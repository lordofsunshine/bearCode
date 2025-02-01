document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const newChatButton = document.getElementById('new-chat-button');
    const stopButton = document.getElementById('stop-button');
    
    let currentChatId = null;
    let controller = null;

    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true
    });

    function createNewChat() {
        currentChatId = Date.now();
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <h2 id="chat-title">New Chat</h2>
            </div>
        `;
    }

    async function generateChatTitle(message) {
        try {
            const response = await fetch('/generate-title', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });
            const data = await response.json();
            return data.title;
        } catch (error) {
            console.error('Error generating title:', error);
            return 'New Chat';
        }
    }

    function createCopyButton(codeBlock) {
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;

        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(codeBlock.textContent);
                button.classList.add('copied');
                button.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 6L9 17l-5-5"></path>
                    </svg>
                `;
                
                setTimeout(() => {
                    button.classList.remove('copied');
                    button.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    `;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        });

        return button;
    }

    window.closeCodeExecutionPopup = function() {
        const popup = document.getElementById('codeExecutionPopup');
        if (popup) {
            popup.style.opacity = '0';
            popup.style.display = 'none';
            const resultDiv = document.getElementById('executionResult');
            const statusDiv = document.getElementById('executionStatus');
            if (resultDiv) resultDiv.innerHTML = '';
            if (statusDiv) statusDiv.innerHTML = '';
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const popup = document.getElementById('codeExecutionPopup');
        const closeButton = document.getElementById('closeExecutionPopup');
        
        if (closeButton) {
            closeButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.closeCodeExecutionPopup();
            }, true);
        }

        if (popup) {
            popup.addEventListener('click', function(e) {
                if (e.target === popup) {
                    window.closeCodeExecutionPopup();
                }
            }, true);
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && popup && popup.style.display === 'flex') {
                window.closeCodeExecutionPopup();
            }
        }, true);
    });

    function createRunButton(codeBlock, language) {
        const button = document.createElement('button');
        button.className = 'run-button';
        
        const supportedLanguages = ['python', 'javascript'];
        const isSupported = supportedLanguages.includes(language.toLowerCase());
        
        if (!isSupported) {
            button.classList.add('disabled');
        }

        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        `;

        if (isSupported) {
            button.addEventListener('click', async () => {
                const popup = document.getElementById('codeExecutionPopup');
                const resultDiv = document.getElementById('executionResult');
                const statusDiv = document.getElementById('executionStatus');
                const languageBadge = document.getElementById('executionLanguage');
                
                popup.style.display = 'flex';
                popup.style.opacity = '1';
                
                languageBadge.textContent = language;
                
                statusDiv.innerHTML = `
                    <div class="status-indicator running">
                        <div class="spinner"></div>
                        <span>Running ${language} code...</span>
                    </div>
                `;
                resultDiv.textContent = '';

                try {
                    const response = await fetch('/execute-code', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            code: codeBlock.textContent,
                            language: language
                        })
                    });

                    const data = await response.json();
                    
                    if (data.status === 'error') {
                        statusDiv.innerHTML = `
                            <div class="status-indicator error">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                                <span>Execution failed</span>
                            </div>
                        `;
                        resultDiv.innerHTML = `<pre class="error">${data.output}</pre>`;
                    } else {
                        statusDiv.innerHTML = `
                            <div class="status-indicator success">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 6L9 17l-5-5"></path>
                                </svg>
                                <span>Execution successful</span>
                            </div>
                        `;
                        resultDiv.innerHTML = `<pre>${data.output || 'No output'}</pre>`;
                    }
                } catch (err) {
                    statusDiv.innerHTML = `
                        <div class="status-indicator error">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                            <span>Execution error</span>
                        </div>
                    `;
                    resultDiv.innerHTML = `<pre class="error">${err.message}</pre>`;
                }
            });
        }

        return button;
    }

    function generateEncryptionKey() {
        return window.crypto.getRandomValues(new Uint8Array(32))
            .reduce((key, byte) => key + byte.toString(16).padStart(2, '0'), '');
    }

    function addMessage(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (!isUser) {
            const typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator';
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('div');
                dot.className = 'typing-dot';
                typingIndicator.appendChild(dot);
            }
            messageContent.appendChild(typingIndicator);
            
            messageDiv.appendChild(messageContent);
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            setTimeout(() => {
                messageContent.innerHTML = ''; 
                if (content.includes('```')) {
                    messageContent.innerHTML = marked.parse(content);
                    messageContent.querySelectorAll('pre code').forEach((block) => {
                        const language = block.className.replace('language-', '');
                        hljs.highlightBlock(block);
                        const pre = block.parentElement;
                        pre.appendChild(createCopyButton(block));
                        pre.appendChild(createRunButton(block, language));
                    });
                } else {
                    messageContent.innerHTML = marked.parse(content);
                }
                messageContent.style.opacity = '0';
                messageContent.style.animation = 'fadeIn 0.5s ease forwards';
            }, 1500); 
        } else {
            messageContent.innerHTML = marked.parse(content);
            messageDiv.appendChild(messageContent);
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    const loadingIndicator = document.querySelector('.loading-indicator');
    const apiStatus = document.querySelector('.api-status');
    const apiStatusText = apiStatus.querySelector('.status-text');

    function setLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.classList.add('active');
            loadingIndicator.querySelector('.loading-text').textContent = 'Processing';
        } else {
            loadingIndicator.classList.remove('active');
            loadingIndicator.querySelector('.loading-text').textContent = 'Ready';
        }
    }

    function updateApiStatus(isOnline) {
        if (isOnline) {
            apiStatus.classList.remove('offline');
            apiStatusText.textContent = 'API Online';
        } else {
            apiStatus.classList.add('offline');
            apiStatusText.textContent = 'API Offline';
        }
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        setLoading(true);

        if (!currentChatId) {
            createNewChat();
            const title = await generateChatTitle(message);
            document.getElementById('chat-title').textContent = title;
        }

        addMessage(message, true);
        userInput.value = '';
        userInput.style.height = 'auto';

        stopButton.classList.add('visible');
        controller = new AbortController();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    message,
                    chatId: currentChatId 
                }),
                signal: controller.signal
            });

            const data = await response.json();
            if (data.error) {
                addMessage('Error: ' + data.error);
            } else {
                addMessage(data.response);
            }
            updateApiStatus(true);
        } catch (error) {
            if (error.name === 'AbortError') {
                addMessage('Response was stopped');
            } else {
                addMessage('Error sending message');
            }
            updateApiStatus(false);
        } finally {
            stopButton.classList.remove('visible');
            controller = null;
            setLoading(false);
        }
    }

    async function checkApiStatus() {
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: 'ping' })
            });
            updateApiStatus(response.ok);
        } catch (error) {
            updateApiStatus(false);
        }
    }

    setInterval(checkApiStatus, 30000);
    checkApiStatus(); 

    newChatButton.addEventListener('click', createNewChat);
    
    stopButton.addEventListener('click', () => {
        if (controller) {
            controller.abort();
            controller = null;
        }
    });

    sendButton.addEventListener('click', sendMessage);

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });
}); 