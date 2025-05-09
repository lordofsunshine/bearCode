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
    const feedbackOverlay = document.querySelector('.feedback-overlay');
    const feedbackDialog = document.querySelector('.feedback-dialog');
    const feedbackTextarea = document.querySelector('.feedback-dialog textarea');
    const cancelFeedbackBtn = document.querySelector('.feedback-dialog-button.cancel');
    const submitFeedbackBtn = document.querySelector('.feedback-dialog-button.submit');
    
    let currentChatId = "default";
    let isProcessing = false;
    let currentModel = localStorage.getItem('bearcode-model') || 'gpt-4o-mini';
    let abortController = null;
    let userSessionId = getUserSessionId();
    let uploadedImages = [];
    let currentImageIndex = 0;
    let currentFeedbackMessage = null;
    
    const API = {
        CHAT: '/api/chat',
        HISTORY: '/api/history',
        CLEAR: '/api/clear',
        NEW: '/api/new',
        GENERATE_IMAGE: '/api/generate-image',
        ANALYZE_IMAGE: '/api/analyze-image',
        FEEDBACK: '/api/feedback'
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
        chatMessages.classList.add('fade-out');
        settingsPanel.classList.remove('hidden');
        settingsPanel.classList.add('fade-in');
        chatInput.classList.add('disabled');
        
        setTimeout(() => {
            chatMessages.classList.add('hidden');
            chatMessages.classList.remove('fade-out');
        }, 300);
        
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
        settingsPanel.classList.add('fade-out');
        
        setTimeout(() => {
            settingsPanel.classList.add('hidden');
            settingsPanel.classList.remove('fade-in', 'fade-out');
            chatMessages.classList.remove('hidden', 'fade-out');
            chatMessages.classList.add('fade-in');
            
            setTimeout(() => {
                chatMessages.classList.remove('fade-in');
            }, 300);
        }, 300);
        
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
            imageUploadButton.setAttribute('disabled', 'disabled');
            imageUploadInput.setAttribute('disabled', 'disabled');
            imageUploadButton.style.opacity = '0.5';
            imageUploadButton.style.cursor = 'not-allowed';
        } else {
            textarea.removeAttribute('disabled');
            imageUploadButton.removeAttribute('disabled');
            imageUploadInput.removeAttribute('disabled');
            imageUploadButton.style.opacity = '1';
            imageUploadButton.style.cursor = 'pointer';
            
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
                    <path fill="currentColor" d="M256 42c-19 0-36.7 7.4-50 19.8C192.7 49.4 175 42 156 42c-48.6 0-88 39.4-88 88 0 30.4 15.4 57.2 38.9 73C106.3 195.5 98 189 88 182c-1.4 7.5-2 15.1-2 23 0 70.7 57.3 128 128 128 11 0 21.8-1.4 32-4v8h-48c-17.7 0-32 14.3-32 32v56c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-24h48v24c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-56c0-17.7-14.3-32-32-32h-48v-8c10.2 2.6 21 4 32 4 70.7 0 128-57.3 128-128 0-7.9-.6-15.5-2-23-10 7-18.3 13.5-18.9 21-23.5-15.8-38.9-42.6-38.9-73 0-48.6-39.4-88-88-88zM156 90a40 40 0 110 80 40 40 0 010-80zm200 0a40 40 0 110 80 40 40 0 010-80zM196 192a16 16 0 100 32 16 16 0 000-32zm120 0a16 16 0 100 32 16 16 0 000-32zm-120 80h120s-20 32-60 32-60-32-60-32z"/>
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
            
            removeAllImages();
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
                <path fill="currentColor" d="M256 42c-19 0-36.7 7.4-50 19.8C192.7 49.4 175 42 156 42c-48.6 0-88 39.4-88 88 0 30.4 15.4 57.2 38.9 73C106.3 195.5 98 189 88 182c-1.4 7.5-2 15.1-2 23 0 70.7 57.3 128 128 128 11 0 21.8-1.4 32-4v8h-48c-17.7 0-32 14.3-32 32v56c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-24h48v24c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-56c0-17.7-14.3-32-32-32h-48v-8c10.2 2.6 21 4 32 4 70.7 0 128-57.3 128-128 0-7.9-.6-15.5-2-23-10 7-18.3 13.5-18.9 21-23.5-15.8-38.9-42.6-38.9-73 0-48.6-39.4-88-88-88zM156 90a40 40 0 110 80 40 40 0 010-80zm200 0a40 40 0 110 80 40 40 0 010-80zM196 192a16 16 0 100 32 16 16 0 000-32zm120 0a16 16 0 100 32 16 16 0 000-32zm-120 80h120s-20 32-60 32-60-32-60-32z"/>
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
        
        if (role === 'assistant') {
            avatarDiv.innerHTML = `
                <svg class="bear-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor" d="M256 42c-19 0-36.7 7.4-50 19.8C192.7 49.4 175 42 156 42c-48.6 0-88 39.4-88 88 0 30.4 15.4 57.2 38.9 73C106.3 195.5 98 189 88 182c-1.4 7.5-2 15.1-2 23 0 70.7 57.3 128 128 128 11 0 21.8-1.4 32-4v8h-48c-17.7 0-32 14.3-32 32v56c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-24h48v24c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-56c0-17.7-14.3-32-32-32h-48v-8c10.2 2.6 21 4 32 4 70.7 0 128-57.3 128-128 0-7.9-.6-15.5-2-23-10 7-18.3 13.5-18.9 21-23.5-15.8-38.9-42.6-38.9-73 0-48.6-39.4-88-88-88zM156 90a40 40 0 110 80 40 40 0 010-80zm200 0a40 40 0 110 80 40 40 0 010-80zM196 192a16 16 0 100 32 16 16 0 000-32zm120 0a16 16 0 100 32 16 16 0 000-32zm-120 80h120s-20 32-60 32-60-32-60-32z"/>
                </svg>
            `;
        } else {
            avatarDiv.innerHTML = '<i class="fas fa-user user-icon"></i>';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = formatMessage(content);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        return messageDiv;
    }
    
    function addMessageToChat(role, content) {
        const messageElement = createMessageElement(role, content);
        
        if (typingIndicator.parentNode === chatMessages) {
            chatMessages.removeChild(typingIndicator);
        }
        
        chatMessages.appendChild(messageElement);
        
        if (role === 'assistant' && !content.includes("Hello! I'm bearCode, your AI coding assistant. How can I help you today?")) {
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'message-feedback';
            
            feedbackDiv.innerHTML = `
                <button class="feedback-button positive" aria-label="This response was helpful">
                    <i class="fas fa-thumbs-up"></i>
                </button>
                <button class="feedback-button negative" aria-label="This response was not helpful">
                    <i class="fas fa-thumbs-down"></i>
                </button>
                <button class="feedback-button regenerate" aria-label="Regenerate response">
                    <i class="fas fa-arrows-rotate"></i>
                </button>
            `;
            
            chatMessages.appendChild(feedbackDiv);
            
            const likeButton = feedbackDiv.querySelector('.feedback-button.positive');
            const dislikeButton = feedbackDiv.querySelector('.feedback-button.negative');
            const regenerateButton = feedbackDiv.querySelector('.feedback-button.regenerate');
            
            likeButton.addEventListener('click', () => handleFeedback(messageElement, feedbackDiv, content, 'positive'));
            dislikeButton.addEventListener('click', () => openFeedbackDialog(messageElement, feedbackDiv, content));
            regenerateButton.addEventListener('click', () => regenerateResponse(content));
        }
        
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
        if (currentModel === 'flux') {
            imageUploadInput.value = '';
            return;
        }
        
        const file = event.target.files[0];
        if (!file) return;
        
        if (!isValidImageFile(file)) return;

        if (uploadedImages.length >= 3) {
            alert('You can upload a maximum of 3 images. Please remove an image first.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const newImage = {
                file: file,
                base64Data: e.target.result,
                type: file.type
            };
            
            uploadedImages.push(newImage);
            currentImageIndex = uploadedImages.length - 1;
            displayImagePreview();
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

    function displayImagePreview() {
        const existingPreview = chatInput.querySelector('.uploaded-image-preview');
        if (existingPreview) {
            chatInput.removeChild(existingPreview);
        }
        
        if (uploadedImages.length === 0) {
            imageUploadInput.value = '';
            textarea.placeholder = currentModel === 'flux' ? "Describe the image you want to generate..." : "Ask bearCode something...";
            
            if (window.innerWidth <= 600) {
                textarea.style.width = '';
            }
            return;
        }
        
        const previewContainer = document.createElement('div');
        previewContainer.className = 'uploaded-image-preview';
        
        const img = document.createElement('img');
        img.src = uploadedImages[currentImageIndex].base64Data;
        previewContainer.appendChild(img);
        
        if (uploadedImages.length > 1) {
            const counterIndicator = document.createElement('div');
            counterIndicator.className = 'image-counter';
            counterIndicator.textContent = `${currentImageIndex + 1}/${uploadedImages.length}`;
            previewContainer.appendChild(counterIndicator);
            
            const prevButton = document.createElement('button');
            prevButton.className = 'image-nav-button prev-image';
            prevButton.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            prevButton.onclick = function(e) {
                e.stopPropagation();
                navigateImages(-1);
            };
            previewContainer.appendChild(prevButton);
            
            const nextButton = document.createElement('button');
            nextButton.className = 'image-nav-button next-image';
            nextButton.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            nextButton.onclick = function(e) {
                e.stopPropagation();
                navigateImages(1);
            };
            previewContainer.appendChild(nextButton);
        }
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-image-button';
        removeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeButton.onclick = function(e) {
            e.stopPropagation();
            removeCurrentImage();
        };
        previewContainer.appendChild(removeButton);
        
        chatInput.insertBefore(previewContainer, textarea);
        
        textarea.placeholder = "Add a message about this image...";
        textarea.style.height = '50px';
        
        const isMobile = window.innerWidth <= 600;
        if (isMobile) {
            textarea.style.width = 'calc(100% - 70px)';
        }
    }
    
    function navigateImages(direction) {
        if (uploadedImages.length <= 1) return;
        
        currentImageIndex = (currentImageIndex + direction + uploadedImages.length) % uploadedImages.length;
        displayImagePreview();
    }
    
    function removeCurrentImage() {
        uploadedImages.splice(currentImageIndex, 1);
        
        if (currentImageIndex >= uploadedImages.length && uploadedImages.length > 0) {
            currentImageIndex = uploadedImages.length - 1;
        }
        
        if (uploadedImages.length > 0) {
            displayImagePreview();
        } else {
            removeAllImages();
        }
    }
    
    function removeAllImages() {
        const previewContainer = chatInput.querySelector('.uploaded-image-preview');
        if (previewContainer) {
            chatInput.removeChild(previewContainer);
        }
        
        uploadedImages = [];
        currentImageIndex = 0;
        imageUploadInput.value = '';
        textarea.placeholder = currentModel === 'flux' ? "Describe the image you want to generate..." : "Ask bearCode something...";
        
        if (window.innerWidth <= 600) {
            textarea.style.width = '';
        }
    }
    
    function removeUploadedImage() {
        removeAllImages();
    }
    
    async function sendImageForAnalysis() {
        if (currentModel === 'flux') {
            removeAllImages();
            return;
        }
        
        if (uploadedImages.length === 0) return;
        
        const userContent = textarea.value.trim() || 'Analyze this image';
        
        const imageDataArray = uploadedImages.map(img => img.base64Data);
        
        const allImages = imageDataArray;
        
        removeAllImages();
        textarea.value = '';
        resetTextareaHeight();
        
        isProcessing = true;
        setInputState(true);
        
        const messageDiv = createUserImageMessage(userContent, imageDataArray);
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
                    images: allImages,
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
 
    function createUserImageMessage(text, imageDataArray) {
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
        
        if (imageDataArray.length > 0) {
            const imageCarousel = document.createElement('div');
            imageCarousel.className = 'user-message-image-carousel';
            
            const imageObj = document.createElement('img');
            imageObj.src = imageDataArray[0];
            imageObj.className = 'user-message-image';
            imageCarousel.appendChild(imageObj);
            
            if (imageDataArray.length > 1) {
                const imageCounter = document.createElement('div');
                imageCounter.className = 'image-counter';
                imageCounter.textContent = `1/${imageDataArray.length}`;
                imageCarousel.appendChild(imageCounter);
                
                let currentIdx = 0;
                
                const prevBtn = document.createElement('button');
                prevBtn.className = 'image-nav-button prev-image';
                prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
                
                const nextBtn = document.createElement('button');
                nextBtn.className = 'image-nav-button next-image';
                nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
                
                prevBtn.onclick = function(e) {
                    e.stopPropagation();
                    currentIdx = (currentIdx - 1 + imageDataArray.length) % imageDataArray.length;
                    imageObj.src = imageDataArray[currentIdx];
                    imageCounter.textContent = `${currentIdx + 1}/${imageDataArray.length}`;
                };
                
                nextBtn.onclick = function(e) {
                    e.stopPropagation();
                    currentIdx = (currentIdx + 1) % imageDataArray.length;
                    imageObj.src = imageDataArray[currentIdx];
                    imageCounter.textContent = `${currentIdx + 1}/${imageDataArray.length}`;
                };
                
                imageCarousel.appendChild(prevBtn);
                imageCarousel.appendChild(nextBtn);
            }
            
            contentDiv.appendChild(imageCarousel);
        }
        
        const analysisRequestTag = document.createElement('div');
        analysisRequestTag.className = 'image-analysis-request';
        analysisRequestTag.textContent = 'Image analysis request';
        contentDiv.appendChild(analysisRequestTag);
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(avatarDiv);
        
        return messageDiv;
    }
    
    async function sendMessage() {
        const messageText = textarea.value.trim();
        
        if (!messageText && uploadedImages.length === 0) return;
        
        addMessageToChat('user', messageText);
        textarea.value = '';
        resetTextareaHeight();
        
        if (uploadedImages.length > 0) {
            await sendImageForAnalysis();
        } else {
            await sendUserMessage(messageText);
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
        if (isProcessing && abortController) {
            abortController.abort();
            isProcessing = false;
            setInputState(false);
            toggleSendButtonState(false);
            if (typingIndicator.parentNode === chatMessages) {
                typingIndicator.classList.add('hidden');
            }
        }
        
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
        if (isProcessing && abortController) {
            abortController.abort();
            isProcessing = false;
            setInputState(false);
            toggleSendButtonState(false);
            if (typingIndicator.parentNode === chatMessages) {
                typingIndicator.classList.add('hidden');
            }
        }
        
        try {
            const response = await fetch(API.NEW, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Session-ID': userSessionId
                },
                body: JSON.stringify({
                    previous_chat_id: currentChatId
                })
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
        
        if (currentModel === 'flux') {
            return;
        }
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                
                const file = items[i].getAsFile();
                if (!file) continue;
                
                if (!isValidImageFile(file)) return;
                
                if (uploadedImages.length >= 3) {
                    alert('You can upload a maximum of 3 images. Please remove an image first.');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    uploadedImages.push({
                        file: file,
                        base64Data: event.target.result,
                        type: file.type
                    });
                    
                    currentImageIndex = uploadedImages.length - 1;
                    displayImagePreview();
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

    function handleFeedback(messageElement, feedbackDiv, content, type) {
        if (type === 'positive') {
            sendFeedback(content, type, "User found this response helpful");
            
            const likeButton = feedbackDiv.querySelector('.feedback-button.positive');
            likeButton.style.color = '#4CAF50';
            likeButton.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                likeButton.style.transform = '';
            }, 500);
        }
    }
    
    function openFeedbackDialog(messageElement, feedbackDiv, content) {
        currentFeedbackMessage = { element: messageElement, feedback: feedbackDiv, content: content };
        feedbackTextarea.value = '';
        feedbackOverlay.classList.add('active');
        feedbackDialog.classList.add('active');
        feedbackTextarea.focus();
    }
    
    function closeFeedbackDialog() {
        feedbackOverlay.classList.remove('active');
        feedbackDialog.classList.remove('active');
        currentFeedbackMessage = null;
    }
    
    function submitNegativeFeedback() {
        if (!currentFeedbackMessage) return;
        
        const feedbackText = feedbackTextarea.value.trim();
        if (!feedbackText) {
            alert('Please provide some feedback to help us improve.');
            return;
        }
        
        sendFeedback(
            currentFeedbackMessage.content, 
            'negative', 
            feedbackText
        );
        
        const dislikeButton = currentFeedbackMessage.feedback.querySelector('.feedback-button.negative');
        dislikeButton.style.color = '#FF9800';
        
        closeFeedbackDialog();
    }
    
    async function sendFeedback(content, type, feedback) {
        try {
            const feedbackData = {
                message_content: content,
                feedback_type: type,
                feedback_text: feedback,
                chat_id: currentChatId,
                timestamp: new Date().toISOString()
            };
            
            console.log('Sending feedback:', feedbackData);
            
            await fetch(API.FEEDBACK, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Session-ID': userSessionId
                },
                body: JSON.stringify(feedbackData)
            });
        } catch (error) {
            console.error('Error sending feedback:', error);
        }
    }
    
    async function regenerateResponse(previousPrompt) {
        if (isProcessing) return;
        
        const userMessages = document.querySelectorAll('.message.user');
        if (userMessages.length === 0) return;
        
        const lastUserMessage = userMessages[userMessages.length - 1];
        const userMessageContent = lastUserMessage.querySelector('.message-content').textContent;
        
        const assistantMessages = document.querySelectorAll('.message.assistant');
        if (assistantMessages.length > 0) {
            const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
            const feedbackElement = lastAssistantMessage.nextElementSibling;
            
            if (feedbackElement && feedbackElement.classList.contains('message-feedback')) {
                chatMessages.removeChild(feedbackElement);
            }
            
            chatMessages.removeChild(lastAssistantMessage);
        }
        
        await sendUserMessage(userMessageContent);
    }
    
    async function sendUserMessage(messageText) {
        if (currentModel === 'flux') {
            await generateImage(messageText);
        } else {
            await sendChatMessage(messageText);
        }
    }

    async function sendChatMessage(message) {
        if (isProcessing) {
            if (abortController) {
                stopGeneration();
            }
            return;
        }

        isProcessing = true;
        abortController = new AbortController();
        toggleSendButtonState(true);
        setInputState(true);

        smoothScrollToBottom();

        try {
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

    cancelFeedbackBtn.addEventListener('click', closeFeedbackDialog);
    submitFeedbackBtn.addEventListener('click', submitNegativeFeedback);
    feedbackOverlay.addEventListener('click', closeFeedbackDialog);
    
    feedbackDialog.addEventListener('click', (e) => e.stopPropagation());
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && feedbackDialog.classList.contains('active')) {
            closeFeedbackDialog();
        }
    });
});