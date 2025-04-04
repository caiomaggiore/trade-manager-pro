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