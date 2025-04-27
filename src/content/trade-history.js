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

// Inicialização do módulo de histórico
window.TradeManager.History = (function() {
    // Cache para evitar duplicidade de operações
    let operationsCache = {};
    let profitCurrent = 0;
    let isInitialized = false;
    let observer = null;
    
    // Referência aos elementos da UI
    const UI = {
        operationsBody: document.querySelector('#operations-body'),
        profitCurrent: document.querySelector('#profitCurrent'),
        exportBtn: document.querySelector('#export-csv')
    };
    
    // Sistema de logs (integração)
    const logToSystem = (message, level = 'INFO') => {
        // Usar sistema de logs global, se disponível
        if (typeof window.logToSystem === 'function') {
            window.logToSystem(message, level, 'trade-history.js');
            return;
        }
        
        // Fallback para console
        console.log(`[${level}][trade-history.js] ${message}`);
        
        // Tentar enviar para o sistema centralizado via mensagem
        try {
            chrome.runtime.sendMessage({
                action: 'logMessage',
                message: message,
                level: level,
                source: 'trade-history.js'
            });
        } catch (error) {
            console.error('[trade-history.js] Erro ao enviar log:', error);
        }
    };
    
    /**
     * Adiciona uma operação à tabela de histórico
     * @param {Object} operation - Dados da operação
     */
    const addOperation = (operation) => {
        if (!UI.operationsBody) {
            logToSystem("Elemento operations-body não encontrado", "ERROR");
            return;
        }

        // Verificar duplicidade antes de criar a linha
        const existingRows = UI.operationsBody.getElementsByTagName('tr');
        const timestampStr = operation.timestamp.toString();
        const symbol = operation.symbol;

        // Verifica se já existe uma linha com o mesmo timestamp e símbolo
        for (const row of existingRows) {
            if (row.dataset.timestamp === timestampStr && row.dataset.symbol === symbol) {
                logToSystem(`Operação duplicada ignorada: ${symbol} em ${new Date(operation.timestamp).toLocaleTimeString()}`, 'DEBUG');
                return; // Encerra a função se encontrar duplicata
            }
        }

        logToSystem(`Adicionando operação: ${operation.status} ${operation.symbol}`, 'INFO');
        
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
            <td>${operation.profit <= 0 ? `${operation.amount.replace('.', ',')}` : operation.action.replace('.', ',')}</td>
            <td>${operation.status === 'Open' ? `0` : `${operation.success ? `+ ${operation.profit.replace('.', ',')}`  : `- ${operation.amount.replace('.', ',')}`}`}</td>        
        `;

        // Adiciona atributos de dados para verificação futura
        row.dataset.timestamp = timestampStr;
        row.dataset.symbol = symbol;

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
        operationsCache[`${operation.timestamp}_${operation.symbol}`] = operation;
        
        // Opcional: Persistir localmente as operações
        saveOperationsToLocalStorage();
    };
    
    /**
     * Salva operações no localStorage para persistência
     */
    const saveOperationsToLocalStorage = () => {
        try {
            const operations = Object.values(operationsCache);
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
                    operationsCache[`${op.timestamp}_${op.symbol}`] = op;
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
                        // Verificar se já existe um observer
                        if (window._tradeObserver) {
                            console.log("Observer já existe, não será criado novamente");
                            return;
                        }
                        
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
                                            
                                            // Armazenar último valor para cálculos
                                            if (!window.lastAmount && amountValue > 0) {
                                                window.lastAmount = amountValue;
                                            }

                                            const TradeTypeElement = node.querySelector('.deals-noty__value')?.textContent;
                                            const payment = (parseFloat(profit) + parseFloat(window.lastAmount || 0)).toFixed(2);

                                            // Estruturar dados da operação
                                            const result = {
                                                status: getTradeType(tradeTitle),
                                                success: (profit > 0),
                                                profit: profit,
                                                amount: window.lastAmount || amountValue,
                                                action: TradeTypeElement === 'Buy' || TradeTypeElement === 'Sell' ? payment : profit,
                                                symbol: node.querySelector('.deals-noty__symbol-title')?.textContent,
                                                timestamp: Date.now()
                                            };

                                            console.log('Operação detectada:', result);                  
                                            
                                            // Enviar o resultado para a extensão
                                            chrome.runtime.sendMessage({
                                                type: 'TRADE_RESULT',
                                                data: result
                                            });
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
                        
                        console.log("Monitoramento de operações iniciado");
                        return true;
                    }
                    
                    // Chamar a função de monitoramento
                    return monitorTrades();
                }
            });
            
            logToSystem("Monitoramento de operações iniciado com sucesso", "SUCCESS");
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
                    if (window._tradeObserver) {
                        window._tradeObserver.disconnect();
                        window._tradeObserver = null;
                        console.log("Monitoramento de operações interrompido");
                        return true;
                    }
                    return false;
                }
            });
            
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
        
        operationsCache = {};
        localStorage.removeItem('tradeOperations');
        
        logToSystem("Histórico de operações limpo", "INFO");
    };
    
    /**
     * Configura os listeners de eventos
     */
    const setupEventListeners = () => {
        // Exportar para CSV
        if (UI.exportBtn) {
            UI.exportBtn.addEventListener('click', exportToCSV);
            logToSystem("Listener de exportação configurado", "DEBUG");
        }
        
        // Listener para receber mensagens do background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'TRADE_RESULT') {
                const trade = message.data;
                logToSystem(`Operação recebida: ${trade.symbol} - ${trade.status}`, "INFO");
                addOperation(trade);
                
                // Enviar notificação se configurado
                if (trade.status === 'Closed') {
                    const sucessoMsg = trade.success ? 'GANHOU' : 'PERDEU';
                    const notificationMessage = `${trade.symbol}: ${sucessoMsg} ${trade.success ? '+' + trade.profit : '-' + trade.amount}`;
                    
                    // Enviar notificação
                    chrome.runtime.sendMessage({
                        action: 'showNotification',
                        title: 'Operação Finalizada',
                        message: notificationMessage,
                        type: trade.success ? 'success' : 'error'
                    });
                }
                
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
        if (isInitialized) {
            logToSystem("Módulo de histórico já inicializado", "WARN");
            return;
        }
        
        logToSystem("Inicializando módulo de histórico...", "INFO");
        
        // Atualizar referências de elementos UI
        UI.operationsBody = document.querySelector('#operations-body');
        UI.profitCurrent = document.querySelector('#profitCurrent');
        UI.exportBtn = document.querySelector('#export-csv');
        
        if (!UI.operationsBody) {
            logToSystem("Elemento operations-body não encontrado", "ERROR");
        }
        
        // Configurar listeners
        setupEventListeners();
        
        // Carregar operações salvas
        loadOperationsFromLocalStorage();
        
        isInitialized = true;
        logToSystem("Módulo de histórico inicializado com sucesso", "SUCCESS");
    };
    
    // Inicialização automática quando o DOM estiver pronto
    document.addEventListener('DOMContentLoaded', init);
    
    // API pública
    return {
        init,
        addOperation,
        startMonitoring: startTradeMonitoring,
        stopMonitoring: stopTradeMonitoring,
        exportToCSV,
        clearHistory,
        getTotalProfit: () => profitCurrent
    };
})();

// Auto-inicialização quando o script é carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.TradeManager && window.TradeManager.History) {
            window.TradeManager.History.init();
        }
    });
} else {
    if (window.TradeManager && window.TradeManager.History) {
        window.TradeManager.History.init();
    }
} 