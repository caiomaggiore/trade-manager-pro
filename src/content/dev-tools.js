// Dev Tools Module - Trade Manager Pro
// ================== SISTEMA DE LOGS PADRÃO ==================
// Usar o sistema global de logs declarado em log-sys.js
// window.logToSystem e window.updateStatus estão disponíveis globalmente

// Log de inicialização do módulo dev-tools
logToSystem('Módulo de ferramentas de desenvolvimento inicializado', 'INFO');

// ================== FUNÇÕES AUXILIARES ==================

// ================== FUNÇÕES DE CAPTURA SEGUINDO A ARQUITETURA ==================

/**
 * Função 1: Captura de tela básica (função base)
 * Usa o handler existente CAPTURE_SCREENSHOT
 */
const captureScreen = () => {
    return new Promise((resolve, reject) => {
        logToSystem('Iniciando captura de tela básica...', 'INFO');
        
        // Usar o handler existente no content.js com iframeWidth para remover o painel
        chrome.runtime.sendMessage({ 
            action: 'CAPTURE_SCREENSHOT',
            iframeWidth: 480 // Largura do painel lateral para remover
        }, (response) => {
            if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message;
                logToSystem(`Erro na captura: ${errorMsg}`, 'ERROR');
                reject(new Error(errorMsg));
                return;
            }
            
            if (response && response.success && response.dataUrl) {
                logToSystem('Captura de tela realizada com sucesso', 'SUCCESS');
                resolve(response.dataUrl);
            } else {
                const error = response ? response.error : 'Erro desconhecido na captura';
                logToSystem(`Erro na captura: ${error}`, 'ERROR');
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
        logToSystem('Obtendo informações do canvas...', 'INFO');
        
        // Usar o handler existente no content.js
        chrome.runtime.sendMessage({ action: 'CAPTURE_CHART_ONLY' }, (response) => {
            if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message;
                logToSystem(`Erro ao obter canvas info: ${errorMsg}`, 'ERROR');
                reject(new Error(errorMsg));
                return;
            }
            
            if (response && response.success && response.canvasInfo) {
                logToSystem('Informações do canvas obtidas com sucesso', 'SUCCESS');
                resolve(response.canvasInfo);
            } else {
                const error = response ? response.error : 'Erro ao obter informações do canvas';
                logToSystem(`Erro ao obter canvas info: ${error}`, 'ERROR');
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
    logToSystem('Iniciando captura apenas do gráfico (combinando funções)...', 'INFO');
    
    try {
        // Passo 1: Capturar tela completa
        const screenDataUrl = await captureScreen();
        logToSystem('Tela capturada, obtendo informações do canvas...', 'INFO');
        
        // Passo 2: Obter informações do canvas
        const canvasInfo = await getCanvasInfo();
        logToSystem('Canvas info obtida, fazendo crop...', 'INFO');
        
        // Passo 3: Fazer crop da imagem usando as informações do canvas
        const croppedImage = await cropImage(screenDataUrl, canvasInfo);
        logToSystem('Crop realizado com sucesso', 'SUCCESS');
        
        return {
            dataUrl: croppedImage,
            canvasInfo: canvasInfo
        };
    } catch (error) {
        logToSystem(`Erro na captura do gráfico: ${error.message}`, 'ERROR');
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
    resultElement: document.getElementById('analysis-debug-result'),
    testAnalysis: document.getElementById('test-analysis'),
    simulateLoss: document.getElementById('simulate-loss'),
    simulateWin: document.getElementById('simulate-win'),
    checkGaleStatus: document.getElementById('check-gale-status'),
    resetSystemError: document.getElementById('reset-system-error'),
    galeLevel: document.getElementById('gale-level'),
    galeValue: document.getElementById('gale-value'),
    testCapturePayout: document.getElementById('test-capture-payout'),
    payoutResult: document.getElementById('payout-result'),
    testFindBestAsset: document.getElementById('test-find-best-asset'),
    testSwitchToCurrency: document.getElementById('test-switch-to-currency'),
    testSwitchToCrypto: document.getElementById('test-switch-to-crypto'),
    minPayoutInput: document.getElementById('min-payout-input'),
    assetTestResult: document.getElementById('asset-test-result'),
    debugOpenModal: document.getElementById('debug-open-modal'),
    debugCloseModal: document.getElementById('debug-close-modal'),
    debugCheckStatus: document.getElementById('debug-check-status'),
    debugToggleModal: document.getElementById('debug-toggle-modal'),
    modalDebugResult: document.getElementById('modal-debug-result'),
    debugAssetCapture: document.getElementById('debug-asset-capture')
};

// ================== CONFIGURAÇÃO DOS BOTÕES ==================

function setupCaptureDebugButtons() {
    logToSystem('Configurando botões de captura no DevTools...', 'INFO');
    
    // Botão de captura de tela básica
    if (!UI.captureScreen) {
        logToSystem('Botão de captura de tela não encontrado no DOM', 'WARN');
        return;
    }
    
    UI.captureScreen.addEventListener('click', async () => {
        logToSystem('=== CLIQUE DETECTADO: Botão de captura de tela ===', 'INFO');
        updateStatus('Capturando tela...', 'info');
        
        try {
            logToSystem('Tentando executar captura de tela...', 'DEBUG');
            const dataUrl = await captureScreen();
            logToSystem('Captura de tela concluída com sucesso', 'SUCCESS');
            updateStatus('Captura de tela realizada com sucesso', 'success');
            
            // Mostrar a imagem em popup
            chrome.runtime.sendMessage({
                action: 'showImagePopup',
                dataUrl: dataUrl
            });
        } catch (error) {
            logToSystem(`Erro na captura: ${error.message}`, 'ERROR');
            updateStatus(`Erro na captura: ${error.message}`, 'error');
        }
    });
    logToSystem('Botão de captura de tela configurado com sucesso', 'DEBUG');

    // Botão de informações do canvas (dimensões do gráfico)
    UI.canvasInfo.addEventListener('click', async () => {
        logToSystem('=== CLIQUE DETECTADO: Botão de dimensão do gráfico ===', 'INFO');
        updateStatus('Obtendo informações do canvas...', 'info');
        
        try {
            logToSystem('Tentando obter informações do canvas...', 'DEBUG');
            const canvasInfo = await getCanvasInfo();
            const message = `Canvas: ${canvasInfo.width}x${canvasInfo.height} @ ${canvasInfo.x},${canvasInfo.y}`;
            logToSystem(`Informações do canvas: ${message}`, 'SUCCESS');
            updateStatus(message, 'success');
            
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
            logToSystem(`Erro ao obter informações do canvas: ${error.message}`, 'ERROR');
            updateStatus(`Erro: ${error.message}`, 'error');
        }
    });
    logToSystem('Botão de dimensão do gráfico configurado com sucesso', 'DEBUG');

    // Botão de captura apenas do gráfico (combina as duas funções)
    UI.chartOnly.addEventListener('click', async () => {
        logToSystem('=== CLIQUE DETECTADO: Botão de captura de gráfico ===', 'INFO');
        updateStatus('Capturando apenas o gráfico...', 'info');
        
        try {
            logToSystem('Tentando executar captura do gráfico...', 'DEBUG');
            const result = await captureChartOnly();
            logToSystem('Captura do gráfico concluída com sucesso', 'SUCCESS');
            updateStatus('Gráfico capturado com sucesso', 'success');
            
            // Mostrar a imagem em popup
            chrome.runtime.sendMessage({
                action: 'showImagePopup',
                dataUrl: result.dataUrl
            });
        } catch (error) {
            logToSystem(`Erro na captura do gráfico: ${error.message}`, 'ERROR');
            updateStatus(`Erro na captura: ${error.message}`, 'error');
        }
    });
    logToSystem('Botão de captura de gráfico configurado com sucesso', 'DEBUG');
}

// ================== CONFIGURAÇÃO DOS BOTÕES DE TESTE DO SISTEMA GALE ==================

function setupGaleTestButtons() {
    logToSystem('Configurando botões de teste do sistema Gale...', 'INFO');
    
    // Verificar se elementos existem
    if (!UI.simulateLoss || !UI.simulateWin || !UI.checkGaleStatus) {
        logToSystem('Botões de teste de gale não encontrados no DOM', 'WARN');
        return;
    }
    
    // Função para atualizar o display de status do gale
    const updateGaleStatusDisplay = (status) => {
        if (UI.galeLevel) {
            UI.galeLevel.textContent = `Nível ${status.level || 0}`;
        }
        if (UI.galeValue) {
            UI.galeValue.textContent = `Valor atual: R$ ${status.currentValue || status.originalValue || 0}`;
        }
    };
    
    // Verifica o status inicial
    if (window.GaleSystem) {
        const initialStatus = window.GaleSystem.getStatus();
        updateGaleStatusDisplay(initialStatus);
    }
    
    // Botão para simular perda e aplicar gale
    UI.simulateLoss.addEventListener('click', () => {
        logToSystem('=== CLIQUE DETECTADO: Simular perda ===', 'INFO');
        if (window.GaleSystem) {
            const result = window.GaleSystem.simulateGale();
            updateStatus(`Simulação de perda: ${result.message}`, result.success ? 'success' : 'error');
            
            // Atualizar display
            const updatedStatus = window.GaleSystem.getStatus();
            updateGaleStatusDisplay(updatedStatus);
        } else {
            updateStatus('Sistema de Gale não está disponível', 'error');
        }
    });
    
    // Botão para simular ganho e resetar gale
    UI.simulateWin.addEventListener('click', () => {
        logToSystem('=== CLIQUE DETECTADO: Simular ganho ===', 'INFO');
        if (window.GaleSystem) {
            const result = window.GaleSystem.simulateReset();
            updateStatus(`Simulação de ganho: ${result.message}`, result.success ? 'success' : 'info');
            
            // Atualizar display
            const updatedStatus = window.GaleSystem.getStatus();
            updateGaleStatusDisplay(updatedStatus);
        } else {
            updateStatus('Sistema de Gale não está disponível', 'error');
        }
    });
    
    // Botão para verificar status do gale
    UI.checkGaleStatus.addEventListener('click', () => {
        logToSystem('=== CLIQUE DETECTADO: Verificar status do Gale ===', 'INFO');
        if (window.GaleSystem) {
            const status = window.GaleSystem.getStatus();
            updateStatus(`Status do Gale: Nível ${status.level}, Próx. valor: R$ ${status.nextValue}`, 'info');
            updateGaleStatusDisplay(status);
            
            // Adicionar log com detalhes completos
            logToSystem(`Status do Gale - Nível: ${status.level}, Ativo: ${status.active}, Valor original: ${status.originalValue}, Próximo valor: ${status.nextValue}`, 'INFO');
        } else {
            updateStatus('Sistema de Gale não está disponível', 'error');
        }
    });
    
    // Botão para resetar status de erro do sistema
    if (UI.resetSystemError) {
        UI.resetSystemError.addEventListener('click', () => {
            logToSystem('=== CLIQUE DETECTADO: Resetar erro do sistema ===', 'INFO');
            if (window.StateManager) {
                const wasReset = window.StateManager.resetErrorStatus();
                if (wasReset) {
                    // Notificar index.js sobre o reset
                    chrome.runtime.sendMessage({
                        action: 'SYSTEM_ERROR_RESET',
                        success: true
                    });
                    updateStatus('Status de erro resetado com sucesso', 'success');
                    logToSystem('Status de erro do sistema resetado manualmente', 'INFO');
                } else {
                    updateStatus('Sistema não estava em estado de erro', 'info');
                    logToSystem('Tentativa de reset, mas sistema não estava em erro', 'DEBUG');
                }
            } else {
                updateStatus('StateManager não disponível', 'error');
                logToSystem('StateManager não disponível para reset de erro', 'ERROR');
            }
        });
        logToSystem('Botão de reset de status de erro configurado', 'DEBUG');
    }
    
    logToSystem('Botões de teste do sistema de Gale configurados com sucesso', 'INFO');
}

// ================== CONFIGURAÇÃO DO BOTÃO DE TESTE DE ANÁLISE ==================

function setupDevAnalysisButton() {
    logToSystem('Configurando botão de teste de análise...', 'INFO');
    
    if (!UI.testAnalysis) {
        logToSystem('Botão de teste de análise não encontrado no DOM', 'WARN');
        return;
    }
    
    UI.testAnalysis.addEventListener('click', async () => {
        logToSystem('=== CLIQUE DETECTADO: Teste de análise ===', 'INFO');
        logToSystem('Executando teste de análise (modo desenvolvedor)', 'INFO');
        
        try {
            // Simular análise com dados mock
            const mockResult = {
                action: Math.random() > 0.5 ? 'BUY' : 'SELL',
                confidence: Math.floor(Math.random() * 40) + 60, // 60-100%
                period: '1m',
                value: 'R$ 10,00',
                reason: 'Análise de teste executada com dados simulados para desenvolvimento.',
                isTestMode: true
            };
            
            // Mostrar modal com resultado
            if (typeof showAnalysisModal === 'function') {
                showAnalysisModal(mockResult);
                logToSystem('Modal de análise de teste exibido com sucesso', 'SUCCESS');
                updateStatus('Análise de teste executada com sucesso', 'success');
            } else {
                logToSystem('Função showAnalysisModal não encontrada', 'ERROR');
                updateStatus('Erro: Modal não disponível', 'error');
            }
        } catch (error) {
            logToSystem(`Erro no teste de análise: ${error.message}`, 'ERROR');
            updateStatus(`Erro no teste: ${error.message}`, 'error');
        }
    });
    
    logToSystem('Botão de teste de análise configurado com sucesso', 'DEBUG');
}

// ================== CONFIGURAÇÃO DOS BOTÕES DE TESTE DE PAYOUT E ATIVOS ==================

function setupPayoutAndAssetTestButtons() {
    logToSystem('Configurando botões de teste de payout e ativos...', 'INFO');
    
    // Função para atualizar resultado dos testes de ativos
    const updateAssetTestResult = (message, isError = false) => {
        if (UI.assetTestResult) {
            UI.assetTestResult.innerHTML = message;
            UI.assetTestResult.style.color = isError ? '#d32f2f' : '#333';
            UI.assetTestResult.style.backgroundColor = isError ? '#ffebee' : '#f9f9f9';
        }
    };
    
    // Botão de teste de captura de payout
    if (UI.testCapturePayout) {
        UI.testCapturePayout.addEventListener('click', async () => {
            logToSystem('=== CLIQUE DETECTADO: Teste de captura de payout ===', 'INFO');
            
            // Atualizar resultado na tela
            if (UI.payoutResult) {
                UI.payoutResult.textContent = 'Capturando payout...';
                UI.payoutResult.style.backgroundColor = '#f0f8ff';
            }
            
            logToSystem('Iniciando teste de captura de payout via content.js', 'INFO');
            updateStatus('Capturando payout do DOM...', 'info');
            
            try {
                // Usar chrome.runtime para comunicar com content.js que tem acesso ao DOM
                const response = await new Promise((resolve, reject) => {
                    // Timeout de segurança
                    const timeoutId = setTimeout(() => {
                        reject(new Error('Timeout: Captura de payout demorou mais de 10 segundos'));
                    }, 10000);
                    
                    chrome.runtime.sendMessage({
                        action: 'TEST_CAPTURE_PAYOUT'
                    }, (response) => {
                        clearTimeout(timeoutId);
                        
                        if (chrome.runtime.lastError) {
                            reject(new Error(`Erro de comunicação: ${chrome.runtime.lastError.message}`));
                            return;
                        }
                        
                        if (!response || !response.success) {
                            reject(new Error(response?.error || 'Erro desconhecido na captura'));
                            return;
                        }
                        
                        resolve(response);
                    });
                });
                
                // Exibir resultado
                if (UI.payoutResult) {
                    UI.payoutResult.textContent = `Payout capturado: ${response.payout}%`;
                    UI.payoutResult.style.backgroundColor = '#e8f5e8';
                }
                
                logToSystem(`✅ Payout capturado com sucesso: ${response.payout}%`, 'SUCCESS');
                updateStatus(`Payout capturado: ${response.payout}%`, 'success');
                
            } catch (error) {
                const errorMsg = error.message;
                logToSystem(`❌ Erro na captura de payout: ${errorMsg}`, 'ERROR');
                updateStatus(`Erro na captura: ${errorMsg}`, 'error');
                
                if (UI.payoutResult) {
                    UI.payoutResult.textContent = `Erro: ${errorMsg}`;
                    UI.payoutResult.style.backgroundColor = '#ffebee';
                }
            }
        });
        logToSystem('Botão de teste de captura de payout configurado', 'DEBUG');
    }
    
    // Botão para buscar melhor ativo
    if (UI.testFindBestAsset) {
        UI.testFindBestAsset.addEventListener('click', async () => {
            logToSystem('=== CLIQUE DETECTADO: Buscar melhor ativo ===', 'INFO');
            const minPayout = parseInt(UI.minPayoutInput?.value || '85', 10);
            updateAssetTestResult(`Buscando melhor ativo (payout >= ${minPayout}%)...`);
            
            try {
                const result = await testFindBestAsset(minPayout);
                updateAssetTestResult(result.message);
                logToSystem(`Melhor ativo encontrado: ${result.message}`, 'SUCCESS');
            } catch (error) {
                const errorMsg = typeof error === 'string' ? error : error.message;
                updateAssetTestResult(errorMsg, true);
                logToSystem(`Erro ao buscar melhor ativo: ${errorMsg}`, 'ERROR');
            }
        });
        logToSystem('Botão de busca de melhor ativo configurado', 'DEBUG');
    }
    
    // Botão para mudar para moedas
    if (UI.testSwitchToCurrency) {
        UI.testSwitchToCurrency.addEventListener('click', async () => {
            logToSystem('=== CLIQUE DETECTADO: Mudar para moedas ===', 'INFO');
            updateAssetTestResult('Mudando para categoria Currencies...');
            
            try {
                const result = await testSwitchAssetCategory('currency');
                updateAssetTestResult(result.message);
                logToSystem(`Mudança para moedas: ${result.message}`, 'SUCCESS');
            } catch (error) {
                const errorMsg = typeof error === 'string' ? error : error.message;
                updateAssetTestResult(errorMsg, true);
                logToSystem(`Erro ao mudar para moedas: ${errorMsg}`, 'ERROR');
            }
        });
        logToSystem('Botão de mudança para moedas configurado', 'DEBUG');
    }
    
    // Botão para mudar para crypto
    if (UI.testSwitchToCrypto) {
        UI.testSwitchToCrypto.addEventListener('click', async () => {
            logToSystem('=== CLIQUE DETECTADO: Mudar para crypto ===', 'INFO');
            updateAssetTestResult('Mudando para categoria Cryptocurrencies...');
            
            try {
                const result = await testSwitchAssetCategory('crypto');
                updateAssetTestResult(result.message);
                logToSystem(`Mudança para crypto: ${result.message}`, 'SUCCESS');
            } catch (error) {
                const errorMsg = typeof error === 'string' ? error : error.message;
                updateAssetTestResult(errorMsg, true);
                logToSystem(`Erro ao mudar para crypto: ${errorMsg}`, 'ERROR');
            }
        });
        logToSystem('Botão de mudança para crypto configurado', 'DEBUG');
    }
    
    logToSystem('Botões de teste de payout e ativos configurados com sucesso', 'INFO');
}

// ================== CONFIGURAÇÃO DOS BOTÕES DE DEBUG DO MODAL ==================

function setupModalDebugButtons() {
    logToSystem('Configurando botões de debug do modal...', 'INFO');
    
    // Função para atualizar resultado dos testes de modal
    const updateModalDebugResult = (message, isError = false) => {
        if (UI.modalDebugResult) {
            UI.modalDebugResult.innerHTML = message;
            UI.modalDebugResult.style.color = isError ? '#d32f2f' : '#333';
            UI.modalDebugResult.style.backgroundColor = isError ? '#ffebee' : '#f9f9f9';
        }
    };
    
    // Botão para abrir modal
    if (UI.debugOpenModal) {
        UI.debugOpenModal.addEventListener('click', async () => {
            logToSystem('=== CLIQUE DETECTADO: Abrir modal ===', 'INFO');
            updateModalDebugResult('🔄 Executando: AssetManager.openAssetModal()...');
            
            try {
                // Usar chrome.runtime para comunicar com content.js
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: 'TEST_OPEN_ASSET_MODAL'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(`Erro de comunicação: ${chrome.runtime.lastError.message}`));
                            return;
                        }
                        resolve(response);
                    });
                });
                
                if (response && response.success) {
                    updateModalDebugResult('✅ Modal aberto com sucesso via AssetManager.openAssetModal()');
                    logToSystem('Modal aberto com sucesso', 'SUCCESS');
                } else {
                    throw new Error(response?.error || 'Erro desconhecido ao abrir modal');
                }
            } catch (error) {
                const errorMsg = error.message;
                updateModalDebugResult(`❌ Erro ao abrir modal: ${errorMsg}`, true);
                logToSystem(`Erro ao abrir modal: ${errorMsg}`, 'ERROR');
            }
        });
        logToSystem('Botão de abrir modal configurado', 'DEBUG');
    }
    
    // Botão para fechar modal
    if (UI.debugCloseModal) {
        UI.debugCloseModal.addEventListener('click', async () => {
            logToSystem('=== CLIQUE DETECTADO: Fechar modal ===', 'INFO');
            updateModalDebugResult('🔄 Executando: AssetManager.closeAssetModal()...');
            
            try {
                // Usar chrome.runtime para comunicar com content.js
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: 'CLOSE_ASSET_MODAL'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(`Erro de comunicação: ${chrome.runtime.lastError.message}`));
                            return;
                        }
                        resolve(response);
                    });
                });
                
                if (response && response.success) {
                    updateModalDebugResult('✅ Modal fechado com sucesso via AssetManager.closeAssetModal()');
                    logToSystem('Modal fechado com sucesso', 'SUCCESS');
                } else {
                    throw new Error(response?.error || 'Erro desconhecido ao fechar modal');
                }
            } catch (error) {
                const errorMsg = error.message;
                updateModalDebugResult(`❌ Erro ao fechar modal: ${errorMsg}`, true);
                logToSystem(`Erro ao fechar modal: ${errorMsg}`, 'ERROR');
            }
        });
        logToSystem('Botão de fechar modal configurado', 'DEBUG');
    }
    
    // Botão para verificar status do modal
    if (UI.debugCheckStatus) {
        UI.debugCheckStatus.addEventListener('click', async () => {
            logToSystem('=== CLIQUE DETECTADO: Verificar status do modal ===', 'INFO');
            updateModalDebugResult('🔍 Verificando status do modal...');
            
            try {
                // Usar chrome.runtime para comunicar com content.js
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: 'GET_MODAL_STATUS'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(`Erro de comunicação: ${chrome.runtime.lastError.message}`));
                            return;
                        }
                        resolve(response);
                    });
                });
                
                if (response && response.success) {
                    updateModalDebugResult(`📊 Status do modal: ${JSON.stringify(response.status, null, 2)}`);
                    logToSystem(`Status do modal verificado: ${JSON.stringify(response.status)}`, 'INFO');
                } else {
                    throw new Error(response?.error || 'Erro desconhecido ao verificar status');
                }
            } catch (error) {
                const errorMsg = error.message;
                updateModalDebugResult(`❌ Erro ao verificar status: ${errorMsg}`, true);
                logToSystem(`Erro ao verificar status do modal: ${errorMsg}`, 'ERROR');
            }
        });
        logToSystem('Botão de verificar status do modal configurado', 'DEBUG');
    }
    
    // Botão de toggle do modal
    if (UI.debugToggleModal) {
        UI.debugToggleModal.addEventListener('click', async () => {
            logToSystem('Testando toggle do modal de ativos...', 'INFO');
            updateModalDebugResult('Testando toggle do modal...', false);
            
            try {
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ action: 'TOGGLE_ASSET_MODAL' }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                if (response && response.success) {
                    updateModalDebugResult(`✅ Toggle executado: ${response.message}`, false);
                } else {
                    updateModalDebugResult(`❌ Erro no toggle: ${response ? response.error : 'Erro desconhecido'}`, true);
                }
            } catch (error) {
                updateModalDebugResult(`❌ Erro no toggle: ${error.message}`, true);
            }
        });
    }
    
    // Botão de debug de captura de ativos
    if (UI.debugAssetCapture) {
        UI.debugAssetCapture.addEventListener('click', async () => {
            logToSystem('Iniciando debug de captura de ativos...', 'INFO');
            updateModalDebugResult('Iniciando debug de captura de ativos...', false);
            
            try {
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ action: 'DEBUG_ASSET_CAPTURE' }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                if (response && response.success) {
                    updateModalDebugResult(`✅ Debug concluído: Modal aberto: ${response.modalOpen}, Containers: ${response.possibleContainers}`, false);
                    logToSystem(`Debug: Modal aberto: ${response.modalOpen}, Containers encontrados: ${response.possibleContainers}`, 'INFO');
                } else {
                    updateModalDebugResult(`❌ Erro no debug: ${response ? response.error : 'Erro desconhecido'}`, true);
                }
            } catch (error) {
                updateModalDebugResult(`❌ Erro no debug: ${error.message}`, true);
            }
        });
    }
    
    // ================== BOTÃO DE TESTE DE COMUNICAÇÃO INTERNA ==================
    // Botão para testar comunicação via window.postMessage
    const testInternalCommunicationBtn = document.createElement('button');
    testInternalCommunicationBtn.className = 'dev-button dev-info';
    testInternalCommunicationBtn.innerHTML = `
        <i class="fas fa-exchange-alt"></i>
        <div class="button-content">
            <span>Teste Comunicação Interna</span>
            <small>Testa window.postMessage</small>
        </div>
    `;
    
    testInternalCommunicationBtn.addEventListener('click', () => {
        logToSystem('=== CLIQUE DETECTADO: Teste de comunicação interna ===', 'INFO');
        updateModalDebugResult('🧪 Testando comunicação interna via window.postMessage...', false);
        
        try {
            // Teste 1: Enviar log via window.postMessage
            const testLogMessage = `Teste de log via window.postMessage - ${new Date().toLocaleTimeString()}`;
            window.postMessage({
                type: 'LOG_MESSAGE',
                data: {
                    message: testLogMessage,
                    level: 'INFO',
                    source: 'dev-tools.js'
                }
            }, '*');
            
            // Teste 2: Enviar status via window.postMessage
            const testStatusMessage = `Status teste via window.postMessage - ${new Date().toLocaleTimeString()}`;
            window.postMessage({
                type: 'UPDATE_STATUS',
                data: {
                    message: testStatusMessage,
                    type: 'success',
                    duration: 5000
                }
            }, '*');
            
            // Teste 3: Enviar log de erro via window.postMessage
            setTimeout(() => {
                window.postMessage({
                    type: 'LOG_MESSAGE',
                    data: {
                        message: 'Teste de log de ERRO via window.postMessage',
                        level: 'ERROR',
                        source: 'dev-tools.js'
                    }
                }, '*');
            }, 1000);
            
            // Teste 4: Enviar status de warning via window.postMessage
            setTimeout(() => {
                window.postMessage({
                    type: 'UPDATE_STATUS',
                    data: {
                        message: 'Teste de status WARNING via window.postMessage',
                        type: 'warn',
                        duration: 3000
                    }
                }, '*');
            }, 2000);
            
            updateModalDebugResult('✅ Testes de comunicação interna enviados!<br><br>Verifique:<br>• Console do navegador<br>• Sistema de logs<br>• Status na tela', false);
            logToSystem('Testes de comunicação interna via window.postMessage enviados com sucesso', 'SUCCESS');
            
        } catch (error) {
            const errorMsg = error.message;
            updateModalDebugResult(`❌ Erro no teste de comunicação: ${errorMsg}`, true);
            logToSystem(`Erro no teste de comunicação interna: ${errorMsg}`, 'ERROR');
        }
    });
    
    // Adicionar o botão ao painel de debug do modal
    const modalDebugPanel = document.querySelector('.sub-panel:has(#modal-debug-result)');
    if (modalDebugPanel) {
        const panelGrid = modalDebugPanel.querySelector('.panel-grid');
        if (panelGrid) {
            panelGrid.appendChild(testInternalCommunicationBtn);
            logToSystem('Botão de teste de comunicação interna adicionado ao painel', 'DEBUG');
        }
    }
    
    logToSystem('Botões de debug do modal configurados com sucesso', 'INFO');
}

// ================== FUNÇÕES DE VISIBILIDADE DO PAINEL ==================

function updateDevPanelVisibility(devModeEnabled) {
    const devPanel = document.getElementById('gale-test-panel');
    if (!devPanel) {
        logToSystem('Painel de desenvolvimento não encontrado no DOM', 'ERROR');
        return;
    }
    
    if (devModeEnabled) {
        devPanel.classList.remove('hidden');
        logToSystem('Painel de desenvolvimento EXIBIDO', 'INFO');
    } else {
        devPanel.classList.add('hidden');
        logToSystem('Painel de desenvolvimento OCULTO', 'INFO');
    }
}

// ================== INICIALIZAÇÃO ==================

function initDevTools() {
    try {
        logToSystem('Inicializando DevTools (seguindo arquitetura)...', 'INFO');
        
        // Aguardar DOM estar pronto antes de configurar botões
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupAllDevToolsButtons();
            });
        } else {
            setupAllDevToolsButtons();
        }
        
        logToSystem('DevTools inicializado com sucesso (seguindo arquitetura)', 'SUCCESS');
    } catch (error) {
        logToSystem(`Erro ao inicializar DevTools: ${error.message}`, 'ERROR');
    }
}

function setupAllDevToolsButtons() {
    try {
        setupCaptureDebugButtons();
        setupGaleTestButtons();
        setupDevAnalysisButton();
        setupPayoutAndAssetTestButtons();
        setupModalDebugButtons();
        logToSystem('Todos os botões do DevTools configurados com sucesso', 'SUCCESS');
    } catch (error) {
        logToSystem(`Erro ao configurar botões do DevTools: ${error.message}`, 'ERROR');
    }
}

// ================== LISTENER PARA MENSAGENS ==================

// Listener para mensagens do chrome.runtime (seguindo arquitetura)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logToSystem(`DevTools recebeu mensagem: ${message.action}`, 'DEBUG');
    
    // Handler para captura de tela
    if (message.action === 'DEV_CAPTURE_SCREEN') {
        captureScreen()
            .then(dataUrl => {
                logToSystem('Captura de tela realizada via mensagem', 'SUCCESS');
                sendResponse({ success: true, dataUrl: dataUrl });
            })
            .catch(error => {
                logToSystem(`Erro na captura via mensagem: ${error.message}`, 'ERROR');
                sendResponse({ success: false, error: error.message });
            });
        return true; // Resposta assíncrona
    }
    
    // Handler para informações do canvas
    if (message.action === 'DEV_GET_CANVAS_INFO') {
        getCanvasInfo()
            .then(canvasInfo => {
                logToSystem('Informações do canvas obtidas via mensagem', 'SUCCESS');
                sendResponse({ success: true, canvasInfo: canvasInfo });
            })
            .catch(error => {
                logToSystem(`Erro ao obter canvas info via mensagem: ${error.message}`, 'ERROR');
                sendResponse({ success: false, error: error.message });
            });
        return true; // Resposta assíncrona
    }
    
    // Handler para captura apenas do gráfico
    if (message.action === 'DEV_CAPTURE_CHART_ONLY') {
        captureChartOnly()
            .then(result => {
                logToSystem('Captura do gráfico realizada via mensagem', 'SUCCESS');
                sendResponse({ success: true, dataUrl: result.dataUrl, canvasInfo: result.canvasInfo });
            })
            .catch(error => {
                logToSystem(`Erro na captura do gráfico via mensagem: ${error.message}`, 'ERROR');
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
    
    // Handler para reset de erro do sistema
    if (message.action === 'SYSTEM_ERROR_RESET') {
        logToSystem('Reset de erro do sistema confirmado', 'INFO');
        sendResponse({ success: true });
        return true;
    }
    
    // Handler para teste de conectividade Gemini
    if (message.action === 'TEST_GEMINI_CONNECTION') {
        testGeminiConnection()
            .then(result => {
                logToSystem('Teste de conectividade Gemini realizado via mensagem', 'SUCCESS');
                sendResponse({ success: true, connected: result });
            })
            .catch(error => {
                logToSystem(`Erro no teste de conectividade: ${error.message}`, 'ERROR');
                sendResponse({ success: false, error: error.message });
            });
        return true; // Resposta assíncrona
    }
    
    // Handler para gerar dados simulados
    if (message.action === 'GENERATE_MOCK_DATA') {
        try {
            const { symbol, timeframe } = message;
            const mockData = generateMockData(symbol, timeframe);
            logToSystem('Dados simulados gerados via mensagem', 'SUCCESS');
            sendResponse({ success: true, data: mockData });
        } catch (error) {
            logToSystem(`Erro ao gerar dados simulados: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
    
    // Handler para renderizar resultados de análise
    if (message.action === 'RENDER_ANALYSIS_RESULTS') {
        try {
            const { result } = message;
            renderAnalysisResults(result);
            logToSystem('Resultados de análise renderizados via mensagem', 'SUCCESS');
            sendResponse({ success: true });
        } catch (error) {
            logToSystem(`Erro ao renderizar resultados: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
    
    return false; // Não processou a mensagem
});

// ================== EXPOSIÇÃO GLOBAL ==================

// Não expor funções globalmente - usar chrome.runtime para comunicação
// Todas as funções são acessadas via mensagens do chrome.runtime

logToSystem('Módulo DevTools carregado (seguindo arquitetura)', 'INFO');

// ================== FUNÇÕES DE ANÁLISE E TESTE ==================

// Função para teste de conectividade da API Gemini
const testGeminiConnection = async () => {
    try {
        logToSystem('Verificando conectividade do sistema...', 'INFO');
        updateStatus('Sistema verificando conectividade...', 'info');
        
        // Verificação básica sem fazer requisição real
        if (window.API_KEY && window.API_URL) {
            logToSystem('Configurações de API encontradas', 'SUCCESS');
            updateStatus('Sistema pronto para análises', 'success');
            return true;
        } else {
            logToSystem('Configurações de API não encontradas', 'WARN');
            updateStatus('Sistema em modo limitado', 'warn');
            return false;
        }
    } catch (error) {
        logToSystem(`Erro na verificação: ${error.message}`, 'ERROR');
        updateStatus('Erro na verificação do sistema', 'error');
        return false;
    }
};

// Função para gerar dados simulados
const generateMockData = (symbol, timeframe) => {
    const candles = [];
    const now = Date.now();
    let lastPrice = Math.random() * 1000 + 100; // Preço inicial entre 100 e 1100
    
    // Gerar candles
    for (let i = 0; i < 200; i++) {
        const time = now - (200 - i) * getTimeframeMinutes(timeframe) * 60 * 1000;
        const range = lastPrice * 0.02; // Variação de 2%
        
        const open = lastPrice;
        const close = lastPrice + (Math.random() * range * 2 - range);
        const high = Math.max(open, close) + Math.random() * range * 0.5;
        const low = Math.min(open, close) - Math.random() * range * 0.5;
        const volume = Math.floor(Math.random() * 1000) + 100;
        
        candles.push({ time, open, high, low, close, volume });
        lastPrice = close;
    }
    
    logToSystem(`Gerados ${candles.length} candles simulados para ${symbol}`, 'DEBUG');
    
    return {
        symbol,
        timeframe,
        candles
    };
};

// Converter timeframe para minutos
const getTimeframeMinutes = (timeframe) => {
    switch (timeframe) {
        case '1m': return 1;
        case '5m': return 5;
        case '15m': return 15;
        case '30m': return 30;
        case '1h': return 60;
        case '4h': return 240;
        case '1d': return 1440;
        default: return 60;
    }
};

// Renderizar resultados da análise
const renderAnalysisResults = (result) => {
    try {
        const resultsContainer = document.getElementById('analysis-results');
        if (!resultsContainer) {
            throw new Error('Container de resultados não encontrado');
        }
        
        // Limpar container
        resultsContainer.innerHTML = '';
        
        // Criar cabeçalho
        const header = document.createElement('div');
        header.className = 'analysis-header';
        header.innerHTML = `<h3>Análise de ${result.symbol}</h3>
                          <p>Atualizada em: ${new Date(result.timestamp).toLocaleString()}</p>`;
        resultsContainer.appendChild(header);
        
        // Criar seção de indicadores
        const indicatorsSection = document.createElement('div');
        indicatorsSection.className = 'indicators-section';
        indicatorsSection.innerHTML = `<h4>Indicadores</h4>`;
        
        // Adicionar valores de indicadores
        const indList = document.createElement('ul');
        for (const [key, value] of Object.entries(result.indicators)) {
            if (value && value.length > 0) {
                const lastValue = value[value.length - 1];
                if (lastValue !== null) {
                    const item = document.createElement('li');
                    item.textContent = `${key.toUpperCase()}: ${lastValue.toFixed(2)}`;
                    indList.appendChild(item);
                }
            }
        }
        indicatorsSection.appendChild(indList);
        resultsContainer.appendChild(indicatorsSection);
        
        // Criar seção de sinais
        const signalsSection = document.createElement('div');
        signalsSection.className = 'signals-section';
        signalsSection.innerHTML = `<h4>Sinais (${result.signals.length})</h4>`;
        
        if (result.signals.length > 0) {
            const signalsList = document.createElement('ul');
            result.signals.forEach(signal => {
                const item = document.createElement('li');
                item.className = `signal-item ${signal.significance.toLowerCase()}`;
                item.innerHTML = `<strong>${signal.type}</strong>: ${signal.indicator1} × ${signal.indicator2}`;
                signalsList.appendChild(item);
            });
            signalsSection.appendChild(signalsList);
        } else {
            signalsSection.innerHTML += '<p>Nenhum sinal detectado</p>';
        }
        
        resultsContainer.appendChild(signalsSection);
        
        logToSystem('Resultados da análise renderizados', 'SUCCESS');
    } catch (error) {
        logToSystem(`Erro ao renderizar resultados: ${error.message}`, 'ERROR');
    }
};

// ================== FUNÇÕES DE TESTE DE ATIVOS ==================

// Função para testar troca de categoria de ativos
const testSwitchAssetCategory = async (category) => {
    return new Promise((resolve, reject) => {
        logToSystem(`Iniciando teste de troca para categoria: ${category}`, 'INFO');
        
        chrome.runtime.sendMessage({
            action: 'TEST_SWITCH_ASSET_CATEGORY',
            category: category
        }, (response) => {
            if (chrome.runtime.lastError) {
                const error = `Erro: ${chrome.runtime.lastError.message}`;
                logToSystem(error, 'ERROR');
                reject(error);
                return;
            }
            
            if (response && response.success) {
                let resultText = `${response.message}<br><br>`;
                
                // Mostrar categoria solicitada vs categoria ativa
                const categoryInfo = response.requestedCategory && response.requestedCategory !== response.category ? 
                    `Categoria solicitada: ${response.requestedCategory} → Categoria ativa: ${response.category}` :
                    `Categoria: ${response.category}`;
                
                resultText += `<strong>Ativos de ${response.category}:</strong><br>`;
                resultText += `<small>(${categoryInfo})</small><br><br>`;
                
                // Verificar se temos ativos capturados
                if (response.assets && response.assets.length > 0) {
                    resultText += `📊 Total de ativos encontrados: ${response.totalAssetsFound || response.assets.length}<br><br>`;
                    
                    // Usar a lista formatada se disponível, senão formatar manualmente
                    if (response.assetsList) {
                        resultText += response.assetsList;
                    } else {
                        resultText += formatAssetsList(response.assets);
                    }
                    
                    // Mostrar ativo selecionado se disponível
                    if (response.selectedAsset) {
                        resultText += `<br><br>🎯 <strong>Ativo Selecionado:</strong> ${response.selectedAsset.name} (${response.selectedAsset.payout}%)`;
                    }
                } else {
                    resultText += `❌ Nenhum ativo encontrado na categoria ${response.category}`;
                }
                
                logToSystem(`Teste de troca de categoria concluído: ${response.message}`, 'SUCCESS');
                logToSystem(`Total de ativos capturados: ${response.totalAssetsFound || 0}`, 'INFO');
                
                resolve({
                    success: true,
                    message: resultText,
                    category: response.category,
                    assets: response.assets,
                    selectedAsset: response.selectedAsset,
                    totalAssetsFound: response.totalAssetsFound
                });
            } else {
                const error = `❌ ${response?.error || 'Falha ao mudar categoria'}`;
                logToSystem(`Erro no teste de troca de categoria: ${response?.error}`, 'ERROR');
                reject({
                    success: false,
                    message: error
                });
            }
        });
    });
};

// Função para formatar lista de ativos
const formatAssetsList = (assets) => {
    if (!assets || assets.length === 0) {
        return 'Nenhum ativo encontrado';
    }
    
    return assets.map(asset => 
        `${asset.name} (${asset.payout}%)${asset.isSelected ? ' [SELECIONADO]' : ''}`
    ).join('<br>');
};

// Função para testar busca de melhor ativo
const testFindBestAsset = async (minPayout = 85) => {
    return new Promise((resolve, reject) => {
        logToSystem(`Iniciando busca de melhor ativo (payout >= ${minPayout}%)`, 'INFO');
        
        chrome.runtime.sendMessage({
            action: 'TEST_FIND_BEST_ASSET',
            minPayout: minPayout
        }, (response) => {
            if (chrome.runtime.lastError) {
                const error = `Erro: ${chrome.runtime.lastError.message}`;
                logToSystem(error, 'ERROR');
                reject(error);
                return;
            }
            
            if (response && response.success) {
                logToSystem(`Melhor ativo encontrado: ${response.message}`, 'SUCCESS');
                resolve({
                    success: true,
                    message: response.message,
                    asset: response.asset
                });
            } else {
                const error = `❌ ${response?.error || 'Falha ao encontrar melhor ativo'}`;
                logToSystem(`Erro na busca de melhor ativo: ${response?.error}`, 'ERROR');
                reject({
                    success: false,
                    message: error
                });
            }
        });
    });
};

// ================== INICIALIZAÇÃO AUTOMÁTICA ==================

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        logToSystem('DOM carregado, inicializando DevTools automaticamente...', 'INFO');
        initDevTools();
    });
} else {
    // DOM já está pronto
    logToSystem('DOM já está pronto, inicializando DevTools...', 'INFO');
    initDevTools();
} 
