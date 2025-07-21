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

    // ================== CONFIGURAÇÃO DOS BOTÕES DE TESTE DO SISTEMA GALE ==================

    function setupGaleTestButtons() {
        devLog('Configurando botões de teste do sistema Gale...', 'INFO');
        
        // Verificar se elementos existem
        if (!UI.simulateLoss || !UI.simulateWin || !UI.checkGaleStatus) {
            devLog('Botões de teste de gale não encontrados', 'WARN');
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
            devLog('=== CLIQUE DETECTADO: Simular perda ===', 'INFO');
            if (window.GaleSystem) {
                const result = window.GaleSystem.simulateGale();
                devUpdateStatus(`Simulação de perda: ${result.message}`, result.success ? 'success' : 'error');
                
                // Atualizar display
                const updatedStatus = window.GaleSystem.getStatus();
                updateGaleStatusDisplay(updatedStatus);
            } else {
                devUpdateStatus('Sistema de Gale não está disponível', 'error');
            }
        });
        
        // Botão para simular ganho e resetar gale
        UI.simulateWin.addEventListener('click', () => {
            devLog('=== CLIQUE DETECTADO: Simular ganho ===', 'INFO');
            if (window.GaleSystem) {
                const result = window.GaleSystem.simulateReset();
                devUpdateStatus(`Simulação de ganho: ${result.message}`, result.success ? 'success' : 'info');
                
                // Atualizar display
                const updatedStatus = window.GaleSystem.getStatus();
                updateGaleStatusDisplay(updatedStatus);
            } else {
                devUpdateStatus('Sistema de Gale não está disponível', 'error');
            }
        });
        
        // Botão para verificar status do gale
        UI.checkGaleStatus.addEventListener('click', () => {
            devLog('=== CLIQUE DETECTADO: Verificar status do Gale ===', 'INFO');
            if (window.GaleSystem) {
                const status = window.GaleSystem.getStatus();
                devUpdateStatus(`Status do Gale: Nível ${status.level}, Próx. valor: R$ ${status.nextValue}`, 'info');
                updateGaleStatusDisplay(status);
                
                // Adicionar log com detalhes completos
                devLog(`Status do Gale - Nível: ${status.level}, Ativo: ${status.active}, Valor original: ${status.originalValue}, Próximo valor: ${status.nextValue}`, 'INFO');
            } else {
                devUpdateStatus('Sistema de Gale não está disponível', 'error');
            }
        });
        
        // Botão para resetar status de erro do sistema
        if (UI.resetSystemError) {
            UI.resetSystemError.addEventListener('click', () => {
                devLog('=== CLIQUE DETECTADO: Resetar erro do sistema ===', 'INFO');
                if (window.StateManager) {
                    const wasReset = window.StateManager.resetErrorStatus();
                    if (wasReset) {
                        // Notificar index.js sobre o reset
                        chrome.runtime.sendMessage({
                            action: 'SYSTEM_ERROR_RESET',
                            success: true
                        });
                        devUpdateStatus('Status de erro resetado com sucesso', 'success');
                        devLog('Status de erro do sistema resetado manualmente', 'INFO');
                    } else {
                        devUpdateStatus('Sistema não estava em estado de erro', 'info');
                        devLog('Tentativa de reset, mas sistema não estava em erro', 'DEBUG');
                    }
                } else {
                    devUpdateStatus('StateManager não disponível', 'error');
                    devLog('StateManager não disponível para reset de erro', 'ERROR');
                }
            });
            devLog('Botão de reset de status de erro configurado', 'DEBUG');
        }
        
        devLog('Botões de teste do sistema de Gale configurados com sucesso', 'INFO');
    }

    // ================== CONFIGURAÇÃO DO BOTÃO DE TESTE DE ANÁLISE ==================

    function setupDevAnalysisButton() {
        devLog('Configurando botão de teste de análise...', 'INFO');
        
        if (!UI.testAnalysis) {
            devLog('Botão de teste de análise não encontrado', 'WARN');
            return;
        }
        
        UI.testAnalysis.addEventListener('click', async () => {
            devLog('=== CLIQUE DETECTADO: Teste de análise ===', 'INFO');
            devLog('Executando teste de análise (modo desenvolvedor)', 'INFO');
            
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
                    devLog('Modal de análise de teste exibido com sucesso', 'SUCCESS');
                    devUpdateStatus('Análise de teste executada com sucesso', 'success');
                } else {
                    devLog('Função showAnalysisModal não encontrada', 'ERROR');
                    devUpdateStatus('Erro: Modal não disponível', 'error');
                }
            } catch (error) {
                devLog(`Erro no teste de análise: ${error.message}`, 'ERROR');
                devUpdateStatus(`Erro no teste: ${error.message}`, 'error');
            }
        });
        
        devLog('Botão de teste de análise configurado com sucesso', 'DEBUG');
    }

    // ================== CONFIGURAÇÃO DOS BOTÕES DE TESTE DE PAYOUT E ATIVOS ==================

    function setupPayoutAndAssetTestButtons() {
        devLog('Configurando botões de teste de payout e ativos...', 'INFO');
        
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
                devLog('=== CLIQUE DETECTADO: Teste de captura de payout ===', 'INFO');
                
                // Atualizar resultado na tela
                if (UI.payoutResult) {
                    UI.payoutResult.textContent = 'Capturando payout...';
                    UI.payoutResult.style.backgroundColor = '#f0f8ff';
                }
                
                devLog('Iniciando teste de captura de payout via content.js', 'INFO');
                devUpdateStatus('Capturando payout do DOM...', 'info');
                
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
                    
                    devLog(`✅ Payout capturado com sucesso: ${response.payout}%`, 'SUCCESS');
                    devUpdateStatus(`Payout capturado: ${response.payout}%`, 'success');
                    
                } catch (error) {
                    const errorMsg = error.message;
                    devLog(`❌ Erro na captura de payout: ${errorMsg}`, 'ERROR');
                    devUpdateStatus(`Erro na captura: ${errorMsg}`, 'error');
                    
                    if (UI.payoutResult) {
                        UI.payoutResult.textContent = `Erro: ${errorMsg}`;
                        UI.payoutResult.style.backgroundColor = '#ffebee';
                    }
                }
            });
            devLog('Botão de teste de captura de payout configurado', 'DEBUG');
        }
        
        // Botão para buscar melhor ativo
        if (UI.testFindBestAsset) {
            UI.testFindBestAsset.addEventListener('click', async () => {
                devLog('=== CLIQUE DETECTADO: Buscar melhor ativo ===', 'INFO');
                const minPayout = parseInt(UI.minPayoutInput?.value || '85', 10);
                updateAssetTestResult(`Buscando melhor ativo (payout >= ${minPayout}%)...`);
                
                try {
                    const result = await testFindBestAsset(minPayout);
                    updateAssetTestResult(result.message);
                    devLog(`Melhor ativo encontrado: ${result.message}`, 'SUCCESS');
                } catch (error) {
                    const errorMsg = typeof error === 'string' ? error : error.message;
                    updateAssetTestResult(errorMsg, true);
                    devLog(`Erro ao buscar melhor ativo: ${errorMsg}`, 'ERROR');
                }
            });
            devLog('Botão de busca de melhor ativo configurado', 'DEBUG');
        }
        
        // Botão para mudar para moedas
        if (UI.testSwitchToCurrency) {
            UI.testSwitchToCurrency.addEventListener('click', async () => {
                devLog('=== CLIQUE DETECTADO: Mudar para moedas ===', 'INFO');
                updateAssetTestResult('Mudando para categoria Currencies...');
                
                try {
                    const result = await testSwitchAssetCategory('currency');
                    updateAssetTestResult(result.message);
                    devLog(`Mudança para moedas: ${result.message}`, 'SUCCESS');
                } catch (error) {
                    const errorMsg = typeof error === 'string' ? error : error.message;
                    updateAssetTestResult(errorMsg, true);
                    devLog(`Erro ao mudar para moedas: ${errorMsg}`, 'ERROR');
                }
            });
            devLog('Botão de mudança para moedas configurado', 'DEBUG');
        }
        
        // Botão para mudar para crypto
        if (UI.testSwitchToCrypto) {
            UI.testSwitchToCrypto.addEventListener('click', async () => {
                devLog('=== CLIQUE DETECTADO: Mudar para crypto ===', 'INFO');
                updateAssetTestResult('Mudando para categoria Cryptocurrencies...');
                
                try {
                    const result = await testSwitchAssetCategory('crypto');
                    updateAssetTestResult(result.message);
                    devLog(`Mudança para crypto: ${result.message}`, 'SUCCESS');
                } catch (error) {
                    const errorMsg = typeof error === 'string' ? error : error.message;
                    updateAssetTestResult(errorMsg, true);
                    devLog(`Erro ao mudar para crypto: ${errorMsg}`, 'ERROR');
                }
            });
            devLog('Botão de mudança para crypto configurado', 'DEBUG');
        }
        
        devLog('Botões de teste de payout e ativos configurados com sucesso', 'INFO');
    }

    // ================== CONFIGURAÇÃO DOS BOTÕES DE DEBUG DO MODAL ==================

    function setupModalDebugButtons() {
        devLog('Configurando botões de debug do modal...', 'INFO');
        
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
                devLog('=== CLIQUE DETECTADO: Abrir modal ===', 'INFO');
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
                        devLog('Modal aberto com sucesso', 'SUCCESS');
                    } else {
                        throw new Error(response?.error || 'Erro desconhecido ao abrir modal');
                    }
                } catch (error) {
                    const errorMsg = error.message;
                    updateModalDebugResult(`❌ Erro ao abrir modal: ${errorMsg}`, true);
                    devLog(`Erro ao abrir modal: ${errorMsg}`, 'ERROR');
                }
            });
            devLog('Botão de abrir modal configurado', 'DEBUG');
        }
        
        // Botão para fechar modal
        if (UI.debugCloseModal) {
            UI.debugCloseModal.addEventListener('click', async () => {
                devLog('=== CLIQUE DETECTADO: Fechar modal ===', 'INFO');
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
                        devLog('Modal fechado com sucesso', 'SUCCESS');
                    } else {
                        throw new Error(response?.error || 'Erro desconhecido ao fechar modal');
                    }
                } catch (error) {
                    const errorMsg = error.message;
                    updateModalDebugResult(`❌ Erro ao fechar modal: ${errorMsg}`, true);
                    devLog(`Erro ao fechar modal: ${errorMsg}`, 'ERROR');
                }
            });
            devLog('Botão de fechar modal configurado', 'DEBUG');
        }
        
        // Botão para verificar status do modal
        if (UI.debugCheckStatus) {
            UI.debugCheckStatus.addEventListener('click', async () => {
                devLog('=== CLIQUE DETECTADO: Verificar status do modal ===', 'INFO');
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
                        devLog(`Status do modal verificado: ${JSON.stringify(response.status)}`, 'INFO');
                    } else {
                        throw new Error(response?.error || 'Erro desconhecido ao verificar status');
                    }
                } catch (error) {
                    const errorMsg = error.message;
                    updateModalDebugResult(`❌ Erro ao verificar status: ${errorMsg}`, true);
                    devLog(`Erro ao verificar status do modal: ${errorMsg}`, 'ERROR');
                }
            });
            devLog('Botão de verificar status do modal configurado', 'DEBUG');
        }
        
        // Botão de toggle do modal
        if (UI.debugToggleModal) {
            UI.debugToggleModal.addEventListener('click', async () => {
                devLog('Testando toggle do modal de ativos...', 'INFO');
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
                devLog('Iniciando debug de captura de ativos...', 'INFO');
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
                        devLog(`Debug: Modal aberto: ${response.modalOpen}, Containers encontrados: ${response.possibleContainers}`, 'INFO');
                    } else {
                        updateModalDebugResult(`❌ Erro no debug: ${response ? response.error : 'Erro desconhecido'}`, true);
                    }
                } catch (error) {
                    updateModalDebugResult(`❌ Erro no debug: ${error.message}`, true);
                }
            });
        }
        
        devLog('Botões de debug do modal configurados com sucesso', 'INFO');
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
            setupGaleTestButtons();
            setupDevAnalysisButton();
            setupPayoutAndAssetTestButtons();
            setupModalDebugButtons();
            
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
        
        // Handler para reset de erro do sistema
        if (message.action === 'SYSTEM_ERROR_RESET') {
            devLog('Reset de erro do sistema confirmado', 'INFO');
            sendResponse({ success: true });
            return true;
        }
        
        // Handler para teste de conectividade Gemini
        if (message.action === 'TEST_GEMINI_CONNECTION') {
            testGeminiConnection()
                .then(result => {
                    devLog('Teste de conectividade Gemini realizado via mensagem', 'SUCCESS');
                    sendResponse({ success: true, connected: result });
                })
                .catch(error => {
                    devLog(`Erro no teste de conectividade: ${error.message}`, 'ERROR');
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Resposta assíncrona
        }
        
        // Handler para gerar dados simulados
        if (message.action === 'GENERATE_MOCK_DATA') {
            try {
                const { symbol, timeframe } = message;
                const mockData = generateMockData(symbol, timeframe);
                devLog('Dados simulados gerados via mensagem', 'SUCCESS');
                sendResponse({ success: true, data: mockData });
            } catch (error) {
                devLog(`Erro ao gerar dados simulados: ${error.message}`, 'ERROR');
                sendResponse({ success: false, error: error.message });
            }
            return true;
        }
        
        // Handler para renderizar resultados de análise
        if (message.action === 'RENDER_ANALYSIS_RESULTS') {
            try {
                const { result } = message;
                renderAnalysisResults(result);
                devLog('Resultados de análise renderizados via mensagem', 'SUCCESS');
                sendResponse({ success: true });
            } catch (error) {
                devLog(`Erro ao renderizar resultados: ${error.message}`, 'ERROR');
                sendResponse({ success: false, error: error.message });
            }
            return true;
        }
        
        return false; // Não processou a mensagem
    });

    // ================== EXPOSIÇÃO GLOBAL ==================
    
    // Não expor funções globalmente - usar chrome.runtime para comunicação
    // Todas as funções são acessadas via mensagens do chrome.runtime
    
    devLog('Módulo DevTools carregado (seguindo arquitetura)', 'INFO');
    
    // ================== FUNÇÕES DE ANÁLISE E TESTE ==================
    
    // Função para teste de conectividade da API Gemini
    const testGeminiConnection = async () => {
        try {
            devLog('Verificando conectividade do sistema...', 'INFO');
            devUpdateStatus('Sistema verificando conectividade...', 'info');
            
            // Verificação básica sem fazer requisição real
            if (window.API_KEY && window.API_URL) {
                devLog('Configurações de API encontradas', 'SUCCESS');
                devUpdateStatus('Sistema pronto para análises', 'success');
                return true;
            } else {
                devLog('Configurações de API não encontradas', 'WARN');
                devUpdateStatus('Sistema em modo limitado', 'warn');
                return false;
            }
        } catch (error) {
            devLog(`Erro na verificação: ${error.message}`, 'ERROR');
            devUpdateStatus('Erro na verificação do sistema', 'error');
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
        
        devLog(`Gerados ${candles.length} candles simulados para ${symbol}`, 'DEBUG');
        
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
            
            devLog('Resultados da análise renderizados', 'SUCCESS');
        } catch (error) {
            devLog(`Erro ao renderizar resultados: ${error.message}`, 'ERROR');
        }
    };
    
    // ================== FUNÇÕES DE TESTE DE ATIVOS ==================
    
    // Função para testar troca de categoria de ativos
    const testSwitchAssetCategory = async (category) => {
        return new Promise((resolve, reject) => {
            devLog(`Iniciando teste de troca para categoria: ${category}`, 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'TEST_SWITCH_ASSET_CATEGORY',
                category: category
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `Erro: ${chrome.runtime.lastError.message}`;
                    devLog(error, 'ERROR');
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
                    
                    devLog(`Teste de troca de categoria concluído: ${response.message}`, 'SUCCESS');
                    devLog(`Total de ativos capturados: ${response.totalAssetsFound || 0}`, 'INFO');
                    
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
                    devLog(`Erro no teste de troca de categoria: ${response?.error}`, 'ERROR');
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
            devLog(`Iniciando busca de melhor ativo (payout >= ${minPayout}%)`, 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'TEST_FIND_BEST_ASSET',
                minPayout: minPayout
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `Erro: ${chrome.runtime.lastError.message}`;
                    devLog(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                if (response && response.success) {
                    devLog(`Melhor ativo encontrado: ${response.message}`, 'SUCCESS');
                    resolve({
                        success: true,
                        message: response.message,
                        asset: response.asset
                    });
                } else {
                    const error = `❌ ${response?.error || 'Falha ao encontrar melhor ativo'}`;
                    devLog(`Erro na busca de melhor ativo: ${response?.error}`, 'ERROR');
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
            devLog('DOM carregado, inicializando DevTools automaticamente...', 'INFO');
            initDevTools();
        });
    } else {
        // DOM já está pronto
        devLog('DOM já está pronto, inicializando DevTools...', 'INFO');
        initDevTools();
    } 