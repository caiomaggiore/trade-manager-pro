// src/content/gale-system.js
// Sistema de aplicação de Gale para o Trade Manager Pro

(function() {
    const GALE_LOG_PREFIX = '[GaleSystem]';

    function log(message, level = 'INFO') {
        const prefixedMessage = `${GALE_LOG_PREFIX} ${message}`;
        // const runtimeId = chrome && chrome.runtime ? chrome.runtime.id : 'undefined';
        // console.warn(`${GALE_LOG_PREFIX} Attempting to log: "${message.substring(0,100)}...", Level: ${level}, Runtime ID: ${runtimeId}`);

        try {
            // if (runtimeId && runtimeId !== 'undefined') { // Condição removida
            chrome.runtime.sendMessage({
                action: 'addLog',
                logMessage: prefixedMessage, 
                level: level,
                source: 'gale-system.js'
            }); 
            // console.warn(`${GALE_LOG_PREFIX} Log message SENT to runtime.`);
            // } else {
            //    console.warn(`${GALE_LOG_PREFIX} Log message NOT SENT to runtime due to invalid runtime ID.`);
            // }
        } catch (error) {
            console.warn(`${GALE_LOG_PREFIX} Exceção ao tentar enviar log via runtime (fallback no console):`, error);
        }
    }

    const GALE_ACTIONS = {
        APPLY: 'APPLY_GALE',
        RESET: 'RESET_GALE',
        STATUS: 'GET_GALE_STATUS',
        UPDATED: 'GALE_UPDATED',
        RESET_DONE: 'GALE_RESET'
    };

    let isActive = false;
    let galeCount = 0;
    let originalValue = 0;
    let galeMultiplier = 1.2;
    
    function initialize() {
        log('Inicializando sistema de gale...', 'INFO');
        try {
            if (window.StateManager) {
                const config = window.StateManager.getConfig();
                isActive = config.gale?.active || false;
                originalValue = config.value || 10;
                galeCount = 0;
                if (config.gale?.level) {
                    galeMultiplier = parseFloat(config.gale.level.replace('x', '')) || 1.2;
                }
                log(`Inicializado com: ativo=${isActive}, valor=${originalValue}, multiplicador=${galeMultiplier}`, 'DEBUG');
                window.StateManager.subscribe((notification) => {
                    if (notification.type === 'config') {
                        handleConfigUpdate(notification.state.config);
                    }
                });
                log('Sistema de Gale inicializado e StateManager listener configurado.', 'SUCCESS');
                log(`Gale ${isActive ? 'ativado' : 'desativado'}, multiplicador: ${galeMultiplier}x`, 'INFO');
            } else {
                log('StateManager não encontrado. O sistema de gale não funcionará corretamente.', 'ERROR');
            }
        } catch (error) {
            log(`Erro ao inicializar: ${error.message}`, 'ERROR');
        }
        setupMessageListener();
    }
    
    function handleConfigUpdate(config) {
        if (!config) return;
        try {
            const oldIsActive = isActive;
            const oldMultiplier = galeMultiplier;
            const oldOriginalValue = originalValue;

            isActive = config.gale?.active || false;
            if (config.gale?.level) {
                galeMultiplier = parseFloat(config.gale.level.replace('x', '')) || 1.2;
            }
            if (galeCount === 0) { // Só atualiza o valor base se não estiver em um ciclo de gale
                originalValue = config.value || 10;
            }
            if (oldIsActive !== isActive || oldMultiplier !== galeMultiplier || (galeCount === 0 && oldOriginalValue !== originalValue)) {
                log(`Configurações de Gale atualizadas: ativo=${isActive}, valor base=${originalValue}, multiplicador=${galeMultiplier}`, 'INFO');
            }
        } catch (error) {
            log(`Erro ao processar atualização de config: ${error.message}`, 'ERROR');
        }
    }
    
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (message.action === GALE_ACTIONS.APPLY) {
                    const result = applyGale(message.data);
                    if (result.success) {
                        setTimeout(triggerNewAnalysis, 500);
                    }
                    sendResponse({ success: true, result: result });
                    return true; 
                }
                if (message.action === GALE_ACTIONS.RESET) {
                    const result = resetGale(message.data);
                    sendResponse({ success: true, result: result });
                    return true;
                }
                if (message.action === GALE_ACTIONS.STATUS) {
                    sendResponse({ success: true, data: getStatus() });
                    return true;
                }
            } catch (error) {
                log(`Erro ao processar mensagem runtime: ${error.message}`, 'ERROR');
                if (typeof sendResponse === 'function') {
                    sendResponse({ success: false, error: error.message });
                }
                return true; // Ainda retorna true para indicar que a resposta (mesmo de erro) foi tratada
            }
            return false; 
        });
        log('Listener de mensagens runtime para GaleSystem configurado.', 'DEBUG');
    }
    
    function triggerNewAnalysis() {
        log('Acionando nova análise após aplicação de gale...', 'INFO');
        try {
            const analyzeBtn = document.querySelector('#analyzeBtn');
            if (analyzeBtn) {
                log('Botão #analyzeBtn encontrado, simulando clique.', 'DEBUG');
                analyzeBtn.click();
                return true;
            }
            log('Botão #analyzeBtn não encontrado, tentando outras formas de iniciar análise.', 'WARN');
            
            if (window.TradeManager && window.TradeManager.AnalyzeGraph) {
                if (typeof window.TradeManager.AnalyzeGraph.analyze === 'function') {
                    log('Chamando TradeManager.AnalyzeGraph.analyze()', 'DEBUG');
                    window.TradeManager.AnalyzeGraph.analyze();
                    return true;
                } else if (typeof window.TradeManager.AnalyzeGraph.runAnalysis === 'function') {
                    log('Chamando TradeManager.AnalyzeGraph.runAnalysis()', 'DEBUG');
                    window.TradeManager.AnalyzeGraph.runAnalysis();
                    return true;
                } else {
                    log(`Métodos de análise disponíveis em TradeManager.AnalyzeGraph: ${Object.keys(window.TradeManager.AnalyzeGraph).join(', ')}`, 'WARN');
                }
            } else {
                log('TradeManager.AnalyzeGraph não encontrado.', 'WARN');
            }
            
            log('Enviando mensagem START_ANALYSIS como fallback.', 'DEBUG');
            chrome.runtime.sendMessage({
                action: 'START_ANALYSIS',
                source: 'gale-system',
                trigger: 'gale_applied'
            }, response => {
                if (chrome.runtime.lastError) {
                    log(`Erro ao solicitar START_ANALYSIS: ${chrome.runtime.lastError.message}`, 'ERROR');
                    return;
                }
                if (response && response.success) {
                    log('Análise iniciada com sucesso via mensagem START_ANALYSIS.', 'INFO');
                } else {
                    log(`Falha ao iniciar análise via START_ANALYSIS: ${response?.error || 'Sem resposta'}`, 'ERROR');
                }
            });
            return true;
        } catch (error) {
            log(`Erro em triggerNewAnalysis: ${error.message}`, 'ERROR');
            return false;
        }
    }
    
    function applyGale(data = {}) {
        log(`Tentativa de aplicar gale. Solicitado por: ${data.source || 'desconhecido'}. Dados: ${JSON.stringify(data)}`, 'DEBUG');
        try {
            if (!isActive) {
                log('Gale desativado. Nenhuma ação.', 'WARN');
                return { success: false, message: 'Gale desativado' };
            }
            if (data.isHistorical) {
                log('Ignorando gale para operação histórica.', 'INFO');
                return { success: false, message: 'Operação histórica ignorada' };
            }
            const operationTime = data.timestamp || data.notifyTime || 0;
            if (operationTime > 0 && (Date.now() - operationTime) > 30000) {
                log(`Ignorando gale para operação antiga (${Math.round((Date.now() - operationTime)/1000)}s atrás).`, 'WARN');
                return { success: false, message: 'Operação muito antiga para aplicar gale' };
            }

            let currentEntryValue = 0;
            if (window.StateManager) {
                currentEntryValue = parseFloat(window.StateManager.getConfig().value || 0);
            }
            if (currentEntryValue <= 0) {
                log(`Valor de entrada atual inválido (${currentEntryValue}), usando valor original base (${originalValue}).`, 'WARN');
                currentEntryValue = originalValue;
            }

            if (galeCount === 0) {
                galeCount = 1;
                if (window.StateManager) { // Atualiza o valor original base APENAS no primeiro gale do ciclo
                    originalValue = parseFloat(window.StateManager.getConfig().value || 10); 
                    log(`Valor original base para este ciclo de gale: ${originalValue}`, 'DEBUG');
                }
            } else {
                galeCount++;
            }
            log(`Aplicando Gale nível ${galeCount}. Multiplicador: ${galeMultiplier}. Valor base para este gale: ${currentEntryValue}`, 'INFO');
            
            const multipliedPortion = parseFloat((currentEntryValue * galeMultiplier).toFixed(2));
            const newValue = parseFloat((currentEntryValue + multipliedPortion).toFixed(2));

            log(`Novo valor calculado: ${newValue} (Base: ${currentEntryValue}, Adicional: ${multipliedPortion})`, 'INFO');

            if (window.StateManager) {
                const config = window.StateManager.getConfig();
                const updatedConfig = { ...config, value: newValue };
                window.StateManager.saveConfig(updatedConfig)
                    .then(() => {
                        log(`Valor de entrada atualizado para: ${newValue} no StateManager.`, 'SUCCESS');
                        showFeedback(`Gale nível ${galeCount} aplicado`, `Novo valor: $${newValue}`, 'warning');
                    })
                    .catch(error => {
                        log(`Erro ao salvar novo valor ${newValue} no StateManager: ${error.message}`, 'ERROR');
                    });
            } else {
                log('StateManager não disponível. Não foi possível atualizar o valor de entrada.', 'ERROR');
                return { success: false, message: 'StateManager não disponível' };
            }
            
            notify(GALE_ACTIONS.UPDATED, { level: galeCount, newValue: newValue, originalValue: originalValue, currentValue: currentEntryValue, multiplier: galeMultiplier });
            return { success: true, level: galeCount, newValue: newValue, currentValue: currentEntryValue, message: `Gale nível ${galeCount} aplicado. Novo valor: ${newValue}` };
        } catch (error) {
            log(`Erro ao aplicar gale: ${error.message}`, 'ERROR');
            return { success: false, message: `Erro: ${error.message}` };
        }
    }
    
    function resetGale(data = {}) {
        log(`Tentativa de resetar gale. Solicitado por: ${data.source || 'desconhecido'}. Dados: ${JSON.stringify(data)}`, 'DEBUG');
        try {
            if (galeCount === 0) {
                log('Não há gale ativo para resetar.', 'INFO');
                return { success: false, message: 'Não há gale para resetar' };
            }
            if (data && data.isHistorical) {
                log('Ignorando reset de gale para operação histórica.', 'INFO');
                return { success: false, message: 'Operação histórica ignorada' };
            }
            if (data && data.timestamp) {
                const operationTime = data.timestamp || data.notifyTime || 0;
                if (operationTime > 0 && (Date.now() - operationTime) > 30000) {
                    log(`Ignorando reset de gale para operação antiga (${Math.round((Date.now() - operationTime)/1000)}s atrás).`, 'WARN');
                    return { success: false, message: 'Operação muito antiga para resetar gale' };
                }
            }

            const previousLevel = galeCount;
            galeCount = 0;
            log(`Gale resetado do nível ${previousLevel}. Restaurando valor original.`, 'INFO');

            if (window.StateManager && originalValue > 0) {
                const config = window.StateManager.getConfig();
                const updatedConfig = { ...config, value: originalValue };
                window.StateManager.saveConfig(updatedConfig)
                    .then(() => {
                        log(`Valor original restaurado no StateManager.`, 'SUCCESS');
                    })
                    .catch(error => {
                        log(`Erro ao restaurar valor original no StateManager: ${error.message}`, 'ERROR');
                    });
            } else {
                log('StateManager não disponível. Não foi possível restaurar o valor original.', 'ERROR');
            }
            
            notify(GALE_ACTIONS.RESET_DONE, { level: previousLevel });
            return { success: true, level: previousLevel };
        } catch (error) {
            log(`Erro ao resetar gale: ${error.message}`, 'ERROR');
            return { success: false, message: `Erro: ${error.message}` };
        }
    }
})();