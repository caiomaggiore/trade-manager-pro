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

    // Nova função para explorar a árvore DOM e buscar elementos
    function exploreDOMTree() {
        log('Iniciando exploração da árvore DOM', 'INFO');
        toUpdateStatus('Analisando estrutura do DOM...', 'info');
        
        try {
            // Obter a aba ativa
            chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
                if (!tabs || !tabs.length) {
                    log('Nenhuma aba ativa encontrada', 'ERROR');
                    toUpdateStatus('Erro: Nenhuma aba ativa encontrada', 'error');
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
                            toUpdateStatus(`Erro: ${chrome.runtime.lastError.message}`, 'error');
                            return;
                        }
                        
                        const result = results[0].result;
                        log(`Resultado da exploração DOM: ${JSON.stringify(result)}`, 'INFO');
                        
                        if (result.results && result.results.length > 0) {
                            // Encontramos elementos candidatos!
                            const firstMatch = result.results[0];
                            log(`Elemento encontrado via ${firstMatch.method}: "${firstMatch.text}"`, 'SUCCESS');
                            toUpdateStatus(`Payout encontrado: ${firstMatch.text}`, 'success');
                            
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
                            toUpdateStatus('Elemento não encontrado', 'warn');
                            
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
                    toUpdateStatus(`Erro na inspeção: ${error.message}`, 'error');
                }
            });
        } catch (error) {
            log(`Erro na exploração DOM: ${error.message}`, 'ERROR');
            toUpdateStatus(`Erro: ${error.message}`, 'error');
        }
    }

    // Nova função para capturar o payout diretamente do DOM
    function capturePayoutFromDOM() {
        try {
            log('Iniciando teste de captura de payout', 'INFO');
            toUpdateStatus('Buscando payout...', 'info');
            
            // Agora vamos executar a exploração DOM para encontrar o elemento
            exploreDOMTree();
            
            return { success: true, message: 'Análise iniciada' };
        } catch (error) {
            const errorMsg = `Erro ao capturar payout: ${error.message}`;
            log(errorMsg, 'ERROR');
            toUpdateStatus(errorMsg, 'error');
            
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
    
    // Configurar listeners de eventos DOM para mudanças de configuração
    setupDOMListeners();
    
    log('Sistema Gale inicializado e pronto para uso', 'SUCCESS');
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
        
        // *** USAR chrome.runtime.sendMessage para verificação de payout ***
        chrome.runtime.sendMessage({
            action: 'CHECK_PAYOUT_FOR_ANALYSIS',
            source: 'gale-system'
        }, (response) => {
            if (chrome.runtime.lastError) {
                log(`Erro ao solicitar verificação de payout: ${chrome.runtime.lastError.message}`, 'ERROR');
                // Fallback para análise direta
                setTimeout(() => requestActualAnalysis(), 2000);
                return;
            }
            
            if (!response) {
                log('Nenhuma resposta recebida para verificação de payout. Tentando análise direta...', 'WARN');
                setTimeout(() => requestActualAnalysis(), 2000);
                return;
            }
            
            if (response.success && response.shouldProceed) {
                log('Payout verificado e aprovado. Iniciando análise do Gale...', 'SUCCESS');
                requestActualAnalysis();
            } else if (response.success && !response.shouldProceed) {
                log(`Payout insuficiente detectado. ${response.reason}. Tentando novamente em 5 segundos...`, 'WARN');
                // O sistema de automação já tratou (trocou ativo, etc)
                // Tentar novamente após delay
                setTimeout(() => triggerNewAnalysis(), 5000);
            } else {
                log(`Erro na verificação de payout: ${response.reason}. Tentando análise direta...`, 'ERROR');
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
            capturePayout: capturePayoutFromDOM,
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