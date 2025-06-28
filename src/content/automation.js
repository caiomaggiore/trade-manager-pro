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
// =================== SISTEMA DE TROCA DE ATIVOS (INTEGRAÇÃO) =========
// ======================================================================

/**
 * Wrapper para trocar para o melhor ativo usando a API centralizada
 * @param {number} minPayout - Payout mínimo desejado (padrão: 85%)
 * @param {string} preferredCategory - Categoria preferida ('crypto', 'currency', etc.)
 * @returns {Promise<Object>} Resultado da operação
 */
async function switchToBestAssetViaAPI(minPayout = 85, preferredCategory = 'crypto') {
    try {
        sendToLogSystem(`🔄 [AUTOMATION] Solicitando troca de ativo via nova API robusta (payout >= ${minPayout}%, categoria: ${preferredCategory})`, 'INFO');
        toUpdateStatus(`Procurando melhor ativo (>=${minPayout}%)...`, 'info', 3000);
        
        // ✅ USAR NOVA FUNÇÃO WRAPPER ESPECÍFICA PARA AUTOMAÇÃO
        // A nova função já faz todo o logging detalhado e busca sequencial
        const result = await AssetManager.switchToBestAssetForAutomation(minPayout, preferredCategory);
        
        if (result.success) {
            // ✅ A nova função já faz todo o logging necessário
            // Apenas atualizar status visual para o usuário
            if (result.wasPreferred) {
                toUpdateStatus(`✅ ${result.asset.name} (${result.asset.payout}%)`, 'success', 4000);
            } else {
                toUpdateStatus(`⚠️ Fallback: ${result.asset.name} (${result.asset.payout}%)`, 'warn', 5000);
            }
            
            return result;
        } else {
            // ❌ ERRO REAL: A nova função já logou o erro
            const errorMsg = result.error || 'UNKNOWN_ERROR: Falha na troca de ativo';
            toUpdateStatus(errorMsg, 'error', 5000);
            throw new Error(errorMsg);
        }
        
    } catch (error) {
        const errorMsg = `AUTOMATION_API_ERROR: ${error.message}`;
        sendToLogSystem(`❌ [AUTOMATION] ${errorMsg}`, 'ERROR');
        toUpdateStatus(errorMsg, 'error', 5000);
        throw error;
    }
}

// ======================================================================
// =================== SISTEMA DE MONITORAMENTO CONTÍNUO ===============
// ======================================================================

/**
 * Sistema de monitoramento contínuo de payout durante automação ativa
 * DESABILITADO: Monitoramento contínuo removido para evitar problemas de performance
 * O payout será verificado apenas no momento da análise
 */
let payoutMonitoringInterval = null;
let isPayoutMonitoringActive = false;

/**
 * Iniciar monitoramento contínuo de payout
 * FUNÇÃO DESABILITADA: Não faz mais monitoramento contínuo
 */
function startPayoutMonitoring() {
    sendToLogSystem('ℹ️ Monitoramento contínuo de payout está DESABILITADO. Payout será verificado apenas durante análises.', 'INFO');
    isPayoutMonitoringActive = false;
    // Não iniciar mais o monitoramento contínuo
}

/**
 * Parar monitoramento contínuo de payout
 */
function stopPayoutMonitoring() {
    if (payoutMonitoringInterval) {
        clearInterval(payoutMonitoringInterval);
        payoutMonitoringInterval = null;
        sendToLogSystem('🛑 Monitoramento contínuo de payout parado', 'INFO');
    }
    isPayoutMonitoringActive = false;
}

/**
 * Tratar problema de payout detectado durante monitoramento
 */
async function handlePayoutIssue(currentPayout, minPayoutRequired, payoutBehavior, config) {
    sendToLogSystem(`🚨 Tratando problema de payout: ${currentPayout}% < ${minPayoutRequired}%, comportamento: ${payoutBehavior}`, 'INFO');
    
    switch (payoutBehavior) {
        case 'cancel':
            sendToLogSystem(`❌ Cancelando automação devido a payout inadequado (${currentPayout}% < ${minPayoutRequired}%)`, 'WARN');
            toUpdateStatus(`Automação cancelada: payout inadequado (${currentPayout}%)`, 'error', 8000);
            
            // Cancelar operação atual
            if (typeof window.cancelCurrentOperation === 'function') {
                window.cancelCurrentOperation(`Payout inadequado: ${currentPayout}% < ${minPayoutRequired}%`);
            }
            break;
            
        case 'wait':
            sendToLogSystem(`⏳ Pausando automação até payout melhorar (${currentPayout}% → ${minPayoutRequired}%)`, 'INFO');
            toUpdateStatus(`Aguardando payout melhorar: ${currentPayout}% → ${minPayoutRequired}%`, 'info', 0);
            
            // Iniciar monitoramento de espera
            await waitForPayoutImprovement(minPayoutRequired, 10, 
                () => {
                    sendToLogSystem('✅ Payout melhorou! Retomando automação...', 'SUCCESS');
                    toUpdateStatus('Payout adequado! Retomando automação...', 'success', 3000);
                    
                    // Monitoramento contínuo desabilitado - payout será verificado na próxima análise
                },
                (error) => {
                    if (error === 'USER_CANCELLED') {
                        sendToLogSystem('🛑 Aguardo de payout cancelado pelo usuário', 'INFO');
                        toUpdateStatus('Aguardo cancelado', 'info', 3000);
                    } else {
                        sendToLogSystem(`❌ Erro durante aguardo de payout: ${error}`, 'ERROR');
                    }
                }
            );
            break;
            
                        case 'switch':
                    sendToLogSystem(`🔄 Trocando ativo devido a payout inadequado (${currentPayout}% < ${minPayoutRequired}%)`, 'INFO');
                    toUpdateStatus(`Trocando ativo: payout inadequado (${currentPayout}%)`, 'warn', 4000);
                    
                    try {
                        const assetConfig = config.assetSwitching || {};
                        const preferredCategory = assetConfig.preferredCategory || 'crypto';
                        
                        const assetResult = await switchToBestAssetViaAPI(minPayoutRequired, preferredCategory);
                        
                        if (assetResult.success) {
                            sendToLogSystem(`✅ Ativo trocado com sucesso: ${assetResult.message}`, 'SUCCESS');
                            toUpdateStatus(`Ativo trocado: ${assetResult.message}`, 'success', 4000);
                            
                            // ✅ CORREÇÃO: Resolver promise para continuar fluxo de análise
                            sendToLogSystem(`🎯 Troca de ativo concluída com sucesso. Fluxo pode prosseguir para análise.`, 'INFO');
                            resolve(true);
                        } else {
                            sendToLogSystem(`❌ Falha na troca de ativo: ${assetResult.error}`, 'ERROR');
                            toUpdateStatus(`Erro na troca de ativo: ${assetResult.error}`, 'error', 5000);
                            
                            // Rejeitar promise com erro específico
                            reject(`ASSET_SWITCH_FAILED: ${assetResult.error}`);
                        }
                    } catch (error) {
                        sendToLogSystem(`❌ Erro durante troca de ativo: ${error.message}`, 'ERROR');
                        toUpdateStatus(`Erro na troca de ativo: ${error.message}`, 'error', 5000);
                        
                        // Rejeitar promise com erro
                        reject(`ASSET_SWITCH_ERROR: ${error.message}`);
                    }
            break;
            
        default:
            sendToLogSystem(`❌ Comportamento de payout desconhecido: ${payoutBehavior}`, 'ERROR');
            toUpdateStatus(`Erro: comportamento desconhecido (${payoutBehavior})`, 'error', 5000);
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
    return safeExecuteAutomation(async () => {
        // Verificar se a troca automática de ativos está habilitada
        if (autoSwitchAsset && window.StateManager?.isAssetSwitchingEnabled()) {
            const minPayout = window.StateManager.getMinPayoutForAssets();
            const preferredCategory = window.StateManager.getPreferredAssetCategory();
            
            sendToLogSystem(`Verificando ativo antes da operação (min payout: ${minPayout}%, categoria: ${preferredCategory})`, 'INFO');
            
            try {
                // Garantir que estamos no melhor ativo usando API centralizada
                await switchToBestAssetViaAPI(minPayout, preferredCategory);
            } catch (assetError) {
                // ❌ ERRO REAL: Nenhum ativo encontrado em nenhuma categoria
                sendToLogSystem(`Erro ao verificar/trocar ativo: ${assetError.message}`, 'ERROR');
                throw new Error(`Falha na verificação de ativo: ${assetError.message}`);
            }
        }
        
        // Executar a operação de trade
        try {
            const result = await chrome.runtime.sendMessage({
                action: 'EXECUTE_TRADE_ACTION',
                tradeAction: action,
                tradeData: config,
                source: 'automation'
            });
            
            if (!result || !result.success) {
                throw new Error(result?.error || 'Falha na execução do trade');
            }
            
            sendToLogSystem(`Trade executado com sucesso: ${action}`, 'SUCCESS');
            return result;
        } catch (tradeError) {
            sendToLogSystem(`Erro ao executar trade: ${tradeError.message}`, 'ERROR');
            throw tradeError;
        }
    }, 'executeTradeWithAssetCheck', action, config, autoSwitchAsset);
}

/**
 * Função para executar análise com verificação automática de ativo
 * @param {Object} config - Configurações da análise
 * @returns {Promise<Object>} Resultado da análise e operação
 */
async function executeAnalysisWithAssetCheck(config = {}) {
    return safeExecuteAutomation(async () => {
        const autoSwitchAsset = config.autoSwitchAsset !== false; // default true
        
        // Verificar se a troca automática de ativos está habilitada
        if (autoSwitchAsset && window.StateManager?.isAssetSwitchingEnabled()) {
            const minPayout = window.StateManager.getMinPayoutForAssets();
            const preferredCategory = window.StateManager.getPreferredAssetCategory();
            
            sendToLogSystem(`Verificando ativo antes da análise (min payout: ${minPayout}%, categoria: ${preferredCategory})`, 'INFO');
            
            try {
                // Garantir que estamos no melhor ativo usando API centralizada
                await switchToBestAssetViaAPI(minPayout, preferredCategory);
            } catch (assetError) {
                sendToLogSystem(`Erro ao verificar/trocar ativo: ${assetError.message}`, 'ERROR');
                // Para análise, não interromper se falhar ao trocar ativo
                sendToLogSystem('Continuando análise com ativo atual', 'WARN');
            }
        }
        
        // Executar a análise
        try {
            const result = await chrome.runtime.sendMessage({
                action: 'START_ANALYSIS',
                source: 'automation',
                config: config
            });
            
            if (!result || !result.success) {
                throw new Error(result?.error || 'Falha na análise');
            }
            
            sendToLogSystem('Análise executada com sucesso', 'SUCCESS');
            return result;
        } catch (analysisError) {
            sendToLogSystem(`Erro ao executar análise: ${analysisError.message}`, 'ERROR');
            throw analysisError;
        }
    }, 'executeAnalysisWithAssetCheck', config);
}

// Wrapper para obter payout atual usando a API centralizada
async function getCurrentPayoutForAutomation() {
    // Usar o PayoutController se disponível (método preferido)
    if (window.PayoutController && typeof window.PayoutController.getCurrentPayout === 'function') {
        sendToLogSystem('🔄 [Automation] Usando PayoutController para obter payout', 'DEBUG');
        return window.PayoutController.getCurrentPayout();
    }
    
    // Fallback: usar a mesma API que o painel de desenvolvimento
    sendToLogSystem('🔄 [Automation] PayoutController não disponível, usando API via chrome.runtime', 'DEBUG');
    return new Promise((resolve, reject) => {
        try {
            // Timeout de segurança
            const timeoutId = setTimeout(() => {
                const errorMsg = 'Timeout: Solicitação de payout demorou mais de 8 segundos';
                sendToLogSystem(errorMsg, 'ERROR');
                reject(new Error(errorMsg));
            }, 8000);
            
            // Usar a mesma API que o painel de desenvolvimento usa
            chrome.runtime.sendMessage({
                action: 'GET_CURRENT_PAYOUT'
            }, (response) => {
                clearTimeout(timeoutId);
                
                if (chrome.runtime.lastError) {
                    const errorMsg = `Erro de comunicação: ${chrome.runtime.lastError.message}`;
                    sendToLogSystem(errorMsg, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                if (!response || !response.success) {
                    const errorMsg = response?.error || 'Erro ao obter payout';
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

// Wrapper para verificar payout antes de análise usando a API centralizada
async function checkPayoutBeforeAnalysisForAutomation() {
    // Usar o PayoutController se disponível (método preferido)
    if (window.PayoutController && typeof window.PayoutController.checkPayoutBeforeAnalysis === 'function') {
        sendToLogSystem('🔄 [Automation] Usando PayoutController para verificação de payout', 'DEBUG');
        return window.PayoutController.checkPayoutBeforeAnalysis();
    }
    
    // Fallback: continuar sem verificação (sistema legado)
    sendToLogSystem('⚠️ [Automation] PayoutController não disponível, continuando sem verificação de payout', 'WARN');
    return new Promise((resolve) => {
        sendToLogSystem('Verificação de payout ignorada - PayoutController não carregado', 'WARN');
        resolve(true); // Continuar sem verificação
    });
}

/**
 * Aplicar comportamento de payout configurado diretamente
 * @param {number} currentPayout - Payout atual detectado
 * @param {number} minPayoutRequired - Payout mínimo configurado
 * @param {string} payoutBehavior - Comportamento configurado ('cancel', 'wait', 'switch')
 * @param {Object} config - Configurações completas do usuário
 * @returns {Promise} Resolve se comportamento executado com sucesso, reject se falhar
 */
async function applyPayoutBehavior(currentPayout, minPayoutRequired, payoutBehavior, config) {
    return new Promise(async (resolve, reject) => {
        try {
            sendToLogSystem(`🔧 Aplicando comportamento de payout: ${payoutBehavior} (${currentPayout}% < ${minPayoutRequired}%)`, 'INFO');
            
            switch (payoutBehavior) {
                case 'wait':
                    sendToLogSystem(`⏳ Aguardando payout melhorar (${currentPayout}% → ${minPayoutRequired}%)`, 'INFO');
                    toUpdateStatus(`Aguardando payout melhorar: ${currentPayout}% → ${minPayoutRequired}%`, 'info', 0);
                    
                    // Usar PayoutController para aguardar se disponível
                    if (window.PayoutController && typeof window.PayoutController.waitForPayoutImprovement === 'function') {
                        sendToLogSystem('🔄 Usando PayoutController.waitForPayoutImprovement', 'DEBUG');
                        
                        const checkInterval = parseInt(config.payoutTimeout) || 5;
                        window.PayoutController.waitForPayoutImprovement(
                            minPayoutRequired, 
                            checkInterval, 
                            () => {
                                sendToLogSystem('✅ Payout melhorou! Retomando automação...', 'SUCCESS');
                                toUpdateStatus('Payout adequado! Retomando automação...', 'success', 3000);
                                resolve(true);
                            },
                            (error) => {
                                if (error === 'USER_CANCELLED') {
                                    sendToLogSystem('🛑 Aguardo de payout cancelado pelo usuário', 'INFO');
                                    toUpdateStatus('Aguardo cancelado', 'info', 3000);
                                    reject('USER_CANCELLED');
                                } else {
                                    sendToLogSystem(`❌ Erro durante aguardo de payout: ${error}`, 'ERROR');
                                    reject(error);
                                }
                            }
                        );
                    } else {
                        // Fallback: aguardo simples
                        sendToLogSystem('⚠️ PayoutController não disponível, usando aguardo simples', 'WARN');
                        setTimeout(() => {
                            sendToLogSystem('⏰ Aguardo simples concluído, prosseguindo...', 'INFO');
                            resolve(true);
                        }, 10000); // 10 segundos de aguardo simples
                    }
                    break;
                    
                case 'switch':
                    sendToLogSystem(`🔄 Trocando ativo devido a payout inadequado (${currentPayout}% < ${minPayoutRequired}%)`, 'INFO');
                    toUpdateStatus(`Trocando ativo: payout inadequado (${currentPayout}%)`, 'warn', 4000);
                    
                    try {
                        const assetConfig = config.assetSwitching || {};
                        const preferredCategory = assetConfig.preferredCategory || 'crypto';
                        
                        // Usar a função existente do painel de desenvolvimento
                        sendToLogSystem(`🔄 Chamando TEST_SWITCH_TO_BEST_ASSET via chrome.runtime (categoria: ${preferredCategory})`, 'DEBUG');
                        
                        chrome.runtime.sendMessage({
                            action: 'TEST_SWITCH_TO_BEST_ASSET',
                            minPayout: minPayoutRequired,
                            category: preferredCategory
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                const errorMsg = `Erro na comunicação para troca de ativo: ${chrome.runtime.lastError.message}`;
                                sendToLogSystem(errorMsg, 'ERROR');
                                toUpdateStatus(errorMsg, 'error', 5000);
                                reject(`ASSET_SWITCH_COMMUNICATION_ERROR: ${errorMsg}`);
                                return;
                            }
                            
                            if (response && response.success) {
                                const successMsg = `Ativo trocado com sucesso: ${response.asset?.name || 'Novo ativo'} (${response.asset?.payout || 'N/A'}%)`;
                                sendToLogSystem(successMsg, 'SUCCESS');
                                toUpdateStatus(successMsg, 'success', 4000);
                                
                                // Aguardar um pouco para a interface atualizar
                                setTimeout(() => {
                                    sendToLogSystem('✅ Troca de ativo concluída, prosseguindo com análise', 'SUCCESS');
                                    resolve(true);
                                }, 2000);
                            } else {
                                const errorMsg = response?.error || 'Falha na troca de ativo';
                                sendToLogSystem(`❌ Falha na troca de ativo: ${errorMsg}`, 'ERROR');
                                toUpdateStatus(`Erro na troca de ativo: ${errorMsg}`, 'error', 5000);
                                reject(`ASSET_SWITCH_FAILED: ${errorMsg}`);
                            }
                        });
                        
                    } catch (error) {
                        sendToLogSystem(`❌ Erro durante troca de ativo: ${error.message}`, 'ERROR');
                        toUpdateStatus(`Erro na troca de ativo: ${error.message}`, 'error', 5000);
                        reject(`ASSET_SWITCH_ERROR: ${error.message}`);
                    }
                    break;
                    
                default:
                    sendToLogSystem(`❌ Comportamento de payout desconhecido: ${payoutBehavior}`, 'ERROR');
                    toUpdateStatus(`Erro: comportamento desconhecido (${payoutBehavior})`, 'error', 5000);
                    reject(`UNKNOWN_BEHAVIOR: ${payoutBehavior}`);
            }
            
        } catch (error) {
            sendToLogSystem(`❌ Erro crítico na aplicação do comportamento de payout: ${error.message}`, 'ERROR');
            reject(`CRITICAL_ERROR: ${error.message}`);
        }
    });
}

// Função auxiliar para aguardar melhora do payout - DELEGADA PARA PayoutController
function waitForPayoutImprovement(minPayout, checkInterval, resolve, reject) {
    // Usar o PayoutController se disponível
    if (window.PayoutController && typeof window.PayoutController.waitForPayoutImprovement === 'function') {
        sendToLogSystem('Delegando aguardo de payout para PayoutController', 'DEBUG');
        return window.PayoutController.waitForPayoutImprovement(minPayout, checkInterval, resolve, reject);
    }
    
    // Fallback: implementação básica
    sendToLogSystem('PayoutController não disponível para aguardo de payout, resolvendo imediatamente', 'WARN');
    resolve(true);
}

// Função para cancelar monitoramento de payout - DELEGADA PARA PayoutController
function cancelPayoutMonitoring() {
    // Usar o PayoutController se disponível
    if (window.PayoutController && typeof window.PayoutController.cancelPayoutMonitoring === 'function') {
        sendToLogSystem('Delegando cancelamento de payout para PayoutController', 'DEBUG');
        return window.PayoutController.cancelPayoutMonitoring();
    }
    
    // Fallback: implementação básica
    sendToLogSystem('PayoutController não disponível, usando implementação básica de cancelamento', 'WARN');
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
    
    // *** NOVO: Handler para parar monitoramento contínuo ***
    if (message.action === 'STOP_PAYOUT_MONITORING') {
        sendToLogSystem(`🛑 Recebido comando para parar monitoramento contínuo: ${message.reason}`, 'INFO');
        stopPayoutMonitoring();
        sendResponse({ success: true, message: 'Monitoramento contínuo parado' });
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

        // *** NOVO: Inicializar LimitsChecker se ainda não estiver ativo ***
        if (window.limitsChecker && !window.limitsChecker.getStatus().isActive) {
            chrome.storage.sync.get(['userConfig'], (result) => {
                const config = result.userConfig || {};
                window.limitsChecker.start(config);
                sendToLogSystem('LimitsChecker iniciado automaticamente pela automação', 'INFO');
            });
        }

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
                
                // Parar monitoramento se automação estiver desativada
                if (isPayoutMonitoringActive) {
                    stopPayoutMonitoring();
                }
                
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

            // *** DEBUG: Log detalhado da comparação ***
            sendToLogSystem(`🔍 [COMPARAÇÃO DETALHADA] Lucro atual: ${currentProfit} (${typeof currentProfit}) vs Meta: ${dailyProfitTarget} (${typeof dailyProfitTarget})`, 'DEBUG');
            sendToLogSystem(`🔍 [COMPARAÇÃO DETALHADA] currentProfit < dailyProfitTarget? ${currentProfit < dailyProfitTarget}`, 'DEBUG');
            sendToLogSystem(`🔍 [COMPARAÇÃO DETALHADA] currentProfit >= dailyProfitTarget? ${currentProfit >= dailyProfitTarget}`, 'DEBUG');

            // *** CORREÇÃO: Stop Loss será verificado pelo LimitsChecker ***
            // O LimitsChecker agora gerencia isso automaticamente
            const stopLossLimit = parseFloat(config.stopLoss) || 0;
            if (stopLossLimit > 0) {
                sendToLogSystem(`Stop Loss configurado: ${stopLossLimit} - LimitsChecker monitora automaticamente`, 'DEBUG');
            }
            
            if (currentProfit < dailyProfitTarget) {
                sendToLogSystem(`🟡 [CONDIÇÃO] Lucro ainda não atingiu meta. Prosseguindo com automação...`, 'INFO');
                const conditionMsg = `Automação: Condição atendida (${currentProfit} < ${dailyProfitTarget}). Verificando payout atual...`;
                sendToLogSystem(conditionMsg, 'INFO');
                toUpdateStatus('Automação: Verificando payout atual...', 'info', 3000);
                
                // *** CORREÇÃO: Obter configurações de payout diretamente do config ***
                // O payoutBehavior define o comportamento, não apenas assetSwitching.enabled
                const minPayoutRequired = parseFloat(config.minPayout) || 80;
                const payoutBehavior = config.payoutBehavior || 'wait';
                
                // Log da configuração de payout para debug
                sendToLogSystem(`🔧 [runAutomationCheck] Configuração de payout: minimo=${minPayoutRequired}%, comportamento=${payoutBehavior}`, 'DEBUG');
                
                // *** LÓGICA CORRIGIDA: Verificar payout atual ANTES de decidir trocar ***
                sendToLogSystem(`🔍 Verificando payout atual (mínimo: ${minPayoutRequired}%)...`, 'INFO');
                sendToLogSystem(`🔍 [DEBUG] Chamando getCurrentPayout()...`, 'DEBUG');
                
                getCurrentPayoutForAutomation()
                    .then(async (payoutResult) => {
                        const currentPayout = payoutResult.payout;
                        sendToLogSystem(`✅ Payout atual capturado: ${currentPayout}% (mínimo: ${minPayoutRequired}%)`, 'INFO');
                        
                        if (currentPayout >= minPayoutRequired) {
                            // ✅ PAYOUT ADEQUADO - Prosseguir diretamente com análise
                            sendToLogSystem(`✅ Payout adequado (${currentPayout}% >= ${minPayoutRequired}%). Iniciando análise diretamente...`, 'SUCCESS');
                            toUpdateStatus(`Payout OK (${currentPayout}%)! Iniciando análise...`, 'success', 3000);
                            
                            // Clicar no botão de análise IMEDIATAMENTE
                            try {
                    if (analyzeBtn) {
                                    sendToLogSystem('🖱️ [DEBUG] Clicando #analyzeBtn para iniciar análise (payout adequado)', 'DEBUG');
                        analyzeBtn.click();
                                    sendToLogSystem('🖱️ [DEBUG] Click executado com sucesso', 'DEBUG');
                                    
                                    // Monitoramento contínuo desabilitado - payout será verificado na próxima análise
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
                            sendToLogSystem(`⚠️ Payout insuficiente (${currentPayout}% < ${minPayoutRequired}%). Aplicando comportamento: ${payoutBehavior}`, 'WARN');
                            
                            // APLICAR COMPORTAMENTO CONFIGURADO DIRETAMENTE
                            try {
                                await applyPayoutBehavior(currentPayout, minPayoutRequired, payoutBehavior, config);
                                
                                // Se chegou aqui, o comportamento foi executado com sucesso
                                sendToLogSystem('✅ Comportamento de payout executado com sucesso. Iniciando análise...', 'SUCCESS');
                                toUpdateStatus('Ativo adequado! Iniciando análise...', 'success', 3000);
                                
                                // Clicar no botão de análise
                                try {
                                    if (analyzeBtn) {
                                        sendToLogSystem('🖱️ [ANÁLISE] Clicando #analyzeBtn após execução do comportamento de payout', 'INFO');
                                        analyzeBtn.click();
                                        sendToLogSystem('🖱️ [ANÁLISE] Click executado - análise iniciada', 'SUCCESS');
                                    } else {
                                        const errorMsg = 'Botão #analyzeBtn não encontrado após comportamento de payout';
                                        sendToLogSystem(errorMsg, 'ERROR');
                                        toUpdateStatus(errorMsg, 'error', 5000);
                                    }
                                } catch (clickError) {
                                    const errorMsg = `Erro ao clicar em #analyzeBtn: ${clickError.message}`;
                                    sendToLogSystem(errorMsg, 'ERROR');
                                    toUpdateStatus(errorMsg, 'error', 5000);
                                }
                                
                            } catch (behaviorError) {
                                // Comportamento falhou - tratar erro
                                sendToLogSystem(`❌ Falha na execução do comportamento de payout: ${behaviorError}`, 'ERROR');
                                
                                if (behaviorError === 'PAYOUT_INSUFFICIENT') {
                                    const cancelMsg = `Análise cancelada: Payout atual (${currentPayout}%) abaixo do mínimo (${minPayoutRequired}%)`;
                                    sendToLogSystem(cancelMsg, 'WARN');
                                    toUpdateStatus(cancelMsg, 'warn', 5000);
                                } else if (behaviorError === 'USER_CANCELLED') {
                                    sendToLogSystem('Análise cancelada pelo usuário durante execução do comportamento', 'INFO');
                                    toUpdateStatus('Operação cancelada pelo usuário', 'info', 3000);
                                } else if (behaviorError.includes('ASSET_SWITCH')) {
                                    const errorMsg = `Erro na troca de ativo: ${behaviorError}`;
                                    sendToLogSystem(errorMsg, 'ERROR');
                                    toUpdateStatus(errorMsg, 'error', 5000);
                                } else {
                                    const errorMsg = `Erro no comportamento de payout: ${behaviorError}`;
                                    sendToLogSystem(errorMsg, 'ERROR');
                                    toUpdateStatus(errorMsg, 'error', 5000);
                                    
                                    // Cancelar operação em caso de erro crítico
                                    if (typeof window.cancelCurrentOperation === 'function') {
                                        window.cancelCurrentOperation(`Erro crítico: ${behaviorError}`);
                                    }
                                }
                            }
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
                // *** CORREÇÃO: Quando meta for atingida, PARAR automação e disparar evento ***
                sendToLogSystem(`🎯 [CONDIÇÃO] META ATINGIDA! Lucro atual ${currentProfit} >= Meta ${dailyProfitTarget}. Iniciando procedimento de parada...`, 'SUCCESS');
                
                // Disparar evento TARGET_REACHED
                chrome.runtime.sendMessage({
                    action: 'TARGET_REACHED',
                    data: {
                        currentProfit: currentProfit,
                        targetProfit: dailyProfitTarget,
                        reason: 'Daily profit target reached'
                    }
                });
                
                // *** DESATIVAR AUTOMAÇÃO ***
                chrome.storage.sync.get(['userConfig'], (configResult) => {
                    if (configResult.userConfig) {
                        const updatedConfig = { 
                            ...configResult.userConfig, 
                            automation: false 
                        };
                        chrome.storage.sync.set({ userConfig: updatedConfig }, () => {
                            sendToLogSystem('🔴 Automação desativada automaticamente após meta atingida', 'INFO');
                        });
                    }
                });
                
                // Log detalhado da parada
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: `🎯 META ATINGIDA: Lucro atual ${currentProfit} atingiu/superou meta de ${dailyProfitTarget} - Automação encerrada`,
                    logLevel: 'SUCCESS',
                    logSource: 'automation.js'
                });
                
                // Parar monitoramento de payout
                if (isPayoutMonitoringActive) {
                    stopPayoutMonitoring();
                }
                
                // *** REMOVIDO: Verificação periódica não é mais usada ***
                // if (isPeriodicCheckActive) {
                //     stopPeriodicMetaCheck();
                // }
                
                // Atualizar status para indicar sucesso
                toUpdateStatus(`🎯 Meta atingida! Lucro: ${currentProfit} / Meta: ${dailyProfitTarget}`, 'success', 10000);
                
                // O status será resetado pelos listeners que criamos
                return; // Não continuar com automação
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
                
                // *** REMOVIDO: Verificação periódica causando problemas ***
                // A meta será verificada apenas quando necessário (após operações)
            });
        } else {
            sendToLogSystem('Botão #start-operation NÃO encontrado por automation.js.', 'WARN');
        }
        
        // Adicionar listener para o CustomEvent 'operationResult' disparado por trade-history.js
        document.addEventListener('operationResult', (event) => {
            sendToLogSystem(`Recebido CustomEvent 'operationResult'. Detalhes: ${JSON.stringify(event.detail)}`, 'INFO');
            
            // *** NOVO: Registrar operação no LimitsChecker ***
            if (window.limitsChecker && event.detail) {
                window.limitsChecker.recordOperation(event.detail);
                sendToLogSystem('Operação registrada no LimitsChecker', 'DEBUG');
            }

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
                                                    // Monitoramento contínuo desabilitado - payout será verificado na próxima análise
                        }
                    } else {
                        // Gale está INATIVO
                        sendToLogSystem('Modo Gale INATIVO detectado. Automação prossegue para runAutomationCheck independentemente do resultado anterior.', 'INFO');
                        runAutomationCheck();
                        
                        // Monitoramento contínuo desabilitado - payout será verificado na próxima análise
                    }
                } else {
                    sendToLogSystem('Automação está DESATIVADA nas configurações. \'operationResult\' ignorado para ciclo de automação.', 'INFO');
                    
                    // Parar monitoramento se automação estiver desativada
                    if (isPayoutMonitoringActive) {
                        stopPayoutMonitoring();
                    }
                    
                    // *** REMOVIDO: Verificação periódica não é mais usada ***
                    // if (isPeriodicCheckActive) {
                    //     stopPeriodicMetaCheck();
                    // }
                }
            });
        });
        sendToLogSystem('Listener para CustomEvent \'operationResult\' adicionado.', 'DEBUG');
    });

    sendToLogSystem('Módulo de Automação carregado e configurado para controle direto e escuta de operationResult.', 'INFO');
    
    // *** REMOVIDO: Exposição global causava problemas ***
    // window.runAutomationCheck = runAutomationCheck;
    // window.startPeriodicMetaCheck = startPeriodicMetaCheck;
    // window.stopPeriodicMetaCheck = stopPeriodicMetaCheck;
    
    // *** NOVO: Listener para mensagens de outros módulos (como gale-system) ***
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Handler para verificação de payout solicitada pelo Gale System
        if (message.action === 'CHECK_PAYOUT_FOR_ANALYSIS' && message.source === 'gale-system') {
            sendToLogSystem('Gale System solicitou verificação de payout. Processando...', 'INFO');
            
            checkPayoutBeforeAnalysisForAutomation()
                .then(() => {
                    sendToLogSystem('Payout verificado e aprovado para Gale System', 'SUCCESS');
                    sendResponse({ 
                        success: true, 
                        shouldProceed: true, 
                        reason: 'Payout aprovado' 
                    });
                })
                .catch(error => {
                    if (error === 'PAYOUT_INSUFFICIENT') {
                        sendToLogSystem('Payout insuficiente detectado. Sistema automático tratou a situação.', 'WARN');
                        sendResponse({ 
                            success: true, 
                            shouldProceed: false, 
                            reason: 'Payout insuficiente - sistema já tratou automaticamente' 
                        });
                    } else if (error === 'USER_CANCELLED') {
                        sendResponse({ 
                            success: false, 
                            shouldProceed: false, 
                            reason: 'Verificação cancelada pelo usuário' 
                        });
                    } else {
                        sendToLogSystem(`Erro na verificação de payout para Gale: ${error}`, 'ERROR');
                        sendResponse({ 
                            success: false, 
                            shouldProceed: true, 
                            reason: `Erro na verificação: ${error}` 
                        });
                    }
                });
            
            return true; // Resposta assíncrona
        }
        
        // Handler para análise com verificação de ativo solicitada pelo Gale System
        if (message.action === 'EXECUTE_ANALYSIS_WITH_ASSET_CHECK' && message.source === 'gale-system') {
            sendToLogSystem('Gale System solicitou análise com verificação de ativo. Processando...', 'INFO');
            
            const config = message.config || {};
            
            executeAnalysisWithAssetCheck(config)
                .then(() => {
                    sendToLogSystem('Análise com verificação de ativo concluída para Gale System', 'SUCCESS');
                    sendResponse({ 
                        success: true, 
                        reason: 'Análise iniciada após verificação de ativo' 
                    });
                })
                .catch(error => {
                    sendToLogSystem(`Erro na análise com verificação de ativo para Gale: ${error}`, 'ERROR');
                    sendResponse({ 
                        success: false, 
                        reason: `Erro: ${error}` 
                    });
                });
            
            return true; // Resposta assíncrona
        }
        
        // Handler para obter payout atual solicitado pelo Gale System
        if (message.action === 'GET_CURRENT_PAYOUT' && message.source === 'gale-system') {
            getCurrentPayoutForAutomation()
                .then(payout => {
                    sendResponse({ 
                        success: true, 
                        payout: payout 
                    });
                })
                .catch(error => {
                    sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                });
            
            return true; // Resposta assíncrona
        }
    });
    
    sendToLogSystem('Handlers de mensagens configurados para integração com outros módulos', 'DEBUG');
})(); 

// Função para reportar erro ao StateManager
function reportSystemError(errorMessage, errorDetails = null) {
    sendToLogSystem(`ERRO DO SISTEMA: ${errorMessage}`, 'ERROR');
    
    if (window.StateManager) {
        const errorInfo = window.StateManager.reportError(errorMessage, errorDetails);
        toUpdateStatus(`Sistema parou por erro: ${errorMessage}`, 'error');
        return errorInfo;
    } else {
        sendToLogSystem('StateManager não disponível para reportar erro', 'ERROR');
        toUpdateStatus(`Sistema parou por erro: ${errorMessage}`, 'error');
        return null;
    }
}

// Função wrapper para try-catch automático nas funções críticas
async function safeExecuteAutomation(fn, functionName, ...args) {
    try {
        return await fn(...args);
    } catch (error) {
        reportSystemError(`Erro em ${functionName}: ${error.message}`, {
            function: functionName,
            args: args,
            stack: error.stack,
            module: 'automation.js'
        });
        throw error;
    }
}

// ======================================================================
// =================== SISTEMA DE VERIFICAÇÃO PERIÓDICA ================
// ======================================================================

/**
 * Sistema de verificação periódica da meta para garantir detecção
 */
let periodicCheckInterval = null;
let isPeriodicCheckActive = false;

/**
 * *** DESABILITADO: Verificação periódica causava problemas ***
 * Iniciar verificação periódica da meta
 */
function startPeriodicMetaCheck() {
    sendToLogSystem('⚠️ Verificação periódica desabilitada - meta será verificada apenas após operações', 'WARN');
    return; // *** DESABILITADO ***
    
    // Código original comentado para referência futura
    /*
    if (isPeriodicCheckActive) {
        sendToLogSystem('Verificação periódica já está ativa', 'DEBUG');
        return;
    }
    
    sendToLogSystem('🔄 Iniciando verificação periódica da meta (a cada 30s)', 'INFO');
    isPeriodicCheckActive = true;
    
    periodicCheckInterval = setInterval(() => {
        try {
            // Verificar se automação ainda está ativa
            chrome.storage.sync.get(['userConfig'], (result) => {
                const config = result.userConfig || {};
                
                if (config.automation) {
                    sendToLogSystem('🔍 [VERIFICAÇÃO PERIÓDICA] Checando meta...', 'DEBUG');
                    // Usar referência global segura
                    if (typeof window.runAutomationCheck === 'function') {
                        window.runAutomationCheck();
                    } else if (typeof runAutomationCheck === 'function') {
                        runAutomationCheck();
                    } else {
                        sendToLogSystem('⚠️ [VERIFICAÇÃO PERIÓDICA] runAutomationCheck não encontrada', 'WARN');
                    }
                } else {
                    sendToLogSystem('🔍 [VERIFICAÇÃO PERIÓDICA] Automação desativada, parando verificação periódica', 'INFO');
                    stopPeriodicMetaCheck();
                }
            });
        } catch (error) {
            sendToLogSystem(`❌ [VERIFICAÇÃO PERIÓDICA] Erro: ${error.message}`, 'ERROR');
        }
    }, 30000); // A cada 30 segundos
    */
}

/**
 * Parar verificação periódica
 */
function stopPeriodicMetaCheck() {
    if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
        periodicCheckInterval = null;
        isPeriodicCheckActive = false;
        sendToLogSystem('🔄 Verificação periódica da meta interrompida', 'INFO');
    }
} 