// src/content/gale-system.js
// Sistema de aplicação de Gale para o Trade Manager Pro

(function() {
    const GALE_LOG_PREFIX = '[GaleSystem]';

    // Sistema de logs otimizado (novo padrão)
    // logToSystem removido - usando window.logToSystem global

    // Sistema de status otimizado (novo padrão)
    // updateStatus removido - usando window.updateStatus global

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
            logToSystem('Obtendo multiplicador de payout para cálculos de Gale', 'DEBUG');
            
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
                        logToSystem(`Payout encontrado: ${percentValue}%, multiplicador: ${multiplier.toFixed(2)}`, 'SUCCESS');
                        currentPayout = multiplier;
                        return multiplier;
                    }
                }
            }
            
            // Se não conseguiu extrair do elemento, tentar capturar novamente
            logToSystem('Não foi possível extrair payout da última captura, iniciando nova captura', 'DEBUG');
            // Aqui poderíamos chamar a captura, mas isso tornaria a função assíncrona
            // Vamos manter o valor atual por enquanto
            
            logToSystem(`Usando valor de payout atual: ${currentPayout}`, 'INFO');
            return currentPayout;
        } catch (error) {
            logToSystem(`Erro ao obter multiplicador de payout: ${error.message}`, 'ERROR');
            return currentPayout; // Usar valor padrão em caso de erro
        }
    }
    
    function initialize() {
    logToSystem('Inicializando sistema de gale...', 'INFO');
    try {
        if (window.StateManager) {
            const config = window.StateManager.getConfig();
            logToSystem(`Configuração recebida do StateManager`, 'DEBUG');
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
                    logToSystem(`Percentual de lucro desejado: ${desiredProfitPercentage * 100}%`, 'INFO');
                } else {
                    desiredProfitPercentage = parseFloat(config.gale.level.replace('x', '')) / 100 || 0.2;
                }
            }
            
            logToSystem(`Configurações: ativo=${isActive}, valor=${originalValue}, lucro=${desiredProfitPercentage * 100}%`, 'DEBUG');
            
            window.StateManager.subscribe((notification) => {
                if (notification.type === 'config') {
                    handleConfigUpdate(notification.state.config);
                }
            });
            logToSystem('Sistema de Gale inicializado', 'SUCCESS');
            logToSystem(`Gale ${isActive ? 'ativado' : 'desativado'}, lucro desejado: ${desiredProfitPercentage * 100}%`, 'INFO');
        } else {
            logToSystem('StateManager não encontrado', 'ERROR');
             isActive = false; // Garantir que isActive seja false se o StateManager não estiver lá
        }
    } catch (error) {
        logToSystem(`Erro ao inicializar: ${error.message}`, 'ERROR');
        isActive = false; // Garantir que isActive seja false em caso de erro
    }
    setupMessageListener(); // Mover para o final de initialize
    
    logToSystem('Sistema Gale inicializado e pronto para uso', 'SUCCESS');
}
    
    // REMOVIDO: Listeners de DOM movidos para index.js
    
    function handleConfigUpdate(config) {
        if (!config) {
            logToSystem('Configuração recebida é nula', 'WARN');
            return;
        }
        try {
            const oldIsActive = isActive;
            const oldProfitPercentage = desiredProfitPercentage;
            const oldOriginalValue = originalValue;

            logToSystem(`Configuração recebida`, 'DEBUG');
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
                logToSystem(`Valor original atualizado para: ${originalValue} (não está em ciclo de gale)`, 'DEBUG');
            } else {
                logToSystem(`Mantendo valor original: ${originalValue} (está em ciclo de gale: nível ${galeCount})`, 'DEBUG');
            }
            logToSystem(`Configurações atualizadas: ativo=${isActive}, valor=${originalValue}, lucro=${desiredProfitPercentage * 100}%`, 'DEBUG');

            if (oldIsActive !== isActive || oldProfitPercentage !== desiredProfitPercentage || (galeCount === 0 && oldOriginalValue !== originalValue)) {
                logToSystem(`Configurações atualizadas: ativo=${isActive}, valor=${originalValue}, lucro=${desiredProfitPercentage * 100}%`, 'INFO');
            }
        } catch (error) {
            logToSystem(`Erro ao processar atualização de config: ${error.message}`, 'ERROR');
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
            logToSystem(`Mensagem Gale recebida: Action=${message.action}`, 'DEBUG'); 
            
            try {
                if (message.action === GALE_ACTIONS.APPLY) {
                    logToSystem(`Aplicando gale`, 'DEBUG');
                    const result = applyGale(message.data);
                    logToSystem(`Gale aplicado`, 'DEBUG');
                    sendResponse({ success: result.success, result: result });
                    return true; 
                }
                if (message.action === GALE_ACTIONS.RESET) {
                    logToSystem(`Resetando gale`, 'DEBUG');
                    const result = resetGale(message.data);
                    logToSystem(`Gale resetado`, 'DEBUG');
                    sendResponse({ success: result.success, result: result });
                    return true;
                }
                if (message.action === GALE_ACTIONS.STATUS) {
                    logToSystem('Obtendo status do gale', 'DEBUG');
                    sendResponse({ success: true, data: getStatusForTesting() });
                    return true;
                }
            } catch (error) {
                logToSystem(`Erro ao processar mensagem runtime do Gale: ${error.message}`, 'ERROR');
                if (typeof sendResponse === 'function') {
                    sendResponse({ success: false, error: error.message });
                }
                return true; 
            }
            
            // Se chegou até aqui, a ação é do Gale mas não foi reconhecida
            logToSystem(`Ação do Gale não reconhecida: ${message.action}`, 'WARN');
            return false; 
        });
        logToSystem('Listener de mensagens configurado', 'DEBUG');
    }
    
    // ✅ IMPLEMENTAR STATUS: Função de aplicar Gale
    function applyGale(data = {}) {
        updateStatus('Aplicando sistema Gale...', 'info');
        logToSystem(`Aplicando gale (ativo: ${isActive})`, 'DEBUG');
        try {
            if (!isActive) {
                updateStatus('Gale desativado. Nenhuma ação.', 'warning', 3000);
                logToSystem('Gale desativado. Nenhuma ação.', 'WARN');
                return { success: false, message: 'Gale desativado' };
            }
            
            // *** NOVO: Verificar se deve usar modo inteligente ***
            if (window.intelligentGale && window.intelligentGale.getStatus().active) {
                logToSystem('Sistema Gale Inteligente ativo, delegando cálculo...', 'INFO');
                intelligentMode = true;
                
                const intelligentResult = window.intelligentGale.applyIntelligentGale(data);
                if (intelligentResult.success) {
                    intelligentValue = intelligentResult.value;
                    intelligentMultiplier = intelligentResult.multiplier;
                    
                    logToSystem(`Gale Inteligente - Nível: ${intelligentResult.level}, Valor: ${intelligentValue}, Multiplicador: ${intelligentMultiplier}, Risco: ${intelligentResult.riskLevel}`, 'SUCCESS');
                    
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
                                logToSystem(`Valor Inteligente ${newValue} salvo no StateManager`, 'SUCCESS');
                                updateStatus('Sistema Gale aplicado com sucesso', 'success', 4000);
                                chrome.runtime.sendMessage({
                                    action: 'SHOW_FEEDBACK', 
                                    type: 'warning', 
                                    message: `🧠 Gale Inteligente nível ${galeCount} aplicado. Valor: $${newValue} (Risco: ${intelligentResult.riskLevel})`
                                });
                                
                                // *** logToSystem DEBUG: Gale vai solicitar nova análise ***
                                logToSystem('Gale aplicado com sucesso, solicitando nova análise', 'INFO');
                                setTimeout(triggerNewAnalysis, 500);
                            })
                            .catch(error => {
                                logToSystem(`Erro ao salvar valor inteligente: ${error.message}`, 'ERROR');
                                updateStatus(`Erro ao salvar valor inteligente: ${error.message}`, 'error', 5000);
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
                    logToSystem('Sistema Gale Inteligente não pôde aplicar, usando sistema clássico', 'WARN');
                    intelligentMode = false;
                    // Continuar com lógica clássica abaixo
                }
            }
            if (data.isHistorical) {
                logToSystem('Ignorando gale para operação histórica', 'INFO');
                return { success: false, message: 'Operação histórica ignorada' };
            }
            const operationTime = data.timestamp || data.notifyTime || 0;
            if (operationTime > 0 && (Date.now() - operationTime) > 30000) { // 30 segundos
                logToSystem(`Ignorando gale para operação antiga (${Math.round((Date.now() - operationTime)/1000)}s atrás)`, 'WARN');
                return { success: false, message: 'Operação muito antiga para aplicar gale' };
            }
            
            // Obter valor atual da entrada
            let currentEntryValue = 0;
            if (window.StateManager) {
                currentEntryValue = parseFloat(window.StateManager.getConfig().value || 0);
            }
            if (currentEntryValue <= 0) {
                logToSystem(`Valor de entrada inválido (${currentEntryValue}), usando valor original (${originalValue})`, 'WARN');
                currentEntryValue = originalValue;
            }
            
                // Inicializar ou incrementar o contador de gale
            if (galeCount === 0) {
                galeCount = 1;
                galeLosses = []; // Reiniciar histórico quando começar um novo ciclo
                logToSystem(`Iniciando primeiro nível de gale`, 'INFO');
            } else {
                galeCount++;
                logToSystem(`Incrementando para gale nível ${galeCount}`, 'INFO');
            }
            
            // Adicionar a perda atual ao histórico
            if (!galeLosses.includes(currentEntryValue)) {
                galeLosses.push(currentEntryValue);
                logToSystem(`Adicionado ao histórico de perdas: ${currentEntryValue}. Total: ${galeLosses.join(' + ')} = ${galeLosses.reduce((a, b) => a + b, 0)}`, 'DEBUG');
            }
            
            // Obter o multiplicador de payout atual
            const payoutMultiplier = getPayoutMultiplier();
            logToSystem(`Payout: ${payoutMultiplier.toFixed(2)} (${((payoutMultiplier-1)*100).toFixed(0)}%)`, 'INFO');
            
            // Calcular soma total das perdas
            const totalLosses = galeLosses.reduce((a, b) => a + b, 0);
            
            logToSystem(`Perdas totais: ${totalLosses.toFixed(2)}`, 'INFO');
            
            // A porcentagem de lucro desejada
            const lucroDesejadoPct = desiredProfitPercentage;
            logToSystem(`Lucro desejado: ${(lucroDesejadoPct * 100).toFixed(0)}%`, 'INFO');
            
            // Calcular o valor necessário para zerar as perdas usando a fórmula direta
            const payoutRate = payoutMultiplier - 1; // Taxa líquida (ex: 1.28 - 1 = 0.28 = 28%)
            
            if (payoutRate <= 0) {
                logToSystem(`ERRO: Taxa de payout (${payoutRate}) inválida para cálculos. Deve ser maior que 0.`, 'ERROR');
                updateStatus(`Erro: Taxa de payout (${payoutRate}) inválida`, 'error', 5000);
                return { success: false, message: 'Taxa de payout inválida para cálculos' };
            }
            
            // Ponto de partida: valor que zera as perdas + lucro desejado
            const valorBaseParaZerarPerdas = totalLosses / payoutRate;
            const lucroDesejadoValor = valorBaseParaZerarPerdas * lucroDesejadoPct;
            let valorEstimado = valorBaseParaZerarPerdas + lucroDesejadoValor;
            
            logToSystem(`Valor inicial calculado: ${valorEstimado.toFixed(2)}`, 'INFO');
            logToSystem(`Verificando se atende à condição: lucro líquido > perdas...`, 'INFO');
            
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
                    logToSystem(`Iteração ${iteracao}: Valor ${valorEstimado.toFixed(2)} → Retorno ${retornoPotencial.toFixed(2)} → Lucro ${lucroLiquido.toFixed(2)} > Perdas ${totalLosses.toFixed(2)} ✓`, 'DEBUG');
                    break; // Encontramos o valor ideal
                }
                
                // Condição não atendida, aumentar a estimativa
                logToSystem(`Iteração ${iteracao}: Valor ${valorEstimado.toFixed(2)} → Retorno ${retornoPotencial.toFixed(2)} → Lucro ${lucroLiquido.toFixed(2)} < Perdas ${totalLosses.toFixed(2)} ✗`, 'DEBUG');
                valorEstimado += incremento;
                iteracao++;
            }
            
            // Arredondar para 2 casas decimais
            const newValue = parseFloat(valorEstimado.toFixed(2));
            
            // Verificação final
            const retornoEsperado = newValue * payoutMultiplier;
            const lucroFinal = retornoEsperado - newValue - totalLosses;
            
            logToSystem(`Cálculo final do Gale:`, 'INFO');
            logToSystem(`Valor base para zerar perdas: ${valorBaseParaZerarPerdas.toFixed(2)}`, 'INFO');
            logToSystem(`Valor inicial com lucro desejado: ${(valorBaseParaZerarPerdas + lucroDesejadoValor).toFixed(2)}`, 'INFO');
            logToSystem(`Valor final após verificações: ${newValue.toFixed(2)}`, 'INFO');
            logToSystem(`Retorno esperado (${payoutMultiplier.toFixed(2)}): ${retornoEsperado.toFixed(2)}`, 'INFO');
            logToSystem(`Lucro líquido esperado: ${lucroFinal.toFixed(2)}`, 'INFO');
            logToSystem(`Relação lucro/perdas: ${lucroFinal.toFixed(2)} / ${totalLosses.toFixed(2)} = ${(totalLosses > 0 ? lucroFinal/totalLosses : 0).toFixed(2)}`, 'INFO');
            
            if (iteracao >= maxIteracoes) {
                logToSystem(`AVISO: Atingido número máximo de iterações (${maxIteracoes})`, 'WARN');
            }
            
            if (lucroFinal <= totalLosses) {
                logToSystem(`AVISO: O lucro final (${lucroFinal.toFixed(2)}) não é maior que as perdas (${totalLosses.toFixed(2)})`, 'WARN');
            }
            
            logToSystem(`Aplicando Gale nível ${galeCount} com estratégia baseada em payout (cálculo direto)`, 'INFO');

            if (window.StateManager) {
                const config = window.StateManager.getConfig();
                const updatedConfig = { ...config, value: newValue };
                window.StateManager.saveConfig(updatedConfig)
                    .then(() => {
                        logToSystem(`Valor de entrada atualizado para: ${newValue} no StateManager.`, 'SUCCESS');
                        updateStatus('Sistema Gale aplicado com sucesso', 'success', 4000);
                        chrome.runtime.sendMessage({
                            action: 'SHOW_FEEDBACK', 
                            type: 'warning', 
                            message: `Gale nível ${galeCount} aplicado. Novo valor: $${newValue}`
                        });

                        // *** logToSystem DEBUG: Gale clássico vai solicitar nova análise ***
                        logToSystem('Gale clássico aplicado com sucesso, solicitando nova análise', 'INFO');
                        // Acionar nova análise após sucesso na aplicação do gale e salvamento da config
                        setTimeout(triggerNewAnalysis, 500);
                    })
                    .catch(error => {
                        logToSystem(`Erro ao salvar novo valor ${newValue} no StateManager: ${error.message}`, 'ERROR');
                        updateStatus(`Erro ao salvar novo valor: ${error.message}`, 'error', 5000);
                    });
            } else {
                logToSystem('StateManager não disponível. Não foi possível atualizar o valor de entrada.', 'ERROR');
                updateStatus('StateManager não disponível', 'error', 5000);
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
            logToSystem(`Erro ao aplicar gale: ${error.message}`, 'ERROR');
            updateStatus(`Erro ao aplicar gale: ${error.message}`, 'error', 5000);
            return { success: false, message: `Erro: ${error.message}` };
        }
    }

    // ✅ IMPLEMENTAR STATUS: Função de resetar Gale
    function resetGale(data = {}) {
        updateStatus('Resetando sistema Gale...', 'info');
        logToSystem(`Resetando gale (ativo: ${isActive}, nível: ${galeCount})`, 'DEBUG');
        try {
            if (galeCount === 0) {
                updateStatus('Não há gale ativo para resetar.', 'warning', 3000);
                logToSystem('Não há gale ativo para resetar.', 'INFO');
                return { success: false, message: 'Não há gale para resetar' };
            }
            if (data && data.isHistorical) {
                logToSystem('Ignorando reset de gale para operação histórica', 'INFO');
                return { success: false, message: 'Operação histórica ignorada para reset' };
            }
            
            const operationTime = data?.timestamp || data?.notifyTime || 0;
            if (operationTime > 0 && (Date.now() - operationTime) > 30000) { // 30 segundos
                 logToSystem(`Ignorando reset de gale para operação antiga (${Math.round((Date.now() - operationTime)/1000)}s atrás)`, 'WARN');
                 return { success: false, message: 'Operação muito antiga para resetar gale' };
            }
            
                const previousLevel = galeCount;
            const totalLosses = galeLosses.reduce((a, b) => a + b, 0);
            
            // *** RESET: Resetar todas as variáveis de estado do gale ***
            galeCount = 0;
            galeLosses = [];
            intelligentMode = false;
            intelligentValue = 0;
            intelligentMultiplier = 0;
            
            logToSystem(`Gale resetado. Nível anterior: ${previousLevel}. Perdas totais zeradas: ${totalLosses.toFixed(2)}`, 'SUCCESS');
            
            // *** RESTAURAR VALOR ORIGINAL ***
            if (window.StateManager && originalValue > 0) {
                const config = window.StateManager.getConfig();
                const updatedConfig = { ...config, value: originalValue };
                window.StateManager.saveConfig(updatedConfig)
                    .then(() => {
                        logToSystem(`Valor de entrada restaurado para valor original: ${originalValue} no StateManager.`, 'SUCCESS');
                        updateStatus('Sistema Gale resetado com sucesso', 'success', 4000);
                    })
                    .catch(error => {
                        logToSystem(`Erro ao restaurar valor original ${originalValue} no StateManager: ${error.message}`, 'ERROR');
                        updateStatus(`Erro ao restaurar valor original: ${error.message}`, 'error', 5000);
                    });
            } else {
                logToSystem('StateManager não disponível ou originalValue inválido. Não foi possível restaurar o valor de entrada.', 'ERROR');
                updateStatus('StateManager não disponível ou originalValue inválido', 'error', 5000);
                return { success: false, message: 'StateManager não disponível ou originalValue inválido para resetar valor' };
            }
            
            notify(GALE_ACTIONS.RESET, { 
                previousLevel: previousLevel, 
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
            logToSystem(`Erro ao resetar gale: ${error.message}`, 'ERROR');
            updateStatus(`Erro ao resetar gale: ${error.message}`, 'error', 5000);
            return { success: false, message: `Erro: ${error.message}` };
        }
    }

    // Função auxiliar para notificar outros sistemas (como UI)
    function notify(action, payload) {
        try {
            chrome.runtime.sendMessage({ action: action, ...payload, source: 'gale-system' });
            logToSystem(`Notificação enviada: Action=${action}, Payload=${JSON.stringify(payload)}`, 'DEBUG');
        } catch (e) {
            logToSystem(`Erro ao enviar notificação ${action}: ${e.message}`, 'ERROR');
        }
    }

    // Funções para os botões de teste do index.js
    function simulateGaleForTesting(testData = {}) {
        logToSystem('simulateGaleForTesting chamado. Chamando applyGale diretamente.', 'DEBUG');
        const dataToSend = { 
            source: 'gale-test-button',
            isHistorical: false, 
            timestamp: Date.now(),
            amount: originalValue, 
            success: false, 
            ...testData 
        };
        
        const result = applyGale(dataToSend); // Chamada direta
        logToSystem(`Resultado de applyGale (simulado diretamente): ${JSON.stringify(result)}`, 'DEBUG');
        
        return result;
    }

    function simulateResetForTesting(testData = {}) {
        logToSystem('simulateResetForTesting chamado. Chamando resetGale diretamente.', 'DEBUG');
        const dataToSend = { 
            source: 'gale-test-button', 
            isHistorical: false,
            timestamp: Date.now(),
            success: true, 
            ...testData
        };

        const result = resetGale(dataToSend); // Chamada direta
        logToSystem(`Resultado de resetGale (simulado diretamente): ${JSON.stringify(result)}`, 'DEBUG');

        return result;
    }
    
    function getStatusForTesting() {
        logToSystem('getStatusForTesting chamado.', 'DEBUG');
        
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
        logToSystem(`Valor inteligente definido: ${value} com multiplicador ${multiplier}`, 'DEBUG');
    }
    
    function resetIntelligent() {
        intelligentMode = false;
        intelligentValue = null;
        intelligentMultiplier = null;
        logToSystem('Modo inteligente resetado', 'DEBUG');
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
        logToSystem('API window.GaleSystem exposta para botões de teste com integração inteligente.', 'DEBUG');
    }

    // Inicialização do módulo
    // Certifique-se que initialize() é chamado. setupMessageListener() é chamado dentro de initialize().
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
