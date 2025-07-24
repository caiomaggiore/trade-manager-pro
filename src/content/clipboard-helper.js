/**
 * Clipboard Helper - Estratégias SIMPLES para cópia de texto
 * Versão simplificada priorizando métodos que funcionam
 */

class ClipboardHelper {
    constructor() {
        this.methods = {
            DIRECT: 'direct',
            BACKGROUND: 'background', 
            OFFSCREEN: 'offscreen'
        };
    }

    /**
     * MÉTODO 1: DIRETO (execCommand) - PRIORIDADE
     * Funciona bem no contexto do iframe
     */
    async copyViaDirect(text) {
        try {
            console.log('🔄 Tentando método DIRECT (execCommand)...');
            
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.cssText = `
                position: fixed;
                left: -9999px;
                top: -9999px;
                opacity: 0;
            `;
            
            document.body.appendChild(textArea);
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                console.log('✅ Método DIRECT: Sucesso');
                return { success: true, method: this.methods.DIRECT };
            } else {
                throw new Error('execCommand retornou false');
            }
        } catch (error) {
            console.error('❌ Método DIRECT falhou:', error.message);
            throw error;
        }
    }

    /**
     * MÉTODO 2: Background Direct
     */
    async copyViaBackground(text) {
        try {
            console.log('🔄 Tentando método BACKGROUND...');
            
            const response = await chrome.runtime.sendMessage({
                action: 'copyTextDirect',
                text: text
            });

            if (response && response.success) {
                console.log('✅ Método BACKGROUND: Sucesso');
                return { success: true, method: this.methods.BACKGROUND };
            } else {
                throw new Error(response?.error || 'Background method failed');
            }
        } catch (error) {
            console.error('❌ Método BACKGROUND falhou:', error.message);
            throw error;
        }
    }

    /**
     * MÉTODO 3: Offscreen (simplificado)
     */
    async copyViaOffscreen(text) {
        try {
            console.log('🔄 Tentando método OFFSCREEN...');
            
            const response = await chrome.runtime.sendMessage({
                action: 'copyTextToClipboard',
                text: text
            });

            if (response && response.success) {
                console.log('✅ Método OFFSCREEN: Sucesso');
                return { success: true, method: this.methods.OFFSCREEN };
            } else {
                throw new Error(response?.error || 'Offscreen method failed');
            }
        } catch (error) {
            console.error('❌ Método OFFSCREEN falhou:', error.message);
            throw error;
        }
    }

    // ✅ IMPLEMENTAR STATUS: Função principal de cópia para clipboard
    async copyText(text) {
        updateStatus('Iniciando cópia para área de transferência...', 'info');
        logToSystem('ClipboardHelper: Tentando copiar texto para a área de transferência', 'INFO');
        
        const strategies = [
            { name: 'DIRECT', method: this.copyViaDirect.bind(this) },
            { name: 'BACKGROUND', method: this.copyViaBackground.bind(this) }
        ];

        let lastError = null;
        
        for (const strategy of strategies) {
            try {
                updateStatus(`Tentando método ${strategy.name}...`, 'info');
                logToSystem(`ClipboardHelper: Tentando estratégia ${strategy.name}`, 'DEBUG');
                
                const result = await strategy.method(text);
                
                if (result && result.success) {
                    updateStatus(`✅ Texto copiado com sucesso via ${strategy.name}!`, 'success', 4000);
                    logToSystem(`ClipboardHelper: Sucesso com ${strategy.name}`, 'SUCCESS');
                    return result;
                }
                
            } catch (error) {
                lastError = error;
                updateStatus(`Método ${strategy.name} falhou, tentando próximo...`, 'warning', 2000);
                logToSystem(`ClipboardHelper: Estratégia ${strategy.name} falhou: ${error.message}`, 'ERROR');
                continue;
            }
        }

        // ✅ STATUS DE ERRO: Se todas as estratégias falharam
        const errorMessage = lastError ? lastError.message : 'Todas as estratégias de cópia falharam';
        updateStatus(`Erro ao copiar texto: ${errorMessage}`, 'error', 6000);
        logToSystem(`ClipboardHelper: Todas as estratégias falharam`, 'ERROR');
        
        return { 
            success: false, 
            error: errorMessage,
            method: null 
        };
    }
}

// Instância global
window.ClipboardHelper = new ClipboardHelper();

// Função global
window.copyToClipboard = async (text) => {
    try {
        const result = await window.ClipboardHelper.copyText(text);
        console.log('📋 Cópia concluída:', result);
        return result;
    } catch (error) {
        console.error('📋 Falha na cópia:', error);
        throw error;
    }
};

console.log('📋 ClipboardHelper SIMPLES carregado'); 