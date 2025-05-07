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

// ================== EVENT LISTENERS ==================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Remover o log que causa poluição no console
    // console.log('Mensagem recebida no background:', message);
    
    // Handler para LOGS - NOVO
    if (message.action === 'addLog') {
        try {
            const logMessage = message.logMessage || "Log sem mensagem";
            const logLevel = message.level || "INFO";
            const logSource = message.source || "UNKNOWN_SOURCE";
            const newLogEntry = {
                timestamp: new Date().toISOString(),
                level: logLevel,
                source: logSource,
                message: logMessage
            };

            chrome.storage.local.get(['systemLogs'], function(result) {
                if (chrome.runtime.lastError) {
                    console.error(`[background.js] Erro ao ler systemLogs do storage: ${chrome.runtime.lastError.message}`);
                    return;
                }
                let logs = result.systemLogs || [];
                logs.push(newLogEntry);

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
        } catch (e) {
            console.error(`[background.js] Exceção no handler addLog: ${e.message}`);
        }
        // Resposta fire-and-forget para logs, não precisa de sendResponse e retorna false.
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

  // Handler para copiar texto para a área de transferência
  if (message.action === 'copyTextToClipboard') {
    try {
      // Obter a aba ativa para injetar o script de cópia
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || !tabs[0] || !tabs[0].id) {
          sendResponse({success: false, error: "Nenhuma aba ativa encontrada"});
          return;
        }
        
        // Injetar script para copiar o texto na aba atual
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: function(textToCopy) {
            function copyToClipboard(text) {
              try {
                // Método 1: função de cópia via navigator.clipboard
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(text).then(function() {
                    // Criar um elemento para mostrar feedback
                    var notification = document.createElement('div');
                    notification.textContent = 'Logs copiados com sucesso!';
                    notification.style.cssText = 'position:fixed;top:10px;right:10px;background:#4CAF50;color:white;padding:10px;border-radius:4px;z-index:9999';
                    document.body.appendChild(notification);
                    
                    // Remover após 3 segundos
                    setTimeout(function() {
                      if (notification.parentNode) document.body.removeChild(notification);
                    }, 3000);
                    
                    return true;
                  }).catch(function(err) {
                    // Método 2: fallback para execCommand
                    return fallbackCopy(text);
                  });
                } else {
                  // Método 2: fallback para execCommand
                  return fallbackCopy(text);
                }
              } catch (e) {
                // Método 2: fallback para execCommand
                return fallbackCopy(text);
              }
              
              return false;
            }
            
            function fallbackCopy(text) {
              try {
                var textArea = document.createElement('textarea');
                textArea.value = text;
                
                // Tornar invisível mas ainda presente no DOM
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                textArea.style.top = '0';
                
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                var success = false;
                try {
                  success = document.execCommand('copy');
                } catch (err) {
                  success = false;
                }
                
                // Feedback visual
                if (success) {
                  var notification = document.createElement('div');
                  notification.textContent = 'Logs copiados com sucesso!';
                  notification.style.cssText = 'position:fixed;top:10px;right:10px;background:#4CAF50;color:white;padding:10px;border-radius:4px;z-index:9999';
                  document.body.appendChild(notification);
                  
                  // Remover após 3 segundos
                  setTimeout(function() {
                    if (notification.parentNode) document.body.removeChild(notification);
                  }, 3000);
                }
                
                document.body.removeChild(textArea);
                return success;
              } catch (err) {
                return false;
              }
            }
            
            return copyToClipboard(textToCopy);
          },
          args: [message.text]
        }, function(results) {
          if (chrome.runtime.lastError) {
            sendResponse({success: false, error: chrome.runtime.lastError.message});
          } else {
            sendResponse({success: true, results: results});
          }
        });
      });
    } catch (err) {
      sendResponse({success: false, error: err.message});
    }
    return true; // Manter canal aberto
  }
}); 