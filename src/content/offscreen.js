chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'copyToClipboard') {
        // Cria uma área de texto temporária. É a forma mais robusta de copiar
        // em um contexto de segundo plano (offscreen) onde o foco não está disponível.
        const textarea = document.createElement('textarea');
        textarea.value = request.text;
        
        // Adiciona o elemento ao DOM para que possa ser selecionado.
        document.body.appendChild(textarea);
        
        let success = false;
        let errorMessage = '';

        try {
            textarea.select();
            // O comando execCommand é síncrono e funciona bem em documentos sem foco.
            success = document.execCommand('copy');
            if (!success) {
                errorMessage = 'document.execCommand("copy") retornou false.';
            }
        } catch (err) {
            success = false;
            errorMessage = err.message;
        } finally {
            // Limpa o DOM removendo o elemento temporário.
            document.body.removeChild(textarea);
        }

        if (success) {
            console.log('Texto copiado com sucesso para a área de transferência via execCommand.');
            sendResponse({ success: true });
        } else {
            console.error('Falha ao copiar texto:', errorMessage);
            sendResponse({ success: false, error: errorMessage });
        }
    }
    // A operação é síncrona, então não é necessário retornar true.
    return false; 
}); 