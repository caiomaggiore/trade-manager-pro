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
        console.log('Iniciando captura de tela...');
        
        // Captura a tela visível
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'png',
            quality: 100
        });

        console.log('Captura concluída, processando imagem...');

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
    console.log('Mensagem recebida no background:', message);
    
    // Handler para captura de imagem
    if (message.action === 'initiateCapture' && !isProcessing) {
        handleCaptureRequest(message)
            .then(dataUrl => {
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
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }

  // Handler para início de análise
  if (message.action === 'START_ANALYSIS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        sendResponse({ success: false, error: "Nenhuma guia ativa encontrada" });
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['scripts/content.js']
          }, () => {
            executeAnalysis(tabs[0].id, sendResponse);
          });
        } else {
          executeAnalysis(tabs[0].id, sendResponse);
        }
      });
    });
    return true;
  }

  // Novo handler para obtenção de períodos
  if (message.action === 'GET_TRADE_PARAMS') {
    chrome.storage.sync.get(['tradeValue', 'tradeTime', 'galeEnabled'], (settings) => {
      chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'FETCH_AVAILABLE_PERIODS'
        }, (response) => {
          const params = getTradeParameters(
            settings,
            message.analysis,
            response?.periods || []
          );
          sendResponse(params);
        });
      });
    });
    return true;
  }

  if (message.action === 'FETCH_AVAILABLE_PERIODS') {
    chrome.tabs.sendMessage(sender.tab.id, message, sendResponse);
    return true;
  }

  // Handler para logs
  if (message.action === 'ADD_LOG') {
    chrome.runtime.sendMessage({
      action: 'ADD_LOG',
      log: message.log
    });
  }

  if (message.action === 'TEST_CONNECTION') {
    chrome.tabs.sendMessage(sender.tab.id, {
      action: 'TEST_CONNECTION'
    }, sendResponse);
    return true;
  }
}); 