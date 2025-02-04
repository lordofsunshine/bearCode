document.addEventListener('DOMContentLoaded', () => {
    const messageContents = document.querySelectorAll('.message-content');
    
    const markedCache = new Map();
    
    marked.setOptions({
        highlight: (() => {
            const cache = new Map();
            return (code, lang) => {
                const key = `${code}-${lang}`;
                if (cache.has(key)) return cache.get(key);
                
                let result;
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        result = hljs.highlight(code, { language: lang }).value;
                        cache.set(key, result);
                        return result;
                    } catch (e) {
                        console.error(e);
                    }
                }
                return code;
            };
        })(),
        breaks: true,
        gfm: true
    });

    const processMessageContent = (element) => {
        const content = element.textContent.trim();
        const cacheKey = content;
        
        if (markedCache.has(cacheKey)) {
            element.innerHTML = markedCache.get(cacheKey);
            return;
        }
        
        let formattedContent = content
            .replace(/\\times/g, '<span class="operator">×</span>')
            .replace(/\\div/g, '<span class="operator">÷</span>')
            .replace(/\\plus/g, '<span class="operator">+</span>')
            .replace(/\\minus/g, '<span class="operator">−</span>')
            .replace(/(\d+(?:,\d+)*(?:\.\d+)?)/g, '<span class="number">$1</span>')
            .replace(/Step \d+:/g, match => `<div class="calculation-step"><div class="step-label">${match}</div>`)
            .replace(/\$\$1\$/g, '')
            .replace(/\$\$\s*1\s*\$\$/g, '')
            .replace(/\$\$\s*\$\$/g, '');

        if (content.includes('```') || 
            content.includes('`') || 
            content.includes('*') || 
            content.includes('#') ||
            content.includes('[') ||
            content.includes('\\')) {
            
            try {
                const parsedContent = marked.parse(formattedContent);
                markedCache.set(cacheKey, parsedContent);
                element.innerHTML = parsedContent;

                if (content.includes('$')) {
                    MathJax.typesetPromise([element]).then(() => {
                        element.querySelectorAll('.MathJax').forEach(math => {
                            math.style.fontSize = '1.2em';
                            math.style.margin = '0.5em 0';
                        });
                    });
                }
            } catch (e) {
                element.textContent = content;
            }
        } else {
            const htmlContent = formattedContent
                .split('\n')
                .map(line => line.trim())
                .join('<br>');
            markedCache.set(cacheKey, htmlContent);
            element.innerHTML = htmlContent;
        }
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                processMessageContent(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, {
        rootMargin: '50px'
    });

    messageContents.forEach(element => {
        observer.observe(element);
    });

    const copyLinkButton = document.getElementById('copyShareLink');
    if (copyLinkButton) {
        copyLinkButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                copyLinkButton.classList.add('copied');
                const originalHTML = copyLinkButton.innerHTML;
                copyLinkButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Copied!
                `;
                
                setTimeout(() => {
                    copyLinkButton.classList.remove('copied');
                    copyLinkButton.innerHTML = originalHTML;
                }, 2000);
            } catch (error) {
            }
        });
    }

    const createCopyButton = document.getElementById('createCopy');
    if (createCopyButton) {
        createCopyButton.addEventListener('click', () => {
            window.location.href = '/?copy=' + window.location.pathname.split('/').pop();
        });
    }
}); 