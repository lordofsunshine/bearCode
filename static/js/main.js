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
        gfm: true,
        headerIds: false,
        mangle: false,
        smartLists: true,
        xhtml: false
    });

    async function createNewChat() {
        currentChatId = generateUUID();
        const messagesContainer = document.querySelector('.chat-messages');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h2 id="chat-title">New Chat</h2>
                <p>Hi! I'm a brevoCode.</p>
            </div>
        `;
    }

    function filterUnwantedContent(text) {
        return text.replace(
            /You can get UNLIMITED API Key with just 10 invites! Join https:\/\/discord\.gg\/Ew6JzjA2NR/gi, 
            ''
        ).replace(
            /https:\/\/discord\.gg\/Ew6JzjA2NR/gi, 
            ''
        ).replace(
            /discord\.gg\/Ew6JzjA2NR/gi,
            ''
        ).replace(
            /\/\/discord\.gg\/Ew6JzjA2NR/gi,
            ''
        ).replace(
            /o1, gpt-4o, claude-3\.5-sonnet,[^]*(available for FREE)?[^]*discord\.gg\/Ew6JzjA2NR/gi,
            ''
        ).replace(
            /now available for FREE/gi,
            ''
        ).trim();
    }

    async function generateChatTitle(firstMessage) {
        try {
            const response = await fetch('/generate-title', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: firstMessage })
            });

            if (!response.ok) {
                throw new Error('Failed to generate title');
            }

            const data = await response.json();
            const titleElement = document.getElementById('chat-title');
            if (titleElement && data.title) {
                titleElement.textContent = data.title;
            }
        } catch (error) {
            console.error('Error generating title:', error);
        }
    }

    function addCodeActions(pre, codeBlock, language) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'code-actions';
        
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(codeBlock.textContent);
                copyButton.classList.add('copied');
                copyButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 6L9 17l-5-5"></path>
                    </svg>
                `;
                
                setTimeout(() => {
                    copyButton.classList.remove('copied');
                    copyButton.innerHTML = `
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
        
        const runButton = document.createElement('button');
        runButton.className = 'run-button';
        const supportedLanguages = ['python', 'javascript'];
        const isSupported = supportedLanguages.includes(language.toLowerCase());
        
        if (!isSupported) {
            runButton.classList.add('disabled');
        }
        
        runButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        `;
        
        if (isSupported) {
            runButton.addEventListener('click', async () => {
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
        
        actionsDiv.appendChild(copyButton);
        actionsDiv.appendChild(runButton);
        pre.insertBefore(actionsDiv, pre.firstChild);
    }

    function addMessage(content, isUser = false, sender = isUser ? 'You' : 'brevocode') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        messageDiv.setAttribute('data-sender', sender);
        
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
                        addCodeActions(pre, block, language);
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

    class ToastNotification {
        constructor() {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
            this.queue = [];
            this.isProcessing = false;
        }

        async show(message, type = 'info', duration = 3000) {
            this.queue.push({ message, type, duration });
            if (!this.isProcessing) {
                this.processQueue();
            }
        }

        async processQueue() {
            if (this.queue.length === 0) {
                this.isProcessing = false;
                return;
            }

            this.isProcessing = true;
            const { message, type, duration } = this.queue.shift();

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;

            const icons = {
                success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 6L9 17l-5-5"/>
                         </svg>`,
                error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M15 9l-6 6M9 9l6 6"/>
                        </svg>`,
                info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4M12 8h.01"/>
                       </svg>`,
                warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 18c-.77 1.333.192 3 1.732 3z"/>
                       </svg>`
            };

            toast.innerHTML = `
                ${icons[type]}
                <div class="toast-content">${message}</div>
                <button class="toast-close">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            `;

            this.container.appendChild(toast);

            const close = () => this.hide(toast);
            toast.querySelector('.toast-close').addEventListener('click', close);

            await new Promise(resolve => setTimeout(resolve, duration));
            close();

            this.processQueue();
        }

        hide(toast) {
            toast.classList.add('removing');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }
    }

    const toast = new ToastNotification();

    class FileStorage {
        constructor() {
            this.files = new Map();
            this.maxFiles = 5;
            this.maxFileSize = 100000; 
            this.maxTotalSize = 500000;
            this.expirationTime = 30 * 60 * 1000;
        }

        getTotalSize() {
            let total = 0;
            for (const [_, data] of this.files.entries()) {
                total += data.content.length;
            }
            return total;
        }

        addFile(fileName, content) {
            if (content.length > this.maxFileSize) {
                toast.show(`File "${fileName}" is too large (max 100KB)`, 'error');
                return false;
            }

            const newTotalSize = this.getTotalSize() + content.length;
            if (newTotalSize > this.maxTotalSize) {
                toast.show('Total files size exceeds limit (max 500KB)', 'error');
                return false;
            }

            if (this.files.size >= this.maxFiles) {
                const oldestFile = [...this.files.entries()]
                    .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0];
                if (oldestFile) {
                    this.files.delete(oldestFile[0]);
                    toast.show(`File "${oldestFile[0]}" was removed due to limit`, 'info');
                }
            }

            this.files.set(fileName, {
                content: this.truncateContent(content),
                timestamp: Date.now()
            });
            return true;
        }

        truncateContent(content) {
            const maxLines = 100; 
            const lines = content.split('\n');
            if (lines.length > maxLines) {
                const truncated = lines.slice(0, maxLines).join('\n');
                return truncated + '\n... (file truncated, showing first 100 lines)';
            }
            return content;
        }

        removeFile(fileName) {
            this.files.delete(fileName);
        }

        getFileContent(fileName) {
            return this.files.get(fileName)?.content;
        }

        getAllFiles() {
            const now = Date.now();
            for (const [fileName, data] of this.files.entries()) {
                if (now - data.timestamp > this.expirationTime) {
                    this.files.delete(fileName);
                    toast.show(`File "${fileName}" was removed from context due to expiration`, 'info');
                }
            }
            return this.files;
        }

        getFilesContext() {
            if (this.files.size === 0) {
                return null;
            }

            let context = 'Files context:\n\n';
            for (const [fileName, data] of this.files.entries()) {
                context += `File: ${fileName}\n\`\`\`\n${data.content}\n\`\`\`\n\n`;
            }
            return context;
        }

        clear() {
            this.files.clear();
        }
    }

    const fileStorage = new FileStorage();

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    const RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY = 2000;
    const CONNECTION_CHECK_INTERVAL = 5000;

    let isConnected = true;
    let reconnectAttempts = 0;
    let lastMessageTimestamp = null;
    let pendingMessage = null;

    async function handleFileUpload(file) {
        const maxSize = 5 * 1024 * 1024;
        const allowedTypes = [
            'text/plain',
            'text/markdown',
            'text/csv',
            'application/json',
            'text/javascript',
            'text/html',
            'text/css',
            'application/xml',
            'text/xml',
            'application/python',
            'text/x-python'
        ];

        if (file.size > maxSize) {
            toast.show(`File "${file.name}" exceeds 5MB limit`, 'error');
            return;
        }

        if (!allowedTypes.includes(file.type) && !file.name.endsWith('.py')) {
            toast.show(`File "${file.name}" has unsupported type`, 'error');
            return;
        }

        try {
            const existingFile = document.querySelector(`.especially_relevant_code_snippet[data-path="${file.name}"]`);
            if (existingFile) {
                existingFile.remove();
            }

            const content = await readFileContent(file);
            const fileExtension = file.name.split('.').pop().toLowerCase();
            const language = fileExtension === 'py' ? 'python' : 
                            fileExtension === 'js' ? 'javascript' :
                            fileExtension === 'html' ? 'html' :
                            fileExtension === 'css' ? 'css' :
                            fileExtension === 'json' ? 'json' :
                            'plaintext';

            const codeElement = document.createElement('div');
            codeElement.className = 'especially_relevant_code_snippet';
            codeElement.style.display = 'none';
            codeElement.setAttribute('data-path', file.name);
            codeElement.setAttribute('data-language', language);
            codeElement.textContent = content;
            
            document.querySelectorAll(`.especially_relevant_code_snippet[data-path="${file.name}"]`)
                .forEach(el => el.remove());
            
            document.body.appendChild(codeElement);

            toast.show(`File "${file.name}" uploaded successfully`, 'success', 2000);
            
            const filesCount = document.querySelectorAll('.especially_relevant_code_snippet').length;
            document.querySelector('.clear-files-button').style.display = filesCount > 0 ? 'block' : 'none';
            
            userInput.focus();
        } catch (error) {
            toast.show(`Error reading "${file.name}": ${error.message}`, 'error');
        }
    }

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    resolve(content);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    async function sendMessageWithRetry(message, retryCount = 0) {
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    chatId: currentChatId
                }),
                signal: controller?.signal
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${errorText || response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            if (!data.response) {
                throw new Error('Empty response from server');
            }
            
            addMessage(data.response, false);
            updateApiStatus(true);
        } catch (error) {
            if (error.name === 'AbortError') {
                toast.show('Response generation stopped', 'info');
                return;
            }

            if (retryCount < MAX_RETRIES) {
                toast.show(`Connection error, retrying... (${retryCount + 1}/${MAX_RETRIES})`, 'warning');
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                return sendMessageWithRetry(message, retryCount + 1);
            } else {
                toast.show(`Failed to send message: ${error.message}`, 'error');
                updateApiStatus(false);
            }
        }
    }

    async function handleDisconnection() {
        if (reconnectAttempts < RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            toast.show(
                `Connection lost. Reconnecting... (${reconnectAttempts}/${RECONNECT_ATTEMPTS})`,
                'warning'
            );
            await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
            await checkConnection();
        } else {
            toast.show('Connection lost. Please refresh the page', 'error');
        }
    }

    async function checkConnection() {
        try {
            const response = await fetch('/health-check', {
                method: 'GET',
                headers: { 
                    'Cache-Control': 'no-cache',
                    'Accept': 'application/json'
                }
            });
            
            const wasDisconnected = !isConnected;
            isConnected = response.ok;
            
            if (isConnected && wasDisconnected) {
                updateApiStatus(true);
                reconnectAttempts = 0;
                if (pendingMessage) {
                    await sendMessageWithRetry(pendingMessage);
                    pendingMessage = null;
                }
            }
        } catch (error) {
            console.error('Connection check error:', error);
            isConnected = false;
            updateApiStatus(false);
            await handleDisconnection();
        }
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        if (!isConnected) {
            pendingMessage = message;
            toast.show('Message will be sent when connection is restored.', 'info');
            return;
        }

        setLoading(true);
        
        const messagesContainer = document.querySelector('.chat-messages');
        const isFirstMessage = !currentChatId;

        if (isFirstMessage) {
            currentChatId = generateUUID();
        }

        addMessage(message, true);
        userInput.value = '';
        userInput.style.height = 'auto';

        if (isFirstMessage) {
            await generateChatTitle(message);
        }

        stopButton.classList.add('visible');
        controller = new AbortController();

        try {
            const snippets = Array.from(document.querySelectorAll('.especially_relevant_code_snippet'))
                .map(snippet => ({
                    path: snippet.getAttribute('data-path'),
                    language: snippet.getAttribute('data-language'),
                    content: snippet.textContent
                }));

            console.log('Sending files:', snippets);

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    chatId: currentChatId,
                    especially_relevant_code_snippet: snippets
                }),
                signal: controller?.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            addMessage(data.response, false);
            updateApiStatus(true);

        } catch (error) {
            console.error('Error sending message:', error);
            toast.show('Failed to send message: ' + error.message, 'error');
        } finally {
            stopButton.classList.remove('visible');
            controller = null;
            setLoading(false);
        }
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
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
            console.error('API status check error:', error);
            updateApiStatus(false);
        }
    }

    setInterval(checkConnection, CONNECTION_CHECK_INTERVAL);
    checkConnection(); 

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

    function closeCodeExecutionPopup() {
        const popup = document.getElementById('codeExecutionPopup');
        popup.style.opacity = '0';
        setTimeout(() => {
            popup.style.display = 'none';
        }, 300);
    }

    document.getElementById('closeExecutionPopup').addEventListener('click', closeCodeExecutionPopup);

    function addFileUploadUI() {
        const inputContainer = document.querySelector('.chat-input-container');
        
        const fileUploadButton = document.createElement('button');
        fileUploadButton.className = 'file-upload-button';
        fileUploadButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            </svg>
        `;
        fileUploadButton.title = 'Upload files for analysis (max 5 files)';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true; 
        fileInput.style.display = 'none';
        fileInput.accept = '.txt,.md,.csv,.json,.js,.html,.css,.xml,.py';

        fileUploadButton.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => handleFileUpload(file));
        });

        const clearFilesButton = document.createElement('button');
        clearFilesButton.className = 'clear-files-button';
        clearFilesButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3-3h6M6 6h12"/>
            </svg>
        `;
        clearFilesButton.title = 'Clear uploaded files';
        clearFilesButton.style.display = 'none';

        clearFilesButton.addEventListener('click', () => {
            fileStorage.clear();
            clearFilesButton.style.display = 'none';
            toast.show('All uploaded files were cleared', 'info');
        });

        inputContainer.insertBefore(clearFilesButton, inputContainer.firstChild);
        inputContainer.insertBefore(fileUploadButton, inputContainer.firstChild);
        inputContainer.appendChild(fileInput);
    }

    addFileUploadUI();
    checkConnection(); 

    const shareButton = document.getElementById('share-chat-button');
    if (shareButton) {
        shareButton.addEventListener('click', async () => {
            try {
                if (!currentChatId) {
                    toast.show('Start a chat before sharing', 'warning');
                    return;
                }

                const overlay = document.createElement('div');
                overlay.className = 'share-overlay';
                
                const popup = document.createElement('div');
                popup.className = 'share-popup';
                
                popup.innerHTML = `
                    <div class="share-popup-header">
                        <h3>Share Chat</h3>
                    </div>
                    <div class="share-url-container">
                        <input type="text" readonly class="share-url-input"/>
                        <button class="copy-link-button">
                            <svg width="16" height="16" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                            </svg>
                            Copy
                        </button>
                    </div>
                `;
                
                overlay.appendChild(popup);
                document.body.appendChild(overlay);
                
                const input = popup.querySelector('.share-url-input');
                await generateShareLink(input);
                
                const copyButton = popup.querySelector('.copy-link-button');
                copyButton.addEventListener('click', () => {
                    input.select();
                    document.execCommand('copy');
                    toast.show('Share link copied to clipboard!', 'success');
                });
                
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        overlay.remove();
                    }
                });
            } catch (error) {
                console.error('Error showing share popup:', error);
                toast.show(error.message || 'Failed to share chat', 'error');
            }
        });
    }

    async function generateShareLink(inputElement) {
        try {
            if (!currentChatId) {
                throw new Error('No active chat to share');
            }

            const response = await fetch('/share-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chatId: currentChatId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate share link');
            }

            const data = await response.json();
            inputElement.value = data.share_url;
        } catch (error) {
            console.error('Share link generation error:', error);
            toast.show(error.message || 'Failed to generate share link', 'error');
            throw error;
        }
    }

    function clearFiles() {
        document.querySelectorAll('.especially_relevant_code_snippet').forEach(snippet => snippet.remove());
        document.querySelector('.clear-files-button').style.display = 'none';
        toast.show('All uploaded files were cleared', 'info');
    }

    document.querySelector('.clear-files-button').addEventListener('click', clearFiles);
}); 