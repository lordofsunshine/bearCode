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
    const imageUploadInput = document.getElementById('image-upload');
    const imageUploadButton = document.querySelector('.image-upload-button');
    
    let currentChatId = "default";
    let isProcessing = false;
    let currentModel = localStorage.getItem('bearcode-model') || 'gpt-4o-mini';
    let abortController = null;
    let userSessionId = getUserSessionId();
    let uploadedImage = null;
    
    const API = {
        CHAT: '/api/chat',
        HISTORY: '/api/history',
        CLEAR: '/api/clear',
        NEW: '/api/new',
        GENERATE_IMAGE: '/api/generate-image',
        ANALYZE_IMAGE: '/api/analyze-image'
    };
    
    function getUserSessionId() {
        let sessionId = localStorage.getItem('bearcode-session-id');
        
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('bearcode-session-id', sessionId);
        }
        
        return sessionId;
    }
    
    function openSettings() {
        chatMessages.classList.add('hidden');
        settingsPanel.classList.remove('hidden');
        chatInput.classList.add('disabled');
        
        const currentTheme = localStorage.getItem('bearcode-theme') || 'light';
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
            document.body.classList.add('flux-model');
        } else {
            textarea.placeholder = "Ask bearCode something...";
            document.body.classList.remove('flux-model');
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
        const savedTheme = localStorage.getItem('bearcode-theme') || 'light';
        
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
            document.body.classList.add('flux-model');
        } else {
            document.body.classList.remove('flux-model');
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
                    'Content-Type': 'application/json',
                    'X-User-Session-ID': userSessionId
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
            const response = await fetch(`${API.HISTORY}?chat_id=${currentChatId}`, {
                headers: {
                    'X-User-Session-ID': userSessionId
                }
            });
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
            avatarDiv.innerHTML = `
               <svg class="user-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                   <path fill="currentColor" d="M5 5a5 5 0 0 1 10 0v2A5 5 0 0 1 5 7zM0 16.68A19.9 19.9 0 0 1 10 14c3.64 0 7.06.97 10 2.68V20H0z"/>
               </svg>            `;
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
            
            renderer.image = function(href, title, text) {
                return `<img src="${href}" alt="${text}" class="user-message-image" ${title ? `title="${title}"` : ''}>`;
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
            console.error('Error formatting message:', error);
            return sanitizeInput(content).replace(/\n/g, '<br>');
        }
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!isValidImageFile(file)) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImage = {
                file: file,
                base64Data: e.target.result,
                type: file.type
            };
            
            displayImagePreview(e.target.result);
        };
        
        reader.readAsDataURL(file); 
    }

    function isValidImageFile(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a valid image file (JPEG, PNG, GIF, or WEBP)');
            return false;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return false;
        }
        
        return true;
    }

    function displayImagePreview(imageData) {
        const existingPreview = chatInput.querySelector('.uploaded-image-preview');
        if (existingPreview) {
            chatInput.removeChild(existingPreview);
        }
        
        const previewContainer = document.createElement('div');
        previewContainer.className = 'uploaded-image-preview';
        
        const img = document.createElement('img');
        img.src = imageData;
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-image-button';
        removeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeButton.onclick = removeUploadedImage;
        
        previewContainer.appendChild(img);
        previewContainer.appendChild(removeButton);
        
        chatInput.insertBefore(previewContainer, textarea);
        
        textarea.placeholder = "Add a message about this image...";
        
        textarea.style.height = '50px';
        
        const isMobile = window.innerWidth <= 600;
        if (isMobile) {
            textarea.style.width = 'calc(100% - 70px)';
        }
    }
    
    function removeUploadedImage() {
        const previewContainer = chatInput.querySelector('.uploaded-image-preview');
        if (previewContainer) {
            chatInput.removeChild(previewContainer);
        }
        
        uploadedImage = null;
        imageUploadInput.value = '';
        textarea.placeholder = currentModel === 'flux' ? "Describe the image you want to generate..." : "Ask bearCode something...";
        
        if (window.innerWidth <= 600) {
            textarea.style.width = '';
        }
    }
    
    async function sendImageForAnalysis() {
        if (!uploadedImage || !uploadedImage.base64Data) return;
        
        const imageData = uploadedImage.base64Data;
        const userContent = textarea.value.trim() || 'Analyze this image';
        
        removeUploadedImage();
        textarea.value = '';
        resetTextareaHeight();
        
        isProcessing = true;
        setInputState(true);
        
        const messageDiv = createUserImageMessage(userContent, imageData);
        chatMessages.appendChild(messageDiv);
        
        if (typingIndicator.parentNode === chatMessages) {
            chatMessages.removeChild(typingIndicator);
        }
        chatMessages.appendChild(typingIndicator);
        typingIndicator.classList.remove('hidden');
        
        smoothScrollToBottom();
        
        try {
            abortController = new AbortController();
            const response = await fetch(API.ANALYZE_IMAGE, {
                method: 'POST',
                body: JSON.stringify({
                    image: imageData,
                    chat_id: currentChatId,
                    message: userContent
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Session-ID': userSessionId
                },
                signal: abortController.signal
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to analyze image');
            }
            
            const data = await response.json();
            addMessageToChat('assistant', data.response);
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error analyzing image:', error);
                addMessageToChat('assistant', `Failed to analyze the image: ${error.message}`);
            }
        } finally {
            typingIndicator.classList.add('hidden');
            isProcessing = false;
            setInputState(false);
            abortController = null;
        }
    }
 
    function createUserImageMessage(text, imageData) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = `
            <svg class="user-icon" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M304 128a80 80 0 1 0 -160 0 80 80 0 1 0 160 0zM96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM49.3 464H398.7c-8.9-63.3-63.3-112-129-112H178.3c-65.7 0-120.1 48.7-129 112zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3z"/>
            </svg>
        `;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content user-message-with-image';
        
        const textParagraph = document.createElement('p');
        textParagraph.textContent = text;
        contentDiv.appendChild(textParagraph);
        
        const imageObj = document.createElement('img');
        imageObj.src = imageData;
        imageObj.className = 'user-message-image';
        contentDiv.appendChild(imageObj);
        
        const analysisRequestTag = document.createElement('div');
        analysisRequestTag.className = 'image-analysis-request';
        analysisRequestTag.textContent = 'Image analysis request';
        contentDiv.appendChild(analysisRequestTag);
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(avatarDiv);
        
        return messageDiv;
    }
    
    async function sendMessage() {
        const message = textarea.value.trim();
        
        if (isProcessing) {
            if (abortController) {
                stopGeneration();
            }
            return;
        }
        
        if (!message && !uploadedImage) return;
        
        if (uploadedImage) {
            await sendImageForAnalysis();
            return;
        }
        
        if (message !== '') {
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
                            'Content-Type': 'application/json',
                            'X-User-Session-ID': userSessionId
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
                    'Content-Type': 'application/json',
                    'X-User-Session-ID': userSessionId
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
                    'Content-Type': 'application/json',
                    'X-User-Session-ID': userSessionId
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
    
    textarea.addEventListener('paste', function(e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;
        
        const items = clipboardData.items;
        if (!items) return;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                
                const file = items[i].getAsFile();
                if (!file) continue;
                
                if (!isValidImageFile(file)) return;
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    uploadedImage = {
                        file: file,
                        base64Data: event.target.result,
                        type: file.type
                    };
                    
                    displayImagePreview(event.target.result);
                };
                
                reader.readAsDataURL(file);
                return;
            }
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
    
    imageUploadInput.addEventListener('change', handleImageUpload);
    imageUploadButton.addEventListener('click', () => imageUploadInput.click());
    
    initTheme();
    initModel();
    initChat();
    
    setTimeout(() => {
        textarea.focus();
    }, 500);
});