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
        // Captura a tela visível
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'png',
            quality: 100
        });

        // Se não precisar de processamento, retorna a imagem
        if (!request.requireProcessing) {
            return dataUrl;
        }

        // Envia para o content script processar
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'processCapture',
            dataUrl: dataUrl,
            iframeWidth: request.iframeWidth
        });

        if (response.error) {
            throw new Error(response.error);
        }

        return response.dataUrl;
    } catch (error) {
        console.error('Erro na captura:', error);
        throw error;
    }
}

/**
 * Executa a análise após injetar o content script se necessário
 * @param {number} tabId - ID da guia ativa
 * @param {function} sendResponse - Função para enviar resposta
 */
const executeAnalysis = (tabId, sendResponse) => {
  chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'PROCESS_ANALYSIS',
      imageData: dataUrl
    }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: "Falha na comunicação final" });
      } else {
        sendResponse(response);
      }
    });
  });
};

// ================== EVENT LISTENERS ==================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Remover o log que causa poluição no console
    // console.log('Mensagem recebida no background:', message);
    
    // Handler para resultado de operações de trading
    if (message.type === 'TRADE_RESULT') {
        console.log('Resultado de operação recebido:', message.data);
        
        // Repassar a mensagem para a interface de popup
        chrome.runtime.sendMessage(message);
        
        // Se a operação foi concluída, mostrar notificação
        if (message.data.status === 'Closed') {
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
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'updateStatus',
                        message: message.message,
                        type: message.type || 'info',
                        duration: message.duration || 3000
                    }).catch(err => {
                        // Silenciar erros de comunicação
                        console.debug('Tab não disponível para update de status');
                    });
                });
            });
            
            // Responde com sucesso
            if (sendResponse) sendResponse({ success: true });
        } catch (error) {
            console.error('Erro ao repassar status:', error);
            if (sendResponse) sendResponse({ success: false, error: error.message });
        }
        return true; // Manter canal aberto
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
    
    // Handler para captura de imagem
    if (message.action === 'initiateCapture' && !isProcessing) {
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
                
                // Só abre a janela se for uma captura normal (não análise)
                if (message.actionType !== 'analyze') {
                    chrome.windows.create({
                        url: dataUrl,
                        type: 'popup',
                        width: 800,
                        height: 600
                    });
                }
                sendResponse({ dataUrl });
            })
            .catch(error => {
                clearTimeout(timeout); // Limpar o timeout
                isProcessing = false;
                sendResponse({ error: error.message });
            });
        return true;
    }

  // Handler para início de análise
  if (message.action === 'START_ANALYSIS') {
    // Definir um timeout para garantir que alguma resposta seja enviada
    const timeout = setTimeout(() => {
        sendResponse({ success: false, error: "Timeout na análise" });
    }, 30000); // 30 segundos de timeout
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        clearTimeout(timeout);
        sendResponse({ success: false, error: "Nenhuma guia ativa encontrada" });
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['scripts/content.js']
          }, () => {
            executeAnalysis(tabs[0].id, (result) => {
                clearTimeout(timeout);
                sendResponse(result);
            });
          });
        } else {
          executeAnalysis(tabs[0].id, (result) => {
            clearTimeout(timeout);
            sendResponse(result);
          });
        }
      });
    });
    return true;
  }

  // Handler para executar ação de compra/venda na plataforma
  if (message.action === 'EXECUTE_TRADE_ACTION') {    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        console.error('Nenhuma guia ativa encontrada');
        sendResponse({ success: false, error: "Nenhuma guia ativa encontrada" });
        return;
      }
      
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
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'EXECUTE_TRADE_ACTION',
            tradeAction: message.tradeAction
          }, (response) => {            
            const sendError = chrome.runtime.lastError;
            if (sendError) {
              console.error('Erro ao enviar mensagem para content script:', sendError.message);
              sendResponse({ 
                success: false, 
                error: `Comunicação com a página falhou: ${sendError.message}` 
              });
            } else if (!response) {
              console.error('Sem resposta do content script');
              sendResponse({ 
                success: false, 
                error: 'Content script não respondeu ao comando' 
              });
            } else {
              sendResponse(response);
            }
          });
        } catch (sendError) {
          console.error('Exceção ao enviar mensagem:', sendError.message);
          sendResponse({ 
            success: false, 
            error: `Falha ao comunicar com a página: ${sendError.message}` 
          });
        }
      };
      
      // Primeiro tentamos enviar mensagem diretamente para ver se o script já está injetado
      chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }, (pingResponse) => {
        if (chrome.runtime.lastError) {
          executeScript();
        } else {
          sendTradeMessage();
        }
      });
    });
    
    // Importante: manter canal aberto para resposta assíncrona
    return true;
  }

  // Novo handler para obtenção de períodos
  if (message.action === 'GET_TRADE_PARAMS') {
    // Definir um timeout para garantir que alguma resposta seja enviada
    const timeout = setTimeout(() => {
      sendResponse({ 
        success: false, 
        error: "Timeout ao obter parâmetros de trade" 
      });
    }, 10000);
    
    try {
      chrome.storage.sync.get(['tradeValue', 'tradeTime', 'galeEnabled'], (settings) => {
        if (chrome.runtime.lastError) {
          clearTimeout(timeout);
          sendResponse({ 
            success: false, 
            error: `Erro ao obter configurações: ${chrome.runtime.lastError.message}` 
          });
          return;
        }
        
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (!tabs || !tabs[0] || !tabs[0].id) {
            clearTimeout(timeout);
            sendResponse({ 
              success: false, 
              error: "Nenhuma guia ativa encontrada" 
            });
            return;
          }
          
          try {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'FETCH_AVAILABLE_PERIODS'
            }, (response) => {
              clearTimeout(timeout);
              
              if (chrome.runtime.lastError) {
                sendResponse({ 
                  success: false, 
                  error: `Erro na comunicação: ${chrome.runtime.lastError.message}`
                });
                return;
              }
              
              try {
                const params = getTradeParameters(
                  settings,
                  message.analysis || {},
                  response?.periods || []
                );
                sendResponse({ 
                  success: true, 
                  params: params 
                });
              } catch (parseError) {
                sendResponse({ 
                  success: false, 
                  error: `Erro ao processar parâmetros: ${parseError.message}`
                });
              }
            });
          } catch (sendError) {
            clearTimeout(timeout);
            sendResponse({ 
              success: false, 
              error: `Erro ao enviar mensagem: ${sendError.message}`
            });
          }
        });
      });
    } catch (error) {
      clearTimeout(timeout);
      sendResponse({ 
        success: false, 
        error: `Erro inesperado: ${error.message}`
      });
    }
    
    return true;
  }

  if (message.action === 'FETCH_AVAILABLE_PERIODS') {
    // Definir um timeout para garantir que alguma resposta seja enviada
    const timeout = setTimeout(() => {
      sendResponse({ 
        success: false, 
        error: "Timeout ao buscar períodos disponíveis" 
      });
    }, 10000);
    
    try {
      if (!sender || !sender.tab || !sender.tab.id) {
        clearTimeout(timeout);
        sendResponse({ 
          success: false, 
          error: "Informações da guia de origem não disponíveis" 
        });
        return true;
      }
      
      chrome.tabs.sendMessage(sender.tab.id, message, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          sendResponse({ 
            success: false, 
            error: `Erro na comunicação: ${chrome.runtime.lastError.message}` 
          });
          return;
        }
        
        sendResponse(response || { success: false, error: "Sem resposta da guia" });
      });
    } catch (error) {
      clearTimeout(timeout);
      sendResponse({ 
        success: false, 
        error: `Erro inesperado: ${error.message}` 
      });
      return true;
    }
    
    return true;
  }

  // Handler para logs
  if (message.action === 'ADD_LOG' || message.action === 'logMessage') {
    try {
      // Obter informações do log
      const logMessage = message.log || message.message || "Log sem mensagem";
      const logLevel = message.level || "INFO";
      const logSource = message.source || "system";
      
      // Registrar apenas erros no console do background
      if (logLevel === 'ERROR') {
        console.error(`[BACKGROUND LOG] [${logLevel}][${logSource}] ${logMessage}`);
      }
      
      // Armazenar no storage local diretamente
      chrome.storage.local.get(['systemLogs'], function(result) {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || 'Erro desconhecido no acesso ao storage';
          console.error(`[BACKGROUND] Erro ao acessar logs armazenados: ${errorMsg}`);
          return;
        }
        
        const logs = result.systemLogs || [];
        
        // Verificar se este log é muito similar a outro log recente (dentro de 5 segundos)
        const now = new Date().getTime();
        const isDuplicate = logs.some(log => {
          return log.message === logMessage && 
                 log.level === logLevel && 
                 log.source === logSource &&
                 (now - log.timestamp) < 5000; // 5 segundos
        });
        
        // Só adiciona se não for um log duplicado muito recente
        if (!isDuplicate) {
          // Adicionar novo log
          logs.push({
            message: logMessage,
            level: logLevel,
            source: logSource,
            date: new Date().toISOString(),
            timestamp: now
          });
          
          // Limitar a quantidade de logs armazenados (manter os 500 mais recentes)
          if (logs.length > 500) {
            logs.splice(0, logs.length - 500);
          }
          
          // Salvar logs atualizados
          chrome.storage.local.set({ systemLogs: logs }, function() {
            if (chrome.runtime.lastError) {
              const errorMsg = chrome.runtime.lastError.message || 'Erro desconhecido ao salvar logs';
              console.error(`[BACKGROUND] Erro ao salvar logs: ${errorMsg}`);
            }
          });
        }
      });
      
      // Responder imediatamente para evitar erros de promessa não resolvida
      sendResponse({ success: true });
    } catch (error) {
      const errorMsg = error.message || error.toString() || 'Erro desconhecido';
      console.error(`[BACKGROUND] Erro ao processar log: ${errorMsg}`);
      // Em caso de erro, ainda responder para não deixar a promessa pendente
      sendResponse({ success: false, error: errorMsg });
    }
    
    // Não manter o canal aberto para resposta assíncrona
    return false;
  }

  if (message.action === 'TEST_CONNECTION') {
    // Definir um timeout para garantir que alguma resposta seja enviada
    const timeout = setTimeout(() => {
      sendResponse({ 
        success: false, 
        error: "Timeout ao testar conexão" 
      });
    }, 10000);
    
    try {
      if (!sender || !sender.tab || !sender.tab.id) {
        clearTimeout(timeout);
        sendResponse({ 
          success: false, 
          error: "Informações da guia de origem não disponíveis" 
        });
        return true;
      }
      
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'TEST_CONNECTION'
      }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          sendResponse({ 
            success: false, 
            connected: false,
            error: `Erro na comunicação: ${chrome.runtime.lastError.message}` 
          });
          return;
        }
        
        sendResponse(response || { 
          success: false, 
          connected: false,
          error: "Sem resposta da guia" 
        });
      });
    } catch (error) {
      clearTimeout(timeout);
      sendResponse({ 
        success: false, 
        connected: false,
        error: `Erro inesperado: ${error.message}` 
      });
      return true;
    }
    
    return true;
  }

  // Buscar configurações de usuário para operações
  if (message.action === 'GET_USER_CONFIG') {
    chrome.storage.sync.get(['userConfig'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Erro ao buscar configurações:', chrome.runtime.lastError);
        sendResponse(null);
        return;
      }
      
      const userConfig = result.userConfig || {};
      
      // Extrair apenas os campos relevantes para operações
      const operationConfig = {
        tradeValue: userConfig.value || 10,
        tradeTime: userConfig.period || 1,
        galeEnabled: userConfig.gale?.active || false,
        galeLevel: userConfig.gale?.level || '1x'
      };
      
      sendResponse(operationConfig);
    });
    
    // Manter canal aberto para resposta assíncrona
    return true;
  }
}); 