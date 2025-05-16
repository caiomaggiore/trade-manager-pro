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

    // Nova função para explorar a árvore DOM e buscar elementos
    function exploreDOMTree() {
        log('Iniciando exploração da árvore DOM', 'INFO');
        updateStatusInIndex('Analisando estrutura do DOM...', 'info');
        
        try {
            // Obter a aba ativa
            chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
                if (!tabs || !tabs.length) {
                    log('Nenhuma aba ativa encontrada', 'ERROR');
                    updateStatusInIndex('Erro: Nenhuma aba ativa encontrada', 'error');
                    return;
                }
                
                // Injetar script para explorar a DOM na página principal
                try {
                    chrome.scripting.executeScript({
                        target: {tabId: tabs[0].id},
                        func: () => {
                            // Função que será executada no contexto da página web
                            function findPayoutElement() {
                                console.log('== DOM Explorer iniciado ==');
                                
                                // Métodos de busca
                                const searchMethods = [
                                    // 1. Buscar pela classe específica em qualquer lugar
                                    () => {
                                        const direct = document.querySelector('.value__val-start');
                                        if (direct) return { 
                                            method: 'Classe direta', 
                                            element: direct,
                                            text: direct.textContent || direct.innerText,
                                            path: getPathTo(direct)
                                        };
                                        return null;
                                    },
                                    
                                    // 2. Buscar pela classe control-wrap e então encontrar o filho
                                    () => {
                                        const controlWrap = document.querySelector('.control-wrap');
                                        if (!controlWrap) return null;
                                        
                                        console.log('control-wrap encontrado:', controlWrap);
                                        
                                        // Buscar dentro do control-wrap
                                        const valueElement = controlWrap.querySelector('[class*="value"]');
                                        if (valueElement) return {
                                            method: 'Via control-wrap',
                                            element: valueElement,
                                            text: valueElement.textContent || valueElement.innerText,
                                            path: getPathTo(valueElement)
                                        };
                                        return null;
                                    },
                                    
                                    // 3. Buscar por elementos que contêm '%'
                                    () => {
                                        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
                                            const text = el.textContent || el.innerText || '';
                                            return text.includes('%') && text.length < 20; // Textos curtos com % são candidatos
                                        });
                                        
                                        if (elements.length > 0) {
                                            const element = elements[0]; // Pegar o primeiro encontrado
                                            return {
                                                method: 'Contém %',
                                                element: element,
                                                text: element.textContent || element.innerText,
                                                path: getPathTo(element),
                                                allElements: elements.map(e => ({
                                                    text: e.textContent || e.innerText,
                                                    path: getPathTo(e)
                                                }))
                                            };
                                        }
                                        return null;
                                    },
                                    
                                    // 4. Buscar em painéis de controle comuns
                                    () => {
                                        const panels = document.querySelectorAll('.panel, .control-panel, .trade-panel');
                                        if (panels.length === 0) return null;
                                        
                                        for (const panel of panels) {
                                            console.log('Painel encontrado:', panel);
                                            // Buscar elementos com percentual
                                            const elements = Array.from(panel.querySelectorAll('*')).filter(el => {
                                                const text = el.textContent || el.innerText || '';
                                                return text.includes('%');
                                            });
                                            
                                            if (elements.length > 0) {
                                                const element = elements[0];
                                                return {
                                                    method: 'Via painel de controle',
                                                    element: element,
                                                    text: element.textContent || element.innerText,
                                                    path: getPathTo(element)
                                                };
                                            }
                                        }
                                        return null;
                                    }
                                ];
                                
                                // Executar todos os métodos de busca
                                let results = [];
                                for (const method of searchMethods) {
                                    const result = method();
                                    if (result) {
                                        results.push(result);
                                    }
                                }
                                
                                // Fazer uma varredura geral para depuração
                                console.log('== Resumo dos elementos encontrados ==');
                                
                                // Lista todas as classes que contêm "value" em qualquer lugar da página
                                const valueClasses = new Set();
                                document.querySelectorAll('*[class*="value"]').forEach(el => {
                                    el.className.split(' ').forEach(cls => {
                                        if (cls.includes('value')) valueClasses.add(cls);
                                    });
                                });
                                
                                console.log('Classes que contêm "value":', Array.from(valueClasses));
                                
                                // Função para obter o caminho do DOM até o elemento
                                function getPathTo(element) {
                                    if (element.id) return `#${element.id}`;
                                    
                                    if (element === document.body) return 'body';
                                    
                                    let path = '';
                                    for (let parent = element; parent && parent !== document.body; parent = parent.parentNode) {
                                        let tag = parent.tagName.toLowerCase();
                                        
                                        if (parent.className) {
                                            tag += `.${parent.className.replace(/\s+/g, '.')}`;
                                        }
                                        
                                        path = `${tag} > ${path}`;
                                        
                                        // Limitar o tamanho do caminho
                                        if (path.length > 200) {
                                            path = '... ' + path.substring(path.length - 200);
                                            break;
                                        }
                                    }
                                    
                                    return `body > ${path}`.trim();
                                }
                                
                                return {
                                    results: results,
                                    valueClasses: Array.from(valueClasses),
                                    documentStructure: {
                                        // Informações resumidas sobre o document
                                        body: document.body ? true : false,
                                        iframes: document.querySelectorAll('iframe').length,
                                        valueElements: document.querySelectorAll('[class*="value"]').length,
                                        percentElements: Array.from(document.querySelectorAll('*')).filter(el => 
                                            (el.textContent || '').includes('%')
                                        ).length
                                    }
                                };
                            }
                            
                            return findPayoutElement();
                        }
                    }, (results) => {
                        if (chrome.runtime.lastError) {
                            log(`Erro na injeção de script: ${chrome.runtime.lastError.message}`, 'ERROR');
                            updateStatusInIndex(`Erro: ${chrome.runtime.lastError.message}`, 'error');
                            return;
                        }
                        
                        const result = results[0].result;
                        log(`Resultado da exploração DOM: ${JSON.stringify(result)}`, 'INFO');
                        
                        if (result.results && result.results.length > 0) {
                            // Encontramos elementos candidatos!
                            const firstMatch = result.results[0];
                            log(`Elemento encontrado via ${firstMatch.method}: "${firstMatch.text}"`, 'SUCCESS');
                            updateStatusInIndex(`Payout encontrado: ${firstMatch.text}`, 'success');
                            
                            // Atualizar elemento de resultado na interface
                            const resultElement = document.getElementById('payout-result');
                            if (resultElement) {
                                resultElement.innerHTML = `
                                    <div>Resultado: "${firstMatch.text}"</div>
                                    <div>Método: ${firstMatch.method}</div>
                                    <div>Caminho: ${firstMatch.path.substring(0, 50)}...</div>
                                `;
                                resultElement.style.backgroundColor = '#ddffdd';
                            }
                            
                            // Armazenar as informações sobre o caminho encontrado
                            window.payoutElementPath = firstMatch.path;
                            log(`Caminho do elemento de payout armazenado: ${firstMatch.path}`, 'INFO');
                        } else {
                            log('Nenhum elemento de payout encontrado na exploração', 'WARN');
                            updateStatusInIndex('Elemento não encontrado', 'warn');
                            
                            // Mostrar informações sobre a estrutura da página
                            const resultElement = document.getElementById('payout-result');
                            if (resultElement) {
                                resultElement.innerHTML = `
                                    <div>Nenhum elemento encontrado</div>
                                    <div>Elementos com classe "value": ${result.valueClasses.length}</div>
                                    <div>Classes encontradas: ${result.valueClasses.join(', ')}</div>
                                    <div>iFrames na página: ${result.documentStructure.iframes}</div>
                                `;
                                resultElement.style.backgroundColor = '#ffdddd';
                            }
                        }
                    });
                } catch (error) {
                    log(`Erro ao executar script na página: ${error.message}`, 'ERROR');
                    updateStatusInIndex(`Erro na inspeção: ${error.message}`, 'error');
                }
            });
        } catch (error) {
            log(`Erro na exploração DOM: ${error.message}`, 'ERROR');
            updateStatusInIndex(`Erro: ${error.message}`, 'error');
        }
    }

    // Nova função para capturar o payout diretamente do DOM
    function capturePayoutFromDOM() {
        try {
            log('Iniciando teste de captura de payout', 'INFO');
            updateStatusInIndex('Buscando payout...', 'info');
            
            // Agora vamos executar a exploração DOM para encontrar o elemento
            exploreDOMTree();
            
            return { success: true, message: 'Análise iniciada' };
        } catch (error) {
            const errorMsg = `Erro ao capturar payout: ${error.message}`;
            log(errorMsg, 'ERROR');
            updateStatusInIndex(errorMsg, 'error');
            
            // Atualizar elemento de resultado na interface
            const resultElement = document.getElementById('payout-result');
            if (resultElement) {
                resultElement.textContent = `Erro: ${error.message}`;
                resultElement.style.backgroundColor = '#ffdddd';
            }
            
            return null;
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
                log(`Initialize: Configuração recebida do StateManager: ${config ? JSON.stringify(config) : 'N/A'}`, 'DEBUG');
                isActive = config?.gale?.active || false;
                originalValue = config?.value || 10;
                galeCount = 0; // Resetar galeCount na inicialização
                if (config?.gale?.level) {
                    galeMultiplier = parseFloat(config.gale.level.replace('x', '')) || 1.2;
                }
                log(`Initialize: isActive definido como: ${isActive}. Valor original: ${originalValue}. Multiplicador: ${galeMultiplier}.`, 'DEBUG');
                
                window.StateManager.subscribe((notification) => {
                    if (notification.type === 'config') {
                        handleConfigUpdate(notification.state.config);
                    }
                });
                log('Sistema de Gale inicializado e StateManager listener configurado.', 'SUCCESS');
                log(`Gale ${isActive ? 'ativado' : 'desativado'}, multiplicador: ${galeMultiplier}x`, 'INFO');
            } else {
                log('StateManager não encontrado. O sistema de gale não funcionará corretamente.', 'ERROR');
                 isActive = false; // Garantir que isActive seja false se o StateManager não estiver lá
            }
        } catch (error) {
            log(`Erro ao inicializar: ${error.message}`, 'ERROR');
            isActive = false; // Garantir que isActive seja false em caso de erro
        }
        setupMessageListener(); // Mover para o final de initialize
        setupDOMListeners(); // Configurar listeners do DOM
    }
    
    // Nova função para configurar os listeners do DOM
    function setupDOMListeners() {
        try {
            // Aguardar o DOM estar completamente carregado
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', attachButtonListeners);
            } else {
                // Se o DOM já estiver carregado, configurar imediatamente
                attachButtonListeners();
            }
        } catch (error) {
            log(`Erro ao configurar listeners do DOM: ${error.message}`, 'ERROR');
        }
    }
    
    // Função para anexar os listeners aos botões
    function attachButtonListeners() {
        try {
            log('Configurando listeners para botões do sistema de Gale', 'DEBUG');
            
            // Botão de teste de captura de payout
            const capturePayoutBtn = document.getElementById('test-capture-payout');
            if (capturePayoutBtn) {
                log('Botão de teste de payout encontrado, configurando listener', 'DEBUG');
                
                capturePayoutBtn.addEventListener('click', () => {
                    log('Botão de teste de payout clicado', 'INFO');
                    capturePayoutFromDOM();
                });
                
                log('Listener para botão de teste de payout configurado com sucesso', 'SUCCESS');
            } else {
                log('Botão de teste de payout não encontrado no DOM', 'WARN');
            }
        } catch (error) {
            log(`Erro ao anexar listeners aos botões: ${error.message}`, 'ERROR');
        }
    }
    
    function handleConfigUpdate(config) {
        if (!config) {
            log('handleConfigUpdate: Configuração recebida é nula ou indefinida. Nenhuma atualização feita.', 'WARN');
            return;
        }
        try {
            const oldIsActive = isActive;
            const oldMultiplier = galeMultiplier;
            const oldOriginalValue = originalValue;

            log(`handleConfigUpdate: Configuração recebida: ${JSON.stringify(config)}`, 'DEBUG');
            isActive = config.gale?.active || false;
            if (config.gale?.level) {
                galeMultiplier = parseFloat(config.gale.level.replace('x', '')) || 1.2;
            }
            if (galeCount === 0) { // Só atualiza o valor base se não estiver em um ciclo de gale
                originalValue = config.value || 10;
            }
            log(`handleConfigUpdate: isActive atualizado para: ${isActive}, valor base (se aplicável): ${originalValue}, multiplicador: ${galeMultiplier}`, 'DEBUG');

            if (oldIsActive !== isActive || oldMultiplier !== galeMultiplier || (galeCount === 0 && oldOriginalValue !== originalValue)) {
                log(`Configurações de Gale efetivamente atualizadas: ativo=${isActive}, valor base=${originalValue}, multiplicador=${galeMultiplier}`, 'INFO');
            }
        } catch (error) {
            log(`Erro ao processar atualização de config: ${error.message}`, 'ERROR');
        }
    }
    
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            log(`Mensagem recebida no GaleSystem: Action=${message.action}, Origem=${sender?.tab?.url || sender?.id || 'desconhecida'}`, 'DEBUG'); 
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
                log(`Erro ao processar mensagem runtime: ${error.message}`, 'ERROR');
                if (typeof sendResponse === 'function') {
                    sendResponse({ success: false, error: error.message });
                }
                return true; 
            }
            log(`Mensagem não tratada por GaleSystem (Action: ${message.action}). Retornando false.`, 'DEBUG');
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
        log(`applyGale: Iniciando. isActive: ${isActive}. Dados: ${data ? JSON.stringify(data) : 'N/A'}`, 'DEBUG');
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
            if (operationTime > 0 && (Date.now() - operationTime) > 30000) { // 30 segundos
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
                // Atualiza o valor original base APENAS no primeiro gale do ciclo, se o StateManager estiver disponível.
                if (window.StateManager) { 
                    originalValue = parseFloat(window.StateManager.getConfig().value || 10); // Pega o valor configurado como base
                    log(`Valor original base para este ciclo de gale: ${originalValue}`, 'DEBUG');
                } else {
                    // Se StateManager não estiver lá, originalValue já foi definido em initialize() ou é o padrão.
                    log(`StateManager não disponível, usando valor original base já definido: ${originalValue}`, 'WARN');
                }
            } else {
                galeCount++;
            }
            log(`Aplicando Gale nível ${galeCount}. Multiplicador: ${galeMultiplier}. Valor base para cálculo neste gale: ${currentEntryValue}`, 'INFO');
            
            // O cálculo do novo valor para o gale deve ser sempre sobre o 'originalValue' do ciclo, não o 'currentEntryValue' que já pode ser um valor de gale.
            // Mas a prática comum é aplicar o multiplicador ao valor da *última entrada perdida*.
            // Vamos manter a lógica atual: novo valor é (valor da última entrada + (valor da última entrada * multiplicador))
            // Isso pode ser um ponto de revisão da estratégia de Gale.
            // Se currentEntryValue é o valor que acabou de perder, então:
            const multipliedPortion = parseFloat((currentEntryValue * galeMultiplier).toFixed(2)); // Esta é a lógica que estava antes: currentEntryValue * (1 + multiplicador)
            // A lógica anterior somava currentEntryValue + (currentEntryValue * galeMultiplier), que é currentEntryValue * (1 + galeMultiplier)
            // A nova lógica no seu código original do index.js (que vou replicar aqui) é:
            // const multipliedPortion = parseFloat((currentEntryValue * galeMultiplier).toFixed(2));
            // const newValue = parseFloat((currentEntryValue + multipliedPortion).toFixed(2));
            // Isso parece ser um aumento de (currentEntryValue * galeMultiplier) SOBRE o currentEntryValue.
            // Ex: valor 10, mult 1.2 => 10 * 1.2 = 12. Novo valor = 10 + 12 = 22. (Se for essa a intenção)
            // Ou, se o multiplicador é o valor total: 10 * 1.2 = 12. (Gale nível 1 = 12).
            // Vamos seguir a lógica que estava no seu index.js: soma do valor atual + (valor atual * multiplicador)
            // No entanto, a descrição comum de martingale é VALOR_ENTRADA * MULTIPLICADOR_GALE.
            // Se o multiplicador for 2x, e a entrada 10, o gale é 20.
            // Se o multiplicador for 1.2x, e a entrada 10, o gale é 12.
            // A sua config `galeMultiplier` parece ser o fator direto.
            
            // Correção da lógica de cálculo do Gale para ser mais tradicional:
            // O primeiro gale é originalValue * multiplicador.
            // O segundo gale é (originalValue * multiplicador) * multiplicador, e assim por diante.
            // Ou, se for sobre o valor perdido: ultimo_valor_perdido * multiplicador.
            // Vamos assumir que 'currentEntryValue' é o valor que acabou de perder.
            // E 'originalValue' é o valor da entrada inicial do ciclo (antes de qualquer gale).

            let newValue;
            if (galeCount === 1) {
                newValue = parseFloat((originalValue * galeMultiplier).toFixed(2));
                log(`Primeiro gale: novo valor = originalValue (${originalValue}) * multiplicador (${galeMultiplier}) = ${newValue}`, 'DEBUG');
            } else {
                // Para gales subsequentes, multiplicamos o valor do *gale anterior*.
                // Precisamos saber qual foi o valor do gale anterior.
                // Se 'currentEntryValue' é o valor que acabou de perder (que era o valor do gale anterior), então:
                newValue = parseFloat((currentEntryValue * galeMultiplier).toFixed(2));
                log(`Gale subsequente (nível ${galeCount}): novo valor = ultimoValorPerdido (${currentEntryValue}) * multiplicador (${galeMultiplier}) = ${newValue}`, 'DEBUG');
            }


            log(`Novo valor calculado para o gale: ${newValue}`, 'INFO');

            if (window.StateManager) {
                const config = window.StateManager.getConfig();
                const updatedConfig = { ...config, value: newValue };
                window.StateManager.saveConfig(updatedConfig)
                    .then(() => {
                        log(`Valor de entrada atualizado para: ${newValue} no StateManager.`, 'SUCCESS');
                        // showFeedback agora é responsabilidade do index.js
                        // showFeedback(`Gale nível ${galeCount} aplicado`, `Novo valor: $${newValue}`, 'warning');
                        chrome.runtime.sendMessage({action: 'SHOW_FEEDBACK', type: 'warning', message: `Gale nível ${galeCount} aplicado. Novo valor: $${newValue}`});

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
            
            notify(GALE_ACTIONS.UPDATED, { level: galeCount, newValue: newValue, originalValue: originalValue, multiplier: galeMultiplier });
            return { success: true, level: galeCount, newValue: newValue, originalValue: originalValue, message: `Gale nível ${galeCount} aplicado. Novo valor: ${newValue}` };
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
            galeCount = 0; // Reseta o contador
            log(`Gale resetado do nível ${previousLevel}. Restaurando valor original: ${originalValue}`, 'INFO');
            
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
            
            notify(GALE_ACTIONS.RESET_DONE, { level: previousLevel, originalValue: originalValue });
            return { success: true, level: previousLevel, originalValue: originalValue, message: `Gale resetado. Nível anterior: ${previousLevel}. Valor restaurado para ${originalValue}` };
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
        
        // O index.js usará este retorno para atualizar sua UI.
        // Se precisar de feedback adicional para o index.js de forma assíncrona, pode-se usar:
        // chrome.runtime.sendMessage({ action: 'SHOW_FEEDBACK', type: result.success ? 'success' : 'error', message: result.message });
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

        // O index.js usará este retorno para atualizar sua UI.
        return result;
    }
    
    function getStatusForTesting() {
        log('getStatusForTesting chamado.', 'DEBUG');
        let currentVal = originalValue;
        let nextVal = originalValue; 
        if (window.StateManager) {
            const currentConfigValue = window.StateManager.getConfig().value;
            currentVal = currentConfigValue || originalValue;
        }

        if (isActive && galeCount > 0) {
            // Se estamos em um ciclo de gale, currentVal é o valor do gale atual.
            // O próximo valor seria currentVal * multiplicador.
            nextVal = parseFloat((currentVal * galeMultiplier).toFixed(2));
        } else if (isActive && galeCount === 0) {
            // Se o gale está ativo mas não estamos em um ciclo, o próximo valor (se houver uma perda) seria originalValue * multiplicador.
            nextVal = parseFloat((originalValue * galeMultiplier).toFixed(2));
        }
        // Se o gale não está ativo, o próximo valor é apenas o valor original.

        return {
            active: isActive,
            level: galeCount,
            originalValue: originalValue,
            currentValue: currentVal,
            nextValue: nextVal, 
            multiplier: galeMultiplier
        };
    }

    // Expor as funções para o window.GaleSystem que o index.js espera
    if (!window.GaleSystem) { // Evitar sobrescrever se já existir por algum motivo
        window.GaleSystem = {
            simulateGale: simulateGaleForTesting,
            simulateReset: simulateResetForTesting,
            getStatus: getStatusForTesting,
            // Adicionar a nova função para captura de payout
            capturePayout: capturePayoutFromDOM
        };
        log('API window.GaleSystem exposta para botões de teste com wrappers de mensagem.', 'DEBUG');
    }

    // Inicialização do módulo
    // Certifique-se que initialize() é chamado. setupMessageListener() é chamado dentro de initialize().
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();