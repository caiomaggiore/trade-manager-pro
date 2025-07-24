/**
 * Offscreen Document - Clipboard functionality SIMPLES
 * Versão ultra-simplificada sem tratamento complexo de erros
 */

// Listener para mensagens do background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'copyToClipboard') {
        // Método ultra-simples: só execCommand sem verificações
        try {
            const textArea = document.createElement('textarea');
            textArea.value = message.text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.opacity = '0';
            
            document.body.appendChild(textArea);
            textArea.select();
            
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            sendResponse({ success: success });
        } catch (error) {
            sendResponse({ success: false, error: 'Falha simples' });
        }
        
        return true;
    }
});

console.log('Offscreen simples carregado'); 