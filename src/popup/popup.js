// ================== VARIÁVEIS GLOBAIS ==================
let settings = {
    tradeValue: 10,
    tradeTime: 0,
    galeEnabled: true,
    galeLevel: '1x'
};

// ================== FUNÇÕES AUXILIARES ==================
// Sistema de logs global disponível via window.updateStatus

/**
 * Carrega as configurações salvas
 */
const loadSettings = () => {
    chrome.storage.sync.get(settings, (result) => {
        settings = { ...settings, ...result };
        
        // Verificar se os elementos existem antes de definir valores
        const tradeValue = document.getElementById('tradeValue');
        const tradeTime = document.getElementById('tradeTime');
        const galeEnabled = document.getElementById('galeEnabled');
        const galeLevel = document.getElementById('galeLevel');
        
        if (tradeValue) tradeValue.value = settings.tradeValue;
        if (tradeTime) tradeTime.value = settings.tradeTime;
        if (galeEnabled) galeEnabled.value = settings.galeEnabled.toString();
        if (galeLevel) galeLevel.value = settings.galeLevel;
    });
};

/**
 * Salva as configurações
 */
const saveSettings = () => {
    // Verificar se os elementos existem antes de obter valores
    const tradeValue = document.getElementById('tradeValue');
    const tradeTime = document.getElementById('tradeTime');
    const galeEnabled = document.getElementById('galeEnabled');
    const galeLevel = document.getElementById('galeLevel');
    
    if (tradeValue && tradeTime && galeEnabled && galeLevel) {
        settings = {
            tradeValue: parseInt(tradeValue.value),
            tradeTime: parseInt(tradeTime.value),
            galeEnabled: galeEnabled.value === 'true',
            galeLevel: galeLevel.value
        };
        chrome.storage.sync.set(settings);
    }
};

// ================== EVENT LISTENERS ==================
document.addEventListener('DOMContentLoaded', () => {
    // Configurar o botão de captura
    const captureBtn = document.getElementById('captureBtn');
    
    if (captureBtn) {
        captureBtn.addEventListener('click', async () => {
            try {
                // Obter a aba ativa
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (!tab) {
                    throw new Error('Nenhuma guia ativa encontrada');
                }
                
                updateStatus('Iniciando captura...', 'info');
                console.log('Iniciando captura a partir do popup');
                
                // Verificar se o módulo CaptureScreen está disponível na janela atual
                if (typeof window.CaptureScreen !== 'undefined' && typeof window.CaptureScreen.captureAndShow === 'function') {
                    console.log('Usando módulo CaptureScreen do popup');
                    try {
                        // Usar o módulo CaptureScreen para capturar e mostrar a tela
                        await window.CaptureScreen.captureAndShow();
                        
                        updateStatus('Captura realizada com sucesso', 'success');
                        
                        // Fechar o popup após confirmar que a janela foi aberta
                        setTimeout(() => window.close(), 500);
                    } catch (captureError) {
                        console.error('Erro ao usar CaptureScreen:', captureError);
                        updateStatus('Erro na captura: ' + captureError.message, 'error');
                    }
                } else {
                    console.warn('CaptureScreen não disponível no popup, usando método alternativo');
                    
                    // Fallback: Usar a abordagem direta para o background
                    chrome.runtime.sendMessage({
                        action: 'initiateCapture',
                        actionType: 'capture',
                        requireProcessing: true,
                        source: 'popup'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('Erro na captura:', chrome.runtime.lastError.message);
                            updateStatus('Erro na captura', 'error');
                            return;
                        }
                        
                        if (response.error) {
                            console.log('Erro na captura:', response.error);
                            updateStatus('Erro na captura', 'error');
                            return;
                        }
                        
                        // Se temos a imagem, mostrar em uma janela popup
                        if (response.dataUrl) {
                            console.log('Imagem capturada com sucesso, primeiros 50 caracteres:', response.dataUrl.substring(0, 50));
                            updateStatus('Captura realizada com sucesso', 'success');
                            
                            // Verificar se a dataUrl começa com 'data:image/'
                            if (!response.dataUrl.startsWith('data:image/')) {
                                console.error('URL de imagem inválida, primeiros 100 caracteres:', response.dataUrl.substring(0, 100));
                                updateStatus('Formato de imagem inválido', 'error');
                                
                                // Tentar corrigir o formato da URL
                                try {
                                    let fixedDataUrl = response.dataUrl;
                                    if (response.dataUrl.includes(',')) {
                                        // Se contém vírgula, pode ser uma base64 incompleta
                                        const parts = response.dataUrl.split(',');
                                        if (parts.length > 1) {
                                            fixedDataUrl = 'data:image/png;base64,' + parts[1];
                                            console.log('Tentando corrigir URL:', fixedDataUrl.substring(0, 50));
                                        }
                                    } else if (response.dataUrl.startsWith('data:,')) {
                                        // URL vazia, não podemos corrigir
                                        console.error('URL de dados vazia, impossível corrigir');
                                        updateStatus('Imagem vazia recebida', 'error');
                                        return;
                                    }
                                    
                                    // Verificar se a correção funcionou
                                    if (fixedDataUrl.startsWith('data:image/')) {
                                        console.log('URL corrigida com sucesso');
                                        response.dataUrl = fixedDataUrl;
                                    } else {
                                        // Se não conseguimos corrigir, mostrar erro e continuar mesmo assim
                                        console.warn('Não foi possível corrigir a URL, tentando usar mesmo assim');
                                    }
                                } catch (error) {
                                    console.error('Erro ao tentar corrigir URL:', error);
                                }
                            }
                            
                            // Adicionar um pequeno atraso antes de abrir a janela popup
                            setTimeout(() => {
                                // Usar o background para abrir uma janela popup
                                chrome.runtime.sendMessage({
                                    action: 'showImagePopup',
                                    dataUrl: response.dataUrl
                                }, (popupResponse) => {
                                    if (chrome.runtime.lastError) {
                                        console.error('Erro ao abrir popup:', chrome.runtime.lastError.message);
                                    }
                                    
                                    console.log('Popup de imagem aberto com sucesso');
                                    
                                    // Fechar o popup após confirmar que a janela foi aberta
                                    setTimeout(() => window.close(), 500);
                                });
                            }, 500); // 500ms de atraso para garantir que a imagem esteja pronta
                        } else {
                            console.error('Resposta sem dados de imagem');
                            updateStatus('Resposta sem dados de imagem', 'error');
                        }
                    });
                }
            } catch (error) {
                console.error('Erro ao capturar tela:', error);
                updateStatus(`Erro: ${error.message}`, 'error');
            }
        });
    }
    
    // Carregar configurações (se estiver na página de configurações)
    loadSettings();
    
    // Adicionar listener para salvar configurações
    const saveBtn = document.getElementById('saveSettings');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }
}); 