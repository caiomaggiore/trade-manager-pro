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
                iframeWidth: request.iframeWidth || 0,
                canvasCrop: request.canvasCrop || null // Informações do canvas para crop
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

// ================== GERENCIADOR DE ESTADO SEGURO ==================
/**
 * Manipula solicitações de estado (`getState`, `saveState`) de forma segura,
 * garantindo que `sendResponse` seja sempre chamado para evitar erros de canal.
 * @param {object} request - A mensagem recebida.
 * @param {function} sendResponse - A função de callback para enviar a resposta.
 * @returns {boolean} - Retorna `true` se a ação foi tratada, `false` caso contrário.
 */
const handleStateRequest = (request, sendResponse) => {
    switch (request.action) {
        case 'getState':
            chrome.storage.sync.get(null, (items) => {
                if (chrome.runtime.lastError) {
                    console.error('Erro ao obter estado:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true, data: items });
                }
            });
            return true; // Indica que a resposta será assíncrona.

        case 'saveState':
            chrome.storage.sync.set(request.data, () => {
                if (chrome.runtime.lastError) {
                    console.error('Erro ao salvar estado:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true });
                }
            });
            return true; // Indica que a resposta será assíncrona.
    }
    // Se a ação não for 'getState' ou 'saveState', não a tratamos aqui.
    return false;
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

// ================== LISTENER DE MENSAGENS PRINCIPAL ==================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let isAsync = false;

    safeExecuteBackground(async () => {
        try {
            if (message.action !== 'addLog') { // Evita log recursivo
                const logSource = sender.tab ? `tab-${sender.tab.id}` : (sender.url ? new URL(sender.url).pathname.split('/').pop() : 'desconhecido');
                addLog(`Mensagem recebida: ${message.action || 'sem ação'} de ${logSource}`, 'DEBUG', 'BackgroundListener');
            }
        } catch (e) {
            console.warn("Falha ao registrar log de mensagem recebida:", e);
        }

        if (message.action === 'addLog') {
            // Ação síncrona, não precisa de `isAsync = true`
            addLog(message.logMessage, message.logLevel, message.logSource);
            sendResponse({ success: true });

        } else if (message.action === 'getState' || message.action === 'saveState') {
            // Ações de estado que são assíncronas
            isAsync = true;
            handleStateRequest(message, sendResponse);

        } else if (message.action === 'saveSettings') {
            // Ação síncrona
            handleSettingsUpdate(message.settings);
            sendResponse({ success: true });

        } else if (message.action === 'initiateCapture') {
            isAsync = true; // DEFINIR ANTES DO AWAIT
        handleCaptureRequest(message)
                .then(dataUrl => sendResponse({ success: true, dataUrl: dataUrl }))
                .catch(error => sendResponse({ success: false, error: error.message }));

        } else if (message.action === 'copyTextToClipboard') {
            isAsync = true; // DEFINIR ANTES DO AWAIT
            copyTextToClipboard(message.text)
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ success: false, error: err.message }));

        } else if (message.action === 'showImagePopup') {
            isAsync = true; // DEFINIR ANTES DO AWAIT
            showImagePopup(message.dataUrl)
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ success: false, error: err.message }));

        } else if (message.action === 'logsCleaned') {
            // Ação síncrona, apenas para evitar erro de roteamento. Não faz nada.
            sendResponse({ success: true });

        } else if (message.action === 'GET_CANVAS_INFO') {
            // Ação assíncrona, encaminhada para o content script
            isAsync = true; // DEFINIR ANTES DO AWAIT
            try {
                const tab = await getActiveTab();
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                            const errorMsg = `Erro ao comunicar com content script (Canvas): ${chrome.runtime.lastError.message}`;
                            addLog(errorMsg, 'ERROR', 'BackgroundCanvas');
                            sendResponse({ success: false, error: errorMsg });
        } else {
                            sendResponse(response);
                        }
          });
        } else {
                    throw new Error('Nenhuma aba ativa encontrada para encaminhar a mensagem do canvas.');
                }
            } catch (error) {
                const errorMsg = `Falha ao obter info do canvas: ${error.message}`;
                addLog(errorMsg, 'ERROR', 'BackgroundCanvas');
                sendResponse({ success: false, error: errorMsg });
            }
        
        } else {
            // AÇÃO PADRÃO: Encaminhar para o content script
            isAsync = true; // DEFINIR ANTES DO AWAIT
            try {
                const tab = await getActiveTab();
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, message, (response) => {
                        if (chrome.runtime.lastError) {
                            const errorMsg = `Erro ao encaminhar '${message.action}': ${chrome.runtime.lastError.message}`;
                            addLog(errorMsg, 'ERROR', 'BackgroundForwarder');
                            sendResponse({ success: false, error: errorMsg });
                } else {
                            sendResponse(response);
                }
              });
            } else {
                    throw new Error(`Nenhuma aba ativa encontrada para encaminhar a ação: ${message.action}`);
            }
        } catch (error) {
                addLog(`Falha ao encaminhar mensagem para content.js: ${error.message}`, 'ERROR', 'BackgroundForwarder');
          sendResponse({ success: false, error: error.message });
        }
        }
    });

    // Retorna true para indicar que a resposta será enviada de forma assíncrona.
    // Isso mantém a porta de comunicação aberta.
    return isAsync;
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

// ===================================================================================
// ===================== FUNÇÕES DE CAPTURA E EXIBIÇÃO ===============================
// ===================================================================================

/**
 * Exibe uma imagem em uma nova janela popup.
 * @param {string} dataUrl - A URL de dados da imagem a ser exibida.
 * @returns {Promise<void>}
 */
async function showImagePopup(dataUrl) {
    if (!dataUrl) {
        throw new Error('Nenhuma imagem fornecida para exibir.');
    }
    const width = 800;
    const height = 600;

    // Obter informações sobre a janela atual para centralizar o popup
    const lastFocused = await chrome.windows.getLastFocused();
    const top = lastFocused.top + Math.round((lastFocused.height - height) / 2);
    const left = lastFocused.left + Math.round((lastFocused.width - width) / 2);

    // HTML para a nova janela com fundo escuro e imagem centralizada
    const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Visualizador de Captura</title></head>
        <body style="margin:0; background-color:#1e1e1e; display:flex; align-items:center; justify-content:center; height:100vh;">
            <img src="${dataUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">
        </body>
        </html>
    `;

    await chrome.windows.create({
        url: `data:text/html,${encodeURIComponent(html)}`,
        type: 'popup',
        width: width,
        height: height,
        top: Math.max(0, top), // Garantir que não seja negativo
        left: Math.max(0, left) // Garantir que não seja negativo
    });
    addLog('Popup de imagem exibido com sucesso.', 'INFO', 'ImagePopup');
}

/**
 * Copia um texto para a área de transferência usando a API offscreen.
 * @param {string} text - O texto a ser copiado.
 * @returns {Promise<void>}
 */
async function copyTextToClipboard(text) {
    addLog('Iniciando processo de cópia para a área de transferência.', 'DEBUG', 'Clipboard');
    // Caminho para o documento offscreen
    const offscreenDocumentPath = 'src/layout/offscreen.html';

    // Verificar se já existe um documento offscreen
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(offscreenDocumentPath)]
    });

    // Se não houver documento offscreen, crie um.
    if (existingContexts.length === 0) {
        addLog('Documento offscreen não encontrado. Criando...', 'DEBUG', 'Clipboard');
        await chrome.offscreen.createDocument({
            url: offscreenDocumentPath,
            reasons: ['CLIPBOARD'],
            justification: 'Necessário para copiar texto para a área de transferência.'
        });
        addLog('Documento offscreen criado.', 'DEBUG', 'Clipboard');
    } else {
        addLog('Documento offscreen já existe.', 'DEBUG', 'Clipboard');
    }

    // Envia a mensagem para o documento offscreen e aguarda a resposta.
    addLog('Enviando texto para o documento offscreen para cópia.', 'DEBUG', 'Clipboard');
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'copyToClipboard',
            text: text
        });

        if (response && response.success) {
            addLog('API Offscreen retornou sucesso.', 'INFO', 'Clipboard');
        } else {
            const errorMessage = response ? response.error : 'Resposta inválida do documento offscreen.';
            addLog(`API Offscreen retornou erro: ${errorMessage}`, 'ERROR', 'Clipboard');
            throw new Error(`Falha na API Offscreen: ${errorMessage}`);
        }
    } catch (error) {
        addLog(`Erro ao comunicar com o documento offscreen: ${error.message}`, 'ERROR', 'Clipboard');
        // Se o erro for sobre "Could not establish connection", pode ser uma race condition.
        if (error.message.includes('Could not establish connection')) {
             addLog('Possível race condition. O listener do offscreen pode não estar pronto.', 'WARN', 'Clipboard');
        }
        throw error; // Re-lança o erro para ser pego pelo listener original.
    }
}

 