const AUTOMATION_LOG_PREFIX = '[AutomationSim]';

// Nova função para enviar logs para o sistema centralizado (via background.js)
function sendToLogSystem(message, level = 'INFO') {
    try {
        chrome.runtime.sendMessage({
            action: 'addLog',
            logMessage: message,
            level: level,
            source: 'automation.js' // Fonte explícita
        });
    } catch (error) {
        // Fallback para console.warn APENAS se o envio da mensagem falhar
        console.warn(`${AUTOMATION_LOG_PREFIX} Falha crítica ao enviar log para o sistema central: "${message}". Erro: ${error.message}`);
    }
}

// Função padronizada para enviar status para o index
function toUpdateStatus(message, type = 'info', duration = 5000) {
    if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
            action: 'updateStatus',
            message: message,
            type: type,
            duration: duration
        });
    }
}

// ======================================================================
// =================== SISTEMA DE TROCA DE ATIVOS ======================
// ======================================================================

/**
 * Função para trocar para o melhor ativo disponível baseado no payout
 * @param {number} minPayout - Payout mínimo desejado (padrão: 85%)
 * @param {string} preferredCategory - Categoria preferida ('crypto', 'currency', etc.)
 * @returns {Promise<Object>} Resultado da operação
 */
async function switchToBestAsset(minPayout = 85, preferredCategory = 'crypto') {
    return new Promise((resolve, reject) => {
        try {
            // Log com stack trace para identificar quem está chamando esta função
            const stack = new Error().stack;
            sendToLogSystem(`🚨 [switchToBestAsset] CHAMADA DETECTADA - payout >= ${minPayout}%, categoria: ${preferredCategory}`, 'WARN');
            sendToLogSystem(`🚨 [switchToBestAsset] Stack trace: ${stack}`, 'DEBUG');
            
            sendToLogSystem(`Iniciando troca para melhor ativo (payout >= ${minPayout}%, categoria: ${preferredCategory})`, 'INFO');
            toUpdateStatus(`Procurando melhor ativo (>=${minPayout}%)...`, 'info', 3000);
            
            // Solicitar troca de ativo via background.js -> content.js
            chrome.runtime.sendMessage({
                action: 'TEST_SWITCH_TO_BEST_ASSET',
                minPayout: minPayout,
                category: preferredCategory
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = `Erro na comunicação para troca de ativo: ${chrome.runtime.lastError.message}`;
                    sendToLogSystem(errorMsg, 'ERROR');
                    toUpdateStatus(errorMsg, 'error', 5000);
                    reject(new Error(errorMsg));
                    return;
                }
                
                if (response && response.success) {
                    const successMsg = `Ativo alterado: ${response.asset.name} (${response.asset.payout}%)`;
                    sendToLogSystem(successMsg, 'SUCCESS');
                    toUpdateStatus(successMsg, 'success', 4000);
                    resolve(response);
                } else {
                    const errorMsg = response?.error || 'Falha na troca de ativo';
                    sendToLogSystem(errorMsg, 'ERROR');
                    toUpdateStatus(errorMsg, 'error', 5000);
                    reject(new Error(errorMsg));
                }
            });
        } catch (error) {
            const errorMsg = `Erro ao solicitar troca de ativo: ${error.message}`;
            sendToLogSystem(errorMsg, 'ERROR');
            toUpdateStatus(errorMsg, 'error', 5000);
            reject(error);
        }
    });
}

/**
 * Função para verificar se o ativo atual atende ao payout mínimo
 * @param {number} minPayout - Payout mínimo desejado
 * @returns {Promise<Object>} Resultado da verificação
 */
async function checkCurrentAssetPayout(minPayout = 85) {
    return new Promise((resolve, reject) => {
        try {
            sendToLogSystem(`🔍 Verificando payout do ativo atual (mínimo: ${minPayout}%)...`, 'DEBUG');
            
            // Solicitar payout atual via sistema existente
            getCurrentPayout()
                .then(payoutResult => {
                    const currentPayout = payoutResult.payout;
                    const isAdequate = currentPayout >= minPayout;
                    const needsSwitch = !isAdequate;
                    
                    sendToLogSystem(`📊 Resultado da verificação: Payout=${currentPayout}%, Mínimo=${minPayout}%, Adequado=${isAdequate}, NecessitaTroca=${needsSwitch}`, 'INFO');
                    
                    resolve({
                        success: true,
                        currentPayout: currentPayout,
                        minPayout: minPayout,
                        isAdequate: isAdequate,
                        needsSwitch: needsSwitch
                    });
                })
                .catch(error => {
                    sendToLogSystem(`❌ Erro ao verificar payout: ${error.message}`, 'ERROR');
                    resolve({
                        success: false,
                        error: error.message,
                        needsSwitch: true // Assumir que precisa trocar em caso de erro
                    });
                });
        } catch (error) {
            sendToLogSystem(`❌ Erro na verificação de payout: ${error.message}`, 'ERROR');
            reject(error);
        }
    });
}

/**
 * Função principal para garantir que estamos operando com o melhor ativo
 * @param {number} minPayout - Payout mínimo desejado
 * @param {string} preferredCategory - Categoria preferida
 * @returns {Promise<Object>} Resultado da operação
 */
async function ensureBestAsset(minPayout = 85, preferredCategory = 'crypto') {
    try {
        sendToLogSystem(`🔍 [ensureBestAsset] Iniciando verificação de ativo (mínimo: ${minPayout}%, categoria: ${preferredCategory})`, 'INFO');
        toUpdateStatus(`Verificando payout atual (mín: ${minPayout}%)...`, 'info', 3000);
        
        // Primeiro verificar o ativo atual
        sendToLogSystem(`🔍 [ensureBestAsset] Chamando checkCurrentAssetPayout...`, 'DEBUG');
        const currentCheck = await checkCurrentAssetPayout(minPayout);
        
        sendToLogSystem(`🔍 [ensureBestAsset] Resultado da verificação: success=${currentCheck.success}, needsSwitch=${currentCheck.needsSwitch}`, 'DEBUG');
        
        if (currentCheck.success && !currentCheck.needsSwitch) {
            sendToLogSystem(`✅ [ensureBestAsset] Ativo atual adequado (${currentCheck.currentPayout}% >= ${minPayout}%), MANTENDO ativo atual`, 'SUCCESS');
            toUpdateStatus(`Ativo atual OK (${currentCheck.currentPayout}%)`, 'success', 2000);
            return {
                success: true,
                action: 'kept_current',
                currentPayout: currentCheck.currentPayout,
                message: `Ativo atual mantido (${currentCheck.currentPayout}%)`
            };
        }
        
        // Se chegou aqui, precisa trocar de ativo
        sendToLogSystem(`⚠️ [ensureBestAsset] Ativo atual inadequado ou não verificável. Motivo: success=${currentCheck.success}, needsSwitch=${currentCheck.needsSwitch}`, 'WARN');
        sendToLogSystem(`🔄 [ensureBestAsset] Iniciando processo de troca de ativo...`, 'INFO');
        toUpdateStatus(`Procurando melhor ativo (>=${minPayout}%)...`, 'warn', 4000);
        
        const switchResult = await switchToBestAsset(minPayout, preferredCategory);
        
        if (switchResult.success) {
            sendToLogSystem(`🎯 [ensureBestAsset] Ativo alterado com sucesso: ${switchResult.asset.name} (${switchResult.asset.payout}%)`, 'SUCCESS');
            toUpdateStatus(`Ativo alterado: ${switchResult.asset.name} (${switchResult.asset.payout}%)`, 'success', 4000);
            
            return {
                success: true,
                action: 'switched',
                asset: switchResult.asset,
                message: switchResult.message
            };
        } else {
            throw new Error(switchResult.error || 'Falha na troca de ativo');
        }
    } catch (error) {
        sendToLogSystem(`❌ [ensureBestAsset] Erro ao garantir melhor ativo: ${error.message}`, 'ERROR');
        toUpdateStatus(`Erro na troca de ativo: ${error.message}`, 'error', 5000);
        return {
            success: false,
            error: error.message
        };
    }
}

// ======================================================================
// =================== INTEGRAÇÃO COM SISTEMA DE AUTOMAÇÃO =============
// ======================================================================

/**
 * Função principal para executar operação com verificação automática de ativo
 * @param {string} action - Ação a ser executada (BUY/SELL)
 * @param {Object} config - Configurações da operação
 * @param {boolean} autoSwitchAsset - Se deve trocar ativo automaticamente
 * @returns {Promise<Object>} Resultado da operação
 */
async function executeTradeWithAssetCheck(action, config = {}, autoSwitchAsset = true) {
    try {
        sendToLogSystem(`🚀 Iniciando operação ${action} com verificação de ativo`, 'INFO');
        
        // Configurações padrão
        const operationConfig = {
            tradeValue: config.tradeValue || 10,
            tradeTime: config.tradeTime || 1,
            minPayout: config.minPayout || 85,
            preferredCategory: config.preferredCategory || 'crypto',
            analysisResult: config.analysisResult || null,
            useDynamicPeriod: config.useDynamicPeriod || false,
            ...config
        };
        
        sendToLogSystem(`📋 Configurações: Valor=${operationConfig.tradeValue}, Tempo=${operationConfig.tradeTime}min, PayoutMin=${operationConfig.minPayout}%`, 'INFO');
        
        // Etapa 1: Verificar e trocar ativo se necessário
        if (autoSwitchAsset) {
            toUpdateStatus('Verificando ativo ideal...', 'info', 2000);
            
            const assetResult = await ensureBestAsset(
                operationConfig.minPayout, 
                operationConfig.preferredCategory
            );
            
            if (!assetResult.success) {
                throw new Error(`Falha na verificação de ativo: ${assetResult.error}`);
            }
            
            // Log do resultado da verificação de ativo
            if (assetResult.action === 'switched') {
                sendToLogSystem(`🔄 Ativo alterado para: ${assetResult.asset.name} (${assetResult.asset.payout}%)`, 'SUCCESS');
            } else {
                sendToLogSystem(`✅ Ativo atual mantido (${assetResult.currentPayout}%)`, 'INFO');
            }
            
            // Aguardar um momento após troca de ativo
            if (assetResult.action === 'switched') {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Etapa 2: Executar a operação
        toUpdateStatus(`Executando ${action}...`, 'info', 2000);
        
        const tradeResult = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'EXECUTE_TRADE_ACTION',
                tradeAction: action,
                tradeData: {
                    tradeValue: operationConfig.tradeValue,
                    tradeTime: operationConfig.tradeTime,
                    analysisResult: operationConfig.analysisResult,
                    useDynamicPeriod: operationConfig.useDynamicPeriod,
                    minPayout: operationConfig.minPayout,
                    isFromAutomation: true
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response?.error || 'Falha na execução da operação'));
                }
            });
        });
        
        sendToLogSystem(`✅ Operação ${action} executada com sucesso`, 'SUCCESS');
        toUpdateStatus(`${action} executado com sucesso!`, 'success', 3000);
        
        return {
            success: true,
            action: action,
            tradeResult: tradeResult,
            message: `Operação ${action} concluída com sucesso`
        };
        
    } catch (error) {
        sendToLogSystem(`❌ Erro na operação ${action}: ${error.message}`, 'ERROR');
        toUpdateStatus(`Erro: ${error.message}`, 'error', 5000);
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Função para executar análise com verificação automática de ativo
 * @param {Object} config - Configurações da análise
 * @returns {Promise<Object>} Resultado da análise e operação
 */
async function executeAnalysisWithAssetCheck(config = {}) {
    try {
        sendToLogSystem(`🔍 Iniciando análise com verificação de ativo`, 'INFO');
        
        const analysisConfig = {
            minPayout: config.minPayout || 85,
            preferredCategory: config.preferredCategory || 'crypto',
            autoExecute: config.autoExecute !== false, // Padrão true
            ...config
        };
        
        // Etapa 1: Verificar e trocar ativo se necessário
        toUpdateStatus('Verificando ativo para análise...', 'info', 2000);
        
        const assetResult = await ensureBestAsset(
            analysisConfig.minPayout, 
            analysisConfig.preferredCategory
        );
        
        if (!assetResult.success) {
            throw new Error(`Falha na verificação de ativo: ${assetResult.error}`);
        }
        
        // Aguardar um momento após troca de ativo
        if (assetResult.action === 'switched') {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // Etapa 2: Executar análise
        toUpdateStatus('Executando análise...', 'info', 2000);
        
        const analysisResult = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'ANALYZE_GRAPH'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response?.error || 'Falha na análise'));
                }
            });
        });
        
        sendToLogSystem(`✅ Análise concluída com sucesso`, 'SUCCESS');
        
        return {
            success: true,
            assetResult: assetResult,
            analysisResult: analysisResult,
            message: 'Análise com verificação de ativo concluída'
        };
        
    } catch (error) {
        sendToLogSystem(`❌ Erro na análise com verificação de ativo: ${error.message}`, 'ERROR');
        toUpdateStatus(`Erro na análise: ${error.message}`, 'error', 5000);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Função para obter o payout atual da plataforma (solicita ao content.js) - VERSÃO ROBUSTA
async function getCurrentPayout() {
    return new Promise((resolve, reject) => {
        try {
            sendToLogSystem('🔍 Solicitando payout atual ao content.js...', 'DEBUG');
            
            // Timeout de segurança para evitar travamento
            const timeoutId = setTimeout(() => {
                const errorMsg = 'Timeout: Solicitação de payout demorou mais de 8 segundos';
                sendToLogSystem(errorMsg, 'ERROR');
                reject(new Error(errorMsg));
            }, 8000);
            
            // Verificar se o contexto da extensão ainda é válido
            if (!chrome.runtime || !chrome.runtime.id) {
                clearTimeout(timeoutId);
                const errorMsg = 'Contexto da extensão inválido para solicitar payout';
                sendToLogSystem(errorMsg, 'ERROR');
                reject(new Error(errorMsg));
                return;
            }
            
            // Solicitar payout ao content.js via chrome.runtime
            chrome.runtime.sendMessage({
                action: 'GET_CURRENT_PAYOUT'
            }, (response) => {
                clearTimeout(timeoutId);
                
                // Verificar erro de runtime primeiro
                if (chrome.runtime.lastError) {
                    const errorMsg = `Erro de comunicação: ${chrome.runtime.lastError.message}`;
                    sendToLogSystem(errorMsg, 'ERROR');
                    
                    // Se for "message port closed", tentar novamente uma vez
                    if (chrome.runtime.lastError.message.includes('message port closed')) {
                        sendToLogSystem('Tentando novamente após "message port closed"...', 'WARN');
                        
                        setTimeout(() => {
                            getCurrentPayout().then(resolve).catch(reject);
                        }, 1000);
                        return;
                    }
                    
                    reject(new Error(errorMsg));
                    return;
                }
                
                // Verificar se recebeu resposta
                if (!response) {
                    const errorMsg = 'Nenhuma resposta recebida do content.js para solicitação de payout';
                    sendToLogSystem(errorMsg, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                // Verificar se a operação foi bem-sucedida
                if (!response.success) {
                    const errorMsg = response.error || 'Erro desconhecido ao obter payout';
                    sendToLogSystem(errorMsg, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                // Validar o valor do payout
                if (typeof response.payout !== 'number' || response.payout <= 0 || response.payout > 100) {
                    const errorMsg = `Payout inválido recebido: ${response.payout}`;
                    sendToLogSystem(errorMsg, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                sendToLogSystem(`✅ Payout capturado: ${response.payout}%`, 'SUCCESS');
                resolve({ success: true, payout: response.payout });
            });
            
        } catch (error) {
            sendToLogSystem(`Erro ao solicitar payout: ${error.message}`, 'ERROR');
            reject(error);
        }
    });
}

// Função para verificar payout antes de análise e aplicar comportamento configurado
async function checkPayoutBeforeAnalysis() {
    return new Promise(async (resolve, reject) => {
        chrome.storage.sync.get(['userConfig'], async (storageResult) => {
            if (chrome.runtime.lastError) {
                const errorMsg = `Falha ao ler userConfig para verificação de payout: ${chrome.runtime.lastError.message}`;
                sendToLogSystem(errorMsg, 'ERROR');
                reject(errorMsg);
                return;
            }

            const config = storageResult.userConfig || {};
            const minPayout = parseFloat(config.minPayout) || 80;
            const payoutBehavior = config.payoutBehavior || 'cancel';
            const checkInterval = parseInt(config.payoutTimeout) || 5; // Renomeado para checkInterval
            
            sendToLogSystem(`Verificando payout: Mínimo=${minPayout}%, Comportamento=${payoutBehavior}, Intervalo=${checkInterval}s`, 'INFO');
            
            // Obter payout atual usando await
            const payoutResult = await getCurrentPayout();
            const currentPayout = payoutResult.payout;
            sendToLogSystem(`Payout atual detectado: ${currentPayout}%`, 'INFO');
            
            if (currentPayout >= minPayout) {
                sendToLogSystem(`Payout adequado (${currentPayout}% >= ${minPayout}%). Prosseguindo com análise.`, 'SUCCESS');
                resolve(true);
                return;
            }
            
            // Payout insuficiente - aplicar comportamento configurado
            sendToLogSystem(`Payout insuficiente (${currentPayout}% < ${minPayout}%). Aplicando comportamento: ${payoutBehavior}`, 'WARN');
            
            switch (payoutBehavior) {
                case 'cancel':
                    const cancelMsg = `Análise cancelada: Payout atual (${currentPayout}%) abaixo do mínimo configurado (${minPayout}%).`;
                    sendToLogSystem(cancelMsg, 'WARN');
                    toUpdateStatus(cancelMsg, 'warn', 8000);
                    reject('PAYOUT_INSUFFICIENT');
                    break;
                    
                case 'wait':
                    sendToLogSystem(`Iniciando monitoramento contínuo de payout (mínimo: ${minPayout}%, intervalo: ${checkInterval}s)...`, 'INFO');
                    toUpdateStatus(`Monitoramento de payout ativo - aguardando ${minPayout}%...`, 'info', 0);
                    waitForPayoutImprovement(minPayout, checkInterval, resolve, reject);
                    break;
                    
                case 'switch':
                    sendToLogSystem(`Iniciando troca automática de ativo (payout atual: ${currentPayout}%, mínimo: ${minPayout}%)...`, 'INFO');
                    toUpdateStatus(`Payout baixo (${currentPayout}%). Procurando melhor ativo...`, 'warn', 4000);
                    
                    // Obter configurações de troca de ativos
                    const assetConfig = config.assetSwitching || {};
                    const preferredCategory = assetConfig.preferredCategory || 'crypto';
                    
                    // Usar a função ensureBestAsset para trocar
                    ensureBestAsset(minPayout, preferredCategory)
                        .then(assetResult => {
                            if (assetResult.success) {
                                sendToLogSystem(`✅ ${assetResult.message}`, 'SUCCESS');
                                toUpdateStatus(assetResult.message, 'success', 4000);
                                
                                // Aguardar um pouco para a interface atualizar e resolver
                                setTimeout(() => {
                                    sendToLogSystem('Troca de ativo concluída. Prosseguindo com análise.', 'SUCCESS');
                                    resolve(true);
                                }, 2000);
                            } else {
                                sendToLogSystem(`❌ Falha na troca de ativo: ${assetResult.error}`, 'ERROR');
                                toUpdateStatus(`Erro na troca de ativo: ${assetResult.error}`, 'error', 5000);
                                reject(`ASSET_SWITCH_FAILED: ${assetResult.error}`);
                            }
                        })
                        .catch(error => {
                            sendToLogSystem(`❌ Erro na troca de ativo: ${error.message || error}`, 'ERROR');
                            toUpdateStatus(`Erro na troca de ativo: ${error.message || error}`, 'error', 5000);
                            reject(`ASSET_SWITCH_ERROR: ${error.message || error}`);
                        });
                    break;
                    
                default:
                    sendToLogSystem(`Comportamento de payout desconhecido: ${payoutBehavior}. Cancelando.`, 'ERROR');
                    reject('UNKNOWN_BEHAVIOR');
            }
        });
    });
}

// Função auxiliar para aguardar melhora do payout (loop contínuo sem timeout)
function waitForPayoutImprovement(minPayout, checkInterval, resolve, reject) {
    let elapsedTime = 0;
    let waitInterval = null;
    let lastStatusUpdate = 0;
    let isCancelled = false;
    
    // Log inicial único
    sendToLogSystem(`Aguardando payout adequado - monitoramento ativo (mínimo: ${minPayout}%, verificação a cada ${checkInterval}s)`, 'INFO');
    
    const checkPayoutPeriodically = async () => {
        // Verificar cancelamento via storage ou mensagem
        try {
            const result = await new Promise((storageResolve) => {
                chrome.storage.local.get(['cancelPayoutWait'], (data) => {
                    storageResolve(data.cancelPayoutWait || false);
                });
            });
            
            if (result || isCancelled) {
                clearInterval(waitInterval);
                sendToLogSystem('Monitoramento de payout cancelado', 'INFO');
                toUpdateStatus('Aguardo de payout cancelado', 'warn', 3000);
                
                // Limpar flag de cancelamento
                chrome.storage.local.remove(['cancelPayoutWait']);
                reject('USER_CANCELLED');
                return;
            }
        } catch (storageError) {
            sendToLogSystem(`Erro ao verificar cancelamento: ${storageError.message}`, 'WARN');
        }
        
        try {
            const payoutResult = await getCurrentPayout();
            const currentPayout = payoutResult.payout;
            elapsedTime += checkInterval; // Incrementar pelo intervalo de verificação
            
            // Verificar se o payout melhorou
            if (currentPayout >= minPayout) {
                clearInterval(waitInterval);
                sendToLogSystem(`Payout adequado alcançado! ${currentPayout}% >= ${minPayout}%. Prosseguindo com análise.`, 'SUCCESS');
                toUpdateStatus(`Payout adequado (${currentPayout}%)! Iniciando análise...`, 'success', 3000);
                resolve(true);
                return;
            }
            
            // Atualizar status visual para o usuário a cada 5 segundos (não logs)
            if (elapsedTime % 5 === 0) {
                const minutes = Math.floor(elapsedTime / 60);
                const seconds = elapsedTime % 60;
                const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                
                toUpdateStatus(`Aguardando payout: ${currentPayout}% → ${minPayout}% (${timeStr} aguardando)`, 'info', 0);
                lastStatusUpdate = elapsedTime;
            }
            
            // Log periódico opcional a cada 30 segundos (reduzido)
            if (elapsedTime % 30 === 0) {
                const minutes = Math.floor(elapsedTime / 60);
                sendToLogSystem(`Monitoramento payout: ${currentPayout}% após ${minutes > 0 ? minutes + 'm' : elapsedTime + 's'}`, 'DEBUG');
            }
            
        } catch (payoutError) {
            clearInterval(waitInterval);
            sendToLogSystem(`Erro ao verificar payout durante monitoramento: ${payoutError.message}`, 'ERROR');
            toUpdateStatus(`Erro na verificação de payout: ${payoutError.message}`, 'error', 5000);
            reject(`PAYOUT_READ_ERROR: ${payoutError.message}`);
            return;
        }
    };
    
    // Verificar imediatamente e depois no intervalo configurado
    checkPayoutPeriodically();
    waitInterval = setInterval(checkPayoutPeriodically, checkInterval * 1000); // Converter para milissegundos
    
    // Armazenar referência do interval no chrome.storage para cancelamento
    chrome.storage.local.set({
        currentPayoutInterval: true,
        payoutMonitoringActive: true
    });
}

// Função para cancelar monitoramento de payout (usando chrome.storage)
function cancelPayoutMonitoring() {
    chrome.storage.local.set({ cancelPayoutWait: true }, () => {
        sendToLogSystem('Sinal de cancelamento de monitoramento enviado via chrome.storage', 'INFO');
        toUpdateStatus('Cancelando monitoramento de payout...', 'info', 3000);
    });
}

// Exportar função via chrome.runtime para acesso externo
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'cancelPayoutMonitoring') {
        cancelPayoutMonitoring();
        sendResponse({ success: true });
        return true;
    }
});

(function() {
    sendToLogSystem('Módulo de Automação INICIANDO.', 'DEBUG');

    let analyzeBtn = null; // Referência ao botão de análise
    let startOperationBtn = null; // Referência ao botão de iniciar operação automática
  
    // Função para enviar status para o campo de status GLOBAL via index.js
    function updateUserVisibleStatus(text, level = 'info', duration = 5000) {
        sendToLogSystem(`Solicitando atualização de status GLOBAL para index.js (via action:updateStatus): "${text}" (${level})`, 'DEBUG');
        chrome.runtime.sendMessage({
            action: 'updateStatus', // Alterado de type: 'REQUEST_INDEX_DIRECT_UPDATE_STATUS'
            message: text,       // Mapeado de text para message
            type: level,         // Mapeado de level para type
            duration: duration
        }, response => {
            if (chrome.runtime.lastError) {
                sendToLogSystem(`Erro ao enviar status (action:updateStatus) para index.js: ${chrome.runtime.lastError.message}`, 'ERROR');
            } else if (response && !response.success) {
                sendToLogSystem(`index.js reportou falha ao processar atualização de status (action:updateStatus).`, 'WARN');
            }
        });
    }

    // Função principal do ciclo de automação (reutilizável)
    function runAutomationCheck() {
        sendToLogSystem('runAutomationCheck: Iniciando ciclo de verificação.', 'INFO');
        toUpdateStatus('Automação: Verificando configurações e lucro...', 'info', 0); // 0 para não desaparecer

        // 1. Obter configuração
        chrome.storage.sync.get(['userConfig'], (storageResult) => {
            if (chrome.runtime.lastError) {
                const errorMsg = `Falha ao ler userConfig do storage sync: ${chrome.runtime.lastError.message}`;
                sendToLogSystem(errorMsg, 'ERROR');
                toUpdateStatus(errorMsg, 'error');
                return;
            }

            const config = storageResult.userConfig || {};
            sendToLogSystem(`runAutomationCheck: Config lida: ${JSON.stringify(config)}`, 'DEBUG');

            // *** Verificar se a automação está ativa ***
            if (!config.automation) {
                const msg = "Modo automatico desativado.";
                sendToLogSystem(msg, 'WARN');
                toUpdateStatus(msg, 'warn');
                return; // Interrompe se desligada
            }

            const dailyProfitTarget = parseFloat(config.dailyProfit) || 0;

            // 2. Obter histórico e calcular lucro
            let currentProfit = 0;
            try {
                const savedOperations = localStorage.getItem('tradeOperations');
                if (savedOperations) {
                    const operations = JSON.parse(savedOperations);
                    operations.forEach(op => {
                        if (op.status === 'Closed') {
                            if (op.success) { currentProfit += parseFloat(op.profit || 0); }
                            else { currentProfit -= parseFloat(op.amount || 0); }
                        }
                    });
                    currentProfit = parseFloat(currentProfit.toFixed(2));
                    sendToLogSystem(`runAutomationCheck: Lucro calculado: ${currentProfit}`, 'DEBUG');
                } else {
                     sendToLogSystem('runAutomationCheck: Nenhum histórico localStorage. Lucro 0.', 'WARN');
                    currentProfit = 0;
                }
            } catch (e) {
                const errorMsg = `Erro ao calcular lucro: ${e.message}`;
                sendToLogSystem(errorMsg, 'ERROR');
                toUpdateStatus(errorMsg, 'error');
                return;
            }

            // 3. Comparar e agir
            sendToLogSystem(`runAutomationCheck: Comparando Lucro(${currentProfit}) vs Meta(${dailyProfitTarget})`, 'INFO');
            if (isNaN(currentProfit) || isNaN(dailyProfitTarget)) {
                 const errorMsg = 'Valores de lucro inválidos.';
                 sendToLogSystem(errorMsg, 'ERROR');
                 toUpdateStatus(errorMsg, 'error');
                return;
            }

            if (currentProfit < dailyProfitTarget) {
                const conditionMsg = `Automação: Condição atendida (${currentProfit} < ${dailyProfitTarget}). Verificando payout atual...`;
                sendToLogSystem(conditionMsg, 'INFO');
                toUpdateStatus('Automação: Verificando payout atual...', 'info', 3000);
                
                // Obter configurações de troca de ativos do StateManager
                let assetConfig = { enabled: false, minPayout: 85, preferredCategory: 'crypto' };
                if (window.StateManager) {
                    assetConfig = window.StateManager.getAssetSwitchingConfig();
                }
                
                // Log da configuração de troca de ativos para debug
                sendToLogSystem(`🔧 [runAutomationCheck] Configuração de troca de ativos: enabled=${assetConfig.enabled}, minPayout=${assetConfig.minPayout}, category=${assetConfig.preferredCategory}, checkBeforeAnalysis=${assetConfig.checkBeforeAnalysis}`, 'DEBUG');
                
                // Usar o payout mínimo configurado (padrão 75% baseado no log)
                const minPayoutRequired = assetConfig.minPayout || 75;
                
                // *** LÓGICA CORRIGIDA: Verificar payout atual ANTES de decidir trocar ***
                sendToLogSystem(`🔍 Verificando payout atual (mínimo: ${minPayoutRequired}%)...`, 'INFO');
                
                getCurrentPayout()
                    .then(payoutResult => {
                        const currentPayout = payoutResult.payout;
                        sendToLogSystem(`Payout atual capturado: ${currentPayout}% (mínimo: ${minPayoutRequired}%)`, 'INFO');
                        
                        if (currentPayout >= minPayoutRequired) {
                            // ✅ PAYOUT ADEQUADO - Prosseguir diretamente com análise
                            sendToLogSystem(`✅ Payout adequado (${currentPayout}% >= ${minPayoutRequired}%). Iniciando análise diretamente...`, 'SUCCESS');
                            toUpdateStatus(`Payout OK (${currentPayout}%)! Iniciando análise...`, 'success', 3000);
                            
                            // Clicar no botão de análise IMEDIATAMENTE
                            try {
                    if (analyzeBtn) {
                                    sendToLogSystem('Clicando #analyzeBtn para iniciar análise (payout adequado)', 'DEBUG');
                        analyzeBtn.click();
                    } else {
                                    const errorMsg = 'Botão #analyzeBtn não encontrado';
                        sendToLogSystem(errorMsg, 'ERROR');
                                    toUpdateStatus(errorMsg, 'error', 5000);
                    }
                } catch (error) {
                                const errorMsg = `Erro ao clicar em #analyzeBtn: ${error.message}`;
                    sendToLogSystem(errorMsg, 'ERROR');
                                toUpdateStatus(errorMsg, 'error', 5000);
                            }
                        } else {
                            // ⚠️ PAYOUT INSUFICIENTE - Aplicar comportamento configurado pelo usuário
                            sendToLogSystem(`⚠️ Payout insuficiente (${currentPayout}% < ${minPayoutRequired}%). Verificando comportamento configurado...`, 'WARN');
                            
                            // Usar a função checkPayoutBeforeAnalysis que já implementa todos os comportamentos
                            checkPayoutBeforeAnalysis()
                                .then(() => {
                                    // Se chegou aqui, o payout foi aprovado (seja por espera ou troca)
                                    sendToLogSystem('✅ Payout aprovado após verificação. Iniciando análise...', 'SUCCESS');
                                    
                                    // Clicar no botão de análise
                                    try {
                                        if (analyzeBtn) {
                                            sendToLogSystem('Clicando #analyzeBtn após aprovação de payout', 'DEBUG');
                                            analyzeBtn.click();
                                        } else {
                                            const errorMsg = 'Botão #analyzeBtn não encontrado após aprovação de payout';
                                            sendToLogSystem(errorMsg, 'ERROR');
                                            toUpdateStatus(errorMsg, 'error', 5000);
                                        }
                                    } catch (error) {
                                        const errorMsg = `Erro ao clicar em #analyzeBtn após aprovação: ${error.message}`;
                                        sendToLogSystem(errorMsg, 'ERROR');
                                        toUpdateStatus(errorMsg, 'error', 5000);
                                    }
                                })
                                .catch(error => {
                                    // Payout foi rejeitado ou houve erro
                                    if (error === 'PAYOUT_INSUFFICIENT') {
                                        const cancelMsg = `Análise cancelada: Payout atual (${currentPayout}%) abaixo do mínimo (${minPayoutRequired}%)`;
                                        sendToLogSystem(cancelMsg, 'WARN');
                                        toUpdateStatus(cancelMsg, 'warn', 5000);
                                    } else if (error === 'USER_CANCELLED') {
                                        sendToLogSystem('Análise cancelada pelo usuário durante aguardo de payout', 'INFO');
                                        toUpdateStatus('Aguardo de payout cancelado pelo usuário', 'info', 3000);

                                    } else if (error.startsWith('ASSET_SWITCH_FAILED:')) {
                                        const failureReason = error.replace('ASSET_SWITCH_FAILED: ', '');
                                        sendToLogSystem(`Falha na troca de ativo: ${failureReason}`, 'ERROR');
                                        toUpdateStatus(`Falha na troca de ativo: ${failureReason}`, 'error', 5000);
                                    } else if (error.startsWith('ASSET_SWITCH_ERROR:')) {
                                        const errorReason = error.replace('ASSET_SWITCH_ERROR: ', '');
                                        sendToLogSystem(`Erro na troca de ativo: ${errorReason}`, 'ERROR');
                                        toUpdateStatus(`Erro na troca de ativo: ${errorReason}`, 'error', 5000);
                                    } else {
                                        sendToLogSystem(`❌ Erro na verificação de payout: ${error}`, 'ERROR');
                                        toUpdateStatus(`Erro na verificação de payout: ${error}`, 'error', 5000);
                                        
                                        // Cancelar operação em caso de erro
                                        if (typeof window.cancelCurrentOperation === 'function') {
                                            window.cancelCurrentOperation(`Erro na verificação de payout: ${error}`);
                                        }
                                    }
                                });
                        }
                    })
                    .catch(error => {
                        sendToLogSystem(`❌ Erro ao verificar payout: ${error.message}`, 'ERROR');
                        toUpdateStatus(`Erro na verificação de payout: ${error.message}`, 'error', 5000);
                        
                        // Cancelar operação em caso de erro crítico
                        if (typeof window.cancelCurrentOperation === 'function') {
                            window.cancelCurrentOperation(`Erro crítico na verificação de payout: ${error.message}`);
                        }
                    });
            } else {
                const resultMsg = `Automação: Meta de lucro atingida ou superada (${currentProfit} >= ${dailyProfitTarget}). Nenhuma análise necessária.`;
                sendToLogSystem(resultMsg, 'INFO');
                toUpdateStatus(resultMsg, 'success');
            }
        }); // Fim callback storage.sync.get
    }
    
    document.addEventListener('DOMContentLoaded', () => {
        sendToLogSystem('DOMContentLoaded disparado em automation.js.', 'DEBUG');
        
        analyzeBtn = document.querySelector('#analyzeBtn');
        startOperationBtn = document.querySelector('#start-operation');
        
        if (analyzeBtn) {
            sendToLogSystem('Botão #analyzeBtn encontrado e referenciado por automation.js.', 'DEBUG');
        } else {
            sendToLogSystem('Botão #analyzeBtn NÃO encontrado por automation.js no DOMContentLoaded.', 'WARN');
        }

        if (startOperationBtn) {
            sendToLogSystem('Botão #start-operation encontrado. Adicionando listener por automation.js.', 'DEBUG');
            startOperationBtn.addEventListener('click', () => {
                sendToLogSystem('Botão #start-operation clicado (listener em automation.js). Iniciando runAutomationCheck.', 'INFO');
                runAutomationCheck();
            });
        } else {
            sendToLogSystem('Botão #start-operation NÃO encontrado por automation.js.', 'WARN');
        }
        
        // Adicionar listener para o CustomEvent 'operationResult' disparado por trade-history.js
        document.addEventListener('operationResult', (event) => {
            sendToLogSystem(`Recebido CustomEvent 'operationResult'. Detalhes: ${JSON.stringify(event.detail)}`, 'INFO');

            // Verificar se a automação está realmente configurada como ativa.
            chrome.storage.sync.get(['userConfig'], (storageResult) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = `Falha ao ler userConfig após 'operationResult': ${chrome.runtime.lastError.message}`;
                    sendToLogSystem(errorMsg, 'ERROR');
                    return;
                }
                const config = storageResult.userConfig || {};
                const lastOpSuccess = event.detail.success; // Resultado da operação que disparou o evento

                if (config.automation) {
                    sendToLogSystem('Automação confirmada como ATIVA. Verificando condições para novo ciclo...', 'DEBUG');
                    
                    if (config.gale && config.gale.active) {
                        // Gale está ATIVO
                        sendToLogSystem('Modo Gale ATIVO detectado.', 'DEBUG');
                        if (lastOpSuccess) {
                            sendToLogSystem('Última operação foi um GANHO com Gale ativo. Automação prossegue para runAutomationCheck.', 'INFO');
                            runAutomationCheck();
                        } else {
                            sendToLogSystem('Última operação foi uma PERDA com Gale ativo. Automação aguardará o sistema Gale. Nenhuma nova análise será iniciada pela automação principal.', 'INFO');
                            // Não faz nada, deixa o Gale System lidar com a perda
                        }
                    } else {
                        // Gale está INATIVO
                        sendToLogSystem('Modo Gale INATIVO detectado. Automação prossegue para runAutomationCheck independentemente do resultado anterior.', 'INFO');
                        runAutomationCheck();
                    }
                } else {
                    sendToLogSystem('Automação está DESATIVADA nas configurações. \'operationResult\' ignorado para ciclo de automação.', 'INFO');
                }
            });
        });
        sendToLogSystem('Listener para CustomEvent \'operationResult\' adicionado.', 'DEBUG');
    });

    sendToLogSystem('Módulo de Automação carregado e configurado para controle direto e escuta de operationResult.', 'INFO');
})(); 