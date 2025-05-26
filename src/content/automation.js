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

// Função para obter o payout atual da plataforma (solicita ao content.js)
async function getCurrentPayout() {
    return new Promise((resolve, reject) => {
        try {
            sendToLogSystem('Solicitando payout atual ao content.js...', 'DEBUG');
            
            // Solicitar payout ao content.js via chrome.runtime
            chrome.runtime.sendMessage({
                action: 'GET_CURRENT_PAYOUT'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = `Erro ao solicitar payout: ${chrome.runtime.lastError.message}`;
                    sendToLogSystem(errorMsg, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                if (!response) {
                    const errorMsg = 'Nenhuma resposta recebida do content.js para solicitação de payout';
                    sendToLogSystem(errorMsg, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                if (!response.success) {
                    const errorMsg = response.error || 'Erro desconhecido ao obter payout';
                    sendToLogSystem(errorMsg, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                if (typeof response.payout !== 'number' || response.payout <= 0) {
                    const errorMsg = `Payout inválido recebido: ${response.payout}`;
                    sendToLogSystem(errorMsg, 'ERROR');
                    reject(new Error(errorMsg));
                    return;
                }
                
                sendToLogSystem(`Payout recebido do content.js: ${response.payout}%`, 'SUCCESS');
                resolve(response.payout);
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
            const payoutTimeout = parseInt(config.payoutTimeout) || 60;
            
            sendToLogSystem(`Verificando payout: Mínimo=${minPayout}%, Comportamento=${payoutBehavior}, Timeout=${payoutTimeout}s`, 'INFO');
            
            // Obter payout atual usando await
            const currentPayout = await getCurrentPayout();
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
                    sendToLogSystem(`Iniciando monitoramento contínuo de payout (mínimo: ${minPayout}%)...`, 'INFO');
                    toUpdateStatus(`Monitoramento de payout ativo - aguardando ${minPayout}%...`, 'info', 0);
                    waitForPayoutImprovement(minPayout, payoutTimeout, resolve, reject);
                    break;
                    
                case 'switch':
                    // Futuro: implementar troca de ativo
                    sendToLogSystem('Comportamento "switch" ainda não implementado. Cancelando por enquanto.', 'WARN');
                    toUpdateStatus('Troca automática de ativo ainda não disponível. Operação cancelada.', 'warn', 5000);
                    reject('SWITCH_NOT_IMPLEMENTED');
                    break;
                    
                default:
                    sendToLogSystem(`Comportamento de payout desconhecido: ${payoutBehavior}. Cancelando.`, 'ERROR');
                    reject('UNKNOWN_BEHAVIOR');
            }
        });
    });
}

// Função auxiliar para aguardar melhora do payout (loop contínuo)
function waitForPayoutImprovement(minPayout, maxTimeout, resolve, reject) {
    let elapsedTime = 0;
    let waitInterval = null;
    let lastStatusUpdate = 0;
    let isCancelled = false;
    
    // Log inicial único
    sendToLogSystem(`Aguardando payout adequado - monitoramento ativo (mínimo: ${minPayout}%)`, 'INFO');
    
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
            const currentPayout = await getCurrentPayout();
            elapsedTime++;
            
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
    
    // Verificar imediatamente e depois a cada segundo
    checkPayoutPeriodically();
    waitInterval = setInterval(checkPayoutPeriodically, 1000);
    
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
                const conditionMsg = `Automação: Condição atendida (${currentProfit} < ${dailyProfitTarget}). Verificando payout antes da análise...`;
                sendToLogSystem(conditionMsg, 'INFO');
                toUpdateStatus('Automação: Verificando payout antes da análise...', 'info');
                
                // *** NOVA LÓGICA: Verificar payout antes de iniciar análise ***
                checkPayoutBeforeAnalysis()
                    .then(() => {
                        // Payout adequado, pode prosseguir com análise
                        sendToLogSystem('Payout verificado e adequado. Iniciando análise...', 'SUCCESS');
                        toUpdateStatus('Payout adequado! Iniciando análise...', 'success', 3000);
                
                // Tentar clicar no botão de análise DIRETAMENTE
                try {
                    if (analyzeBtn) {
                        sendToLogSystem('Clicando #analyzeBtn DIRETAMENTE para iniciar análise.', 'DEBUG');
                        analyzeBtn.click();
                    } else {
                        const errorMsg = 'Botão #analyzeBtn NÃO encontrado (referência não estabelecida).';
                        sendToLogSystem(errorMsg, 'ERROR');
                        toUpdateStatus(errorMsg, 'error');
                    }
                } catch (error) {
                    const errorMsg = `Erro ao clicar em #analyzeBtn DIRETAMENTE: ${error.message}`;
                    sendToLogSystem(errorMsg, 'ERROR');
                    toUpdateStatus(errorMsg, 'error');
                }
                    })
                    .catch((reason) => {
                        // Payout insuficiente ou outro erro
                        sendToLogSystem(`Verificação de payout falhou: ${reason}`, 'WARN');
                        
                        if (reason === 'PAYOUT_INSUFFICIENT') {
                            toUpdateStatus('Análise cancelada: Payout insuficiente', 'warn', 5000);
                        } else if (reason === 'PAYOUT_TIMEOUT') {
                            toUpdateStatus('Análise cancelada: Timeout aguardando payout', 'warn', 5000);
                        } else if (reason === 'USER_CANCELLED') {
                            toUpdateStatus('Monitoramento de payout cancelado pelo usuário', 'info', 5000);
                        } else if (reason === 'SWITCH_NOT_IMPLEMENTED') {
                            toUpdateStatus('Troca de ativo não implementada ainda', 'warn', 5000);
                        } else {
                            toUpdateStatus(`Erro na verificação de payout: ${reason}`, 'error', 5000);
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