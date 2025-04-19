document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.querySelector('.chat-messages');
    const settingsPanel = document.querySelector('.settings-panel');
    const textarea = document.querySelector('textarea');
    const sendButton = document.querySelector('.send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearButton = document.querySelector('.btn-clear');
    const newChatButton = document.querySelector('.btn-new');
    const chatInput = document.querySelector('.chat-input');
    const settingsLink = document.querySelector('.settings-link');
    const closeSettingsBtn = document.querySelector('.btn-close-settings');
    const themeOptions = document.querySelectorAll('.theme-option');
    const modelOptions = document.querySelectorAll('.model-option');
    
    let currentChatId = "default";
    let isProcessing = false;
    let currentModel = localStorage.getItem('bearcode-model') || 'gpt-4o-mini';
    let abortController = null;
    
    const API = {
        CHAT: '/api/chat',
        HISTORY: '/api/history',
        CLEAR: '/api/clear',
        NEW: '/api/new',
        GENERATE_IMAGE: '/api/generate-image'
    };
    
    function openSettings() {
        chatMessages.classList.add('hidden');
        settingsPanel.classList.remove('hidden');
        chatInput.classList.add('disabled');
        
        const currentTheme = localStorage.getItem('bearcode-theme') || 'system';
        themeOptions.forEach(option => {
            if (option.dataset.theme === currentTheme) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        
        modelOptions.forEach(option => {
            if (option.dataset.model === currentModel) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }
    
    function closeSettings() {
        settingsPanel.classList.add('hidden');
        chatMessages.classList.remove('hidden');
        chatInput.classList.remove('disabled');
    }
    
    function toggleSendButtonState(isStopping) {
        if (isStopping) {
            sendButton.classList.add('stopping');
            sendButton.setAttribute('aria-label', 'Stop generation');
        } else {
            sendButton.classList.remove('stopping');
            sendButton.setAttribute('aria-label', 'Send message');
            abortController = null;
        }
    }
    
    function setInputState(disabled) {
        if (disabled) {
            textarea.setAttribute('disabled', 'disabled');
            textarea.placeholder = "Wait for the response...";
        } else {
            textarea.removeAttribute('disabled');
            
            if (currentModel === 'flux') {
                textarea.placeholder = "Describe the image you want to generate...";
            } else {
                textarea.placeholder = "Ask bearCode something...";
            }
        }
    }

    function stopGeneration() {
        if (abortController) {
            abortController.abort();
            toggleSendButtonState(false);
            setInputState(false);
            isProcessing = false;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar';
            avatarDiv.innerHTML = `
                <svg class="bear-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor" d="M256 128c-39.8 0-74.2 23.3-90.5 56.9-8.6-14.7-24.4-24.9-42.8-24.9-27.5 0-49.7 22.2-49.7 49.7v64c0 25.6 19.2 46.6 44.1 49.3 8.2 21.1 22.8 38.1 41.5 48.8c0 0 0 0 0 0c16.6 9.8 34.2 15.2 52.6 15.2s36-5.4 52.6-15.2c0 0 0 0 0 0c18.7-10.7 33.3-27.7 41.5-48.8c24.9-2.7 44.1-23.7 44.1-49.3v-64c0-27.5-22.2-49.7-49.7-49.7c-18.4 0-34.2 10.2-42.8 24.9C330.2 151.3 295.8 128 256 128zm-43.5 96c17.8 0 32-14.2 32-32c0-2.7-2.2-4.9-4.9-4.9s-4.9 2.2-4.9 4.9c0 12.3-9.9 22.2-22.2 22.2c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9zm87 0c17.8 0 32-14.2 32-32c0-2.7-2.2-4.9-4.9-4.9s-4.9 2.2-4.9 4.9c0 12.3-9.9 22.2-22.2 22.2c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9zM305.7 308c-6.2 14.3-16.4 25.9-28.9 33.9l0 0c-12.3 7.1-25.5 10.7-38.8 10.7s-26.5-3.6-38.8-10.7l0 0c-12.5-8-22.7-19.5-28.9-33.9c-1.8-4.1-6.8-2.9-7.3 1.5c-.5 4.1-.3 8.3 .8 12.5c6.5 24.7 24 45 47 56.3s51.6 11.3 74.6 0s40.5-31.6 47-56.3c1.1-4.3 1.2-8.5 .8-12.5c-.5-4.4-5.5-5.6-7.3-1.5h-.1zM64 128a64 64 0 1 0 0-128 64 64 0 1 0 0 128zm384 0a64 64 0 1 0 0-128 64 64 0 1 0 0 128z"/>
                </svg>
            `;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.innerHTML = '<p>Generation stopped by user.</p>';
            
            messageDiv.appendChild(avatarDiv);
            messageDiv.appendChild(contentDiv);
            
            if (typingIndicator.parentNode === chatMessages) {
                chatMessages.removeChild(typingIndicator);
            }
            
            chatMessages.appendChild(messageDiv);
            
            chatMessages.appendChild(typingIndicator);
            typingIndicator.classList.add('hidden');
            
            smoothScrollToBottom();
        }
    }
    
    function setModel(model) {
        modelOptions.forEach(option => option.classList.remove('active'));
        
        document.querySelector(`.model-option[data-model="${model}"]`).classList.add('active');
        
        currentModel = model;
        localStorage.setItem('bearcode-model', model);
        
        if (model === 'flux') {
            textarea.placeholder = "Describe the image you want to generate...";
        } else {
            textarea.placeholder = "Ask bearCode something...";
        }
    }
    
    function setTheme(theme) {
        themeOptions.forEach(option => option.classList.remove('active'));
        
        document.querySelector(`.theme-option[data-theme="${theme}"]`).classList.add('active');
        
        if (theme === 'system') {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-theme');
                switchCodeTheme('dark');
            } else {
                document.body.classList.remove('dark-theme');
                switchCodeTheme('light');
            }
            localStorage.setItem('bearcode-theme', 'system');
        } else if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            localStorage.setItem('bearcode-theme', 'dark');
            switchCodeTheme('dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('bearcode-theme', 'light');
            switchCodeTheme('light');
        }
    }
    
    function initTheme() {
        const savedTheme = localStorage.getItem('bearcode-theme') || 'system';
        
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            switchCodeTheme('dark');
        } else if (savedTheme === 'system') {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-theme');
                switchCodeTheme('dark');
            }
        }
        
        if (savedTheme === 'system') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                if (localStorage.getItem('bearcode-theme') === 'system') {
                    if (e.matches) {
                        document.body.classList.add('dark-theme');
                        switchCodeTheme('dark');
                    } else {
                        document.body.classList.remove('dark-theme');
                        switchCodeTheme('light');
                    }
                }
            });
        }
    }
    
    function initModel() {
        if (currentModel === 'flux') {
            textarea.placeholder = "Describe the image you want to generate...";
        }
    }
    
    function switchCodeTheme(theme) {
        const codeThemeLink = document.getElementById('code-theme');
        if (theme === 'dark') {
            codeThemeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
        } else {
            codeThemeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css';
        }
        
        document.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
    }
    
    function createImageLoadingElement() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'image-loading';
        
        const spinner = document.createElement('div');
        spinner.className = 'image-loading-spinner';
        
        const loadingText = document.createElement('div');
        loadingText.className = 'image-loading-text';
        loadingText.textContent = 'Generating your image...';
        
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(loadingText);
        
        return loadingDiv;
    }
    
    async function generateImage(prompt) {
        typingIndicator.classList.add('hidden');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = `
            <svg class="bear-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M256 128c-39.8 0-74.2 23.3-90.5 56.9-8.6-14.7-24.4-24.9-42.8-24.9-27.5 0-49.7 22.2-49.7 49.7v64c0 25.6 19.2 46.6 44.1 49.3 8.2 21.1 22.8 38.1 41.5 48.8c0 0 0 0 0 0c16.6 9.8 34.2 15.2 52.6 15.2s36-5.4 52.6-15.2c0 0 0 0 0 0c18.7-10.7 33.3-27.7 41.5-48.8c24.9-2.7 44.1-23.7 44.1-49.3v-64c0-27.5-22.2-49.7-49.7-49.7c-18.4 0-34.2 10.2-42.8 24.9C330.2 151.3 295.8 128 256 128zm-43.5 96c17.8 0 32-14.2 32-32c0-2.7-2.2-4.9-4.9-4.9s-4.9 2.2-4.9 4.9c0 12.3-9.9 22.2-22.2 22.2c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9zm87 0c17.8 0 32-14.2 32-32c0-2.7-2.2-4.9-4.9-4.9s-4.9 2.2-4.9 4.9c0 12.3-9.9 22.2-22.2 22.2c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9zM305.7 308c-6.2 14.3-16.4 25.9-28.9 33.9l0 0c-12.3 7.1-25.5 10.7-38.8 10.7s-26.5-3.6-38.8-10.7l0 0c-12.5-8-22.7-19.5-28.9-33.9c-1.8-4.1-6.8-2.9-7.3 1.5c-.5 4.1-.3 8.3 .8 12.5c6.5 24.7 24 45 47 56.3s51.6 11.3 74.6 0s40.5-31.6 47-56.3c1.1-4.3 1.2-8.5 .8-12.5c-.5-4.4-5.5-5.6-7.3-1.5h-.1zM64 128a64 64 0 1 0 0-128 64 64 0 1 0 0 128zm384 0a64 64 0 1 0 0-128 64 64 0 1 0 0 128z"/>
            </svg>
        `;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'generated-image-container';
        
        const loadingElement = createImageLoadingElement();
        
        contentDiv.innerHTML = `<p>I'm generating an image based on: "${prompt}"</p>`;
        contentDiv.appendChild(imageContainer);
        imageContainer.appendChild(loadingElement);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        if (typingIndicator.parentNode === chatMessages) {
            chatMessages.removeChild(typingIndicator);
        }
        chatMessages.appendChild(messageDiv);
        
        smoothScrollToBottom();
        
        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: currentChatId,
                    prompt: prompt,
                    model: 'flux'
                }),
                signal: abortController.signal
            });
            
            const data = await response.json();
            
            imageContainer.removeChild(loadingElement);
            
            if (data.url) {
                const img = document.createElement('img');
                img.className = 'generated-image';
                img.src = data.url;
                img.alt = prompt;
                img.addEventListener('load', () => {
                    smoothScrollToBottom();
                });
                
                imageContainer.appendChild(img);
            } else if (data.error) {
                contentDiv.innerHTML += `<p class="error-message">Error generating image: ${data.error}</p>`;
            }
        } catch (error) {
            if (imageContainer.contains(loadingElement)) {
                imageContainer.removeChild(loadingElement);
            }
            
            if (error.name === 'AbortError') {
                if (messageDiv.parentNode === chatMessages) {
                    chatMessages.removeChild(messageDiv);
                }
            } else {
                contentDiv.innerHTML += `<p class="error-message">Failed to generate image. Please try again later.</p>`;
                console.error('Image generation error:', error);
            }
        }
        
        return messageDiv;
    }
    
    async function initChat() {
        try {
            const response = await fetch(`${API.HISTORY}?chat_id=${currentChatId}`);
            const data = await response.json();
            
            if (data.history) {
                clearChatMessages();
    
                data.history.forEach(msg => {
                    addMessageToChat(msg.role, msg.content);
                });
                
                smoothScrollToBottom();
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    }
    
    function createMessageElement(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (role === 'assistant') {
            avatarDiv.innerHTML = `
                <svg class="bear-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor" d="M256 128c-39.8 0-74.2 23.3-90.5 56.9-8.6-14.7-24.4-24.9-42.8-24.9-27.5 0-49.7 22.2-49.7 49.7v64c0 25.6 19.2 46.6 44.1 49.3 8.2 21.1 22.8 38.1 41.5 48.8c0 0 0 0 0 0c16.6 9.8 34.2 15.2 52.6 15.2s36-5.4 52.6-15.2c0 0 0 0 0 0c18.7-10.7 33.3-27.7 41.5-48.8c24.9-2.7 44.1-23.7 44.1-49.3v-64c0-27.5-22.2-49.7-49.7-49.7c-18.4 0-34.2 10.2-42.8 24.9C330.2 151.3 295.8 128 256 128zm-43.5 96c17.8 0 32-14.2 32-32c0-2.7-2.2-4.9-4.9-4.9s-4.9 2.2-4.9 4.9c0 12.3-9.9 22.2-22.2 22.2c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9zm87 0c17.8 0 32-14.2 32-32c0-2.7-2.2-4.9-4.9-4.9s-4.9 2.2-4.9 4.9c0 12.3-9.9 22.2-22.2 22.2c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9zM305.7 308c-6.2 14.3-16.4 25.9-28.9 33.9l0 0c-12.3 7.1-25.5 10.7-38.8 10.7s-26.5-3.6-38.8-10.7l0 0c-12.5-8-22.7-19.5-28.9-33.9c-1.8-4.1-6.8-2.9-7.3 1.5c-.5 4.1-.3 8.3 .8 12.5c6.5 24.7 24 45 47 56.3s51.6 11.3 74.6 0s40.5-31.6 47-56.3c1.1-4.3 1.2-8.5 .8-12.5c-.5-4.4-5.5-5.6-7.3-1.5h-.1zM64 128a64 64 0 1 0 0-128 64 64 0 1 0 0 128zm384 0a64 64 0 1 0 0-128 64 64 0 1 0 0 128z"/>
                </svg>
            `;
        } else {
            avatarDiv.innerHTML = '<i class="fa-solid fa-user"></i>';
        }
        
        contentDiv.innerHTML = formatMessage(content);
        
        if (role === 'assistant') {
            messageDiv.appendChild(avatarDiv);
            messageDiv.appendChild(contentDiv);
        } else {
            messageDiv.appendChild(contentDiv);
            messageDiv.appendChild(avatarDiv);
        }
        
        return messageDiv;
    }
    
    function addMessageToChat(role, content) {
        const messageElement = createMessageElement(role, content);
        
        if (typingIndicator.parentNode === chatMessages) {
            chatMessages.removeChild(typingIndicator);
        }
        
        chatMessages.appendChild(messageElement);
        
        if (!content.includes("I'm generating an image based on:")) {
            chatMessages.appendChild(typingIndicator);
        }
        
        return messageElement;
    }
    
    function formatMessage(content) {
        if (!content) return '';
        
        try {
            const renderer = new marked.Renderer();
            
            renderer.code = function(code, language) {
                if (!language) language = 'text';
                
                try {
                    const highlightedCode = hljs.highlight(code, {language: language, ignoreIllegals: true}).value;
                    return `<pre><code class="code-block-mobile-friendly hljs language-${language}">${highlightedCode}</code></pre>`;
                } catch (e) {
                    return `<pre><code class="code-block-mobile-friendly">${code}</code></pre>`;
                }
            };
            
            const markedOptions = {
                renderer: renderer,
                highlight: function(code, language) {
                    if (language && hljs.getLanguage(language)) {
                        return hljs.highlight(code, {language: language, ignoreIllegals: true}).value;
                    }
                    return code;
                },
                breaks: true,
                gfm: true
            };
            
            let html = marked.parse(content, markedOptions);
            
            html = DOMPurify.sanitize(html);
            
            return html;
        } catch (error) {
            console.error('Ошибка форматирования сообщения:', error);
            return sanitizeInput(content).replace(/\n/g, '<br>');
        }
    }
    
    async function sendMessage() {
        const message = textarea.value.trim();
        
        if (isProcessing && abortController) {
            stopGeneration();
            return;
        }
        
        if (message !== '' && !isProcessing) {
            isProcessing = true;
            abortController = new AbortController();
            toggleSendButtonState(true);
            setInputState(true);
            
            addMessageToChat('user', message);
            
            textarea.value = '';
            resetTextareaHeight();
            
            smoothScrollToBottom();
            
            try {
                if (currentModel === 'flux') {
                    await generateImage(message);
                } else {
                    typingIndicator.classList.remove('hidden');
                    
                    const response = await fetch(API.CHAT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            chat_id: currentChatId,
                            message: message,
                            model: currentModel
                        }),
                        signal: abortController.signal
                    });
                
                    const data = await response.json();
                
                    typingIndicator.classList.add('hidden');
                
                    if (data.response) {
                        addMessageToChat('assistant', data.response);
                
                        smoothScrollToBottom();
                    } else if (data.error) {
                        console.error('API error:', data.error);
                        addMessageToChat('assistant', `Sorry, I encountered an error: ${data.error}`);
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('Request was aborted');
                    typingIndicator.classList.add('hidden');
                } else {
                    console.error('Failed to send message:', error);
                    typingIndicator.classList.add('hidden');
                    addMessageToChat('assistant', 'Sorry, there was an error connecting to the server. Please try again.');
                }
            } finally {
                isProcessing = false;
                toggleSendButtonState(false);
                setInputState(false);
            }
        }
    }
    
    function clearChatMessages() {
        while (chatMessages.firstChild) {
            chatMessages.removeChild(chatMessages.firstChild);
        }
        
        chatMessages.appendChild(typingIndicator);
        typingIndicator.classList.add('hidden');
    }
    
    async function clearChat() {
        try {
            const response = await fetch(API.CLEAR, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: currentChatId
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                await initChat();
            } else {
                console.error('Failed to clear chat:', data.error);
            }
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    }
    
    async function createNewChat() {
        try {
            const response = await fetch(API.NEW, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.status === 'success' && data.chat_id) {
                currentChatId = data.chat_id;
                
                await initChat();
                
                textarea.focus();
            } else {
                console.error('Failed to create new chat:', data.error);
            }
        } catch (error) {
            console.error('Error creating new chat:', error);
        }
    }
    
    function resetTextareaHeight() {
        textarea.style.height = '60px';
    }
    
    function smoothScrollToBottom() {
        const targetPosition = chatMessages.scrollHeight;
        const startPosition = chatMessages.scrollTop;
        const distance = targetPosition - startPosition;
        const duration = 300;
        let startTime = null;
        
        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const scrollY = easeInOutQuad(timeElapsed, startPosition, distance, duration);
            chatMessages.scrollTop = scrollY;
            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        }
        
        function easeInOutQuad(t, b, c, d) {
            t /= d / 2;
            if (t < 1) return c / 2 * t * t + b;
            t--;
            return -c / 2 * (t * (t - 2) - 1) + b;
        }
        
        requestAnimationFrame(animation);
    }
    
    function sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }
    
    sendButton.addEventListener('click', sendMessage);
    
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey && !isProcessing) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        const newHeight = Math.min(this.scrollHeight, 150);
        this.style.height = newHeight + 'px';
    });
    
    clearButton.addEventListener('click', clearChat);
    newChatButton.addEventListener('click', createNewChat);
    
    window.addEventListener('resize', function() {
        if (textarea.value) {
            textarea.style.height = 'auto';
            const newHeight = Math.min(textarea.scrollHeight, 150);
            textarea.style.height = newHeight + 'px';
        }
    });
    
    settingsLink.addEventListener('click', function(e) {
        e.preventDefault();
        openSettings();
    });
    
    closeSettingsBtn.addEventListener('click', closeSettings);
    
    themeOptions.forEach(option => {
        option.addEventListener('click', function() {
            setTheme(this.dataset.theme);
        });
    });
    
    modelOptions.forEach(option => {
        option.addEventListener('click', function() {
            setModel(this.dataset.model);
        });
    });
    
    initTheme();
    initModel();
    initChat();
    
    setTimeout(() => {
        textarea.focus();
    }, 500);
});