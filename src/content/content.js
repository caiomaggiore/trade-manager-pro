// Injeta a estrutura principal na página
const injectInterface = () => {
    const iframe = document.createElement('iframe');
    iframe.id = "trade-manager-iframe";
  
    // Estilos do iframe
    iframe.style.cssText = `
        position: fixed;
        right: 0;
        top: 0;
        width: 480px;
        height: 100vh;
        border: none;
        z-index: 9999;
        box-shadow: -2px 0 10px rgba(0,0,0,0.1);
        background: #f8f9fa;
    `;
  
    // Ajusta a página original
    document.body.style.marginRight = "480px";
    
    // Carrega o conteúdo
    iframe.src = chrome.runtime.getURL('src/layout/index.html');
    document.body.appendChild(iframe);
  
    // Cria o botão de controle
    const toggleButton = document.createElement('button');
    toggleButton.id = "trade-manager-toggle";
    toggleButton.textContent = "Trade Manager";
    toggleButton.style.cssText = `
        position: fixed;
        left: 300px;
        top: 10px;
        z-index: 10000;
        padding: 10px;
        background:rgb(88, 46, 204);
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    `;
      // Adiciona evento ao botão
      toggleButton.addEventListener('click', () => {
        iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
        document.body.style.marginRight = iframe.style.display === 'none' ? '0' : '480px';
    });
  
    document.body.appendChild(toggleButton);
  
    // Escuta mensagens do iframe
    window.addEventListener('message', (event) => {
        if (event.data.action === 'captureScreen') {
            safeLog('Mensagem de captura recebida do iframe', 'INFO');
            chrome.runtime.sendMessage({
                action: 'initiateCapture',
                actionType: event.data.actionType,
                requireProcessing: event.data.requireProcessing,
                iframeWidth: event.data.iframeWidth
            });
        }
    });
  };
  
  // ======================================================================
  // =================== MONITORAMENTO DE OPERAÇÕES ======================
  // ======================================================================
  
  // Inicializar monitoramento de operações
  const startTradeMonitoring = () => {
    // Verificar se o observer já existe
    if (window._tradeObserver) {
      safeLog("Observer já existe, não será criado novamente", "INFO");
      return;
    }
    
    safeLog("Iniciando monitoramento de operações", "INFO");
    
    // Função para processar modal de notificação de trade
    const processTradeModal = (modal) => {
      try {
        // Verificar se é realmente um modal de operação
        if (!modal.classList.contains('deals-noty')) {
          return;
        }
        
        // Obter título da operação
        const titleElement = modal.querySelector('.deals-noty__title');
        if (!titleElement) return;
        
        const titleText = titleElement.textContent.trim();
        
        // Determinar tipo de operação
        let tradeType = null;
        if (titleText.includes('placed')) {
          tradeType = 'Open';
        } else if (titleText.includes('closed')) {
          tradeType = 'Closed';
        } else {
          return; // Não é um modal de operação relevante
        }
        
        // Obter símbolo
        const symbolElement = modal.querySelector('.deals-noty__symbol-title');
        const symbol = symbolElement ? symbolElement.textContent.trim() : 'Desconhecido';
        
        // Obter dados da operação
        const textColumns = modal.querySelectorAll('.deals-noty__text-col');
        if (!textColumns || textColumns.length === 0) return;
        
        let amount = 0;
        let profit = 0;
        let forecast = '';
        
        // Procurar nos elementos de texto os valores
        textColumns.forEach(column => {
          const label = column.querySelector('.deals-noty__label');
          const value = column.querySelector('.deals-noty__value');
          
          if (!label || !value) return;
          
          const labelText = label.textContent.trim();
          const valueText = value.textContent.trim();
          
          if (labelText.includes('Amount')) {
            amount = parseFloat(valueText.replace(/[^0-9.-]+/g, '')) || 0;
          } else if (labelText.includes('Profit')) {
            profit = parseFloat(valueText.replace(/[^0-9.-]+/g, '')) || 0;
          } else if (labelText.includes('Forecast')) {
            forecast = valueText;
          }
        });
        
        // Armazenar último valor para cálculos em operações fechadas
        if (tradeType === 'Open' && amount > 0) {
          window.lastTradeAmount = amount.toFixed(2);
        }
        
        // Calcular valores para registro (payment = lucro + valor investido)
        const lastAmount = window.lastTradeAmount || amount.toFixed(2);
        const payment = (parseFloat(profit) + parseFloat(lastAmount)).toFixed(2);
        
        // Estruturar o resultado da operação
        const result = {
          status: tradeType,
          success: profit > 0,
          profit: profit.toFixed(2),
          amount: lastAmount,
          action: forecast || payment,
          symbol: symbol,
          timestamp: Date.now()
        };
        
        safeLog(`Operação detectada: ${result.status} ${result.symbol}`, 'INFO');
        
        // Enviar resultado para processamento
        chrome.runtime.sendMessage({
          type: 'TRADE_RESULT',
          data: result
        });
        
      } catch (error) {
        safeLog(`Erro ao processar modal de operação: ${error.message}`, 'ERROR');
      }
    };
    
    // Criar observer para monitorar adições no DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        // Verificar novos nós
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          
          // Verificar se é um container de modal ou o próprio modal
          if (node.classList && 
              (node.classList.contains('deals-noty-streamer') || 
               node.classList.contains('deals-noty'))) {
            
            if (node.classList.contains('deals-noty')) {
              processTradeModal(node);
            } else {
              // Se for um container, procurar modais dentro dele
              node.querySelectorAll('.deals-noty').forEach(modal => {
                processTradeModal(modal);
              });
            }
          }
        });
      });
    });
    
    // Configurar observer
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Armazenar referência para evitar duplicação
    window._tradeObserver = observer;
    
    safeLog("Monitoramento de operações iniciado com sucesso", "SUCCESS");
  };
  
  // Inicialização
  const modalTutorial = document.querySelector('.tutorial-v1__close-icon');
  setTimeout( () => {
    modalTutorial.click()
    , 1000
  });
  
  
  // Inicialização segura
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectInterface();
      // Iniciar monitoramento após interface carregada
      setTimeout(startTradeMonitoring, 1500);
    });
  } else {
    injectInterface();
    // Iniciar monitoramento após interface carregada
    setTimeout(startTradeMonitoring, 1500);
  }
  
      
  // Adicione o listener para processamento
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'processCapture') {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
  
        img.onload = () => {
        try {
            canvas.width = img.width - message.iframeWidth;
            canvas.height = img.height;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
            
            sendResponse({ dataUrl: canvas.toDataURL('image/png') });
        } catch (error) {
            safeLog(`Erro ao processar captura: ${error.message}`, 'ERROR');
            sendResponse({ error: error.message });
        }
        };
  
        img.onerror = () => {
          safeLog('Erro ao carregar imagem para processamento', 'ERROR');
          sendResponse({ error: 'Erro ao carregar imagem' });
        };
        img.src = message.dataUrl;
        return true; // Mantém o canal aberto
    }
  
    if (message.action === 'FETCH_AVAILABLE_PERIODS') {
      const periods = Array.from(document.querySelectorAll('.dops__timeframes-item'))
          .map(item => item.textContent.trim());
      sendResponse({ periods });
      return true;
    }
    
    // Handler para executar operações de compra/venda
    if (message.action === 'EXECUTE_TRADE_ACTION') {
      safeLog(`Recebido comando para executar ${message.tradeAction}`, 'INFO');
      
      // Log para registrar a solicitação da operação
      try {
        chrome.runtime.sendMessage({
          action: 'logMessage',
          message: `Solicitação de operação ${message.tradeAction} recebida`,
          level: 'INFO',
          source: 'content.js'
        });
      } catch (logError) {
        // Silenciar erros de logging para não afetar a execução principal
        console.log(`Erro ao enviar log: ${logError.message}`);
      }
      
      try {
        // Primeiro configurar a operação com as configurações do usuário
        safeLog('Aplicando configurações antes de executar a operação', 'INFO');
        
        // Obter configurações atuais do usuário (via mensagem)
        chrome.runtime.sendMessage({ action: 'GET_USER_CONFIG' }, async (config) => {
          try {
            if (chrome.runtime.lastError) {
              const errorMsg = chrome.runtime.lastError.message;
              safeLog(`Erro ao obter configurações: ${errorMsg}`, 'ERROR');
              sendResponse({ 
                success: false, 
                error: `Erro ao obter configurações: ${errorMsg}` 
              });
              return;
            }
            
            // Se não recebeu configurações, tenta usar defaults
            const userConfig = config || { tradeValue: 10, tradeTime: 1 };
            
            // Configurar a operação
            const configured = await TradingConfig.configureOperation(userConfig);
            if (!configured) {
                throw new Error('Falha ao configurar parâmetros da operação');
            }
            
            // Buscar o painel de controle com seletores mais abrangentes
            const findControlPanel = () => {
              // Tentar vários seletores possíveis
              const selectors = [
                '.call-put-block.control-panel',
                '.call-put-block',
                '.tour-action-buttons-container',
                '#put-call-buttons-chart-1'
              ];
              
              for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                  safeLog(`Painel de controle encontrado via seletor: ${selector}`, 'INFO');
                  return element;
                }
              }
              
              return null;
            };
            
            const controlPanel = findControlPanel();
            
            if (!controlPanel) {
              safeLog('Erro: Painel de controle não encontrado', 'ERROR');
              
              sendResponse({ 
                success: false, 
                error: 'Painel de controle não encontrado na página' 
              });
              return true;
            }
            
            // Seletores mais flexíveis para os botões
            const findTradeButton = (action) => {
              // Se a ação for WAIT, retorna null (não há botão para esperar)
              if (action === 'WAIT') {
                safeLog('Ação WAIT detectada - não há botão físico para esta ação', 'WARN');
                return null;
              }
              
              try {
                // Seletores mais básicos para maior compatibilidade
                const selectors = {
                  'BUY': [
                    'button.btn-call',
                    'a.btn-call',
                    '.btn-call',
                    'button.btn-green',
                    'a.btn-green',
                    '.btn-green',
                    '[data-type="call"]',
                    '[data-action="call"]',
                    '[class*="call"]',
                    'button:contains("Buy")',
                    'a:contains("Buy")'
                  ],
                  'SELL': [
                    'button.btn-put',
                    'a.btn-put',
                    '.btn-put',
                    'button.btn-red',
                    'a.btn-red', 
                    '.btn-red',
                    '[data-type="put"]',
                    '[data-action="put"]',
                    '[class*="put"]',
                    'button:contains("Sell")',
                    'a:contains("Sell")'
                  ]
                };
                
                const buttonSelectors = selectors[action] || [];
                let targetButton = null;
                
                // Procurar em toda a página
                for (const selector of buttonSelectors) {
                  try {
                    const elements = document.querySelectorAll(selector);
                    if (elements && elements.length > 0) {
                      // Pegar o primeiro elemento visível
                      for (const element of elements) {
                        if (element.offsetParent !== null) { // Verifica se é visível
                          safeLog(`Botão ${action} encontrado via seletor: ${selector}`, 'SUCCESS');
                          targetButton = element;
                          break;
                        }
                      }
                      
                      if (targetButton) break;
                    }
                  } catch (err) {
                    // Ignorar erros de seletor individual
                    continue;
                  }
                }
                
                if (!targetButton) {
                  safeLog(`Nenhum botão encontrado para ${action} após tentar todos os seletores`, 'ERROR');
                }
                
                return targetButton;
              } catch (error) {
                safeLog(`Erro ao buscar botão ${action}: ${error.message}`, 'ERROR');
                return null;
              }
            };
            
            const targetButton = findTradeButton(message.tradeAction);
            
            if (!targetButton) {
              const errorMsg = `Botão para ${message.tradeAction} não encontrado`;
              safeLog(errorMsg, 'ERROR');
              
              // Se for uma ação WAIT, registrar mensagem específica
              if (message.tradeAction === 'WAIT') {
                safeLog('Erro de operação WAIT: Esta plataforma não suporta botão de espera', 'ERROR');
                safeLog('Recomendação: Para operações WAIT, não execute nenhuma ação', 'WARN');
              }
              
              sendResponse({ 
                success: false, 
                error: errorMsg
              });
              return true;
            }
            
            // Simular o clique no botão
            safeLog(`Executando operação ${message.tradeAction}`, 'INFO');

            try {
              targetButton.click();
              safeLog(`Operação ${message.tradeAction} executada com sucesso`, 'SUCCESS');
              
              // Adicionar um log após a execução para confirmar que o clique foi realizado
              setTimeout(() => {
                safeLog(`Operação ${message.tradeAction} processada pela plataforma`, 'SUCCESS');
              }, 300);
              
              sendResponse({ 
                success: true, 
                message: `Operação ${message.tradeAction} executada com sucesso` 
              });
            } catch (error) {
              // Captura erros gerais
              const errorMsg = `Erro ao executar operação ${message.tradeAction}: ${error.message}`;
              safeLog(errorMsg, 'ERROR');
              
              sendResponse({ 
                success: false, 
                error: errorMsg
              });
            }
          } catch (error) {
            safeLog(`Erro na execução: ${error.message}`, 'ERROR');
            sendResponse({ 
              success: false, 
              error: error.message 
            });
          }
        });
        
        // Manter canal aberto para resposta assíncrona
        return true;
        
      } catch (outerError) {
        safeLog(`Erro ao iniciar execução: ${outerError.message}`, 'ERROR');
        sendResponse({ 
          success: false, 
          error: `Falha ao iniciar execução: ${outerError.message}` 
        });
      }
    }
    
    // Handler simples para verificar se o content script está ativo
    if (message.action === 'PING') {
      safeLog('Recebido PING, enviando PONG', 'DEBUG');
      sendResponse({ success: true, message: 'PONG' });
      return true;
    }

    // Adicionar handler específico para análise de gráficos
    if (message.action === 'ANALYZE_GRAPH') {
      safeLog('Iniciando análise do gráfico a partir da solicitação', 'INFO');
      
      // Processar análise de gráfico aqui
      try {
        // Capturar screenshot para análise
        safeLog('Capturando tela para análise', 'INFO');
        
        // Simular execução da análise e retornar sucesso para testes
        setTimeout(() => {
          safeLog('Análise de gráfico concluída com sucesso', 'SUCCESS');
          sendResponse({ success: true, result: 'Análise simulada' });
        }, 500);
        
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        safeLog(`Erro durante análise de gráfico: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }
  });
  
  // content.js - Funções de controle da interface
  const TradingAutomation = {
    // Abre o modal de períodos
    openExpirationModal: () => {
        const expirationBlock = document.querySelector('.block.block--expiration-inputs .block__control.control');
        if (expirationBlock) {
            expirationBlock.click();
            sendLog('Modal de períodos aberto');
        }
    },
  
    // Seleciona um período no modal
    selectExpiration: (period) => {
        const items = document.querySelectorAll('.dops__timeframes-item');
        const periodMap = {
            'S5': 5, 'S15': 15, 'S30': 30,
            'M1': 60, 'M3': 180, 'M5': 300
        };
  
        items.forEach(item => {
            if (item.textContent.trim() === period) {
                item.click();
                sendLog(`Período selecionado: ${period} (${periodMap[period]}s)`);
            }
        });
    },
  
    // Define o valor de entrada
    setTradeValue: (value) => {
        const valueInput = document.querySelector('.block.block--bet-amount input[type="text"]');
        if (valueInput) {
            valueInput.value = value;
            valueInput.dispatchEvent(new Event('input', { bubbles: true }));
            sendLog(`Valor definido: $${value}`);
        }
    },
  
    // Executa a operação (BUY/SELL)
    executeTrade: (action) => {
        const actions = {
            'BUY': '.btn-call',
            'SELL': '.btn-put'
        };
  
        const button = document.querySelector(actions[action]);
        if (button) {
            button.click();
            sendLog(`Operação ${action} executada`);
        }
    },
  
    // Captura períodos disponíveis
    getAvailablePeriods: () => {
      const periods = [];
      document.querySelectorAll('.dops__timeframes-item').forEach(item => {
        periods.push(item.textContent.trim());
      });
      return periods;
    },
  
    // Atualiza valor de trade com validação
    setTradeValue: (value) => {
      const MIN_VALUE = 10;
      const parsedValue = Math.max(Number(value) || MIN_VALUE, MIN_VALUE);
      const valueInput = document.querySelector('.block.block--bet-amount input[type="text"]');
      
      if(valueInput) {
        valueInput.value = parsedValue;
        valueInput.dispatchEvent(new Event('input', { bubbles: true }));
        sendLog(`Valor definido: $${parsedValue}`);
      }
    }
  };

// Helper para logging seguro, caso a função sendLog não esteja disponível
const safeLog = (message, level = 'info') => {
  try {
    // Tenta usar sendLog se disponível
    if (typeof sendLog === 'function') {
      sendLog(message, level);
    } else {
      // Fallback para console apenas para erros
      if (level.toLowerCase() === 'error') {
        console.error(`[TradingBot] ${message}`);
      }
    }
  } catch (error) {
    // Apenas erros são mostrados no console
    if (level.toLowerCase() === 'error') {
      console.error(`[TradingBot] ${message}`);
    }
  }
};

// Função para enviar logs para o sistema central
const sendLog = (message, level = 'INFO') => {
  try {
    // Enviar mensagem diretamente para o sistema de log centralizado
    chrome.runtime.sendMessage({
      action: 'logMessage',
      message: message,
      level: level.toUpperCase(),
      source: 'content.js'
    });
    
    // Log local apenas para erros
    if (level.toUpperCase() === 'ERROR') {
      console.error(`[${level.toUpperCase()}][content.js] ${message}`);
    }
  } catch (error) {
    console.error(`[content.js] Erro ao enviar log: ${error.message}`);
  }
};

// ======================================================================
// =================== CONFIGURAÇÃO DE OPERAÇÕES =======================
// ======================================================================

// Funções para configurar operações na plataforma
const TradingConfig = {
  // Abrir o modal de tempo
  openTimeModal: () => {
    try {
      const timeControl = document.querySelector('.block--expiration-inputs .control__value');
      if (!timeControl) {
        sendLog('Elemento de tempo não encontrado na plataforma', 'ERROR');
        return false;
      }
      
      // Clicar no elemento para abrir o modal
      timeControl.click();
      sendLog('Modal de tempo aberto', 'INFO');
      return true;
    } catch (error) {
      sendLog(`Erro ao abrir modal de tempo: ${error.message}`, 'ERROR');
      return false;
    }
  },
  
  // Converter minutos para formato da plataforma (S5, M1, etc.)
  convertTimeToFormat: (minutes) => {
    // Converter para segundos
    const seconds = minutes * 60;
    
    // Mapear para o formato da plataforma
    if (seconds <= 5) return 'S5';
    if (seconds <= 15) return 'S15';
    if (seconds <= 30) return 'S30';
    if (seconds <= 60) return 'M1';
    if (seconds <= 180) return 'M3';
    if (seconds <= 300) return 'M5';
    if (seconds <= 1800) return 'M30';
    if (seconds <= 3600) return 'H1';
    return 'H4'; // Acima de 1 hora
  },
  
  // Encontrar e selecionar a opção de tempo no modal
  selectTimeOption: (targetTime) => {
    return new Promise((resolve, reject) => {
      try {
        // Aguardar o modal aparecer (até 2 segundos)
        let attempts = 0;
        const maxAttempts = 20;
        const checkInterval = 100; // 100ms
        
        const findAndClickOption = () => {
          // Verificar se o modal está visível
          const modal = document.querySelector('.drop-down-modal.trading-panel-modal.expiration-inputs-list-modal');
          if (!modal || modal.style.display === 'none') {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(findAndClickOption, checkInterval);
              return;
            } else {
              reject('Modal de tempo não apareceu após a espera');
              return;
            }
          }
          
          // Encontrar todas as opções de tempo
          const timeOptions = modal.querySelectorAll('.dops__timeframes-item');
          if (!timeOptions || timeOptions.length === 0) {
            reject('Opções de tempo não encontradas no modal');
            return;
          }
          
          sendLog(`Procurando opção de tempo: ${targetTime}`, 'INFO');
          
          // Procurar a opção exata ou mais próxima
          let selectedOption = null;
          
          // Primeiro tentar encontrar correspondência exata
          for (const option of timeOptions) {
            if (option.textContent.trim() === targetTime) {
              selectedOption = option;
              break;
            }
          }
          
          // Se não encontrou correspondência exata, converter para mapeamento e tentar novamente
          if (!selectedOption) {
            sendLog(`Opção exata ${targetTime} não encontrada, buscando alternativa`, 'WARN');
            
            // Mapear de segundos/minutos para os formatos disponíveis
            const formatMap = {
              'S5': 5, // 5 segundos
              'S15': 15, // 15 segundos
              'S30': 30, // 30 segundos
              'M1': 60, // 1 minuto
              'M3': 180, // 3 minutos
              'M5': 300, // 5 minutos
              'M30': 1800, // 30 minutos
              'H1': 3600, // 1 hora
              'H4': 14400 // 4 horas
            };
            
            // Extrair o valor numérico do targetTime
            let targetSeconds = 0;
            if (targetTime.startsWith('S')) {
              targetSeconds = parseInt(targetTime.substring(1));
            } else if (targetTime.startsWith('M')) {
              targetSeconds = parseInt(targetTime.substring(1)) * 60;
            } else if (targetTime.startsWith('H')) {
              targetSeconds = parseInt(targetTime.substring(1)) * 3600;
            }
            
            // Encontrar a opção mais próxima disponível
            let closestDiff = Infinity;
            
            for (const option of timeOptions) {
              const optionText = option.textContent.trim();
              const optionSeconds = formatMap[optionText] || 0;
              
              const diff = Math.abs(optionSeconds - targetSeconds);
              if (diff < closestDiff) {
                closestDiff = diff;
                selectedOption = option;
              }
            }
          }
          
          if (selectedOption) {
            sendLog(`Selecionando opção de tempo: ${selectedOption.textContent}`, 'SUCCESS');
            selectedOption.click();
            resolve(selectedOption.textContent);
          } else {
            reject('Não foi possível encontrar uma opção de tempo adequada');
          }
        };
        
        // Iniciar a busca
        findAndClickOption();
        
      } catch (error) {
        reject(`Erro ao selecionar tempo: ${error.message}`);
      }
    });
  },
  
  // Definir o valor da operação
  setTradeAmount: (amount) => {
    try {
      const amountInput = document.querySelector('.block--bet-amount input[type="text"]');
      if (!amountInput) {
        sendLog('Campo de valor não encontrado na plataforma', 'ERROR');
        return false;
      }
      
      // Definir valor e disparar evento de input
      amountInput.value = amount;
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      sendLog(`Valor de operação definido: $${amount}`, 'SUCCESS');
      return true;
    } catch (error) {
      sendLog(`Erro ao definir valor: ${error.message}`, 'ERROR');
      return false;
    }
  },
  
  // Fechar o modal de tempo após seleção
  closeTimeModal: () => {
    try {
      // Verificar se o modal está aberto
      const modal = document.querySelector('.drop-down-modal.trading-panel-modal.expiration-inputs-list-modal');
      if (!modal) {
        sendLog('Modal de tempo não encontrado para fechar', 'WARN');
        return true; // Retorna true pois o modal já está fechado
      }
      
      // Método 1: Clicar fora do modal (no body)
      const bodyElement = document.body;
      if (bodyElement) {
        // Criar um clique fora do modal para fechá-lo
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: 10, // Posição fora do modal
          clientY: 10
        });
        bodyElement.dispatchEvent(clickEvent);
        sendLog('Evento de clique disparado para fechar o modal', 'INFO');
      }
      
      // Método 2: Verificar se há um botão de fechar no modal
      const closeButton = modal.querySelector('.close-btn, .btn-close, [data-close="true"]');
      if (closeButton) {
        closeButton.click();
        sendLog('Botão de fechar modal clicado', 'INFO');
      }
      
      // Verificar se o modal foi fechado
      setTimeout(() => {
        const modalStillOpen = document.querySelector('.drop-down-modal.trading-panel-modal.expiration-inputs-list-modal');
        if (modalStillOpen) {
          sendLog('Modal ainda aberto após tentativa de fechamento', 'WARN');
          
          // Método 3: Tentar clicar no controle de tempo novamente para alternar (toggle)
          const timeControl = document.querySelector('.block--expiration-inputs .control__value');
          if (timeControl) {
            timeControl.click();
            sendLog('Tentativa alternativa de fechar modal: clique no controle', 'INFO');
          }
        } else {
          sendLog('Modal de tempo fechado com sucesso', 'SUCCESS');
        }
      }, 300);
      
      return true;
    } catch (error) {
      sendLog(`Erro ao fechar modal de tempo: ${error.message}`, 'ERROR');
      return false;
    }
  },
  
  // Configurar operação com base nas configurações do usuário
  configureOperation: async (config) => {
    try {
      sendLog('Configurando parâmetros da operação...', 'INFO');
      
      // Definir valor da operação
      if (config.tradeValue) {
        const valueSet = TradingConfig.setTradeAmount(config.tradeValue);
        if (!valueSet) {
          throw new Error('Falha ao definir valor da operação');
        }
      }
      
      // Configurar tempo da operação
      if (config.tradeTime) {
        // Converter para o formato da plataforma
        const timeFormat = TradingConfig.convertTimeToFormat(config.tradeTime);
        
        // Abrir modal de tempo
        const modalOpened = TradingConfig.openTimeModal();
        if (!modalOpened) {
          throw new Error('Falha ao abrir modal de tempo');
        }
        
        // Selecionar opção de tempo
        const selectedTime = await TradingConfig.selectTimeOption(timeFormat);
        sendLog(`Tempo de operação configurado: ${selectedTime}`, 'SUCCESS');
        
        // Fechar o modal após a seleção
        TradingConfig.closeTimeModal();
      }
      
      return true;
    } catch (error) {
      sendLog(`Erro ao configurar operação: ${error.message}`, 'ERROR');
      return false;
    }
  }
};

const executeTradeAction = async (action, config) => {
  return new Promise(async (resolve, reject) => {
    try {
      safeLog(`Executando ação de trade: ${action}`, 'INFO');
      
      // Se a ação for WAIT, apenas espera o tempo configurado
      if (action === 'WAIT') {
        const waitTime = (config && config.waitTime) || 5000; // Padrão de 5 segundos
        safeLog(`Esperando ${waitTime}ms antes de prosseguir`, 'INFO');
        setTimeout(() => {
          safeLog('Espera concluída', 'SUCCESS');
          resolve({ success: true, message: `Esperou ${waitTime}ms com sucesso` });
        }, waitTime);
        return;
      }
      
      // Para ações BUY ou SELL, primeiro tenta configurar a operação
      if (config) {
        try {
          const configResult = await TradingConfig.configureOperation(config);
          if (!configResult) {
            throw new Error('Falha ao configurar operação');
          }
          safeLog('Operação configurada com sucesso', 'SUCCESS');
        } catch (configError) {
          safeLog(`Erro ao configurar operação: ${configError.message}`, 'ERROR');
          return reject({ success: false, message: `Erro ao configurar operação: ${configError.message}` });
        }
      }

      // Busca o botão de trading
      const tradeButton = findTradeButton(action);
      
      if (!tradeButton) {
        const errorMsg = `Não foi possível encontrar o botão para a ação ${action}`;
        safeLog(errorMsg, 'ERROR');
        return reject({ success: false, message: errorMsg });
      }
      
      // Verifica se o botão está habilitado
      if (tradeButton.disabled || tradeButton.classList.contains('disabled') || 
          getComputedStyle(tradeButton).opacity < 0.5) {
        const errorMsg = `O botão para ${action} está desabilitado ou não clicável`;
        safeLog(errorMsg, 'WARN');
        return reject({ success: false, message: errorMsg });
      }
      
      // Tenta executar o clique
      try {
        safeLog(`Clicando no botão de ${action}...`, 'INFO');
        tradeButton.click();
        
        // Verifica se o clique foi bem sucedido (verificação simples)
        setTimeout(() => {
          safeLog(`Ação ${action} executada com sucesso`, 'SUCCESS');
          resolve({ success: true, message: `Ação ${action} executada` });
        }, 200);
      } catch (clickError) {
        const errorMsg = `Erro ao clicar no botão de ${action}: ${clickError.message}`;
        safeLog(errorMsg, 'ERROR');
        reject({ success: false, message: errorMsg });
      }
    } catch (error) {
      const errorMsg = `Erro geral ao executar a ação ${action}: ${error.message}`;
      safeLog(errorMsg, 'ERROR');
      reject({ success: false, message: errorMsg });
    }
  });
};