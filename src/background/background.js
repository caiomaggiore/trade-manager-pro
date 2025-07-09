// ================== CONFIGURAÇÃO INICIAL ==================
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    galeEnabled: true,
    galeLevel: '1x',
    dailyProfit: '',
    stopLoss: '',
    autoActive: false,
    tradeValue: 10, // Valor padrão
    tradeTime: 0    // Período dinâmico por padrão
  });
});

// ================== VARIÁVEIS GLOBAIS ==================
let isProcessing = false;

// ================== FUNÇÕES AUXILIARES ==================
/**
 * Captura a imagem da guia visível
 * @returns {Promise<string>} Data URL da imagem capturada
 */
const captureTabImage = async () => {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab({ format: 'png' }, resolve);
  });
};

/**
 * Obtém a guia ativa atual
 * @returns {Promise<chrome.tabs.Tab>} Objeto da guia ativa
 */
const getActiveTab = async () => {
  const [tab] = await new Promise(resolve => 
    chrome.tabs.query({ active: true, currentWindow: true }, resolve)
  );
  return tab;
};

/**
 * Converte segundos para o formato de período da plataforma
 * @param {number} seconds - Segundos para conversão
 * @returns {string} Código do período (ex: 'M5')
 */
const convertToPlatformFormat = (seconds) => {
  const periods = {
    5: 'S5', 15: 'S15', 30: 'S30',
    60: 'M1', 180: 'M3', 300: 'M5'
  };
  return periods[seconds] || 'M5';
};

/**
 * Obtém parâmetros de trade com fallback para padrões
 * @param {object} settings - Configurações do usuário
 * @param {object} analysis - Dados da análise
 * @param {array} availablePeriods - Períodos disponíveis na plataforma
 * @returns {object} Parâmetros formatados
 */
const getTradeParameters = (settings, analysis, availablePeriods) => {
  const DEFAULT_VALUE = 10;
  const value = settings.tradeValue > 0 ? settings.tradeValue : DEFAULT_VALUE;
  
  // Determina o período com base nas opções disponíveis
  let expiration;
  if(settings.tradeTime > 0) {
    expiration = convertToPlatformFormat(settings.tradeTime);
  } else {
    const geminiPeriod = convertToPlatformFormat(analysis.expiration * 60);
    expiration = availablePeriods.includes(geminiPeriod) ? geminiPeriod : availablePeriods[0];
  }

  return {
    value,
    expiration: settings.tradeTime > 0 ? expiration : 'dynamic',
    action: analysis.action,
    geminiExpiration: expiration
  };
};

// ================== HANDLERS PRINCIPAIS ==================
/**
 * Manipula a solicitação de captura de imagem e processamento
 * @param {object} message - Mensagem recebida
 * @returns {Promise<string>} Data URL da imagem processada
 */
async function handleCaptureRequest(request) {
    try {
        console.log('Background: Iniciando captura de tela');
        
        // Captura a tela visível
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'png',
            quality: 100
        });
        
        console.log('Background: Captura realizada, verificando formato');
        
        // Verificar se a captura retornou uma dataUrl válida
        if (!dataUrl || typeof dataUrl !== 'string') {
            console.error('Background: Captura falhou - dataUrl inválida ou vazia');
            throw new Error('Captura da tela falhou - dataUrl inválida');
        }
        
        // Verificar se a dataUrl está no formato correto
        if (!dataUrl.startsWith('data:image/')) {
            console.warn('Background: Formato de dataUrl incorreto, tentando corrigir');
            
            // Se não for necessário processamento, tenta corrigir aqui mesmo
            if (!request.requireProcessing) {
                let fixedDataUrl = dataUrl;
                
                // Tentar corrigir o formato
                if (dataUrl.includes(',')) {
                    const parts = dataUrl.split(',');
                    if (parts.length > 1) {
                        fixedDataUrl = 'data:image/png;base64,' + parts[1];
                        console.log('Background: URL corrigida');
                    }
                }
                
                // Se conseguiu corrigir, usa a versão corrigida
                if (fixedDataUrl.startsWith('data:image/')) {
                    console.log('Background: Formato corrigido com sucesso');
                    return fixedDataUrl;
                }
                
                // Se não conseguiu corrigir, continua com a URL original (pode falhar depois)
                console.warn('Background: Não foi possível corrigir a URL, continuando mesmo assim');
            }
        } else {
            console.log('Background: dataUrl em formato válido');
        }

        // Se não precisar de processamento, retorna a imagem direto
        if (!request.requireProcessing) {
            return dataUrl;
        }

        console.log('Background: Enviando para processamento no content script');
        
        // Envia para o content script processar
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.id) {
            console.error('Background: Nenhuma aba ativa encontrada');
            throw new Error('Nenhuma aba ativa encontrada para processamento');
        }
        
        // Enviar para o content script e aguardar resposta
        const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'processCapture',
                dataUrl: dataUrl,
                iframeWidth: request.iframeWidth || 0
            }, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Background: Erro ao comunicar com content script', chrome.runtime.lastError);
                    reject(new Error('Erro na comunicação com content script: ' + chrome.runtime.lastError.message));
                    return;
                }
                
                if (!result) {
                    console.error('Background: Resposta vazia do content script');
                    reject(new Error('Resposta vazia do content script'));
                    return;
                }
                
                if (result.error) {
                    console.error('Background: Erro retornado pelo content script', result.error);
                    reject(new Error(result.error));
                    return;
                }
                
                resolve(result);
            });
        });
        
        console.log('Background: Processamento concluído com sucesso');
        
        // Verificar se a resposta contém uma dataUrl válida
        if (!response.dataUrl || !response.dataUrl.startsWith('data:image/')) {
            console.error('Background: Resposta do processamento com formato inválido');
            throw new Error('Formato de imagem inválido após processamento');
        }

        return response.dataUrl;
    } catch (error) {
        console.error('Background: Erro na captura:', error);
        throw error;
    }
}

/**
 * Executa a análise após injetar o content script se necessário
 * @param {number} tabId - ID da guia ativa
 * @param {function} sendResponse - Função para enviar resposta
 * @param {object} metadata - Metadados adicionais sobre a análise
 */
const executeAnalysis = (tabId, sendResponse, metadata = {}) => {
  console.log(`Executando análise na tab ${tabId}`, metadata);
  
  // Verificar se o tabId é válido
  if (!tabId) {
    console.error('ID de tab inválido para análise');
    sendResponse({ success: false, error: "Tab ID inválido" });
    return;
  }
  
  chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
    // Verificar se houve erro na captura
    if (chrome.runtime.lastError) {
      console.error('Erro na captura:', chrome.runtime.lastError);
      sendResponse({ success: false, error: `Erro na captura: ${chrome.runtime.lastError.message}` });
      return;
    }
    
    // Enviar mensagem para o content script processar a imagem
    chrome.tabs.sendMessage(tabId, {
      action: 'PROCESS_ANALYSIS',
      imageData: dataUrl,
      metadata: metadata // Passar metadados para o script de conteúdo
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Erro na comunicação final:', chrome.runtime.lastError);
        sendResponse({ success: false, error: `Falha na comunicação final: ${chrome.runtime.lastError.message}` });
      } else {
        console.log('Análise processada com sucesso');
        sendResponse(response);
      }
    });
  });
};

// ================== AUTOMAÇÃO HANDLERS ==================
/**
 * Manipula parada automática da automação
 * @param {object} message - Mensagem com dados da parada
 */
const handleAutomationStopped = (message) => {
    const { reason, profit, target, stopLossLimit } = message;
    
    console.log(`Automação parada automaticamente: ${reason}`);
    
    // Log detalhado baseado no motivo
    switch (reason) {
        case 'daily_profit_reached':
            addLog(`Meta de lucro diária atingida! Lucro atual: ${profit}, Meta: ${target}`, 'SUCCESS');
            break;
        case 'stop_loss_triggered':
            addLog(`STOP LOSS acionado! Perda atual: ${profit}, Limite: -${stopLossLimit}`, 'ERROR');
            break;
        default:
            addLog(`Automação parada: ${reason}`, 'INFO');
    }
    
    // Notificar todas as abas sobre a parada
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.url && (tab.url.includes('pocketoption.com') || tab.url.includes('chrome-extension'))) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'AUTOMATION_STOPPED_NOTIFICATION',
                    reason: reason,
                    data: message
                }).catch(() => {
                    // Ignorar erros de comunicação com abas inativas
                });
            }
        });
    });
};

// ================== EVENT LISTENERS ==================
// Função para formatar o timestamp no padrão desejado
function formatTimestamp(date = new Date()) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `[${day}/${month}/${year}, ${hours}:${minutes}:${seconds}]`;
}

// Função para reportar erro ao StateManager
const reportSystemError = (errorMessage, errorDetails = null) => {
    console.error('ERRO DO SISTEMA (Background):', errorMessage);
    
    try {
        // Tentar notificar as abas sobre o erro
        chrome.tabs.query({}, (tabs) => {
            for (const tab of tabs) {
                if (tab.url && tab.url.includes('chrome-extension://')) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'SYSTEM_ERROR_OCCURRED',
                        error: {
                            message: errorMessage,
                            details: errorDetails,
                            timestamp: Date.now(),
                            source: 'background.js'
                        }
                    }, () => {
                        // Silenciar erros de comunicação
                        if (chrome.runtime.lastError) {
                            // Ignore
                        }
                    });
                }
            }
        });
    } catch (e) {
        console.warn('Erro ao notificar abas sobre erro do sistema:', e.message);
    }
};

// Wrapper para funções críticas do background
const safeExecuteBackground = async (fn, functionName, ...args) => {
    try {
        return await fn(...args);
    } catch (error) {
        reportSystemError(`Erro em ${functionName}: ${error.message}`, {
            function: functionName,
            args: args,
            stack: error.stack,
            module: 'background.js'
        });
        throw error;
    }
};

// Nova função para enviar logs para o sistema centralizado (via storage e broadcast)
function addLog(message, level = 'INFO', source = 'background.js') {
    try {
        const now = new Date();
        const formattedTimestamp = formatTimestamp(now);
        const logEntry = {
            message: message,
            level: level,
            source: source,
            timestampFormatted: formattedTimestamp
        };
        
        chrome.storage.local.get(['systemLogs'], function(result) {
            if (chrome.runtime.lastError) {
                console.error(`[background.js] Erro ao ler systemLogs do storage: ${chrome.runtime.lastError.message}`);
                return;
            }
            let logs = result.systemLogs || [];
            logs.push(logEntry);
            // Limitar o número de logs armazenados (ex: 1000)
            const MAX_LOGS = 1000;
            if (logs.length > MAX_LOGS) {
                logs = logs.slice(logs.length - MAX_LOGS);
            }
            chrome.storage.local.set({ systemLogs: logs }, function() {
                if (chrome.runtime.lastError) {
                    console.error(`[background.js] Erro ao salvar systemLogs no storage: ${chrome.runtime.lastError.message}`);
                }
            });
        });
        
        // Broadcast para todas as abas (logs em tempo real)
        chrome.tabs.query({}, (tabs) => {
            for (const tab of tabs) {
                // Só envie para abas que estão na página de logs da extensão
                if (tab.url && tab.url.includes('logs.html')) {
                    chrome.tabs.sendMessage(tab.id, { action: 'newLog', log: logEntry }, () => {
                        // Silenciar o erro se não houver receiver
                        if (chrome.runtime.lastError) {
                            // Apenas ignore, não faça nada
                        }
                    });
                }
            }
        });
    } catch (e) {
        console.error(`[background.js] Exceção na função addLog: ${e.message}`);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Remover o log que causa poluição no console
    // console.log('Mensagem recebida no background:', message);
    
    // Handler para LOGS - NOVO
    if (message.action === 'addLog') {
        try {
            const logMessage = message.logMessage || "Log sem mensagem";
            const logLevel = message.logLevel || message.level || "INFO";
            const logSource = message.logSource || message.source || "UNKNOWN_SOURCE";
            const now = new Date();
            const formattedTimestamp = formatTimestamp(now);
            const logEntry = {
                message: logMessage,
                level: logLevel,
                source: logSource,
                timestampFormatted: formattedTimestamp
            };
            chrome.storage.local.get(['systemLogs'], function(result) {
                if (chrome.runtime.lastError) {
                    console.error(`[background.js] Erro ao ler systemLogs do storage: ${chrome.runtime.lastError.message}`);
                    return;
                }
                let logs = result.systemLogs || [];
                logs.push(logEntry);
                // Limitar o número de logs armazenados (ex: 1000)
                const MAX_LOGS = 1000;
                if (logs.length > MAX_LOGS) {
                    logs = logs.slice(logs.length - MAX_LOGS);
                }
                chrome.storage.local.set({ systemLogs: logs }, function() {
                    if (chrome.runtime.lastError) {
                        console.error(`[background.js] Erro ao salvar systemLogs no storage: ${chrome.runtime.lastError.message}`);
                    }
                });
            });
            // Broadcast para todas as abas (logs em tempo real)
            chrome.tabs.query({}, (tabs) => {
                for (const tab of tabs) {
                    // Só envie para abas que estão na página de logs da extensão
                    if (tab.url && tab.url.includes('logs.html')) {
                        chrome.tabs.sendMessage(tab.id, { action: 'newLog', log: logEntry }, () => {
                            // Silenciar o erro se não houver receiver
                            if (chrome.runtime.lastError) {
                                // Apenas ignore, não faça nada
                            }
                        });
                    }
                }
            });
        } catch (e) {
            console.error(`[background.js] Exceção no handler addLog: ${e.message}`);
        }
        // Resposta fire-and-forget para logs, não precisa de sendResponse e retorna false.
        return false;
    }
    
    // ================== NOVOS HANDLERS BASEADOS EM EVENTOS ==================
    
    // Handler para captura baseada em eventos em vez de callback
    if (message.action === 'initiateCapture' && message.useEventResponseMode === true) {
        console.log('Background: Recebida solicitação de captura baseada em eventos');
        
        // Tratar de forma assíncrona
        handleEventBasedCapture(message);
        
        // Não manter conexão aberta, pois usaremos mensagem de resposta
        return false;
    }
    
    // Handler para análise baseada em eventos em vez de callback
    if (message.action === 'PROCESS_ANALYSIS' && message.useEventResponseMode === true) {
        console.log('Background: Recebida solicitação de análise baseada em eventos');
        
        // Tratar de forma assíncrona
        handleEventBasedAnalysis(message);
        
        // Não manter conexão aberta, pois usaremos mensagem de resposta
        return false;
    }
    
    // Handler para PROXY_STATUS_UPDATE (vindo de log-sys.js ou outras UIs auxiliares)
    if (message.action === 'PROXY_STATUS_UPDATE' && message.statusPayload) {
        try {
            const { message: statusMsg, type: statusType, duration: statusDuration } = message.statusPayload;
            // Obter todas as tabs ativas e enviar a mensagem para elas
            // Reutilizando a lógica do handler 'updateStatus'
            chrome.tabs.query({active: true}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'updateStatus', // A action que index.js espera
                            message: statusMsg,
                            type: statusType || 'info',
                            duration: statusDuration || 3000
                        }).catch(err => {
                            console.debug(`[background.js] Falha ao enviar updateStatus para tab ${tab.id} (PROXY): ${err.message}`);
                        });
                    }
                });
            });
            // Não há necessidade de sendResponse aqui, pois é um proxy.
        } catch (error) {
            console.error(`[background.js] Erro ao processar PROXY_STATUS_UPDATE: ${error.message}`);
        }
        return false; // Fire-and-forget
    }
    
    // Handler para resultado de operações de trading
    if (message.type === 'TRADE_RESULT') {
        // Enviar sinal de notificação para o popup e outras páginas
        chrome.runtime.sendMessage({
            type: 'TRADE_RESULT',
            data: message.data
        });
        
        // Criar notificação somente se origem for do content script
        // Isso evita duplicação de notificações já que só o background deve gerar notificações
        if (message.data.status === 'Closed' && sender.tab) {
            const title = message.data.success ? 'Operação bem-sucedida' : 'Operação com perda';
            const profit = message.data.success ? 
                `+${message.data.profit}` : 
                `-${message.data.amount}`;
            
            chrome.notifications.create({
                type: 'basic',
                iconUrl: '../assets/icons/icon48.png',
                title: title,
                message: `${message.data.symbol}: ${profit}`,
                priority: 1
            });
        }
        
        if (sendResponse) sendResponse({ success: true });
        return true;
    }
    
    // Handler para atualização de status - reencaminha para as tabs ativas
    if (message.action === 'updateStatus') {
        try {
            // Obter todas as tabs ativas e enviar a mensagem para elas
            chrome.tabs.query({active: true}, (tabs) => {
                tabs.forEach(tab => {
                    // Verificar se a tab ainda está ativa antes de enviar
                    if (tab.id && tab.status === 'complete') {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'updateStatus',
                            message: message.message,
                            type: message.type || 'info',
                            duration: message.duration || 3000
                        }).catch(err => {
                            // Silenciar erros de comunicação
                            console.debug('Tab não disponível para update de status');
                        });
                    }
                });
            });
            
            // Responde com sucesso imediatamente
            if (sendResponse) sendResponse({ success: true });
        } catch (error) {
            console.error('Erro ao repassar status:', error);
            if (sendResponse) sendResponse({ success: false, error: error.message });
        }
        return false; // Não manter canal aberto
    }
    
    // Handler para mostrar notificações
    if (message.action === 'showNotification') {
        try {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: '../assets/icons/icon48.png',
                title: message.title || 'Notificação',
                message: message.message || '',
                priority: 1
            });
            
            if (sendResponse) sendResponse({ success: true });
        } catch (error) {
            console.error('Erro ao criar notificação:', error);
            if (sendResponse) sendResponse({ success: false, error: error.message });
        }
        return false;
    }

    // *** NOVO: Handler para cancelamento de operação via chrome.runtime ***
    if (message.action === 'CANCEL_OPERATION_REQUEST') {
        console.log(`Background: Processando cancelamento - ${message.reason}`);
        
        try {
            // Obter configuração atual de automação
            chrome.storage.sync.get(['autoActive'], (result) => {
                const automationActive = result.autoActive || false;
                
                // Enviar comando para todas as tabs ativas cancelarem a operação
                chrome.tabs.query({active: true}, (tabs) => {
                    tabs.forEach(tab => {
                        if (tab.id && tab.status === 'complete') {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'FORCE_CANCEL_OPERATION',
                                reason: message.reason,
                                timestamp: message.timestamp
                            }).catch(err => {
                                console.debug('Tab não disponível para cancelamento');
                            });
                        }
                    });
                });
                
                // Responder imediatamente
                if (sendResponse) {
                    sendResponse({ 
                        success: true, 
                        message: 'Cancelamento processado',
                        automationActive: automationActive,
                        timestamp: Date.now()
                    });
                }
                
                console.log('Background: Cancelamento enviado para tabs ativas');
            });
        } catch (error) {
            console.error('Background: Erro ao processar cancelamento:', error);
            if (sendResponse) {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            }
        }
                return true; // Resposta assíncrona
    }

    // *** NOVO: Handler para cancelamento de operação pelo controle de payout ***
    if (message.action === 'CANCEL_CURRENT_OPERATION') {
        console.log(`Background: Recebido comando para cancelar operação: ${message.reason}`);
        addLog(`🚫 Cancelamento de operação solicitado: ${message.reason}`, 'INFO');
        
        // Notificar todas as abas sobre o cancelamento
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && (tab.url.includes('pocketoption.com') || tab.url.includes('chrome-extension'))) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'CANCEL_OPERATION_NOTIFICATION',
                        reason: message.reason,
                        source: message.source || 'system'
                    }).catch(() => {
                        // Ignorar erros de comunicação com abas inativas
                    });
                }
            });
        });
        
        if (sendResponse) {
            sendResponse({ success: true, message: 'Comando de cancelamento enviado para todas as abas' });
        }
        return true;
    }

    // *** NOVO: Handler para parada automática da automação ***
    if (message.action === 'AUTOMATION_STOPPED') {
        console.log(`Background: Processando parada automática da automação`);
        
        try {
            handleAutomationStopped(message);
            
            if (sendResponse) {
                sendResponse({ 
                    success: true, 
                    message: 'Parada automática processada',
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Background: Erro ao processar parada automática:', error);
            if (sendResponse) {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            }
        }
        return false; // Fire-and-forget
    }

    // *** NOVO: Handlers para novos módulos analisadores ***
    if (message.action === 'EMERGENCY_STOP' || message.action === 'CRITICAL_STOP' || message.action === 'TARGET_REACHED') {
        console.log(`Background: Processando ${message.action} do LimitsChecker`);
        
        // Log baseado no tipo de parada
        const logLevel = message.action === 'EMERGENCY_STOP' ? 'ERROR' : 
                        message.action === 'CRITICAL_STOP' ? 'ERROR' : 'SUCCESS';
        
        addLog(`LimitsChecker: ${message.data?.reason || 'Parada automática'}`, logLevel);
        
        // *** ESPECIAL: TARGET_REACHED - Desativar automação e resetar status ***
        if (message.action === 'TARGET_REACHED') {
            console.log('Background: Processando TARGET_REACHED - Desativando automação');
            
            // Desativar automação nas configurações
            chrome.storage.sync.get(['userConfig'], (result) => {
                if (result.userConfig) {
                    const updatedConfig = { 
                        ...result.userConfig, 
                        automation: false 
                    };
                    chrome.storage.sync.set({ userConfig: updatedConfig }, () => {
                        addLog('🔴 Automação desativada automaticamente após meta atingida', 'SUCCESS');
                        console.log('Background: Automação desativada com sucesso após TARGET_REACHED');
                    });
                }
            });
            
            // Log específico para meta atingida
            const currentProfit = message.data?.currentProfit || 'N/A';
            const targetProfit = message.data?.targetProfit || 'N/A';
            addLog(`🎯 META ATINGIDA: Lucro atual ${currentProfit} atingiu/superou meta de ${targetProfit} - Sistema encerrado automaticamente`, 'SUCCESS');
        }
        
        // Notificar todas as abas sobre a parada crítica
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && tab.url.includes('pocketoption.com')) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'LIMITS_VIOLATION',
                        type: message.action,
                        data: message.data
                    }).catch(() => {
                        // Ignorar erros de comunicação
                    });
                }
            });
        });
        
        if (sendResponse) {
            sendResponse({ success: true, processed: true });
        }
        
        return true;
    }

    // *** NOVO: Handler para estatísticas de cache ***
    if (message.action === 'CACHE_STATS_REQUEST') {
        // Este será processado pelo content script que tem acesso ao cacheAnalyzer
        if (sendResponse) {
            sendResponse({ success: true, forwarded: true });
        }
        return true;
    }

    // *** NOVO: Handler para análise local ***
    if (message.action === 'LOCAL_ANALYSIS_RESULT') {
        console.log(`Background: Resultado de análise local: ${message.data?.confidence}% confiança`);
        addLog(`Análise Local: ${message.data?.recommendation?.reason || 'Processada'}`, 'INFO');
        
        if (sendResponse) {
            sendResponse({ success: true, logged: true });
        }
        return true;
    }

    // *** REMOVIDO: Handler ANALYZE_VOLATILITY (agora usa análise real do gráfico) ***

    // *** NOVO: Handler para eventos do Intelligent Gale ***
    if (message.action === 'INTELLIGENT_GALE_EVENT') {
        const { event, data } = message;
        console.log(`Background: Evento do Intelligent Gale: ${event}`);
        
        // Log baseado no evento
        switch (event) {
            case 'gale_applied':
                addLog(`🧠 Gale Inteligente aplicado - Nível: ${data.level}, Valor: ${data.value}, Risco: ${data.riskLevel}`, 'SUCCESS');
                break;
            case 'gale_stopped':
                addLog(`🛑 Gale Inteligente parado - Motivo: ${data.reason}`, 'WARN');
                break;
            case 'gale_reset':
                addLog(`🔄 Gale Inteligente resetado - Motivo: ${data.reason}`, 'INFO');
                break;
            default:
                addLog(`Gale Inteligente - ${event}`, 'INFO');
        }
        
        // Notificar abas se necessário
        if (event === 'gale_stopped' || event === 'gale_applied') {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.url && tab.url.includes('pocketoption.com')) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'INTELLIGENT_GALE_NOTIFICATION',
                            event: event,
                            data: data
                        }).catch(() => {
                            // Ignorar erros de comunicação
                        });
                    }
                });
            });
        }
        
        if (sendResponse) {
            sendResponse({ success: true, processed: true });
        }
        return true;
    }

    // *** NOVO: Handler para iniciar operação via chrome.runtime ***
    if (message.action === 'START_OPERATION_REQUEST') {
        console.log(`Background: Processando início de operação`);
        
        try {
            // Obter configuração atual de automação
            chrome.storage.sync.get(['userConfig'], (result) => {
                const config = result.userConfig || {};
                const automationActive = config.automation || false;
                
                if (automationActive) {
                    // Enviar comando para todas as tabs ativas iniciarem operação
                    chrome.tabs.query({active: true}, (tabs) => {
                        tabs.forEach(tab => {
                            if (tab.id && tab.status === 'complete') {
                                chrome.tabs.sendMessage(tab.id, {
                                    action: 'FORCE_START_OPERATION',
                                    timestamp: message.timestamp
                                }).catch(err => {
                                    console.debug('Tab não disponível para início de operação');
                                });
                            }
                        });
                    });
                    
                    // Responder imediatamente
                    if (sendResponse) {
                        sendResponse({ 
                            success: true, 
                            message: 'Operação iniciada com sucesso',
                            automationActive: automationActive,
                            timestamp: Date.now()
                        });
                    }
                    
                    console.log('Background: Início de operação enviado para tabs ativas');
                } else {
                    // Automação não está ativa
                    if (sendResponse) {
                        sendResponse({ 
                            success: false, 
                            error: 'A automação está desativada. Ative-a nas configurações.'
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Background: Erro ao processar início de operação:', error);
            if (sendResponse) {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            }
        }
        return true; // Resposta assíncrona
    }

    // Handler para captura de imagem (modo tradicional com callback)
    if (message.action === 'initiateCapture' && !message.useEventResponseMode && !isProcessing) {
        isProcessing = true; // Marcar como processando para evitar chamadas paralelas
        
        // Definir um timeout para garantir que alguma resposta seja enviada
        const timeout = setTimeout(() => {
            isProcessing = false;
            sendResponse({ error: "Timeout ao capturar imagem" });
        }, 30000); // 30 segundos de timeout
        
        handleCaptureRequest(message)
            .then(dataUrl => {
                clearTimeout(timeout); // Limpar o timeout
                isProcessing = false;
                
                // Retornar a URL da imagem, sem tentar mostrar a imagem
                sendResponse({ dataUrl });
            })
            .catch(error => {
                clearTimeout(timeout); // Limpar o timeout
                isProcessing = false;
                sendResponse({ error: error.message });
            });
        return true;
    }
    
    // Handler para mostrar uma imagem em uma janela popup
    if (message.action === 'showImagePopup' && message.dataUrl) {
        try {
            console.log('Background: Recebida solicitação para mostrar imagem em popup');
            
            // Verificar se a dataUrl é válida
            if (!message.dataUrl.startsWith('data:image/')) {
                console.error('Background: URL de imagem inválida', message.dataUrl.substring(0, 30) + '...');
                sendResponse({ success: false, error: 'URL de imagem inválida' });
                return true;
            }
            
            console.log('Background: Criando janela popup para exibir a imagem');
            
            // Abrir uma janela popup nativa do Chrome com a imagem
            chrome.windows.create({
                url: message.dataUrl,
                type: 'popup',
                width: 800,
                height: 600
            }, window => {
                if (chrome.runtime.lastError) {
                    console.error('Background: Erro ao criar janela popup:', chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }
                
                console.log('Background: Janela popup criada com sucesso, ID:', window.id);
                
                // Armazenar o ID da janela para referência futura se necessário
                sendResponse({ success: true, windowId: window.id });
            });
        } catch (error) {
            console.error('Background: Erro ao criar janela popup:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // manter canal aberto para resposta assíncrona
    }

  // Handler para início de análise (modo tradicional com callback)
  if (message.action === 'START_ANALYSIS' || (message.action === 'PROCESS_ANALYSIS' && !message.useEventResponseMode)) {
    // Log para rastreamento
    console.log('Solicitação de análise recebida:', message);
    
    // Definir um timeout para garantir que alguma resposta seja enviada
    const timeout = setTimeout(() => {
        console.warn('Timeout na solicitação de análise');
        sendResponse({ success: false, error: "Timeout na análise" });
    }, 30000); // 30 segundos de timeout
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        clearTimeout(timeout);
        console.error('Nenhuma guia ativa encontrada para análise');
        sendResponse({ success: false, error: "Nenhuma guia ativa encontrada" });
        return;
      }

      // Verificar se é uma solicitação do sistema de gale e adicionar dados extras
      const isFromGale = message.source === 'gale-system';
      console.log(`Iniciando análise ${isFromGale ? 'do sistema de gale' : 'padrão'}`);
      
      // Criar objeto de metadados
      const metadata = {
        source: message.source || 'user',
        trigger: message.trigger || 'manual',
        timestamp: Date.now()
      };
      
      // Verificar se o content script está disponível
      chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }, (pingResponse) => {
        // Se houver erro no ping, content script não está disponível
        if (chrome.runtime.lastError) {
          console.log('Content script não disponível, injetando...');
          
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['scripts/content.js']
          }, () => {
            // Verificar erro na injeção
            if (chrome.runtime.lastError) {
              clearTimeout(timeout);
              console.error('Erro ao injetar content script:', chrome.runtime.lastError);
              sendResponse({ 
                success: false, 
                error: `Erro ao injetar script: ${chrome.runtime.lastError.message}` 
              });
              return;
            }
            
            // Aguardar um momento para garantir que o script foi carregado
            setTimeout(() => {
              console.log('Content script injetado, executando análise');
              executeAnalysis(tabs[0].id, (result) => {
                clearTimeout(timeout);
                console.log('Resultado da análise:', result);
                sendResponse(result);
              }, metadata);
            }, 500);
          });
        } else {
          // Content script já disponível, executar análise diretamente
          console.log('Content script disponível, executando análise');
          executeAnalysis(tabs[0].id, (result) => {
            clearTimeout(timeout);
            console.log('Resultado da análise:', result);
            sendResponse(result);
          }, metadata);
        }
      });
    });
    return true; // Manter canal aberto para resposta assíncrona
  }

  // Handler para trocar para melhor ativo (roteamento para content.js)
  if (message.action === 'TEST_SWITCH_TO_BEST_ASSET') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        console.error('Nenhuma guia ativa encontrada para troca de ativo');
        sendResponse({ success: false, error: "Nenhuma guia ativa encontrada" });
        return;
      }
      
      console.log('Solicitação de TEST_SWITCH_TO_BEST_ASSET recebida no background, roteando para content.js');
      console.log('Parâmetros:', { minPayout: message.minPayout, category: message.category });
      
      // Verificar se o content script está disponível
      chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }, (pingResponse) => {
        if (chrome.runtime.lastError) {
          console.log('Content script não disponível para troca de ativo, injetando...');
          
          // Injetar content script se necessário
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['src/content/content.js']
          }, (injectionResults) => {
            const injectError = chrome.runtime.lastError;
            if (injectError) {
              console.error('Erro ao injetar script para troca de ativo:', injectError.message);
              sendResponse({ success: false, error: injectError.message });
              return;
            }
            
            // Aguardar script carregar e enviar mensagem
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'TEST_SWITCH_TO_BEST_ASSET',
                minPayout: message.minPayout,
                category: message.category
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Erro na mensagem para o content script (troca de ativo):', chrome.runtime.lastError);
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                  return;
                }
                
                console.log('Resposta da troca de ativo recebida:', response);
                sendResponse(response || { success: false, error: 'Sem resposta do content script' });
              });
            }, 300);
          });
        } else {
          console.log('Content script disponível para troca de ativo, enviando mensagem');
          
          // Enviar mensagem diretamente
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'TEST_SWITCH_TO_BEST_ASSET',
            minPayout: message.minPayout,
            category: message.category
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Erro na mensagem para o content script (troca de ativo):', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            
            console.log('Resposta da troca de ativo recebida:', response);
            sendResponse(response || { success: false, error: 'Sem resposta do content script' });
          });
        }
      });
    });
    return true; // Manter canal aberto para resposta assíncrona
  }

  // Handler para obter payout atual da plataforma (roteamento para content.js)
  if (message.action === 'GET_CURRENT_PAYOUT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        console.error('Nenhuma guia ativa encontrada para verificar payout');
        sendResponse({ success: false, error: "Nenhuma guia ativa encontrada" });
        return;
      }
      
      console.log('Solicitação de GET_CURRENT_PAYOUT recebida no background, roteando para content.js');
      
      // Verificar se o content script está disponível
      chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }, (pingResponse) => {
        if (chrome.runtime.lastError) {
          console.log('Content script não disponível para payout, injetando...');
          
          // Injetar content script se necessário
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['src/content/content.js']
          }, (injectionResults) => {
            const injectError = chrome.runtime.lastError;
            if (injectError) {
              console.error('Erro ao injetar script para payout:', injectError.message);
              sendResponse({ success: false, error: injectError.message });
              return;
            }
            
            // Aguardar script carregar e enviar mensagem
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'GET_CURRENT_PAYOUT'
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Erro na mensagem para o content script (payout):', chrome.runtime.lastError);
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                  return;
                }
                
                console.log('Resposta do payout recebida:', response);
                sendResponse(response || { success: false, error: 'Sem resposta do content script' });
              });
            }, 300);
          });
        } else {
          console.log('Content script disponível para payout, enviando mensagem');
          
          // Enviar mensagem diretamente
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'GET_CURRENT_PAYOUT'
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Erro na mensagem para o content script (payout):', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            
            console.log('Resposta do payout recebida:', response);
            sendResponse(response || { success: false, error: 'Sem resposta do content script' });
          });
        }
      });
    });
    return true; // Manter canal aberto para resposta assíncrona
  }

  // Handler para executar ação de compra/venda na plataforma
  if (message.action === 'EXECUTE_TRADE_ACTION') {    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        console.error('Nenhuma guia ativa encontrada');
        sendResponse({ success: false, error: "Nenhuma guia ativa encontrada" });
        return;
      }
      
      // Verificar se a operação vem do modal para evitar duplicação
      const isFromModal = message.tradeData && message.tradeData.isFromModal === true;
      
      // Registro detalhado para depuração
      console.log('Solicitação de EXECUTE_TRADE_ACTION recebida no background:', {
        action: message.tradeAction,
        isFromModal: isFromModal,
        tradeValue: message.tradeData?.tradeValue,
        tradeTime: message.tradeData?.tradeTime,
        source: message.source || 'desconhecido'
      });
      
      // Tentar injetar o script diretamente, sem verificar se já está injetado
      const executeScript = () => {
        try {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['src/content/content.js']
          }, (injectionResults) => {
            const injectError = chrome.runtime.lastError;
            if (injectError) {
              console.error('Erro ao injetar script:', injectError.message);
              
              // Tentar caminhos alternativos em caso de falha
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content.js']
              }, (altResults) => {
                const altError = chrome.runtime.lastError;
                if (altError) {
                  console.error('Erro ao injetar script alternativo:', altError.message);
                  // Mesmo com erro, tentamos enviar a mensagem como último recurso
                  setTimeout(() => sendTradeMessage(), 100);
                } else {
                  // Espera 300ms para garantir que o script seja carregado completamente
                  setTimeout(() => sendTradeMessage(), 300);
                }
              });
            } else {
              // Espera 300ms para garantir que o script seja carregado completamente
              setTimeout(() => sendTradeMessage(), 300);
            }
          });
        } catch (error) {
          console.error('Exceção ao injetar script:', error.message);
          // Ainda tentar enviar a mensagem como último recurso
          setTimeout(() => sendTradeMessage(), 100);
        }
      };
      
      // Função para enviar a mensagem de execução de trade
      const sendTradeMessage = () => {
        try {
          // Assegurar que os dados da operação são enviados corretamente
          const tradeData = message.tradeData || {};
          
          // Garantir que a origem da solicitação seja preservada
          tradeData.isFromModal = isFromModal;
          
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'EXECUTE_TRADE_ACTION',
            tradeAction: message.tradeAction,
            tradeData: tradeData,
            source: message.source || 'user'
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Erro na mensagem para o content script:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            
            console.log('Resposta da execução de trade:', response);
            sendResponse(response || { success: true });
          });
        } catch (error) {
          console.error('Exceção ao enviar mensagem de trade:', error.message);
          sendResponse({ success: false, error: error.message });
        }
      };
      
      // Verificar se o content script está disponível
      chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }, (pingResponse) => {
        if (chrome.runtime.lastError) {
          console.log('Content script não disponível para trade, injetando...');
          executeScript();
        } else {
          console.log('Content script disponível para trade, enviando mensagem');
          sendTradeMessage();
        }
      });
    });
    return true; // Manter canal aberto para resposta assíncrona
  }

  // Handler para copiar texto para a área de transferência
  if (message.action === 'copyTextToClipboard') {
    console.log('Background: Solicitação para copiar texto recebida');
    
    try {
        // Verificar se o texto está presente
        if (!message.text) {
            sendResponse({ success: false, error: 'Nenhum texto fornecido para cópia' });
            return true;
        }
        
        // Obter a guia ativa
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) {
                sendResponse({ success: false, error: 'Nenhuma guia ativa encontrada' });
                return;
            }
            
            // Injetar script para copiar texto
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: (text) => {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    
                    let success = false;
                    try {
                        success = document.execCommand('copy');
                    } catch (err) {
                        console.error('Erro ao executar comando de cópia:', err);
                    }
                    
                    document.body.removeChild(textArea);
                    return success;
                },
                args: [message.text]
            }, (results) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ 
                        success: false, 
                        error: chrome.runtime.lastError.message
                    });
                    return;
                }
                
                const success = results && results[0] && results[0].result === true;
                sendResponse({ 
                    success: success,
                    error: success ? null : 'Falha no comando de cópia'
                });
            });
        });
        
        return true; // Manter canal aberto para resposta assíncrona
    } catch (error) {
        console.error('Background: Erro ao copiar para área de transferência:', error);
        sendResponse({ 
            success: false, 
            error: error.message || 'Erro desconhecido ao copiar para área de transferência'
        });
        return true;
    }
  }

  // ================== HANDLERS PARA TESTE DE ATIVOS ==================
  
  // Handler para testes de manipulação de ativos e operações de modal
  if (message.action && (message.action.startsWith('TEST_') || message.action === 'CLOSE_ASSET_MODAL' || message.action === 'GET_CURRENT_ASSET')) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        console.error('Nenhuma guia ativa encontrada para teste de ativos');
        sendResponse({ success: false, error: "Nenhuma guia ativa encontrada" });
        return;
      }
      
      console.log(`Roteando operação de ativo: ${message.action}`);
      
      // Verificar se o content script está disponível
      chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }, (pingResponse) => {
        if (chrome.runtime.lastError) {
          console.log('Content script não disponível para teste de ativos, injetando...');
          
          // Injetar content script se necessário
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['src/content/content.js']
          }, (injectionResults) => {
            const injectError = chrome.runtime.lastError;
            if (injectError) {
              console.error('Erro ao injetar script para teste de ativos:', injectError.message);
              sendResponse({ success: false, error: injectError.message });
              return;
            }
            
            // Aguardar script carregar e enviar mensagem
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Erro na mensagem para o content script (teste ativos):', chrome.runtime.lastError);
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                  return;
                }
                
                console.log('Resposta do teste de ativos recebida:', response);
                sendResponse(response || { success: false, error: 'Sem resposta do content script' });
              });
            }, 300);
          });
        } else {
          console.log('Content script disponível para teste de ativos, enviando mensagem');
          
          // Enviar mensagem diretamente
          chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Erro na mensagem para o content script (teste ativos):', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            
            console.log('Resposta do teste de ativos recebida:', response);
            sendResponse(response || { success: false, error: 'Sem resposta do content script' });
          });
        }
      });
    });
    return true; // Manter canal aberto para resposta assíncrona
  }

  // Retornamos true apenas para os handlers que realmente usam resposta assíncrona
  return false;
});

// ================== NOVOS HANDLERS PARA COMUNICAÇÃO BASEADA EM EVENTOS ==================

/**
 * Manipula a solicitação de captura baseada em eventos em vez de callback
 * @param {object} message - Mensagem recebida
 */
async function handleEventBasedCapture(message) {
    try {
        console.log('Background: Iniciando captura baseada em eventos');
        
        // Extrair informações importantes
        const { requestId, actionType } = message;
        
        try {
            // Utilizar a função existente para captura
            const dataUrl = await handleCaptureRequest(message);
            
            // Enviar resposta como uma nova mensagem
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'captureResponse',
                        requestId: requestId,
                        dataUrl: dataUrl,
                        success: true
                    });
                    console.log('Background: Resposta de captura enviada via evento');
                } else {
                    console.error('Background: Não foi possível encontrar a aba ativa para enviar resposta');
                }
            });
        } catch (error) {
            console.error('Background: Erro ao processar captura baseada em eventos', error);
            
            // Enviar erro como resposta
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'captureResponse',
                        requestId: requestId,
                        error: error.message,
                        success: false
                    });
                }
            });
        }
    } catch (error) {
        console.error('Background: Erro crítico na captura baseada em eventos', error);
    }
}

/**
 * Manipula a solicitação de análise baseada em eventos em vez de callback
 * @param {object} message - Mensagem recebida
 */
async function handleEventBasedAnalysis(message) {
    try {
        console.log('Background: Iniciando análise baseada em eventos');
        
        // Extrair informações importantes
        const { requestId, imageData, settings } = message;
        
        try {
            // Obter a aba ativa
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.id) {
                throw new Error('Nenhuma guia ativa encontrada para análise');
            }
            
            // Enviar solicitação de análise para o content script
            chrome.tabs.sendMessage(tab.id, {
                action: 'PROCESS_ANALYSIS',
                imageData: imageData,
                metadata: settings || {}
            }, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Background: Erro na comunicação com content script', chrome.runtime.lastError);
                    
                    // Enviar erro como resposta
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'analysisResponse',
                        requestId: requestId,
                        error: chrome.runtime.lastError.message,
                        success: false
                    });
                    return;
                }
                
                // Enviar resposta como uma nova mensagem
                chrome.tabs.sendMessage(tab.id, {
                    action: 'analysisResponse',
                    requestId: requestId,
                    result: result,
                    success: true
                });
                console.log('Background: Resposta de análise enviada via evento');
            });
        } catch (error) {
            console.error('Background: Erro ao processar análise baseada em eventos', error);
            
            // Enviar erro como resposta
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'analysisResponse',
                        requestId: requestId,
                        error: error.message,
                        success: false
                    });
                }
            });
        }
    } catch (error) {
        console.error('Background: Erro crítico na análise baseada em eventos', error);
    }
} 