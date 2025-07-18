// Dev Tools Module - Trade Manager Pro
// ================== SISTEMA DE FERRAMENTAS DE DESENVOLVIMENTO ==================

// ================== FUNÇÕES AUXILIARES ==================

// Função para logs usando chrome.runtime (padrão do sistema)
const devLog = (message, level = 'INFO') => {
    try {
        chrome.runtime.sendMessage({
            action: 'addLog',
            logMessage: `[DEV-TOOLS] ${message}`,
            level: level,
            source: 'dev-tools.js'
        });
    } catch (error) {
        // Erro silencioso
    }
};

// Função para atualizar status (padrão do sistema)
const devUpdateStatus = (message, type = 'info') => {
    try {
        chrome.runtime.sendMessage({
            action: 'updateStatus',
            message: message,
            type: type
        });
    } catch (error) {
        // Erro silencioso
    }
};

    // ================== FUNÇÕES DE CAPTURA SEGUINDO A ARQUITETURA ==================
    
    /**
     * Função 1: Captura de tela básica (função base)
     * Usa o handler existente CAPTURE_SCREENSHOT
     */
    const captureScreen = () => {
        return new Promise((resolve, reject) => {
            devLog('Iniciando captura de tela básica...', 'INFO');
            
            // Usar o handler existente no content.js com iframeWidth para remover o painel
            chrome.runtime.sendMessage({ 
                action: 'CAPTURE_SCREENSHOT',
                iframeWidth: 480 // Largura do painel lateral para remover
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message;
                    devLog(`Erro na captura: ${errorMsg}`, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                if (response && response.success && response.dataUrl) {
                    devLog('Captura de tela realizada com sucesso', 'SUCCESS');
                    resolve(response.dataUrl);
                } else {
                    const error = response ? response.error : 'Erro desconhecido na captura';
                    devLog(`Erro na captura: ${error}`, 'ERROR');
                    reject(new Error(error));
                }
            });
        });
    };

    /**
     * Função 2: Obter informações do canvas (função complementar)
     * Usa o handler existente CAPTURE_CHART_ONLY mas apenas para obter canvas info
     */
    const getCanvasInfo = () => {
        return new Promise((resolve, reject) => {
            devLog('Obtendo informações do canvas...', 'INFO');
            
            // Usar o handler existente no content.js
            chrome.runtime.sendMessage({ action: 'CAPTURE_CHART_ONLY' }, (response) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message;
                    devLog(`Erro ao obter canvas info: ${errorMsg}`, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                if (response && response.success && response.canvasInfo) {
                    devLog('Informações do canvas obtidas com sucesso', 'SUCCESS');
                    resolve(response.canvasInfo);
                } else {
                    const error = response ? response.error : 'Erro ao obter informações do canvas';
                    devLog(`Erro ao obter canvas info: ${error}`, 'ERROR');
                    reject(new Error(error));
                }
            });
        });
    };

    /**
     * Função 3: Captura apenas do gráfico (combina as duas funções anteriores)
     * 1. Captura tela completa
     * 2. Obtém informações do canvas
     * 3. Faz crop da imagem
     */
    const captureChartOnly = async () => {
        devLog('Iniciando captura apenas do gráfico (combinando funções)...', 'INFO');
        
        try {
            // Passo 1: Capturar tela completa
            const screenDataUrl = await captureScreen();
            devLog('Tela capturada, obtendo informações do canvas...', 'INFO');
            
            // Passo 2: Obter informações do canvas
            const canvasInfo = await getCanvasInfo();
            devLog('Canvas info obtida, fazendo crop...', 'INFO');
            
            // Passo 3: Fazer crop da imagem usando as informações do canvas
            const croppedImage = await cropImage(screenDataUrl, canvasInfo);
            devLog('Crop realizado com sucesso', 'SUCCESS');
            
            return {
                dataUrl: croppedImage,
                canvasInfo: canvasInfo
            };
        } catch (error) {
            devLog(`Erro na captura do gráfico: ${error.message}`, 'ERROR');
            throw error;
        }
    };

    /**
     * Função auxiliar: Fazer crop de uma imagem baseado nas informações do canvas
     */
    const cropImage = (dataUrl, canvasInfo) => {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Definir dimensões do canvas de saída
                    canvas.width = canvasInfo.width;
                    canvas.height = canvasInfo.height;
                    
                    // Fazer o crop
                    ctx.drawImage(
                        img,
                        canvasInfo.x, canvasInfo.y, canvasInfo.width, canvasInfo.height, // source
                        0, 0, canvasInfo.width, canvasInfo.height // destination
                    );
                    
                    // Converter para dataUrl
                    const croppedDataUrl = canvas.toDataURL('image/png');
                    resolve(croppedDataUrl);
                };
                
                img.onerror = () => {
                    reject(new Error('Erro ao carregar imagem para crop'));
                };
                
                img.src = dataUrl;
            } catch (error) {
                reject(error);
            }
        });
    };

    // ================== PADRÃO UI - CONTROLE DE ELEMENTOS ==================
    
    // Objeto UI para controle centralizado dos elementos (padrão arquitetural)
    const UI = {
        captureScreen: document.getElementById('captureBtn'),
        canvasInfo: document.getElementById('captureCanvasInfoBtn'),
        chartOnly: document.getElementById('captureChartOnlyBtn'),
        statusElement: document.getElementById('dev-status'),
        resultElement: document.getElementById('analysis-debug-result')
    };
    
    // ================== CONFIGURAÇÃO DOS BOTÕES ==================
    
    function setupCaptureDebugButtons() {
        devLog('Configurando botões de captura no DevTools...', 'INFO');
        
        // Botão de captura de tela básica
        UI.captureScreen.addEventListener('click', async () => {
            devLog('=== CLIQUE DETECTADO: Botão de captura de tela ===', 'INFO');
            devUpdateStatus('Capturando tela...', 'info');
            
            try {
                devLog('Tentando executar captura de tela...', 'DEBUG');
                const dataUrl = await captureScreen();
                devLog('Captura de tela concluída com sucesso', 'SUCCESS');
                devUpdateStatus('Captura de tela realizada com sucesso', 'success');
                
                // Mostrar a imagem em popup
                chrome.runtime.sendMessage({
                    action: 'showImagePopup',
                    dataUrl: dataUrl
                });
            } catch (error) {
                devLog(`Erro na captura: ${error.message}`, 'ERROR');
                devUpdateStatus(`Erro na captura: ${error.message}`, 'error');
            }
        });
        devLog('Botão de captura de tela configurado com sucesso', 'DEBUG');

        // Botão de informações do canvas (dimensões do gráfico)
        UI.canvasInfo.addEventListener('click', async () => {
            devLog('=== CLIQUE DETECTADO: Botão de dimensão do gráfico ===', 'INFO');
            devUpdateStatus('Obtendo informações do canvas...', 'info');
            
            try {
                devLog('Tentando obter informações do canvas...', 'DEBUG');
                const canvasInfo = await getCanvasInfo();
                const message = `Canvas: ${canvasInfo.width}x${canvasInfo.height} @ ${canvasInfo.x},${canvasInfo.y}`;
                devLog(`Informações do canvas: ${message}`, 'SUCCESS');
                devUpdateStatus(message, 'success');
                
                // Atualizar elemento de resultado
                if (UI.resultElement) {
                    UI.resultElement.innerHTML = `
                        <div><strong>Canvas encontrado:</strong></div>
                        <div>Dimensões: ${canvasInfo.width}x${canvasInfo.height}</div>
                        <div>Posição: ${canvasInfo.x}, ${canvasInfo.y}</div>
                        <div>Seletor: ${canvasInfo.selector}</div>
                        <div>Classe: ${canvasInfo.className}</div>
                    `;
                }
            } catch (error) {
                devLog(`Erro ao obter informações do canvas: ${error.message}`, 'ERROR');
                devUpdateStatus(`Erro: ${error.message}`, 'error');
            }
        });
        devLog('Botão de dimensão do gráfico configurado com sucesso', 'DEBUG');

        // Botão de captura apenas do gráfico (combina as duas funções)
        UI.chartOnly.addEventListener('click', async () => {
            devLog('=== CLIQUE DETECTADO: Botão de captura de gráfico ===', 'INFO');
            devUpdateStatus('Capturando apenas o gráfico...', 'info');
            
            try {
                devLog('Tentando executar captura do gráfico...', 'DEBUG');
                const result = await captureChartOnly();
                devLog('Captura do gráfico concluída com sucesso', 'SUCCESS');
                devUpdateStatus('Gráfico capturado com sucesso', 'success');
                
                // Mostrar a imagem em popup
                chrome.runtime.sendMessage({
                    action: 'showImagePopup',
                    dataUrl: result.dataUrl
                });
            } catch (error) {
                devLog(`Erro na captura do gráfico: ${error.message}`, 'ERROR');
                devUpdateStatus(`Erro na captura: ${error.message}`, 'error');
            }
        });
        devLog('Botão de captura de gráfico configurado com sucesso', 'DEBUG');
    }

    // ================== FUNÇÕES DE VISIBILIDADE DO PAINEL ==================
    
    function updateDevPanelVisibility(devModeEnabled) {
        const devPanel = document.getElementById('gale-test-panel');
        if (!devPanel) {
            devLog('Painel de desenvolvimento não encontrado no DOM', 'ERROR');
            return;
        }
        
        if (devModeEnabled) {
            devPanel.classList.remove('hidden');
            devLog('Painel de desenvolvimento EXIBIDO', 'INFO');
        } else {
            devPanel.classList.add('hidden');
            devLog('Painel de desenvolvimento OCULTO', 'INFO');
        }
    }

    // ================== INICIALIZAÇÃO ==================
    
    function initDevTools() {
        try {
            devLog('Inicializando DevTools (seguindo arquitetura)...', 'INFO');
            
            setupCaptureDebugButtons();
            
            devLog('DevTools inicializado com sucesso (seguindo arquitetura)', 'SUCCESS');
        } catch (error) {
            devLog(`Erro ao inicializar DevTools: ${error.message}`, 'ERROR');
        }
    }

    // ================== LISTENER PARA MENSAGENS ==================
    
    // Listener para mensagens do chrome.runtime (seguindo arquitetura)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        devLog(`DevTools recebeu mensagem: ${message.action}`, 'DEBUG');
        
        // Handler para captura de tela
        if (message.action === 'DEV_CAPTURE_SCREEN') {
            captureScreen()
                .then(dataUrl => {
                    devLog('Captura de tela realizada via mensagem', 'SUCCESS');
                    sendResponse({ success: true, dataUrl: dataUrl });
                })
                .catch(error => {
                    devLog(`Erro na captura via mensagem: ${error.message}`, 'ERROR');
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Resposta assíncrona
        }
        
        // Handler para informações do canvas
        if (message.action === 'DEV_GET_CANVAS_INFO') {
            getCanvasInfo()
                .then(canvasInfo => {
                    devLog('Informações do canvas obtidas via mensagem', 'SUCCESS');
                    sendResponse({ success: true, canvasInfo: canvasInfo });
                })
                .catch(error => {
                    devLog(`Erro ao obter canvas info via mensagem: ${error.message}`, 'ERROR');
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Resposta assíncrona
        }
        
        // Handler para captura apenas do gráfico
        if (message.action === 'DEV_CAPTURE_CHART_ONLY') {
            captureChartOnly()
                .then(result => {
                    devLog('Captura do gráfico realizada via mensagem', 'SUCCESS');
                    sendResponse({ success: true, dataUrl: result.dataUrl, canvasInfo: result.canvasInfo });
                })
                .catch(error => {
                    devLog(`Erro na captura do gráfico via mensagem: ${error.message}`, 'ERROR');
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Resposta assíncrona
        }
        
        // Handler para atualizar visibilidade do painel
        if (message.action === 'UPDATE_DEV_PANEL_VISIBILITY') {
            updateDevPanelVisibility(message.devModeEnabled);
            sendResponse({ success: true });
            return true;
        }
        
        // Handler para inicializar DevTools
        if (message.action === 'INIT_DEV_TOOLS') {
            initDevTools();
            sendResponse({ success: true });
            return true;
        }
        
        return false; // Não processou a mensagem
    });

    // ================== EXPOSIÇÃO GLOBAL ==================
    
    // Não expor funções globalmente - usar chrome.runtime para comunicação
    // Todas as funções são acessadas via mensagens do chrome.runtime
    
    devLog('Módulo DevTools carregado (seguindo arquitetura)', 'INFO');
    
    // ================== INICIALIZAÇÃO AUTOMÁTICA ==================
    
    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            devLog('DOM carregado, inicializando DevTools automaticamente...', 'INFO');
            initDevTools();
        });
    } else {
        // DOM já está pronto
        devLog('DOM já está pronto, inicializando DevTools...', 'INFO');
        initDevTools();
    } 