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

// Função para obter o payout atual (exemplo, ajuste conforme sua lógica real)
function getCurrentPayout() {
    // Substitua por sua lógica real de obtenção do payout
    return window.currentPayout || 100; // Exemplo: valor fictício
}

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

            const minPayout = parseFloat(config.minPayout) || 80;
            const currentPayout = getCurrentPayout();
            if (currentPayout < minPayout) {
                sendToLogSystem(`Payout atual (${currentPayout}%) está abaixo do mínimo configurado (${minPayout}%). Forçando WAIT.`, 'WARN');
                toUpdateStatus(`Aguardando payout subir para o mínimo configurado (${minPayout}%).`, 'warn');
                // Chamar modal de análise forçado com ação WAIT e mensagem personalizada
                if (chrome && chrome.runtime && chrome.runtime.id) {
                    chrome.runtime.sendMessage({
                        action: 'forceWaitModal',
                        reason: `O payout atual (${currentPayout}%) está abaixo do mínimo configurado (${minPayout}%). Aguarde ou troque de moeda.`
                    });
                }
                return;
            }

            if (currentProfit < dailyProfitTarget) {
                const conditionMsg = `Automação: Condição atendida (${currentProfit} < ${dailyProfitTarget}). Iniciando análise...`;
                sendToLogSystem(conditionMsg, 'INFO');
                toUpdateStatus('Automação: Iniciando análise...', 'info');
                
                // Tentar clicar no botão de análise DIRETAMENTE
                try {
                    // O botão é buscado no DOMContentLoaded
                    if (analyzeBtn) {
                        sendToLogSystem('Clicando #analyzeBtn DIRETAMENTE para iniciar análise.', 'DEBUG');
                        analyzeBtn.click();
                        // Não atualiza status final aqui, espera a análise rodar
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