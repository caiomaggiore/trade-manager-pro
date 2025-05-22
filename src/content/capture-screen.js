// capture-screen.js
// Sistema centralizado de captura de tela para Trade Manager Pro

/**
 * Detecta o ambiente em que o script está sendo executado
 * @returns {string} Ambiente de execução ('content', 'popup', 'background' ou 'unknown')
 */
function detectEnvironment() {
    try {
        // Verificar se estamos em um content script (document completo disponível)
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
            // Verificar se estamos no popup
            if (document.body.classList.contains('popup-page') || 
                (window.location.href && window.location.href.includes('popup.html'))) {
                return 'popup';
            }
            
            // Se não for popup mas tiver document completo, provavelmente é content script
            return 'content';
        }
        
        // Verificar se estamos no background (chrome.tabs.captureVisibleTab disponível)
        if (typeof chrome !== 'undefined' && chrome.tabs && 
            typeof chrome.tabs.captureVisibleTab === 'function') {
            return 'background';
        }
        
        // Ambiente desconhecido
        return 'unknown';
    } catch (error) {
        console.error('Erro ao detectar ambiente:', error);
        return 'unknown';
    }
}

/**
 * Adiciona mensagem ao log do sistema
 * @param {string} message - Mensagem a ser registrada
 * @param {string} level - Nível do log (INFO, WARN, ERROR, SUCCESS)
 */
function logCapture(message, level = 'INFO') {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
            action: 'addLog',
            logMessage: message,
            level: level,
            source: 'capture-screen.js'
        });
    } else {
        console.log(`[${level}] ${message}`);
    }
}

/**
 * Captura a tela sem exibir modal - apenas retorna a dataUrl
 * @returns {Promise<string>} URL da imagem capturada em formato dataUrl
 */
function captureScreenSimple() {
    return new Promise((resolve, reject) => {
        logCapture('Iniciando captura de tela básica', 'INFO');
        
        // Verificar se estamos em um contexto onde chrome.runtime está disponível
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            return reject(new Error('API Chrome não disponível neste contexto'));
        }
        
        try {
            // Detectar ambiente para captura adequada
            const environment = detectEnvironment();
            logCapture(`Captura sendo executada no ambiente: ${environment}`, 'INFO');
            
            // No popup, precisamos usar uma abordagem diferente
            if (environment === 'popup') {
                logCapture('Usando método de captura específico para popup', 'INFO');
                
                // Obter a aba ativa
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message;
                        logCapture(`Erro ao obter aba ativa: ${errorMsg}`, 'ERROR');
                        reject(new Error(errorMsg));
                        return;
                    }
                    
                    if (!tabs || !tabs[0] || !tabs[0].id) {
                        logCapture('Nenhuma aba ativa encontrada', 'ERROR');
                        reject(new Error('Nenhuma aba ativa encontrada'));
                        return;
                    }
                    
                    // Solicitar a captura através do content script
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'CAPTURE_POPUP_REQUEST'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            const errorMsg = chrome.runtime.lastError.message;
                            logCapture(`Erro na comunicação com content script: ${errorMsg}`, 'ERROR');
                            
                            // Fallback direto para o background
                            chrome.runtime.sendMessage({
                                action: 'initiateCapture',
                                actionType: 'capture',
                                requireProcessing: true,
                                source: 'popup-fallback'
                            }, (bgResponse) => {
                                if (chrome.runtime.lastError) {
                                    const bgErrorMsg = chrome.runtime.lastError.message;
                                    logCapture(`Erro no fallback de captura: ${bgErrorMsg}`, 'ERROR');
                                    reject(new Error(bgErrorMsg));
                                    return;
                                }
                                
                                if (bgResponse && bgResponse.dataUrl) {
                                    logCapture('Captura concluída com sucesso via fallback', 'SUCCESS');
                                    window.lastCapturedImage = bgResponse.dataUrl;
                                    resolve(bgResponse.dataUrl);
                                } else {
                                    const bgError = bgResponse && bgResponse.error ? bgResponse.error : 'Resposta sem dados de imagem';
                                    logCapture(`Erro no fallback: ${bgError}`, 'ERROR');
                                    reject(new Error(bgError));
                                }
                            });
                            return;
                        }
                        
                        if (!response || !response.success) {
                            const responseError = response && response.error ? response.error : 'Falha na captura pelo content script';
                            logCapture(`Erro na resposta do content script: ${responseError}`, 'ERROR');
                            reject(new Error(responseError));
                            return;
                        }
                        
                        if (!response.dataUrl) {
                            logCapture('Resposta sem dados de imagem', 'ERROR');
                            reject(new Error('Resposta sem dados de imagem'));
                            return;
                        }
                        
                        logCapture('Captura concluída com sucesso via content script', 'SUCCESS');
                        window.lastCapturedImage = response.dataUrl;
                        resolve(response.dataUrl);
                    });
                });
            } else {
                // Método padrão para content script e outros ambientes
                chrome.runtime.sendMessage({
                    action: 'initiateCapture',
                    actionType: 'capture',
                    requireProcessing: true,
                    iframeWidth: 480
                }, (response) => {
                    // Verificar se houve erro na comunicação
                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message;
                        logCapture(`Erro na captura: ${errorMsg}`, 'ERROR');
                        reject(new Error(errorMsg));
                        return;
                    }
                    
                    // Verificar se houve erro reportado na resposta
                    if (response && response.error) {
                        logCapture(`Erro retornado: ${response.error}`, 'ERROR');
                        reject(new Error(response.error));
                        return;
                    }
                    
                    // Verificar se recebemos dados de imagem
                    if (!response || !response.dataUrl) {
                        logCapture('Resposta sem dados de imagem', 'ERROR');
                        reject(new Error('Sem dados de imagem'));
                        return;
                    }
                    
                    logCapture('Captura concluída com sucesso', 'SUCCESS');
                    
                    // Armazenar a imagem para uso posterior
                    window.lastCapturedImage = response.dataUrl;
                    
                    resolve(response.dataUrl);
                });
            }
        } catch (error) {
            logCapture(`Erro inesperado na captura: ${error.message}`, 'ERROR');
            reject(error);
        }
    });
}

/**
 * Captura a tela e mostra em uma janela popup
 * @returns {Promise<string>} URL da imagem capturada
 */
function captureAndShowPopup() {
    return new Promise((resolve, reject) => {
        logCapture('Iniciando captura para exibição em popup', 'INFO');
        
        captureScreenSimple()
            .then(dataUrl => {
                try {
                    // Mostrar a imagem em uma janela popup nativa do Chrome via background
                    chrome.runtime.sendMessage({
                        action: 'showImagePopup',
                        dataUrl: dataUrl
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            logCapture(`Aviso: ${chrome.runtime.lastError.message}`, 'WARN');
                            // Continue mesmo com erro na exibição do popup
                        }
                        
                        resolve(dataUrl);
                    });
                } catch (error) {
                    logCapture(`Erro ao exibir popup: ${error.message}`, 'WARN');
                    // Mesmo com erro no popup, resolvemos a Promise com a dataUrl
                    resolve(dataUrl);
                }
            })
            .catch(error => {
                logCapture(`Erro na captura para popup: ${error.message}`, 'ERROR');
                reject(error);
            });
    });
}

/**
 * Captura a tela para análise (sem mostrar visualmente)
 * @returns {Promise<string>} URL da imagem capturada
 */
function captureForAnalysis() {
    logCapture('Iniciando captura para análise', 'INFO');
    
    // Usar um timeout para evitar "message port closed"
    let timeoutId = null;
    
    return new Promise((resolve, reject) => {
        // Configurar um timeout para evitar bloqueios indefinidos
        timeoutId = setTimeout(() => {
            logCapture('Timeout na captura para análise', 'ERROR');
            reject(new Error('Timeout na captura de tela para análise'));
        }, 15000); // 15 segundos de timeout
        
        // Tentar usar imagem em cache se disponível e recente
        if (window.lastCapturedImage && window.lastCapturedImageTimestamp) {
            const now = Date.now();
            const imageAge = now - window.lastCapturedImageTimestamp;
            
            // Se a imagem tem menos de 2 segundos, usar o cache
            if (imageAge < 2000) {
                logCapture('Usando imagem em cache recente para análise', 'INFO');
                clearTimeout(timeoutId);
                resolve(window.lastCapturedImage);
                return;
            }
        }
        
        // Tentar capturar nova imagem
        try {
            captureScreenSimple()
                .then(dataUrl => {
                    clearTimeout(timeoutId);
                    
                    // Armazenar com timestamp para cache
                    window.lastCapturedImage = dataUrl;
                    window.lastCapturedImageTimestamp = Date.now();
                    
                    logCapture('Captura para análise concluída', 'SUCCESS');
                    resolve(dataUrl);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    logCapture(`Erro na captura para análise: ${error.message}`, 'ERROR');
                    reject(error);
                });
        } catch (error) {
            clearTimeout(timeoutId);
            logCapture(`Erro crítico na captura para análise: ${error.message}`, 'ERROR');
            reject(error);
        }
    });
}

/**
 * Captura a tela e mostra em um popup - método completo e independente
 * @returns {Promise<string>} URL da imagem capturada
 */
async function captureAndShow() {
    try {
        logCapture('Iniciando captura e exibição de tela em popup', 'INFO');
        
        // Obter o ambiente de execução
        const environment = detectEnvironment();
        logCapture(`Captura sendo executada no ambiente: ${environment}`, 'INFO');
        
        // Realizar a captura
        const dataUrl = await captureScreenSimple();
        
        if (!dataUrl) {
            throw new Error('Falha ao capturar a tela');
        }
        
        logCapture('Captura concluída com sucesso', 'SUCCESS');
        
        // Solicitar exibição do popup via background
        chrome.runtime.sendMessage({
            action: 'showImagePopup',
            dataUrl: dataUrl
        }, response => {
            if (chrome.runtime.lastError) {
                logCapture(`Erro ao mostrar popup: ${chrome.runtime.lastError.message}`, 'ERROR');
                return;
            }
            
            if (response && response.success) {
                logCapture('Imagem exibida com sucesso no popup', 'SUCCESS');
            } else {
                logCapture(`Erro ao exibir imagem no popup: ${response.error || 'Erro desconhecido'}`, 'ERROR');
            }
        });
        
        return dataUrl;
    } catch (error) {
        logCapture(`Erro ao capturar e exibir tela: ${error.message}`, 'ERROR');
        throw error;
    }
}

/**
 * Valida e corrige uma dataUrl se necessário
 * @param {string} dataUrl - URL de dados para validar e corrigir
 * @returns {string} URL de dados corrigida
 */
function validateAndFixDataUrl(dataUrl) {
    if (!dataUrl) {
        logCapture('validateAndFixDataUrl: URL de dados vazia ou indefinida', 'ERROR');
        return null;
    }
    
    // Verificar se já está no formato correto
    if (dataUrl.startsWith('data:image/')) {
        return dataUrl; // Já está correto
    }
    
    logCapture('Tentando corrigir formato de dataUrl', 'INFO');
    
    // Tentar extrair a parte base64 e reconstruir a dataUrl
    if (dataUrl.includes(',')) {
        const parts = dataUrl.split(',');
        if (parts.length > 1) {
            // Verificar se parece ser base64 válido
            const base64Regex = /^[A-Za-z0-9+/=]+$/;
            if (base64Regex.test(parts[1])) {
                const fixedDataUrl = 'data:image/png;base64,' + parts[1];
                logCapture('Formato de dataUrl corrigido com sucesso', 'SUCCESS');
                return fixedDataUrl;
            }
        }
    }
    
    // Se chegou aqui, não foi possível corrigir
    logCapture('Não foi possível corrigir o formato da dataUrl', 'ERROR');
    return dataUrl; // Retornar a original, mesmo que inválida
}

// Exportar API global
window.CaptureScreen = {
    captureScreenSimple,
    captureForAnalysis,
    captureAndShow,
    validateAndFixDataUrl,
    detectEnvironment
};

// Adicionar identificador de ambiente ao carregar o script
if (typeof document !== 'undefined' && document.body) {
    document.body.setAttribute('data-capture-initialized', 'true');
    
    // Adicionar uma classe no popup para facilitar a detecção
    if (document.body.classList.contains('popup-page') || 
        (window.location.href && window.location.href.includes('popup.html'))) {
        document.body.classList.add('capture-in-popup');
    }
}

// Log de inicialização
logCapture(`Módulo de captura de tela inicializado no ambiente: ${detectEnvironment()}`, 'INFO'); 