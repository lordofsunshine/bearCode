document.addEventListener('DOMContentLoaded', () => {
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (e) {
                    console.error(e);
                }
            }
            return code;
        },
        breaks: true,
        gfm: true
    });

    document.querySelectorAll('.message-content').forEach(element => {
        const originalContent = element.textContent.trim();
        
        if (originalContent.includes('```') || 
            originalContent.includes('`') || 
            originalContent.includes('*') || 
            originalContent.includes('#') ||
            originalContent.includes('[')) {
            
            try {
                const parsedContent = marked.parse(originalContent);
                element.innerHTML = parsedContent;

                element.querySelectorAll('pre code').forEach(block => {
                    hljs.highlightBlock(block);
                });
            } catch (e) {
                element.textContent = originalContent;
            }
        } else {
            element.innerHTML = originalContent
                .split('\n')
                .map(line => line.trim())
                .join('<br>');
        }
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