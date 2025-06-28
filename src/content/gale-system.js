// src/content/gale-system.js
// Sistema de aplicação de Gale para o Trade Manager Pro

(function() {
    const GALE_LOG_PREFIX = '[GaleSystem]';

    function log(message, level = 'INFO') {
        // const prefixedMessage = `${GALE_LOG_PREFIX} ${message}`; // REMOVIDO
        // const runtimeId = chrome && chrome.runtime ? chrome.runtime.id : 'undefined';
        // console.warn(`${GALE_LOG_PREFIX} Attempting to log: "${message.substring(0,100)}...", Level: ${level}, Runtime ID: ${runtimeId}`);

        try {
            // if (runtimeId && runtimeId !== 'undefined') { // Condição removida
            chrome.runtime.sendMessage({
                action: 'addLog',
                logMessage: message, // MODIFICADO: Apenas a mensagem
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

    // Função padronizada para enviar status para o index
    function toUpdateStatus(message, type = 'info', duration = 3000) {
        if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: 'updateStatus',
                message: message,
                type: type,
                duration: duration
            });
        }
    }

    // Função para enviar atualização de status para o index.js
    function updateStatusInIndex(message, type = 'info', duration = 3000) {
        try {
            log(`Enviando atualização de status: ${message} (${type})`, 'DEBUG');
            chrome.runtime.sendMessage({
                action: 'updateStatus', 
                message: message,
                type: type,
                duration: duration
            }, response => {
                if (chrome.runtime.lastError) {
                    log(`Erro ao enviar status para index.js: ${chrome.runtime.lastError.message}`, 'ERROR');
                } else if (response && response.success) {
                    log('Status atualizado com sucesso no index.js', 'DEBUG');
                }
            });
        } catch (error) {
            log(`Erro ao enviar status: ${error.message}`, 'ERROR');
        }
    }

    // REMOVIDO: Funções de payout movidas para PayoutController

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
    
    // Novas variáveis para a estratégia de Gale baseada em payout
    let galeLosses = []; // Histórico de valores perdidos no ciclo atual
    let desiredProfitPercentage = 0.2; // Valor padrão de 20%
    let currentPayout = 1.9; // Valor padrão para payout de 90% (multiplicador 1.9)
    
    // *** NOVO: Integração com Intelligent Gale ***
    let intelligentMode = false; // Se está usando modo inteligente
    let intelligentValue = null; // Valor sugerido pelo sistema inteligente
    let intelligentMultiplier = null; // Multiplicador sugerido pelo sistema inteligente
    
    // Função para capturar e processar o payout para uso nos cálculos
    function getPayoutMultiplier() {
        try {
            log('Obtendo multiplicador de payout para cálculos de Gale', 'DEBUG');
            
            // Tenta usar o valor armazenado da última captura, caso exista
            const payoutResult = document.getElementById('payout-result');
            if (payoutResult) {
                const resultText = payoutResult.textContent || '';
                // Extrair o percentual do texto
                const percentMatch = resultText.match(/(\d+\.?\d*)%/);
                
                if (percentMatch && percentMatch[1]) {
                    const percentValue = parseFloat(percentMatch[1]);
                    if (!isNaN(percentValue) && percentValue > 0) {
                        // Converter percentual para multiplicador (ex: 90% = 1.90)
                        const multiplier = 1 + (percentValue / 100);
                        log(`Payout encontrado: ${percentValue}%, multiplicador: ${multiplier.toFixed(2)}`, 'SUCCESS');
                        currentPayout = multiplier;
                        return multiplier;
                    }
                }
            }
            
            // Se não conseguiu extrair do elemento, tentar capturar novamente
            log('Não foi possível extrair payout da última captura, iniciando nova captura', 'DEBUG');
            // Aqui poderíamos chamar a captura, mas isso tornaria a função assíncrona
            // Vamos manter o valor atual por enquanto
            
            log(`Usando valor de payout atual: ${currentPayout}`, 'INFO');
            return currentPayout;
        } catch (error) {
            log(`Erro ao obter multiplicador de payout: ${error.message}`, 'ERROR');
            return currentPayout; // Usar valor padrão em caso de erro
        }
    }
    
    function initialize() {
    log('Inicializando sistema de gale...', 'INFO');
    try {
        if (window.StateManager) {
            const config = window.StateManager.getConfig();
            log(`Initialize: Configuração recebida do StateManager: ${config ? JSON.stringify(config) : 'N/A'}`, 'DEBUG');
            isActive = config?.gale?.active || false;
            // Garantir que o valor original seja capturado do StateManager
            originalValue = config?.value || 10;
            galeCount = 0; // Resetar galeCount na inicialização
            galeLosses = []; // Resetar histórico de perdas
            
            // Obter multiplicador do gale (agora é a % de lucro desejado)
            if (config?.gale?.level) {
                // Converter formato "Xx%" para decimal (exemplo: "20%" para 0.2, "0%" para 0, "5%" para 0.05)
                const levelMatch = config.gale.level.match(/(\d+)%?/);
                if (levelMatch && levelMatch[1] !== undefined) {
                    desiredProfitPercentage = parseFloat(levelMatch[1]) / 100;
                    log(`Percentual de lucro desejado: ${desiredProfitPercentage * 100}%`, 'INFO');
                } else {
                    desiredProfitPercentage = parseFloat(config.gale.level.replace('x', '')) / 100 || 0.2;
                }
            }
            
            log(`Initialize: isActive definido como: ${isActive}. Valor original: ${originalValue}. Lucro desejado: ${desiredProfitPercentage * 100}%.`, 'DEBUG');
            
            window.StateManager.subscribe((notification) => {
                if (notification.type === 'config') {
                    handleConfigUpdate(notification.state.config);
                }
            });
            log('Sistema de Gale inicializado e StateManager listener configurado.', 'SUCCESS');
            log(`Gale ${isActive ? 'ativado' : 'desativado'}, lucro desejado: ${desiredProfitPercentage * 100}%`, 'INFO');
        } else {
            log('StateManager não encontrado. O sistema de gale não funcionará corretamente.', 'ERROR');
             isActive = false; // Garantir que isActive seja false se o StateManager não estiver lá
        }
    } catch (error) {
        log(`Erro ao inicializar: ${error.message}`, 'ERROR');
        isActive = false; // Garantir que isActive seja false em caso de erro
    }
    setupMessageListener(); // Mover para o final de initialize
    
    log('Sistema Gale inicializado e pronto para uso', 'SUCCESS');
}
    
    // REMOVIDO: Listeners de DOM movidos para index.js
    
    function handleConfigUpdate(config) {
        if (!config) {
            log('handleConfigUpdate: Configuração recebida é nula ou indefinida. Nenhuma atualização feita.', 'WARN');
            return;
        }
        try {
            const oldIsActive = isActive;
            const oldProfitPercentage = desiredProfitPercentage;
            const oldOriginalValue = originalValue;

            log(`handleConfigUpdate: Configuração recebida: ${JSON.stringify(config)}`, 'DEBUG');
            isActive = config.gale?.active || false;
            
            // Atualizar percentual de lucro desejado
            if (config.gale?.level) {
                // Converter formato "Xx%" para decimal (exemplo: "20%" para 0.2, "0%" para 0, "5%" para 0.05)
                const levelMatch = config.gale.level.match(/(\d+)%?/);
                if (levelMatch && levelMatch[1] !== undefined) {
                    desiredProfitPercentage = parseFloat(levelMatch[1]) / 100;
                } else {
                    desiredProfitPercentage = parseFloat(config.gale.level.replace('x', '')) / 100 || 0.2;
                }
            }
            
            if (galeCount === 0) { // Só atualiza o valor base se não estiver em um ciclo de gale
                originalValue = config.value || 10;
                log(`Valor original atualizado para: ${originalValue} (não está em ciclo de gale)`, 'DEBUG');
            } else {
                log(`Mantendo valor original: ${originalValue} (está em ciclo de gale: nível ${galeCount})`, 'DEBUG');
            }
            log(`handleConfigUpdate: isActive atualizado para: ${isActive}, valor base (se aplicável): ${originalValue}, lucro desejado: ${desiredProfitPercentage * 100}%`, 'DEBUG');

            if (oldIsActive !== isActive || oldProfitPercentage !== desiredProfitPercentage || (galeCount === 0 && oldOriginalValue !== originalValue)) {
                log(`Configurações de Gale efetivamente atualizadas: ativo=${isActive}, valor base=${originalValue}, lucro desejado=${desiredProfitPercentage * 100}%`, 'INFO');
            }
        } catch (error) {
            log(`Erro ao processar atualização de config: ${error.message}`, 'ERROR');
        }
    }
    
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // *** FILTRAR MENSAGENS: Só processar mensagens destinadas ao Gale ***
            const galeActions = Object.values(GALE_ACTIONS);
            
            // Se a mensagem não é para o Gale, ignorar silenciosamente
            if (!galeActions.includes(message.action)) {
                return false; // Não processar, deixar outros listeners tratarem
            }
            
            // Agora só logamos mensagens que são realmente para o Gale
            log(`Mensagem Gale recebida: Action=${message.action}`, 'DEBUG'); 
            
            try {
                if (message.action === GALE_ACTIONS.APPLY) {
                    log(`GALE_ACTIONS.APPLY detectado. Dados: ${JSON.stringify(message.data)}`, 'DEBUG');
                    const result = applyGale(message.data);
                    log(`Resultado de applyGale para APPLY_GALE: ${JSON.stringify(result)}. Enviando resposta...`, 'DEBUG');
                    sendResponse({ success: result.success, result: result });
                    return true; 
                }
                if (message.action === GALE_ACTIONS.RESET) {
                    log(`GALE_ACTIONS.RESET detectado. Dados: ${JSON.stringify(message.data)}`, 'DEBUG');
                    const result = resetGale(message.data);
                    log(`Resultado de resetGale para RESET_GALE: ${JSON.stringify(result)}. Enviando resposta...`, 'DEBUG');
                    sendResponse({ success: result.success, result: result });
                    return true;
                }
                if (message.action === GALE_ACTIONS.STATUS) {
                    log('GALE_ACTIONS.STATUS detectado. Chamando getStatusForTesting e enviando resposta...', 'DEBUG');
                    sendResponse({ success: true, data: getStatusForTesting() });
                    return true;
                }
            } catch (error) {
                log(`Erro ao processar mensagem runtime do Gale: ${error.message}`, 'ERROR');
                if (typeof sendResponse === 'function') {
                    sendResponse({ success: false, error: error.message });
                }
                return true; 
            }
            
            // Se chegou até aqui, a ação é do Gale mas não foi reconhecida
            log(`Ação do Gale não reconhecida: ${message.action}`, 'WARN');
            return false; 
        });
        log('Listener de mensagens runtime para GaleSystem configurado (apenas ações do Gale).', 'DEBUG');
    }
    
    function triggerNewAnalysis() {
        log('🎯 [GALE] Acionando nova análise após aplicação de gale...', 'INFO');
        
        // ✅ CORREÇÃO: Usar a mesma lógica de verificação de payout da automação principal
        chrome.storage.sync.get(['userConfig'], async (storageResult) => {
            if (chrome.runtime.lastError) {
                log(`❌ [GALE] Erro ao ler configuração: ${chrome.runtime.lastError.message}`, 'ERROR');
                // Fallback: análise direta após delay
                setTimeout(() => requestActualAnalysis(), 2000);
                return;
            }
            
            const config = storageResult.userConfig || {};
            const minPayoutRequired = parseFloat(config.minPayout) || 80;
            const payoutBehavior = config.payoutBehavior || 'wait';
            
            log(`🔧 [GALE] Configuração: payout min=${minPayoutRequired}%, comportamento=${payoutBehavior}`, 'DEBUG');
            
            try {
                // ✅ USAR A MESMA FUNÇÃO DA AUTOMAÇÃO PRINCIPAL
                const payoutResult = await getCurrentPayoutForAutomation();
                const currentPayout = payoutResult.payout;
                
                log(`🔍 [GALE] Payout atual: ${currentPayout}% (mínimo: ${minPayoutRequired}%)`, 'INFO');
                
                if (currentPayout >= minPayoutRequired) {
                    // ✅ PAYOUT ADEQUADO: Iniciar análise diretamente
                    log(`✅ [GALE] Payout adequado (${currentPayout}% >= ${minPayoutRequired}%). Iniciando análise...`, 'SUCCESS');
                    requestActualAnalysis();
                } else {
                    // ⚠️ PAYOUT INSUFICIENTE: Aplicar comportamento configurado
                    log(`⚠️ [GALE] Payout insuficiente (${currentPayout}% < ${minPayoutRequired}%). Aplicando comportamento: ${payoutBehavior}`, 'WARN');
                    
                    try {
                        // ✅ USAR A MESMA FUNÇÃO DE COMPORTAMENTO DA AUTOMAÇÃO
                        await applyPayoutBehavior(currentPayout, minPayoutRequired, payoutBehavior, config);
                        
                        log(`✅ [GALE] Comportamento de payout executado. Iniciando análise...`, 'SUCCESS');
                        requestActualAnalysis();
                        
                    } catch (behaviorError) {
                        log(`❌ [GALE] Falha no comportamento de payout: ${behaviorError}`, 'ERROR');
                        
                        if (behaviorError === 'USER_CANCELLED') {
                            log('ℹ️ [GALE] Análise cancelada pelo usuário durante comportamento de payout', 'INFO');
                        } else if (behaviorError === 'PAYOUT_INSUFFICIENT') {
                            log(`⚠️ [GALE] Payout continua insuficiente após comportamento. Tentando novamente em 10s...`, 'WARN');
                            setTimeout(() => triggerNewAnalysis(), 10000);
                        } else {
                            log(`❌ [GALE] Erro crítico no comportamento: ${behaviorError}. Tentando análise direta...`, 'ERROR');
                            setTimeout(() => requestActualAnalysis(), 3000);
                        }
                    }
                }
                
            } catch (payoutError) {
                log(`❌ [GALE] Erro na verificação de payout: ${payoutError.message}`, 'ERROR');
                // Fallback: análise direta após delay
                setTimeout(() => requestActualAnalysis(), 2000);
            }
        });
    }
    
    // *** NOVA FUNÇÃO: Requisitar análise sem verificações (função original) ***
    function requestActualAnalysis() {
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
            log(`Erro em requestActualAnalysis: ${error.message}`, 'ERROR');
            return false;
        }
    }
    
    function applyGale(data = {}) {
        log(`applyGale: Iniciando. isActive: ${isActive}. Dados: ${data ? JSON.stringify(data) : 'N/A'}`, 'DEBUG');
        try {
            if (!isActive) {
                log('Gale desativado. Nenhuma ação.', 'WARN');
                return { success: false, message: 'Gale desativado' };
            }
            
            // *** NOVO: Verificar se deve usar modo inteligente ***
            if (window.intelligentGale && window.intelligentGale.getStatus().active) {
                log('Sistema Gale Inteligente ativo, delegando cálculo...', 'INFO');
                intelligentMode = true;
                
                const intelligentResult = window.intelligentGale.applyIntelligentGale(data);
                if (intelligentResult.success) {
                    intelligentValue = intelligentResult.value;
                    intelligentMultiplier = intelligentResult.multiplier;
                    
                    log(`Gale Inteligente - Nível: ${intelligentResult.level}, Valor: ${intelligentValue}, Multiplicador: ${intelligentMultiplier}, Risco: ${intelligentResult.riskLevel}`, 'SUCCESS');
                    
                    // Usar valor inteligente em vez do cálculo clássico
                    const newValue = intelligentValue;
                    
                    // Atualizar contadores locais para sincronização
                    galeCount = intelligentResult.level;
                    
                    // Salvar no StateManager
                    if (window.StateManager) {
                        const config = window.StateManager.getConfig();
                        const updatedConfig = { ...config, value: newValue };
                        window.StateManager.saveConfig(updatedConfig)
                            .then(() => {
                                log(`Valor Inteligente ${newValue} salvo no StateManager`, 'SUCCESS');
                                chrome.runtime.sendMessage({
                                    action: 'SHOW_FEEDBACK', 
                                    type: 'warning', 
                                    message: `🧠 Gale Inteligente nível ${galeCount} aplicado. Valor: $${newValue} (Risco: ${intelligentResult.riskLevel})`
                                });
                                
                                // *** LOG DEBUG: Gale vai solicitar nova análise ***
                                log('🎯 Gale aplicado com sucesso. Solicitando nova análise em 500ms...', 'INFO');
                                setTimeout(triggerNewAnalysis, 500);
                            })
                            .catch(error => {
                                log(`Erro ao salvar valor inteligente: ${error.message}`, 'ERROR');
                            });
                    }
                    
                    return {
                        success: true,
                        level: galeCount,
                        newValue: newValue,
                        originalValue: originalValue,
                        message: `Gale Inteligente nível ${galeCount} aplicado. Valor: ${newValue}`,
                        intelligent: true,
                        riskLevel: intelligentResult.riskLevel,
                        confidence: intelligentResult.confidence
                    };
                } else {
                    log('Sistema Gale Inteligente não pôde aplicar, usando sistema clássico', 'WARN');
                    intelligentMode = false;
                    // Continuar com lógica clássica abaixo
                }
            }
            if (data.isHistorical) {
                log('Ignorando gale para operação histórica.', 'INFO');
                return { success: false, message: 'Operação histórica ignorada' };
            }
            const operationTime = data.timestamp || data.notifyTime || 0;
            if (operationTime > 0 && (Date.now() - operationTime) > 30000) { // 30 segundos
                log(`Ignorando gale para operação antiga (${Math.round((Date.now() - operationTime)/1000)}s atrás).`, 'WARN');
                return { success: false, message: 'Operação muito antiga para aplicar gale' };
            }
            
            // Obter valor atual da entrada
            let currentEntryValue = 0;
            if (window.StateManager) {
                currentEntryValue = parseFloat(window.StateManager.getConfig().value || 0);
            }
            if (currentEntryValue <= 0) {
                log(`Valor de entrada atual inválido (${currentEntryValue}), usando valor original base (${originalValue}).`, 'WARN');
                currentEntryValue = originalValue;
            }
            
                // Inicializar ou incrementar o contador de gale
    if (galeCount === 0) {
        galeCount = 1;
        // Atualiza o valor original base APENAS no primeiro gale do ciclo
        if (window.StateManager) { 
            // Aqui é o ponto crucial: capturar o valor original das configurações
            originalValue = parseFloat(window.StateManager.getConfig().value || 10);
            log(`Valor original base para este ciclo de gale: ${originalValue}`, 'DEBUG');
        }
        // Inicia o histórico de perdas com o valor original
        galeLosses = [originalValue];
        log(`Inicializando histórico de perdas com valor original: ${originalValue}`, 'DEBUG');
    } else {
        galeCount++;
        // Adicionar o valor atual perdido ao histórico
        galeLosses.push(currentEntryValue);
        log(`Adicionado ao histórico de perdas: ${currentEntryValue}. Total: ${galeLosses.join(' + ')} = ${galeLosses.reduce((a, b) => a + b, 0)}`, 'DEBUG');
    }
            
            // Obter o multiplicador de payout atual
            const payoutMultiplier = getPayoutMultiplier();
            log(`Usando payout: ${payoutMultiplier.toFixed(2)} (${((payoutMultiplier-1)*100).toFixed(0)}%)`, 'INFO');
            
            // Calcular soma total das perdas
            const totalLosses = galeLosses.reduce((a, b) => a + b, 0);
            
            log(`Implementando cálculo direto para Gale com base no payout`, 'INFO');
            log(`Perdas totais: ${totalLosses.toFixed(2)}`, 'INFO');
            
            // A porcentagem de lucro desejada
            const lucroDesejadoPct = desiredProfitPercentage;
            log(`Percentual de lucro desejado: ${(lucroDesejadoPct * 100).toFixed(0)}%`, 'INFO');
            
            // Calcular o valor necessário para zerar as perdas usando a fórmula direta
            const payoutRate = payoutMultiplier - 1; // Taxa líquida (ex: 1.28 - 1 = 0.28 = 28%)
            
            if (payoutRate <= 0) {
                log(`ERRO: Taxa de payout (${payoutRate}) inválida para cálculos. Deve ser maior que 0.`, 'ERROR');
                return { success: false, message: 'Taxa de payout inválida para cálculos' };
            }
            
            // Ponto de partida: valor que zera as perdas + lucro desejado
            const valorBaseParaZerarPerdas = totalLosses / payoutRate;
            const lucroDesejadoValor = valorBaseParaZerarPerdas * lucroDesejadoPct;
            let valorEstimado = valorBaseParaZerarPerdas + lucroDesejadoValor;
            
            log(`Valor inicial calculado: ${valorEstimado.toFixed(2)}`, 'INFO');
            log(`Verificando se atende à condição: lucro líquido > perdas...`, 'INFO');
            
            // Incremento para ajustar a estimativa (1% do valor original)
            const incremento = originalValue * 0.01;
            // Número máximo de iterações para evitar loop infinito
            const maxIteracoes = 50;
            let iteracao = 0;
            
            // Loop para verificar e ajustar o valor até atender à condição
            while (iteracao < maxIteracoes) {
                // Calcular retorno potencial com o payout
                const retornoPotencial = valorEstimado * payoutMultiplier;
                
                // Calcular lucro líquido: (retorno - entrada - perdas)
                const lucroLiquido = retornoPotencial - valorEstimado - totalLosses;
                
                // Verificar a condição: lucro líquido deve ser maior que as perdas
                if (lucroLiquido > totalLosses) {
                    log(`Iteração ${iteracao}: Valor ${valorEstimado.toFixed(2)} → Retorno ${retornoPotencial.toFixed(2)} → Lucro ${lucroLiquido.toFixed(2)} > Perdas ${totalLosses.toFixed(2)} ✓`, 'DEBUG');
                    break; // Encontramos o valor ideal
                }
                
                // Condição não atendida, aumentar a estimativa
                log(`Iteração ${iteracao}: Valor ${valorEstimado.toFixed(2)} → Retorno ${retornoPotencial.toFixed(2)} → Lucro ${lucroLiquido.toFixed(2)} < Perdas ${totalLosses.toFixed(2)} ✗`, 'DEBUG');
                valorEstimado += incremento;
                iteracao++;
            }
            
            // Arredondar para 2 casas decimais
            const newValue = parseFloat(valorEstimado.toFixed(2));
            
            // Verificação final
            const retornoEsperado = newValue * payoutMultiplier;
            const lucroFinal = retornoEsperado - newValue - totalLosses;
            
            log(`Cálculo final do Gale:`, 'INFO');
            log(`Valor base para zerar perdas: ${valorBaseParaZerarPerdas.toFixed(2)}`, 'INFO');
            log(`Valor inicial com lucro desejado: ${(valorBaseParaZerarPerdas + lucroDesejadoValor).toFixed(2)}`, 'INFO');
            log(`Valor final após verificações: ${newValue.toFixed(2)}`, 'INFO');
            log(`Retorno esperado (${payoutMultiplier.toFixed(2)}): ${retornoEsperado.toFixed(2)}`, 'INFO');
            log(`Lucro líquido esperado: ${lucroFinal.toFixed(2)}`, 'INFO');
            log(`Relação lucro/perdas: ${lucroFinal.toFixed(2)} / ${totalLosses.toFixed(2)} = ${(totalLosses > 0 ? lucroFinal/totalLosses : 0).toFixed(2)}`, 'INFO');
            
            if (iteracao >= maxIteracoes) {
                log(`AVISO: Atingido número máximo de iterações (${maxIteracoes})`, 'WARN');
            }
            
            if (lucroFinal <= totalLosses) {
                log(`AVISO: O lucro final (${lucroFinal.toFixed(2)}) não é maior que as perdas (${totalLosses.toFixed(2)})`, 'WARN');
            }
            
            log(`Aplicando Gale nível ${galeCount} com estratégia baseada em payout (cálculo direto)`, 'INFO');

            if (window.StateManager) {
                const config = window.StateManager.getConfig();
                const updatedConfig = { ...config, value: newValue };
                window.StateManager.saveConfig(updatedConfig)
                    .then(() => {
                        log(`Valor de entrada atualizado para: ${newValue} no StateManager.`, 'SUCCESS');
                        chrome.runtime.sendMessage({
                            action: 'SHOW_FEEDBACK', 
                            type: 'warning', 
                            message: `Gale nível ${galeCount} aplicado. Novo valor: $${newValue}`
                        });

                        // *** LOG DEBUG: Gale clássico vai solicitar nova análise ***
                        log('🎯 Gale clássico aplicado com sucesso. Solicitando nova análise em 500ms...', 'INFO');
                        // Acionar nova análise após sucesso na aplicação do gale e salvamento da config
                        setTimeout(triggerNewAnalysis, 500);
                    })
                    .catch(error => {
                        log(`Erro ao salvar novo valor ${newValue} no StateManager: ${error.message}`, 'ERROR');
                    });
            } else {
                log('StateManager não disponível. Não foi possível atualizar o valor de entrada.', 'ERROR');
                return { success: false, message: 'StateManager não disponível para salvar novo valor' };
            }
            
            notify(GALE_ACTIONS.UPDATED, { 
                level: galeCount, 
                newValue: newValue, 
                originalValue: originalValue, 
                payout: payoutMultiplier,
                profit: desiredProfitPercentage * 100,
                losses: totalLosses
            });
            
            return { 
                success: true, 
                level: galeCount, 
                newValue: newValue, 
                originalValue: originalValue, 
                message: `Gale nível ${galeCount} aplicado. Novo valor: ${newValue}`,
                payout: payoutMultiplier,
                totalLosses: totalLosses
            };
        } catch (error) {
            log(`Erro ao aplicar gale: ${error.message}`, 'ERROR');
            return { success: false, message: `Erro: ${error.message}` };
        }
    }
    
    function resetGale(data = {}) {
        log(`resetGale: Iniciando. isActive: ${isActive}. Contador Gale: ${galeCount}. Dados: ${data ? JSON.stringify(data) : 'N/A'}`, 'DEBUG');
        try {
            if (galeCount === 0) {
                log('Não há gale ativo para resetar.', 'INFO');
                return { success: false, message: 'Não há gale para resetar' };
            }
            if (data && data.isHistorical) {
                log('Ignorando reset de gale para operação histórica.', 'INFO');
                return { success: false, message: 'Operação histórica ignorada para reset' };
            }
            
            const operationTime = data?.timestamp || data?.notifyTime || 0;
            if (operationTime > 0 && (Date.now() - operationTime) > 30000) { // 30 segundos
                 log(`Ignorando reset de gale para operação antiga (${Math.round((Date.now() - operationTime)/1000)}s atrás).`, 'WARN');
                 return { success: false, message: 'Operação muito antiga para resetar gale' };
            }
            
                const previousLevel = galeCount;
    const totalLosses = galeLosses.reduce((a, b) => a + b, 0);
    
    // Resetar contador e histórico de perdas
    galeCount = 0;
    galeLosses = [];
    
    log(`Gale resetado do nível ${previousLevel}. Total de perdas: ${totalLosses}. Restaurando valor original: ${originalValue}`, 'INFO');
    
    if (window.StateManager && originalValue > 0) {
        const config = window.StateManager.getConfig();
        // Apenas atualiza o valor se ele for diferente do originalValue, para evitar escritas desnecessárias
        if (config.value !== originalValue) {
            const updatedConfig = { ...config, value: originalValue };
            window.StateManager.saveConfig(updatedConfig)
                .then(() => {
                    log(`Valor original (${originalValue}) restaurado no StateManager.`, 'SUCCESS');
                    chrome.runtime.sendMessage({action: 'SHOW_FEEDBACK', type: 'success', message: `Gale resetado. Valor restaurado: $${originalValue}`});
                })
                .catch(error => {
                    log(`Erro ao restaurar valor original no StateManager: ${error.message}`, 'ERROR');
                });
        } else {
             log(`Valor no StateManager (${config.value}) já é o original (${originalValue}). Nenhuma atualização necessária.`, 'DEBUG');
             chrome.runtime.sendMessage({action: 'SHOW_FEEDBACK', type: 'info', message: `Gale resetado. Valor original: $${originalValue}`});
        }
    } else {
        log('StateManager não disponível ou originalValue inválido. Não foi possível restaurar o valor de entrada.', 'ERROR');
         return { success: false, message: 'StateManager não disponível ou originalValue inválido para resetar valor' };
    }
            
            notify(GALE_ACTIONS.RESET_DONE, { 
                level: previousLevel, 
                originalValue: originalValue,
                totalLosses: totalLosses
            });
            
            return { 
                success: true, 
                level: previousLevel, 
                originalValue: originalValue, 
                message: `Gale resetado. Nível anterior: ${previousLevel}. Valor restaurado para ${originalValue}`,
                totalLosses: totalLosses
            };
        } catch (error) {
            log(`Erro ao resetar gale: ${error.message}`, 'ERROR');
            return { success: false, message: `Erro: ${error.message}` };
        }
    }

    // Função auxiliar para notificar outros sistemas (como UI)
    function notify(action, payload) {
        try {
            chrome.runtime.sendMessage({ action: action, ...payload, source: 'gale-system' });
            log(`Notificação enviada: Action=${action}, Payload=${JSON.stringify(payload)}`, 'DEBUG');
        } catch (e) {
            log(`Erro ao enviar notificação ${action}: ${e.message}`, 'ERROR');
        }
    }

    // Funções para os botões de teste do index.js
    function simulateGaleForTesting(testData = {}) {
        log('simulateGaleForTesting chamado. Chamando applyGale diretamente.', 'DEBUG');
        const dataToSend = { 
            source: 'gale-test-button',
            isHistorical: false, 
            timestamp: Date.now(),
            amount: originalValue, 
            success: false, 
            ...testData 
        };
        
        const result = applyGale(dataToSend); // Chamada direta
        log(`Resultado de applyGale (simulado diretamente): ${JSON.stringify(result)}`, 'DEBUG');
        
        return result;
    }

    function simulateResetForTesting(testData = {}) {
        log('simulateResetForTesting chamado. Chamando resetGale diretamente.', 'DEBUG');
        const dataToSend = { 
            source: 'gale-test-button', 
            isHistorical: false,
            timestamp: Date.now(),
            success: true, 
            ...testData
        };

        const result = resetGale(dataToSend); // Chamada direta
        log(`Resultado de resetGale (simulado diretamente): ${JSON.stringify(result)}`, 'DEBUG');

        return result;
    }
    
    function getStatusForTesting() {
        log('getStatusForTesting chamado.', 'DEBUG');
        
        // Obter payout atual
        const payoutMultiplier = getPayoutMultiplier();
        
        // Calcular soma das perdas se houver
        const totalLosses = galeLosses.length > 0 ? galeLosses.reduce((a, b) => a + b, 0) : 0;
        
        // Calcular próximo valor caso haja perda
        let currentVal = originalValue;
        let nextVal = originalValue;
        
        if (window.StateManager) {
            const currentConfigValue = window.StateManager.getConfig().value;
            currentVal = currentConfigValue || originalValue;
        }

        if (isActive) {
            if (galeCount > 0) {
                // Se estamos em um ciclo de gale, calcular próximo valor usando a fórmula
                const desiredProfit = originalValue * desiredProfitPercentage;
                nextVal = parseFloat(((totalLosses + currentVal + desiredProfit) / payoutMultiplier).toFixed(2));
            } else {
                // Primeiro nível de gale (primeira perda)
                const desiredProfit = originalValue * desiredProfitPercentage;
                nextVal = parseFloat(((originalValue + desiredProfit) / payoutMultiplier).toFixed(2));
            }
        }

        return {
            active: isActive,
            level: galeCount,
            originalValue: originalValue,
            currentValue: currentVal,
            nextValue: nextVal,
            desiredProfitPercentage: desiredProfitPercentage * 100, // Em percentual
            payoutMultiplier: payoutMultiplier,
            totalLosses: totalLosses,
            lossHistory: galeLosses
        };
    }

    // *** NOVO: Funções de integração com Intelligent Gale ***
    function setIntelligentValue(value, multiplier) {
        intelligentValue = value;
        intelligentMultiplier = multiplier;
        intelligentMode = true;
        log(`Valor inteligente definido: ${value} com multiplicador ${multiplier}`, 'DEBUG');
    }
    
    function resetIntelligent() {
        intelligentMode = false;
        intelligentValue = null;
        intelligentMultiplier = null;
        log('Modo inteligente resetado', 'DEBUG');
    }
    
    function getIntelligentStatus() {
        return {
            mode: intelligentMode,
            value: intelligentValue,
            multiplier: intelligentMultiplier,
            hasIntelligentSystem: !!window.intelligentGale
        };
    }

    // Expor as funções para o window.GaleSystem que o index.js espera
    if (!window.GaleSystem) { // Evitar sobrescrever se já existir por algum motivo
        window.GaleSystem = {
            simulateGale: simulateGaleForTesting,
            simulateReset: simulateResetForTesting,
            getStatus: getStatusForTesting,
            // *** NOVO: Funções de integração ***
            setIntelligentValue,
            resetIntelligent,
            getIntelligentStatus
        };
        log('API window.GaleSystem exposta para botões de teste com integração inteligente.', 'DEBUG');
    }

    // Inicialização do módulo
    // Certifique-se que initialize() é chamado. setupMessageListener() é chamado dentro de initialize().
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();