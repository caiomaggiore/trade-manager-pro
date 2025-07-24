/**
 * Trade History Module - Trade Manager Pro
 * Responsável pelo gerenciamento de histórico de operações, incluindo:
 * - Monitoramento de operações
 * - Registro na tabela de histórico
 * - Exportação para CSV
 * - Cálculo de lucro/prejuízo
 */

// Namespace global para o módulo
window.TradeManager = window.TradeManager || {};

// Verifica se estamos na página correta para o histórico de operações
const isTradeHistoryPage = () => {
    return window.location.href.includes('/history') || 
           document.querySelector('#operations-body') !== null;
};

// Inicialização do módulo de histórico
window.TradeManager.History = (function() {
    // Cache para evitar duplicidade de operações
    let operationsCache = {};
    let profitCurrent = 0;
    let isInitialized = false;
    let observer = null;
    
    // Referência aos elementos da UI
    const UI = {
        operationsBody: null,
        profitCurrent: null,
        exportBtn: null,
        clearHistoryBtn: null
    };
    
    // Sistema de logs global disponível via window.logToSystem e window.updateStatus
    
    /**
     * Adiciona uma operação à tabela de histórico
     * @param {Object} operation - Dados da operação
     */
    const addOperation = (operation) => {
        if (!UI.operationsBody) {
            // Não logar erro se não estivermos na página correta
            if (isTradeHistoryPage()) {
                logToSystem("Elemento operations-body não encontrado", "ERROR");
            }
            return;
        }

        // Verificar duplicidade antes de criar a linha
        const existingRows = UI.operationsBody.getElementsByTagName('tr');
        const timestampStr = operation.timestamp.toString();
        const symbol = operation.symbol;
        const status = operation.status;

        // Verifica se já existe uma linha com o mesmo timestamp, símbolo E status
        // Adicionamos verificação de status para distinguir operações abertas e fechadas
        for (const row of existingRows) {
            if (row.dataset.timestamp === timestampStr && 
                row.dataset.symbol === symbol &&
                row.dataset.status === status) {
                // Operação duplicada - não logar para evitar spam
                return; // Encerra a função se encontrar duplicata
            }
        }

        logToSystem(`Nova operação registrada: ${operation.symbol} - ${operation.status}`, 'INFO');
        
        // Cria a nova linha se não houver duplicata
        const row = document.createElement('tr');
        
        // Define a classe com base no status da operação
        const statusClass = operation.status === 'Open' ? 'neutro' : (operation.success ? 'venceu' : 'perdeu');
        row.className = statusClass;

        // Construir HTML da linha
        row.innerHTML = `
            <td>${new Date(operation.timestamp).toLocaleTimeString()}</td>
            <td>${operation.symbol}</td>
            <td>${operation.status === 'Open' ? 'OPEN' : operation.success ? 'GANHOU' : 'PERDEU'}</td>
            <td>${operation.amount.replace('.', ',')}</td>
            <td>${operation.status === 'Open' ? `0` : `${operation.success ? `+ ${operation.profit.replace('.', ',')}`  : `- ${operation.amount.replace('.', ',')}`}`}</td>        
        `;

        // Adiciona atributos de dados para verificação futura
        row.dataset.timestamp = timestampStr;
        row.dataset.symbol = symbol;
        row.dataset.status = status; // Adicionar status como atributo para facilitar verificação de duplicatas

        // Calcular o lucro/prejuízo total
        if (UI.profitCurrent) {
            const currentProfit = parseFloat(UI.profitCurrent.textContent) || 0;
            let result = currentProfit;
            
            if (operation.status == 'Closed') {
                if (operation.success) {
                    result = (currentProfit + parseFloat(operation.profit));
                } else {
                    result = (currentProfit - parseFloat(operation.amount));
                }
            }
            
            UI.profitCurrent.textContent = result.toFixed(2);
            profitCurrent = result;
            
            logToSystem(`Lucro atual atualizado: ${result.toFixed(2)}`, 'INFO');
        }

        // Inserir a linha no início da tabela
        UI.operationsBody.prepend(row);
        
        // Adicionar classe para animação
        row.classList.add('new-operation');
        
        // Armazenar a operação no cache para evitar duplicações
        operationsCache[`${operation.timestamp}_${operation.symbol}_${operation.status}`] = operation;
        
        // Opcional: Persistir localmente as operações
        saveOperationsToLocalStorage();
        
        // Notificar o sistema de automação sobre resultado, com um pequeno delay
        // para garantir que todos os sistemas estejam prontos
        // Apenas notificar se não for uma operação histórica carregada do localStorage
        if (operation.status === 'Closed' && !operation.isHistorical) {
            setTimeout(() => {
                notifyAutomationSystem(operation);
            }, 500);
        }
    };
    
    /**
     * Salva operações no localStorage para persistência
     */
    const saveOperationsToLocalStorage = () => {
        try {
            // Obter todas as operações do cache
            let operations = Object.values(operationsCache);
            
            // Filtrar para manter apenas operações dos últimos 7 dias
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            operations = operations.filter(op => op.timestamp > oneWeekAgo);
            
            // Limitar o número de operações salvas (máximo 100)
            if (operations.length > 100) {
                // Ordenar por timestamp (mais recentes primeiro)
                operations.sort((a, b) => b.timestamp - a.timestamp);
                // Manter apenas as 100 mais recentes
                operations = operations.slice(0, 100);
            }
            
            localStorage.setItem('tradeOperations', JSON.stringify(operations));
            logToSystem(`${operations.length} operações salvas no localStorage`, 'DEBUG');
        } catch (error) {
            logToSystem(`Erro ao salvar operações no localStorage: ${error.message}`, 'ERROR');
        }
    };
    
    /**
     * Carrega operações do localStorage
     */
    const loadOperationsFromLocalStorage = () => {
        try {
            const savedOperations = localStorage.getItem('tradeOperations');
            if (savedOperations) {
                const operations = JSON.parse(savedOperations);
                logToSystem(`Carregando ${operations.length} operações do localStorage`, 'INFO');
                
                // Limpar tabela antes de adicionar
                if (UI.operationsBody) {
                    UI.operationsBody.innerHTML = '';
                }
                
                // Adicionar cada operação
                operations.forEach(op => {
                    // Marcar operação como histórica para não acionar o gale
                    op.isHistorical = true;
                    operationsCache[`${op.timestamp}_${op.symbol}_${op.status}`] = op;
                    addOperation(op);
                });
            }
        } catch (error) {
            logToSystem(`Erro ao carregar operações do localStorage: ${error.message}`, 'ERROR');
        }
    };

    /**
     * Exporta operações para CSV
     */
    const exportToCSV = () => {
        const rows = [];
        
        // Função para normalizar texto (remover acentos)
        const normalizeText = (text) => {
            return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };
        
        // Cabeçalhos
        const headers = Array.from(document.querySelectorAll('th')).map(th => 
            normalizeText(th.textContent.trim().toUpperCase())
        );
        rows.push(headers.join(';'));

        // Dados da tabela
        document.querySelectorAll('tbody tr').forEach(tr => {
            const cells = Array.from(tr.children).map(td => {
                let content = td.textContent.trim();
                
                // Formatar valores monetários
                if (content.startsWith('R$')) {
                    content = content.replace('R$', '').trim().replace('.', '').replace(',', '.');
                }
                
                return normalizeText(content);
            });
            rows.push(cells.join(';'));
        });

        // Criar e baixar arquivo
        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.href = url;
        link.download = 'operacoes.csv';
        link.click();
        URL.revokeObjectURL(url);
        
        logToSystem("Histórico exportado para CSV", "SUCCESS");
    };

    /**
     * Inicia monitoramento de operações na página
     */
    const startTradeMonitoring = async () => {
        try {
            logToSystem("Iniciando monitoramento de operações...", "INFO");
            
            // Obter a aba ativa
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (!tabs || tabs.length === 0) {
                throw new Error("Não foi possível obter a aba ativa");
            }
            
            // Injetar script na página
            await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                    // Função para monitorar alterações na página e detectar operações
                    function monitorTrades() {
                        const scriptName = '[trade-history.js][monitorTrades]';
                        // let localRuntimeId = 'undefined';
                        // try {
                        //     localRuntimeId = chrome && chrome.runtime ? chrome.runtime.id : 'undefined';
                        // } catch(e) { /*ignore*/ }

                        // Verificar se já existe um observer
                        if (window._tradeObserver) {
                            // Observer já existe - não logar para evitar spam
                            return;
                        }
                        
                        // Cache para evitar envio de operações duplicadas
                        if (!window._processedTrades) {
                            window._processedTrades = new Set();
                        }
                        
                        // Função para gerar ID único de operação
                        const generateTradeId = (symbol, status, timestamp) => {
                            return `${symbol}_${status}_${timestamp}`;
                        };
                        
                        // Verificar se uma operação já foi processada recentemente
                        const isProcessedRecently = (trade) => {
                            const tradeId = generateTradeId(trade.symbol, trade.status, trade.timestamp);
                            if (window._processedTrades.has(tradeId)) {
                                return true;
                            }
                            
                            // Adicionar ao cache com timeout para expiração (5 segundos)
                            window._processedTrades.add(tradeId);
                            setTimeout(() => {
                                window._processedTrades.delete(tradeId);
                            }, 5000);
                            
                            return false;
                        };
                        
                        // Criar observer para monitorar notificações de operações
                        const observer = new MutationObserver((mutations) => {
                            mutations.forEach((mutation) => {
                                mutation.addedNodes.forEach((node) => {
                                    if (node.nodeType === Node.ELEMENT_NODE) {
                                        // Verificar se é uma notificação de trade
                                        const isTrade = node.querySelector('.deals-noty__title-icon svg');                
                                        if (isTrade) {
                                            // Extrair informações da operação
                                            const profitElement = [...node.querySelectorAll('.deals-noty__text-col')]
                                                .find(el => el.querySelector('.deals-noty__label').textContent === 'Profit')
                                                ?.querySelector('.deals-noty__value');

                                            const profit = (parseFloat(profitElement?.textContent.replace('$', '') || 0).toFixed(2));                                    
                                            const tradeTitle = node.querySelector('.deals-noty__title')?.textContent || ''; 

                                            // Determinar tipo de operação
                                            const getTradeType = (title) => {
                                                const cleanedTitle = title.replace(/\s+/g, '');
                                                return cleanedTitle === 'Tradeorderplaced' ? 'Open' : 'Closed';
                                            };

                                            // Extrair valor da operação
                                            const Amount = [...node.querySelectorAll('.deals-noty__text-col')]
                                                .find(el => el.querySelector('.deals-noty__label').textContent === 'Amount')
                                                ?.querySelector('.deals-noty__value');

                                            const amountValue = (parseFloat(Amount?.textContent.replace('$', '') || 0).toFixed(2));
                                            
                                            // *** CORREÇÃO: Obter valor real da entrada (incluindo Gale) ***
                                            let realEntryAmount = amountValue;
                                            
                                            // Verificar se há Gale ativo e obter valor real do StateManager
                                            try {
                                                if (window.StateManager) {
                                                    const config = window.StateManager.getConfig();
                                                    const configValue = parseFloat(config.value || 0);
                                                    if (configValue > 0) {
                                                        realEntryAmount = configValue.toFixed(2);
                                                    }
                                                }
                                            } catch (error) {
                                                // Erro ao obter valor do StateManager - usar valor padrão
                                            }
                                            
                                            // Armazenar último valor para cálculos (usar valor real)
                                            window.lastAmount = realEntryAmount;

                                            const TradeTypeElement = node.querySelector('.deals-noty__value')?.textContent;
                                            const payment = (parseFloat(profit) + parseFloat(realEntryAmount)).toFixed(2);
                                            
                                            const tradeStatus = getTradeType(tradeTitle);
                                            const symbol = node.querySelector('.deals-noty__symbol-title')?.textContent;
                                            const timestamp = Date.now();

                                            // Estruturar dados da operação com valor real
                                            const result = {
                                                status: tradeStatus,
                                                success: (profit > 0),
                                                profit: profit,
                                                amount: realEntryAmount, // *** CORREÇÃO: Usar valor real ***
                                                action: TradeTypeElement === 'Buy' || TradeTypeElement === 'Sell' ? payment : profit,
                                                symbol: symbol,
                                                timestamp: timestamp
                                            };
                                            
                                            // Verificar se é uma operação duplicada
                                            if (isProcessedRecently(result)) {
                                                // Operação duplicada - não logar para evitar spam
                                                return;
                                            }

                                            // Enviar o resultado para a extensão
                                            try {
                                                chrome.runtime.sendMessage({
                                                    type: 'TRADE_RESULT',
                                                    data: result
                                                }); 
                                            } catch (error) {
                                                // Erro ao enviar operação - não logar para evitar spam
                                            }
                                        }
                                    }
                                });
                            });
                        });

                        // Iniciar observação de alterações no DOM
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                        
                        // Armazenar referência ao observer
                        window._tradeObserver = observer;
                        
                        return true;
                    }
                    
                    // Chamar a função de monitoramento
                    return monitorTrades();
                }
            });
            
            updateStatus("Monitoramento de operações iniciado", "success", 3000);
            logToSystem("Monitoramento de operações iniciado", "INFO");
        } catch (error) {
            logToSystem(`Erro ao iniciar monitoramento: ${error.message}`, "ERROR");
            throw error;
        }
    };
    
    /**
     * Para o monitoramento de operações
     */
    const stopTradeMonitoring = async () => {
        try {
            // Obter a aba ativa
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (!tabs || tabs.length === 0) {
                throw new Error("Não foi possível obter a aba ativa");
            }
            
            // Injetar script para parar o observer
            await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                    const scriptName = '[trade-history.js][stopMonitoring]';
                    // let localRuntimeId = 'undefined';
                    // try {
                    //     localRuntimeId = chrome && chrome.runtime ? chrome.runtime.id : 'undefined';
                    // } catch(e) { /*ignore*/ }

                    if (window._tradeObserver) {
                        window._tradeObserver.disconnect();
                        window._tradeObserver = null;
                        return true;
                    }
                    return false;
                }
            });
            
            updateStatus("Monitoramento de operações interrompido", "info", 3000);
            logToSystem("Monitoramento de operações interrompido", "INFO");
        } catch (error) {
            logToSystem(`Erro ao parar monitoramento: ${error.message}`, "ERROR");
        }
    };
    
    /**
     * Limpa o histórico de operações
     */
    const clearHistory = () => {
        if (UI.operationsBody) {
            UI.operationsBody.innerHTML = '';
        }
        
        if (UI.profitCurrent) {
            UI.profitCurrent.textContent = '0';
            profitCurrent = 0;
        }
        
        // *** CORREÇÃO: Também atualizar o saldo no index ***
        const lastProfitElement = document.querySelector('#last-profit');
        if (lastProfitElement) {
            lastProfitElement.textContent = 'R$ 0,00';
        }
        
        operationsCache = {};
        localStorage.removeItem('tradeOperations');
        
        // *** CORREÇÃO: Notificar outros módulos sobre a limpeza ***
        try {
            chrome.runtime.sendMessage({
                action: 'historyCleared',
                timestamp: Date.now()
            });
        } catch (e) {
            // Ignorar erros de comunicação
        }
        
        updateStatus("Histórico de operações limpo", "success", 3000);
        logToSystem("Histórico de operações limpo", "INFO");
    };
    
    /**
     * Configura os listeners de eventos
     */
    const setupEventListeners = () => {
        // Exportar para CSV
        if (UI.exportBtn) {
            UI.exportBtn.addEventListener('click', exportToCSV);
        }
        
        // Limpar histórico
        if (UI.clearHistoryBtn) {
            UI.clearHistoryBtn.addEventListener('click', clearHistory);
        }
        
        // Listener para receber mensagens do background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'TRADE_RESULT') {
                const trade = message.data;
                addOperation(trade);
                
                if (sendResponse) sendResponse({ success: true });
            }
            
            // Manter canal de mensagem aberto para respostas assíncronas
            return true;
        });
    };
    
    /**
     * Inicializa o módulo de histórico
     */
    const init = () => {
        // Verificar se estamos na página correta antes de inicializar
        if (!isTradeHistoryPage()) {
            // Não estamos na página correta, mas isso não é um erro
            return;
        }
        
        if (isInitialized) {
            logToSystem("Módulo de histórico já inicializado", "WARN");
            return;
        }
        
        updateStatus("Inicializando módulo de histórico...", "info", 2000);
        logToSystem("Inicializando módulo de histórico", "INFO");
        
        // Atualizar referências de elementos UI
        UI.operationsBody = document.querySelector('#operations-body');
        UI.profitCurrent = document.querySelector('#profitCurrent');
        UI.exportBtn = document.querySelector('#export-csv');
        UI.clearHistoryBtn = document.querySelector('#clear-history');
        
        if (!UI.operationsBody) {
            // Só logar como erro se estivermos na página que deveria ter o elemento
            logToSystem("Elemento operations-body não encontrado", "ERROR");
            return; // Não continuar a inicialização se o elemento principal não existir
        }
        
        // Configurar listeners
        setupEventListeners();
        
        // Carregar operações salvas
        loadOperationsFromLocalStorage();
        
        isInitialized = true;
        updateStatus("Módulo de histórico inicializado", "success", 3000);
        logToSystem("Módulo de histórico inicializado com sucesso", "SUCCESS");
    };
    
    // Inicialização automática quando o DOM estiver pronto
    document.addEventListener('DOMContentLoaded', init);
    
    /**
     * Notifica o sistema de automação sobre o resultado da operação
     * @param {Object} operation - Dados da operação
     */
    const notifyAutomationSystem = (operation) => {
        try {
            // Verificação mais robusta para garantir que só operações realmente fechadas sejam consideradas
            if (operation.status !== 'Closed') {
                return;
            }

            // Validação adicional para garantir que temos dados válidos
            if (!operation.symbol || typeof operation.success !== 'boolean') {
                logToSystem(`Dados de operação inválidos`, 'WARN');
                return;
            }
            
            // Verificar se é uma operação histórica carregada do localStorage
            if (operation.isHistorical) {
                return;
            }
            
            // Verificar se a operação é recente (menos de 30 segundos atrás)
            const isRecent = Date.now() - operation.timestamp < 30000; // 30 segundos
            if (!isRecent) {
                return;
            }
            
            logToSystem(`Notificando automação: ${operation.symbol} - ${operation.success ? 'ganhou' : 'perdeu'}`, 'INFO');
            
            // Notificar o sistema de Gale, com verificação mais robusta
            let galeSystemNotified = false;
            
            // Método 1: Tentar usar a API global do GaleSystem diretamente
            if (typeof window.GaleSystem !== 'undefined' && window.GaleSystem) {
                try {
                    if (operation.success) {
                        // Se for sucesso, resetar o gale (usando função de interface)
                        if (typeof window.GaleSystem.simulateReset === 'function') {
                            const result = window.GaleSystem.simulateReset();
                            logToSystem(`Gale resetado: ${result.message}`, 'SUCCESS');
                            galeSystemNotified = true;
                        } else if (typeof window.GaleSystem.resetGale === 'function') {
                            // Fallback para método direto
                            const result = window.GaleSystem.resetGale();
                            logToSystem(`Gale resetado: ${result.message}`, 'SUCCESS');
                            galeSystemNotified = true;
                        }
                    } else {
                        // Se for falha, aplicar o gale usando simulateGale (mesma função do botão)
                        if (typeof window.GaleSystem.simulateGale === 'function') {
                            const result = window.GaleSystem.simulateGale();
                            logToSystem(`Gale aplicado: ${result.message}`, 'WARN');
                            galeSystemNotified = true;
                        } else if (typeof window.GaleSystem.applyGale === 'function') {
                            // Fallback para método direto apenas se o simulateGale não existir
                            const result = window.GaleSystem.applyGale({
                                ...operation,
                                source: 'trade-history',
                                notifyTime: Date.now()
                            });
                            logToSystem(`Gale aplicado: ${result.message}`, 'WARN');
                            galeSystemNotified = true;
                        }
                    }
                } catch (galeError) {
                    logToSystem(`Erro ao notificar GaleSystem: ${galeError.message}`, 'ERROR');
                }
            } else {
                logToSystem(`GaleSystem não encontrado`, 'WARN');
            }
            
            // Método 2: Se a comunicação direta falhar, tentar via mensagem do Chrome
            if (!galeSystemNotified) {
                try {
                    const action = operation.success ? 'RESET_GALE' : 'APPLY_GALE';
                    chrome.runtime.sendMessage({
                        action: action,
                        data: {
                            ...operation,
                            source: 'trade-history',
                            notifyTime: Date.now()
                        }
                    });
                } catch (msgError) {
                    logToSystem(`Erro ao enviar mensagem para gale: ${msgError.message}`, 'ERROR');
                }
            }
            
            // Método 3: Criar um evento personalizado para notificar o sistema de automação (método legado)
            try {
                const operationResultEvent = new CustomEvent('operationResult', {
                    detail: {
                        success: operation.success,
                        profit: parseFloat(operation.profit),
                        amount: parseFloat(operation.amount),
                        symbol: operation.symbol,
                        timestamp: operation.timestamp
                    }
                });
                
                // Disparar o evento
                document.dispatchEvent(operationResultEvent);
                
                // *** REMOVIDO: A chamada completeOperationCycle estava causando mudança indevida de status ***
                // O StateManager já controla adequadamente o status baseado na configuração de automação
            } catch (eventError) {
                logToSystem(`Erro ao disparar evento de operação: ${eventError.message}`, 'ERROR');
            }
        } catch (error) {
            logToSystem(`Erro ao notificar automação: ${error.message}`, 'ERROR');
        }
    };
    
    // API pública
    return {
        init,
        addOperation,
        startMonitoring: startTradeMonitoring,
        stopMonitoring: stopTradeMonitoring,
        exportToCSV,
        clearHistory,
        getTotalProfit: () => profitCurrent,
        isTradeHistoryPage: isTradeHistoryPage,
        notifyAutomationSystem: notifyAutomationSystem
    };
})();

// Auto-inicialização quando o script é carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Verificar se estamos na página correta antes de inicializar
        if (window.TradeManager && window.TradeManager.History) {
            // Só inicializar se a detecção de página indicar que estamos na página correta
            if (isTradeHistoryPage()) {
                window.TradeManager.History.init();
            }
        }
    });
} else {
    // Mesmo para carregamento imediato, verificar se estamos na página certa
    if (window.TradeManager && window.TradeManager.History) {
        if (isTradeHistoryPage()) {
            window.TradeManager.History.init();
        }
    }
}

