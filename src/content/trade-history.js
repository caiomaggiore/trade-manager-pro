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
    
    // Sistema de logs (integração)
    const logToSystem = (message, level = 'INFO') => {
        // Usar sistema de logs global, se disponível
        if (typeof window.logToSystem === 'function') {
            window.logToSystem(message, level, 'trade-history.js');
            return;
        }
        
        // Fallback para console apenas para erros
        if (level.toUpperCase() === 'ERROR') {
            console.error(`[${level}][trade-history.js] ${message}`);
        }
        
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
            // Não logar erro se não estivermos na página correta
            if (isTradeHistoryPage()) {
                logToSystem("Elemento operations-body não encontrado", "ERROR");
            }
            return;
        }

        // Verificação mais rigorosa de duplicação usando propriedades intrínsecas da operação
        // Construir uma chave baseada em timestamp, símbolo e status
        const operationKey = `${operation.timestamp}_${operation.symbol}_${operation.status}`;
        
        // Verificar o cache de operações primeiro
        if (operationsCache[operationKey]) {
            logToSystem(`Operação ignorada (chave exata já existente): ${operation.symbol} [${operation.status}]`, 'DEBUG');
            return;
        }
        
        // Verificação adicional para detectar duplicações mesmo com timestamps diferentes
        // mas próximos (dentro de 3 segundos), mesmo símbolo e mesmo status
        const now = operation.timestamp;
        const similarOp = Object.values(operationsCache).find(op => 
            op.symbol === operation.symbol && 
            op.status === operation.status && 
            Math.abs(op.timestamp - now) < 3000 && // 3 segundos
            (operation.status !== 'Closed' || op.success === operation.success) // Se fechado, verificar também o resultado
        );
        
        if (similarOp) {
            logToSystem(`Operação similar ignorada: ${operation.symbol} [${operation.status}]`, 'DEBUG');
            return;
        }
        
        // Verificar duplicidade também na tabela visível
        const existingRows = UI.operationsBody.getElementsByTagName('tr');
        const timestampStr = operation.timestamp.toString();
        const symbol = operation.symbol;

        for (const row of existingRows) {
            // Verificação por timestamp e símbolo
            if (row.dataset.timestamp === timestampStr && row.dataset.symbol === symbol) {
                logToSystem(`Operação duplicada ignorada (na tabela): ${symbol}`, 'DEBUG');
                return;
            }
            
            // Verificação adicional pela hora visível e símbolo
            // (para casos onde o timestamp interno pode ser diferente mas a hora mostrada é a mesma)
            const rowTime = row.querySelector('td:first-child')?.textContent;
            const opTime = new Date(operation.timestamp).toLocaleTimeString();
            
            if (rowTime === opTime && row.dataset.symbol === symbol && 
                row.className === (operation.status === 'Open' ? 'neutro' : (operation.success ? 'venceu' : 'perdeu'))) {
                logToSystem(`Operação duplicada ignorada (mesma hora visual): ${symbol} em ${opTime}`, 'DEBUG');
                return;
            }
        }

        logToSystem(`Adicionando operação: ${operation.status} ${operation.symbol}`, 'INFO');
        
        // Cria a nova linha se não houver duplicata
        const row = document.createElement('tr');
        
        // Define a classe com base no status da operação
        const statusClass = operation.status === 'Open' ? 'neutro' : (operation.success ? 'venceu' : 'perdeu');
        row.className = statusClass;

        // Garantir que os valores sejam strings antes de usar replace
        const amountStr = (typeof operation.amount === 'number') ? operation.amount.toString() : (operation.amount || '0');
        const profitStr = (typeof operation.profit === 'number') ? operation.profit.toString() : (operation.profit || '0');
        const actionStr = (typeof operation.action === 'number') ? operation.action.toString() : (operation.action || '0');

        // Construir HTML da linha com valores convertidos para string
        row.innerHTML = `
            <td>${new Date(operation.timestamp).toLocaleTimeString()}</td>
            <td>${operation.symbol}</td>
            <td>${operation.status === 'Open' ? 'OPEN' : operation.success ? 'GANHOU' : 'PERDEU'}</td>
            <td>${parseFloat(profitStr) <= 0 ? `${amountStr.replace('.', ',')}` : actionStr.replace('.', ',')}</td>
            <td>${operation.status === 'Open' ? `0` : `${operation.success ? `+ ${profitStr.replace('.', ',')}`  : `- ${amountStr.replace('.', ',')}`}`}</td>        
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
                    result = (currentProfit + parseFloat(profitStr));
                } else {
                    result = (currentProfit - parseFloat(amountStr));
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

        // Notifica o sistema de automação sobre o resultado da operação
        notifyAutomationSystem(operation);
    };
    
    /**
     * Notifica o sistema de automação sobre o resultado da operação
     * @param {Object} operation - Dados da operação
     */
    const notifyAutomationSystem = (operation) => {
        try {
            // Verificação robusta para garantir que só operações realmente fechadas sejam consideradas
            if (operation.status !== 'Closed') {
                logToSystem(`Ignorando notificação para operação não fechada: ${operation.symbol} - ${operation.status}`, 'DEBUG');
                return;
            }

            // Validação adicional para garantir que temos dados válidos
            if (!operation.symbol || typeof operation.success !== 'boolean') {
                logToSystem(`Dados de operação inválidos ou incompletos, cancelando notificação`, 'WARN');
                return;
            }
            
            // Verificar se é uma operação histórica carregada do localStorage
            if (operation.isHistorical) {
                logToSystem(`Ignorando notificação para operação histórica: ${operation.symbol}`, 'INFO');
                return;
            }
            
            // Verificar se a operação é recente (menos de 30 segundos atrás)
            const isRecent = Date.now() - operation.timestamp < 30000; // 30 segundos
            if (!isRecent) {
                logToSystem(`Ignorando notificação para operação antiga: ${operation.symbol}`, 'INFO');
                return;
            }
            
            // Verificar se esta operação já foi notificada
            if (operation._systemNotified) {
                logToSystem(`Ignorando notificação duplicada para: ${operation.symbol}`, 'DEBUG');
                return;
            }
            
            // Marcar a operação como já notificada para evitar duplicações
            operation._systemNotified = true;
            
            logToSystem(`Notificando sistema de automação: operação ${operation.success ? 'vencedora' : 'perdedora'} - ${operation.symbol}`, 'INFO');
            
            // Notificar o sistema de Gale, com verificação mais robusta
            let galeSystemNotified = false;
            
            // Método 1: Tentar usar a API global do GaleSystem diretamente
            if (typeof window.GaleSystem !== 'undefined' && window.GaleSystem) {
                try {
                    if (operation.success) {
                        // Se for sucesso, resetar o gale (usando função de interface)
                        if (typeof window.GaleSystem.simulateReset === 'function') {
                            logToSystem(`Operação bem-sucedida, chamando simulateReset para resetar gale`, 'SUCCESS');
                            const result = window.GaleSystem.simulateReset();
                            logToSystem(`Resultado do reset: ${result.message}`, 'SUCCESS');
                            galeSystemNotified = true;
                        } else if (typeof window.GaleSystem.resetGale === 'function') {
                            // Fallback para método direto
                            const result = window.GaleSystem.resetGale();
                            logToSystem(`Operação bem-sucedida, sistema de gale: ${result.message}`, 'SUCCESS');
                            galeSystemNotified = true;
                        }
                    } else {
                        // Se for falha, aplicar o gale usando simulateGale (mesma função do botão)
                        if (typeof window.GaleSystem.simulateGale === 'function') {
                            logToSystem(`Operação com perda, chamando simulateGale para aplicar gale`, 'WARN');
                            const result = window.GaleSystem.simulateGale();
                            logToSystem(`Resultado da aplicação de gale: ${result.message}`, 'WARN');
                            galeSystemNotified = true;
                        } else if (typeof window.GaleSystem.applyGale === 'function') {
                            // Fallback para método direto apenas se o simulateGale não existir
                            const result = window.GaleSystem.applyGale({
                                ...operation,
                                source: 'trade-history',
                                notifyTime: Date.now()
                            });
                            logToSystem(`Operação com perda, sistema de gale: ${result.message}`, 'WARN');
                            galeSystemNotified = true;
                        }
                    }
                } catch (galeError) {
                    logToSystem(`Erro ao notificar GaleSystem diretamente: ${galeError.message}`, 'ERROR');
                }
            } else {
                logToSystem(`GaleSystem não encontrado para notificação direta`, 'WARN');
            }
            
            // Método 2: Se a comunicação direta falhar, tentar via mensagem do Chrome
            if (!galeSystemNotified) {
                try {
                    if (chrome && chrome.runtime) {
                        const action = operation.success ? 'RESET_GALE' : 'APPLY_GALE';
                        chrome.runtime.sendMessage({
                            action: action,
                            data: {
                                ...operation,
                                source: 'trade-history',
                                notifyTime: Date.now()
                            }
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                logToSystem(`Erro na comunicação com background: ${chrome.runtime.lastError.message}`, 'ERROR');
                                return;
                            }
                            
                            if (response && response.success) {
                                logToSystem(`Operação ${operation.success ? 'bem-sucedida' : 'com perda'}, resposta do sistema de gale via mensagem recebida`, operation.success ? 'SUCCESS' : 'WARN');
                            }
                        });
                    }
                } catch (msgError) {
                    logToSystem(`Erro ao enviar mensagem para sistema de gale: ${msgError.message}`, 'ERROR');
                }
            }
            
            // Método 3: Criar um evento personalizado para notificar o sistema de automação (método legado)
            try {
                const operationResultEvent = new CustomEvent('operationResult', {
                    detail: {
                        success: operation.success,
                        profit: parseFloat(typeof operation.profit === 'string' ? operation.profit : operation.profit.toString()),
                        amount: parseFloat(typeof operation.amount === 'string' ? operation.amount : operation.amount.toString()),
                        symbol: operation.symbol,
                        timestamp: operation.timestamp
                    }
                });
                
                // Disparar o evento
                document.dispatchEvent(operationResultEvent);
                logToSystem(`Evento 'operationResult' disparado`, 'DEBUG');
            } catch (eventError) {
                logToSystem(`Erro ao disparar evento: ${eventError.message}`, 'ERROR');
            }
        } catch (error) {
            logToSystem(`Erro ao notificar sistema de automação: ${error.message}`, 'ERROR');
        }
    };
    
    /**
     * Salva operações no localStorage para persistência
     */
    const saveOperationsToLocalStorage = () => {
        try {
            logToSystem(`Iniciando salvamento de operações no localStorage...`, 'DEBUG');
            
            // Obter todas as operações do cache
            let operations = Object.values(operationsCache);
            logToSystem(`Total de ${operations.length} operações no cache para salvar`, 'DEBUG');
            
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
            
            // Verificar se temos operações para salvar
            if (operations.length === 0) {
                logToSystem(`Nenhuma operação para salvar`, 'DEBUG');
                return false;
            }
            
            // Salvar no localStorage - diferente do chrome.storage.local
            localStorage.setItem('tradeOperations', JSON.stringify(operations));
            logToSystem(`${operations.length} operações salvas no localStorage`, 'SUCCESS');
            
            return true;
        } catch (error) {
            logToSystem(`Erro ao salvar operações: ${error.message}`, 'ERROR');
            return false;
        }
    };
    
    /**
     * Carrega operações do localStorage
     */
    const loadOperationsFromLocalStorage = () => {
        try {
            logToSystem(`Tentando carregar operações do localStorage...`, 'INFO');
            
            const savedOperations = localStorage.getItem('tradeOperations');
            if (savedOperations) {
                try {
                    const operations = JSON.parse(savedOperations);
                    logToSystem(`Carregando ${operations.length} operações do localStorage`, 'INFO');
                    
                    // Verificar se operationsBody existe
                    if (!UI.operationsBody) {
                        logToSystem(`UI.operationsBody não encontrado durante carregamento. DOM pronto: ${document.readyState === 'complete'}`, 'ERROR');
                        return false;
                    }
                    
                    // Limpar tabela antes de adicionar
                    UI.operationsBody.innerHTML = '';
                    logToSystem(`Tabela limpa antes de adicionar operações carregadas`, 'DEBUG');
                    
                    // Limpar cache de operações antes de recarregar
                    operationsCache = {};
                    
                    // Adicionar cada operação
                    operations.forEach((op, index) => {
                        try {
                            // Marcar operação como histórica para não acionar o gale
                            op.isHistorical = true;
                            operationsCache[`${op.timestamp}_${op.symbol}_${op.status || ''}`] = op;
                            addOperation(op);
                            
                            if (index === 0 || index === operations.length - 1 || index % 20 === 0) {
                                logToSystem(`Operação ${index+1}/${operations.length} carregada: ${op.symbol}`, 'DEBUG');
                            }
                        } catch (opError) {
                            logToSystem(`Erro ao processar operação ${index+1}: ${opError.message}`, 'ERROR');
                        }
                    });
                    
                    logToSystem(`Carregamento de ${operations.length} operações concluído com sucesso`, 'SUCCESS');
                    return true;
                } catch (parseError) {
                    logToSystem(`Erro ao processar JSON das operações: ${parseError.message}`, 'ERROR');
                    return false;
                }
            } else {
                logToSystem('Nenhuma operação encontrada no localStorage', 'INFO');
                return false;
            }
        } catch (error) {
            logToSystem(`Erro ao carregar operações: ${error.message}`, 'ERROR');
            return false;
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
                        
                        // Criar um registro de notificações já processadas para evitar duplicações
                        if (!window._processedNotifications) {
                            window._processedNotifications = new Set();
                        }
                        
                        // Criar observer para monitorar notificações de operações
                        const observer = new MutationObserver((mutations) => {
                            mutations.forEach((mutation) => {
                                mutation.addedNodes.forEach((node) => {
                                    if (node.nodeType === Node.ELEMENT_NODE) {
                                        // Verificar se é uma notificação de trade
                                        const isTrade = node.querySelector('.deals-noty__title-icon svg');                
                                        if (isTrade) {
                                            // Criar um identificador único para esta notificação
                                            // baseado no conteúdo e tempo
                                            const timestamp = Date.now();
                                            const symbol = node.querySelector('.deals-noty__symbol-title')?.textContent || '';
                                            const title = node.querySelector('.deals-noty__title')?.textContent || '';
                                            const notificationId = `${timestamp}_${symbol}_${title.replace(/\s+/g, '')}`;
                                            
                                            // Verificar se esta notificação já foi processada recentemente
                                            if (window._processedNotifications.has(notificationId)) {
                                                console.log('Notificação já processada, ignorando:', notificationId);
                                                return;
                                            }
                                            
                                            // Adicionar à lista de processados
                                            window._processedNotifications.add(notificationId);
                                            
                                            // Limitar o tamanho do conjunto para evitar uso excessivo de memória
                                            if (window._processedNotifications.size > 100) {
                                                const oldestEntries = Array.from(window._processedNotifications).slice(0, 50);
                                                oldestEntries.forEach(entry => window._processedNotifications.delete(entry));
                                            }
                                            
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
                                                symbol: symbol,
                                                timestamp: timestamp,
                                                notificationId: notificationId // Incluir o ID para rastreabilidade
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
        if (!UI.operationsBody) {
            logToSystem(`Não foi possível limpar o histórico: elemento operationsBody não encontrado`, 'ERROR');
            return;
        }
        
        // Limpar a tabela visualmente
        UI.operationsBody.innerHTML = '';
        
        // Atualizar o lucro total
        if (UI.profitCurrent) {
            UI.profitCurrent.textContent = '0';
            profitCurrent = 0;
        }
        
        // Limpar o cache local
        operationsCache = {};
        
        // Remover do localStorage em vez de chrome.storage
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
        
        // Limpar histórico
        if (UI.clearHistoryBtn) {
            UI.clearHistoryBtn.addEventListener('click', clearHistory);
            logToSystem("Listener de limpar histórico configurado", "DEBUG");
        }
        
        // Listener para receber mensagens do background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'TRADE_RESULT') {
                const trade = message.data;
                logToSystem(`Operação recebida: ${trade.symbol} - ${trade.status}`, "INFO");
                
                // Verificar se a operação já existe no cache com o mesmo status
                const operationKey = `${trade.timestamp}_${trade.symbol}`;
                const existingOperation = operationsCache[operationKey];
                
                if (existingOperation && existingOperation.status === trade.status) {
                    logToSystem(`Operação ignorada (já processada): ${trade.symbol} - ${trade.status}`, "DEBUG");
                    if (sendResponse) sendResponse({ success: true, duplicated: true });
                    return true;
                }
                
                addOperation(trade);
                
                // Enviar notificação apenas uma vez e apenas para operações fechadas
                if (trade.status === 'Closed' && !trade._notificationSent) {
                    trade._notificationSent = true; // Marcar como notificação enviada
                    
                    const sucessoMsg = trade.success ? 'GANHOU' : 'PERDEU';
                    const notificationMessage = `${trade.symbol}: ${sucessoMsg} ${trade.success ? '+' + trade.profit : '-' + trade.amount}`;
                    
                    // Enviar notificação apenas uma vez, com timestamp para garantir unicidade
                    chrome.runtime.sendMessage({
                        action: 'showNotification',
                        title: 'Operação Finalizada',
                        message: notificationMessage,
                        type: trade.success ? 'success' : 'error',
                        id: `trade_${trade.timestamp}_${trade.symbol}` // ID único para a notificação
                    });
                    
                    logToSystem(`Notificação enviada para: ${trade.symbol}`, "DEBUG");
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
        // Verificar se estamos na página correta antes de inicializar
        if (!isTradeHistoryPage()) {
            // Não estamos na página correta, mas isso não é um erro
            return;
        }
        
        if (isInitialized) {
            logToSystem("Módulo de histórico já inicializado", "WARN");
            return;
        }
        
        logToSystem("Inicializando módulo de histórico...", "INFO");
        
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
        getTotalProfit: () => profitCurrent,
        isTradeHistoryPage: isTradeHistoryPage
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

// Na função updateOperationResult, adicionar após atualizar o cache
const updateOperationUI = (key) => {
    // Lógica para atualizar a interface de operações, se necessário
    // Por enquanto, essa função está vazia
};

/**
 * Atualiza o resultado de uma operação
 */
const updateOperationResult = (key, status, amount, profit, success) => {
    try {
        // Se a operação não existir no cache, cancelar
        if (!operationsCache[key]) {
            logToSystem(`Tentativa de atualizar operação não encontrada: ${key}`, 'WARN');
            return;
        }
        
        const oldStatus = operationsCache[key].status;
        
        // Atualizar o status da operação
        operationsCache[key].status = status;
        
        // Atualizar apenas se os valores estiverem definidos
        if (amount !== undefined) operationsCache[key].amount = amount;
        if (profit !== undefined) operationsCache[key].profit = profit;
        if (success !== undefined) operationsCache[key].success = success;
        
        // Se o status mudou, precisamos atualizar a chave no cache
        if (oldStatus !== status) {
            // Criar nova chave com status atualizado
            const baseKey = key.split('_').slice(0, 2).join('_'); // Pega apenas timestamp e symbol
            const newKey = `${baseKey}_${status}`;
            
            // Copiar a operação para a nova chave
            operationsCache[newKey] = {...operationsCache[key]};
            
            // Remover a chave antiga
            delete operationsCache[key];
            
            // Usar a nova chave para atualização de UI e notificações
            key = newKey;
            
            logToSystem(`Operação movida de ${oldStatus} para ${status}: ${baseKey}`, 'DEBUG');
        }
        
        // Atualizar a interface
        updateOperationUI(key);
        
        // Salvar no localStorage
        saveOperationsToLocalStorage();
        
        // Notificar sistema de automação sobre o resultado apenas se fechou
        if (status === 'Closed' && success !== undefined) {
            notifyAutomationSystem(operationsCache[key]);
        }
    } catch (error) {
        logToSystem(`Erro ao atualizar resultado da operação: ${error.message}`, 'ERROR');
    }
}; 