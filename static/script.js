const chatIdPrefix = "bearcode";

const state = {
    chatId: null,
    sessionId: getSessionId(),
    isSending: false,
    abortController: null,
};

const elements = {
    messages: document.getElementById("messages"),
    form: document.getElementById("chat-form"),
    input: document.getElementById("message-input"),
    sendButton: document.getElementById("send-button"),
    typing: document.getElementById("typing-indicator"),
    newChat: document.getElementById("new-chat"),
    clearChat: document.getElementById("clear-chat"),
    chatList: document.getElementById("chat-list"),
    chatTitle: document.getElementById("chat-title"),
};

function getSessionId() {
    const key = `${chatIdPrefix}-session-id`;
    const existing = localStorage.getItem(key);

    if (existing) {
        return existing;
    }

    const randomId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const sessionId = `session_${Date.now()}_${randomId}`;
    localStorage.setItem(key, sessionId);
    return sessionId;
}

function headers() {
    return {
        "Content-Type": "application/json",
        "X-User-Session-ID": state.sessionId,
    };
}

function formatMessage(content) {
    if (!content) {
        return "";
    }

    if (!window.marked || !window.DOMPurify) {
        const paragraph = document.createElement("p");
        paragraph.textContent = content;
        return paragraph.outerHTML;
    }

    marked.setOptions({
        breaks: true,
        gfm: true,
    });

    return DOMPurify.sanitize(marked.parse(content));
}

function messageNode(role, content, elapsedSeconds) {
    const message = document.createElement("article");
    message.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "You" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = formatMessage(content);

    if (role === "assistant" && Number.isFinite(elapsedSeconds)) {
        bubble.appendChild(responseTimeNode(elapsedSeconds));
    }

    message.append(avatar, bubble);
    return message;
}

function addMessage(role, content, elapsedSeconds) {
    const node = messageNode(role, content, elapsedSeconds);
    elements.typing.before(node);
    scrollToBottom();
    return node;
}

function responseTimeNode(elapsedSeconds) {
    const node = document.createElement("small");
    node.className = "response-time";
    node.textContent = `Completed in ${formatDuration(elapsedSeconds)}`;
    return node;
}

function formatDuration(value) {
    if (value < 1) {
        return `${Math.max(0.1, value).toFixed(1)}s`;
    }

    return `${value.toFixed(value < 10 ? 1 : 0)}s`;
}

async function addTypedMessage(content, elapsedSeconds) {
    const node = messageNode("assistant", "");
    const bubble = node.querySelector(".bubble");
    elements.typing.before(node);
    bubble.classList.add("typing-output");

    let current = "";
    const characters = Array.from(content);
    const chunkSize = content.length > 2400 ? 24 : content.length > 900 ? 14 : 7;

    for (let index = 0; index < characters.length; index += chunkSize) {
        current += characters.slice(index, index + chunkSize).join("");
        bubble.textContent = current;
        scrollToBottom();
        await wait(16);
    }

    bubble.classList.remove("typing-output");
    bubble.innerHTML = formatMessage(content);
    if (Number.isFinite(elapsedSeconds)) {
        bubble.appendChild(responseTimeNode(elapsedSeconds));
    }
    scrollToBottom();
    return node;
}

function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setTyping(isVisible) {
    elements.typing.classList.toggle("hidden", !isVisible);
    scrollToBottom();
}

function setSending(isSending) {
    state.isSending = isSending;
    elements.input.disabled = isSending;
    elements.clearChat.disabled = isSending;
    elements.newChat.disabled = isSending;
    elements.sendButton.classList.toggle("is-loading", isSending);
    elements.sendButton.setAttribute("aria-label", isSending ? "Waiting for response" : "Send message");
}

function showError(message) {
    addMessage("assistant", message || "Something went wrong. Please try again.");
}

function clearMessages() {
    elements.messages.replaceChildren(elements.typing);
    elements.typing.classList.add("hidden");
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        elements.messages.scrollTop = elements.messages.scrollHeight;
    });
}

function resizeInput() {
    elements.input.style.height = "auto";
    const nextHeight = Math.min(elements.input.scrollHeight, 180);
    elements.input.style.height = `${nextHeight}px`;
    elements.input.style.overflowY = elements.input.scrollHeight > 180 ? "auto" : "hidden";
}

function renderChats(chats) {
    elements.chatList.replaceChildren();

    if (!chats || chats.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-history";
        empty.textContent = "Your recent chats will appear here.";
        elements.chatList.appendChild(empty);
        return;
    }

    for (const chat of chats) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-history-item";
        button.classList.toggle("active", chat.id === state.chatId);
        button.dataset.chatId = chat.id;

        const title = document.createElement("strong");
        title.textContent = chat.title || "New conversation";

        const time = document.createElement("small");
        time.textContent = formatDate(chat.updated_at);

        button.append(title, time);
        button.addEventListener("click", () => loadHistory(chat.id));
        elements.chatList.appendChild(button);
    }
}

function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Recent";
    }

    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

async function loadChats() {
    try {
        const response = await fetch("/api/chats", { headers: headers() });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        state.chatId = state.chatId || data.active_chat_id;
        renderChats(data.chats);
    } catch {
        showError("Could not load your chats.");
    }
}

async function refreshChatMetadata() {
    try {
        const response = await fetch("/api/chats", { headers: headers() });
        const data = await response.json();

        if (!response.ok) {
            return;
        }

        renderChats(data.chats);
        const activeChat = (data.chats || []).find((chat) => chat.id === state.chatId);
        if (activeChat) {
            animateTitle(activeChat.title || "New conversation");
        }
    } catch {
    }
}

async function pollChatMetadata(previousTitle) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        await wait(900);

        try {
            const response = await fetch("/api/chats", { headers: headers() });
            const data = await response.json();

            if (!response.ok) {
                continue;
            }

            renderChats(data.chats);
            const activeChat = (data.chats || []).find((chat) => chat.id === state.chatId);
            const nextTitle = activeChat?.title || "New conversation";

            if (activeChat && nextTitle !== previousTitle) {
                animateTitle(nextTitle);
                return;
            }
        } catch {
        }
    }
}

async function animateTitle(title) {
    if (!title || elements.chatTitle.textContent === title) {
        return;
    }

    elements.chatTitle.textContent = "";
    const characters = Array.from(title);

    for (let index = 0; index < characters.length; index += 1) {
        elements.chatTitle.textContent += characters[index];
        await wait(24);
    }
}

async function loadHistory(chatId) {
    try {
        const url = chatId ? `/api/history?chat_id=${encodeURIComponent(chatId)}` : "/api/history";
        const response = await fetch(url, { headers: headers() });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        state.chatId = data.chat.id;
        elements.chatTitle.textContent = data.chat.title || "New conversation";
        clearMessages();

        for (const item of data.chat.messages || []) {
            addMessage(item.role, item.content, item.elapsed_seconds);
        }

        renderChats(data.chats);
    } catch {
        showError("Could not load this conversation.");
    }
}

async function sendMessage(message) {
    setSending(true);
    setTyping(true);
    state.abortController = new AbortController();

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: headers(),
            signal: state.abortController.signal,
            body: JSON.stringify({
                chat_id: state.chatId,
                message,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "bearCode could not answer right now.");
        }

        setTyping(false);
        const previousTitle = elements.chatTitle.textContent;
        await addTypedMessage(data.response, data.elapsed_seconds);
        state.chatId = data.chat.id;
        animateTitle(data.chat.title || "New conversation");
        renderChats(data.chats);
        pollChatMetadata(previousTitle);
    } catch (error) {
        setTyping(false);

        if (error.name !== "AbortError") {
            showError(error.message);
        }
    } finally {
        state.abortController = null;
        setSending(false);
        elements.input.focus();
    }
}

async function clearChat() {
    try {
        const response = await fetch("/api/clear", {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ chat_id: state.chatId }),
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        state.chatId = data.chat.id;
        elements.chatTitle.textContent = data.chat.title || "New conversation";
        clearMessages();
        for (const item of data.chat.messages || []) {
            addMessage(item.role, item.content, item.elapsed_seconds);
        }
        renderChats(data.chats);
    } catch (error) {
        showError(error.message);
    }
}

async function newChat() {
    try {
        const response = await fetch("/api/new", {
            method: "POST",
            headers: headers(),
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        state.chatId = data.chat.id;
        elements.chatTitle.textContent = data.chat.title || "New conversation";
        clearMessages();
        for (const item of data.chat.messages || []) {
            addMessage(item.role, item.content, item.elapsed_seconds);
        }
        renderChats(data.chats);
    } catch (error) {
        showError(error.message);
    }
}

elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.isSending) {
        return;
    }

    const message = elements.input.value.trim();
    if (!message) {
        elements.input.focus();
        return;
    }

    addMessage("user", message);
    elements.input.value = "";
    resizeInput();
    await sendMessage(message);
});

elements.input.addEventListener("input", resizeInput);

elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        elements.form.requestSubmit();
    }
});

elements.clearChat.addEventListener("click", clearChat);
elements.newChat.addEventListener("click", newChat);

loadChats().then(() => loadHistory(state.chatId));
resizeInput();
elements.input.focus();
