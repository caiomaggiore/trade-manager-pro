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
            console.log('Mensagem de captura recebida do iframe');
            chrome.runtime.sendMessage({
                action: 'initiateCapture',
                actionType: event.data.actionType,
                requireProcessing: event.data.requireProcessing,
                iframeWidth: event.data.iframeWidth
            });
        }
    });
  };
  
  // Inicialização
  const modalTutorial = document.querySelector('.tutorial-v1__close-icon');
  setTimeout( () => {
    modalTutorial.click()
    , 1000
  });
  
  
  // Inicialização segura
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectInterface);
  } else {
    injectInterface();
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
            sendResponse({ error: error.message });
        }
        };
  
        img.onerror = () => sendResponse({ error: 'Erro ao carregar imagem' });
        img.src = message.dataUrl;
        return true; // Mantém o canal aberto
    }
  
    if (message.action === 'FETCH_AVAILABLE_PERIODS') {
      const periods = Array.from(document.querySelectorAll('.dops__timeframes-item'))
          .map(item => item.textContent.trim());
      sendResponse({ periods });
      return true;
    }
    
    // Novo handler para executar operações de compra/venda
    if (message.action === 'EXECUTE_TRADE_ACTION') {
      console.log(`Content script: Recebido comando para executar ${message.tradeAction}`);
      safeLog(`Iniciando execução de ${message.tradeAction}`);
      
      try {
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
              safeLog(`Painel de controle encontrado via seletor: ${selector}`);
              return element;
            }
          }
          
          return null;
        };
        
        const controlPanel = findControlPanel();
        
        if (!controlPanel) {
          console.error('Painel de controle não encontrado');
          safeLog('Erro: Painel de controle não encontrado', 'error');
          
          // Tenta imprimir os elementos disponíveis para debug
          console.log('Elementos disponíveis na página:');
          document.querySelectorAll('div').forEach(el => {
            if (el.className && (el.className.includes('call') || el.className.includes('put'))) {
              console.log(`Elemento potencial: ${el.tagName}.${el.className}`);
            }
          });
          
          sendResponse({ 
            success: false, 
            error: 'Painel de controle não encontrado na página' 
          });
          return true;
        }
        
        // Seletores mais flexíveis para os botões
        const findTradeButton = (action) => {
          const selectors = {
            'BUY': [
              '.button-call-wrap .btn-call',
              '.btn-call',
              '.action-high-low a.btn-call',
              'a.btn-call',
              '[class*="call-wrap"] a',
              '.btn-green', // Alguns sites usam cores em vez de call/put
              'button:contains("Buy")',
              'a:contains("Buy")'
            ],
            'SELL': [
              '.button-put-wrap .btn-put',
              '.btn-put',
              '.action-high-low a.btn-put',
              'a.btn-put',
              '[class*="put-wrap"] a',
              '.btn-red', // Alguns sites usam cores em vez de call/put
              'button:contains("Sell")',
              'a:contains("Sell")'
            ]
          };
          
          const buttonSelectors = selectors[action] || [];
          
          // Primeiro tenta elementos dentro do painel de controle
          for (const selector of buttonSelectors) {
            try {
              const button = controlPanel.querySelector(selector);
              if (button) {
                safeLog(`Botão ${action} encontrado via seletor: ${selector} (no painel)`);
                return button;
              }
            } catch (err) {
              // Ignora erros de seletor inválido
            }
          }
          
          // Se não encontrar, busca em toda a página
          for (const selector of buttonSelectors) {
            try {
              const button = document.querySelector(selector);
              if (button) {
                safeLog(`Botão ${action} encontrado via seletor: ${selector} (global)`);
                return button;
              }
            } catch (err) {
              // Ignora erros de seletor inválido
            }
          }
          
          return null;
        };
        
        const targetButton = findTradeButton(message.tradeAction);
        
        if (!targetButton) {
          console.error(`Botão para ${message.tradeAction} não encontrado`);
          safeLog(`Erro: Botão para ${message.tradeAction} não encontrado`, 'error');
          sendResponse({ 
            success: false, 
            error: `Botão para ${message.tradeAction} não encontrado` 
          });
          return true;
        }
        
        // Simular o clique no botão
        console.log(`Clicando no botão ${message.tradeAction}...`);
        safeLog(`Executando operação ${message.tradeAction}`);
        targetButton.click();
        
        sendResponse({ 
          success: true, 
          message: `Operação ${message.tradeAction} executada com sucesso` 
        });
      } catch (error) {
        console.error('Erro ao executar operação:', error);
        safeLog(`Erro na execução: ${error.message}`, 'error');
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      }
      
      return true;
    }
    
    // Handler simples para verificar se o content script está ativo
    if (message.action === 'PING') {
      sendResponse({ status: 'alive' });
      return true;
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
      sendLog(message);
    } else {
      // Fallback para console
      console[level](`[TradingBot] ${message}`);
    }
  } catch (error) {
    console.log(`[TradingBot] ${message}`);
  }
};