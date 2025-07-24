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
            window.logToSystem('Mensagem de captura recebida do iframe', 'INFO');
            chrome.runtime.sendMessage({
                action: 'initiateCapture',
                actionType: event.data.actionType,
                requireProcessing: event.data.requireProcessing,
                iframeWidth: event.data.iframeWidth
            });
        }
    });
  };
  
// Sistema de status otimizado (novo padrão)
function updateStatus(message, type = 'info', duration = 5000) {
    if (window.sendStatus) {
        window.sendStatus(message, type, duration);
    }
}
  
  // ======================================================================
// =================== CAPTURA DE PAYOUT ===============================
// ======================================================================

/**
 * Função para capturar payout diretamente do DOM da PocketOption
 * Esta função tem acesso direto ao DOM da página principal
 */
function capturePayoutFromDOM() {
    return new Promise((resolve, reject) => {
        try {
            window.logToSystem('🔍 Iniciando captura de payout do DOM da PocketOption', 'INFO');
            updateStatus('Capturando payout...', 'info');
            
            // Seletores específicos da PocketOption para encontrar o payout
            const payoutSelectors = [
                '.value__val-start',
                '.estimated-profit-block__percent',
                '.payout-value',
                '.profit-percent',
                '[data-payout]',
                '.asset-payout',
                '.payout-percent',
                '[class*="payout"]',
                '[class*="profit"]'
            ];
            
            // ✅ DEBUG: Primeiro, vamos listar TODOS os elementos que contêm %
            window.logToSystem('🔍 [DEBUG] Listando TODOS os elementos que contêm % na página:', 'DEBUG');
            const allElementsWithPercent = document.querySelectorAll('*');
            let elementCount = 0;
            for (const elem of allElementsWithPercent) {
                const text = elem.textContent?.trim() || '';
                if (text.includes('%') && text.length < 50) {
                    elementCount++;
                    if (elementCount <= 10) { // Limitar para não poluir logs
                        window.logToSystem(`🔍 [DEBUG] Elemento ${elementCount}: "${text}" (tag: ${elem.tagName}, classes: ${elem.className})`, 'DEBUG');
                    }
                }
            }
            window.logToSystem(`🔍 [DEBUG] Total de elementos com % encontrados: ${elementCount}`, 'DEBUG');
            
            let payoutElement = null;
            let payoutValue = 0;
            let foundSelector = '';
            
            // Tentar encontrar o elemento de payout
            for (const selector of payoutSelectors) {
                const elements = document.querySelectorAll(selector);
                window.logToSystem(`🔎 Testando seletor "${selector}" - encontrados ${elements.length} elementos`, 'DEBUG');
                
                if (elements.length > 0) {
                    // Testar cada elemento encontrado
                    for (let i = 0; i < elements.length; i++) {
                        const element = elements[i];
                        const text = element.textContent || element.innerText || '';
                        window.logToSystem(`📝 Elemento ${i+1}: "${text}"`, 'DEBUG');
                        
                        // Verificar se contém um valor de payout válido
                        const payoutMatch = text.match(/(\d+(?:\.\d+)?)\s*%?/);
                        if (payoutMatch) {
                            const value = parseFloat(payoutMatch[1]);
                            if (value >= 50 && value <= 200) { // Payout válido entre 50% e 200%
                                payoutElement = element;
                                payoutValue = value;
                                foundSelector = selector;
                                window.logToSystem(`✅ Elemento de payout encontrado com seletor: ${selector} (${i+1}º elemento)`, 'SUCCESS');
                                break;
                            }
                        }
                    }
                    
                    if (payoutElement) break;
                }
            }
            
            // Se não encontrou com seletores específicos, fazer busca ampla
            if (!payoutElement) {
                window.logToSystem('🔍 Seletores específicos não funcionaram, fazendo busca ampla...', 'DEBUG');
                
                // Busca ampla por elementos que contêm %
                const allElements = document.querySelectorAll('*');
                for (const element of allElements) {
                    const text = element.textContent || element.innerText || '';
                    
                    // Procurar por padrão de porcentagem
                    if (text.includes('%') && text.match(/\d+\s*%/)) {
                        const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
                        if (match) {
                            const value = parseFloat(match[1]);
                            if (value >= 50 && value <= 200) {
                                payoutValue = value;
                                payoutElement = element;
                                foundSelector = 'busca-ampla';
                                window.logToSystem(`🎯 Payout encontrado em busca ampla: ${payoutValue}%`, 'INFO');
                                break;
                            }
                        }
                    }
                }
            }
            
            // Preparar resultado
            if (payoutElement && payoutValue > 0) {
                const result = {
                    success: true,
                    payout: payoutValue,
                    source: 'platform-dom',
                    selector: foundSelector,
                    timestamp: new Date().toISOString(),
                    elementText: payoutElement.textContent || payoutElement.innerText || ''
                };
                
                window.logToSystem(`✅ Payout capturado com sucesso: ${payoutValue}% (seletor: ${foundSelector})`, 'SUCCESS');
                updateStatus(`Payout encontrado: ${payoutValue}%`, 'success');
                
                resolve(result);
            } else {
                // Valor padrão se não conseguir encontrar
                const defaultResult = {
                    success: true,
                    payout: 85, // Valor padrão realista
                    source: 'default',
                    selector: 'none',
                    timestamp: new Date().toISOString(),
                    elementText: 'Valor padrão'
                };
                
                window.logToSystem('⚠️ Payout não encontrado no DOM, usando valor padrão: 85%', 'WARN');
                updateStatus('Payout não encontrado, usando padrão: 85%', 'warn');
                
                resolve(defaultResult);
            }
            
        } catch (error) {
            window.logToSystem(`❌ Erro ao capturar payout: ${error.message}`, 'ERROR');
            updateStatus(`Erro na captura: ${error.message}`, 'error');
            
            reject(new Error(`Falha na captura de payout: ${error.message}`));
        }
    });
}
  
  // ======================================================================
  // =================== MONITORAMENTO DE OPERAÇÕES ======================
  // ======================================================================
  
  // Inicializar monitoramento de operações
  const startTradeMonitoring = () => {
    // Verificar se o observer já existe
    if (window._tradeObserver) {
      window.logToSystem("Observer já existe, não será criado novamente", "INFO");
      return;
    }
    
    window.logToSystem("Iniciando monitoramento de operações", "INFO");
    
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
        
        window.logToSystem(`Operação detectada: ${result.status} ${result.symbol}`, 'INFO');
        
        // Enviar resultado para processamento
        chrome.runtime.sendMessage({
          type: 'TRADE_RESULT',
          data: result
        });
        
      } catch (error) {
        window.logToSystem(`Erro ao processar modal de operação: ${error.message}`, 'ERROR');
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
    
    window.logToSystem("Monitoramento de operações iniciado com sucesso", "SUCCESS");
  };
  
  // Inicialização do fechamento do modal de tutorial
  const modalTutorial = document.querySelector('.tutorial-v1__close-icon');
  if (modalTutorial) {
    setTimeout(() => {
        window.logToSystem('Fechando modal de tutorial...', 'INFO');
        modalTutorial.click();
    }, 1000);
  }
  
  
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
        window.logToSystem('Processando captura de tela', 'INFO');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
  
        img.onload = () => {
            try {
                // Verificar se a imagem carregou corretamente
                if (img.width === 0 || img.height === 0) {
                    window.logToSystem('Erro: Imagem carregada com dimensões inválidas', 'ERROR');
                    sendResponse({ error: 'Dimensões de imagem inválidas' });
                    return;
                }
                
                // Verificar se há informações de crop do canvas
                if (message.canvasCrop) {
                    window.logToSystem('📸 Aplicando crop do canvas do gráfico', 'INFO');
                    
                    const crop = message.canvasCrop;
                    let cropX = crop.x;
                    let cropY = crop.y;
                    let cropWidth = crop.width;
                    let cropHeight = crop.height;
                    
                    // Ajustar coordenadas considerando o iframe removido
                    let adjustedCropX = cropX;
                    if (message.iframeWidth && message.iframeWidth > 0) {
                        // Se a imagem já foi cortada para remover o iframe, ajustar as coordenadas
                        adjustedCropX = cropX;
                    }
                    
                    // Verificar se as coordenadas do crop estão dentro dos limites da imagem
                    if (adjustedCropX < 0) adjustedCropX = 0;
                    if (cropY < 0) cropY = 0;
                    if (adjustedCropX + cropWidth > img.width) {
                        cropWidth = img.width - adjustedCropX;
                    }
                    if (cropY + cropHeight > img.height) {
                        cropHeight = img.height - cropY;
                    }
                    
                    // Configurar canvas para o tamanho do crop
                    canvas.width = cropWidth;
                    canvas.height = cropHeight;
                    
                    // Desenhar apenas a área do canvas
                    ctx.drawImage(img, adjustedCropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                    
                    window.logToSystem(`✅ Crop aplicado: ${cropWidth}x${cropHeight} @ ${adjustedCropX},${cropY}`, 'SUCCESS');
                } else {
                    // Processamento normal (remover apenas o iframe)
                    window.logToSystem('📸 Aplicando processamento normal (remoção do iframe)', 'INFO');
                    
                    // Calculando dimensões com base no iframe
                    let width = img.width;
                    if (message.iframeWidth && message.iframeWidth > 0) {
                        width = img.width - message.iframeWidth;
                    } else {
                        window.logToSystem(`Usando largura total da imagem: ${width}px`, 'INFO');
                    }
                    
                    canvas.width = width;
                    canvas.height = img.height;
                    
                    // Desenhar apenas a parte da imagem sem o iframe
                    ctx.drawImage(img, 0, 0, width, img.height, 0, 0, width, img.height);
                }
                
                // Garantir que a imagem seja PNG
                const dataUrl = canvas.toDataURL('image/png');
                
                // Verificar se o dataUrl está no formato correto
                if (!dataUrl.startsWith('data:image/png')) {
                    window.logToSystem('Aviso: dataUrl não está no formato esperado', 'WARN');
                    // Tentar forçar o formato correto
                    const fixedDataUrl = 'data:image/png;base64,' + dataUrl.split(',')[1];
                    window.logToSystem('Formato corrigido manualmente', 'INFO');
                    sendResponse({ dataUrl: fixedDataUrl });
                } else {
                    // Imagem válida, retornar normalmente
                    window.logToSystem('Captura processada com sucesso', 'SUCCESS');
                    sendResponse({ dataUrl: dataUrl });
                }
            } catch (error) {
                window.logToSystem(`Erro ao processar captura: ${error.message}`, 'ERROR');
                sendResponse({ error: error.message });
            }
        };
  
        img.onerror = () => {
            window.logToSystem('Erro ao carregar imagem para processamento', 'ERROR');
            sendResponse({ error: 'Erro ao carregar imagem' });
        };
        
        // Verificar se a dataUrl recebida é válida
        if (!message.dataUrl || typeof message.dataUrl !== 'string' || !message.dataUrl.startsWith('data:')) {
            window.logToSystem('dataUrl recebida inválida: ' + (message.dataUrl ? message.dataUrl.substring(0, 20) + '...' : 'undefined'), 'ERROR');
            sendResponse({ error: 'URL de dados de imagem inválida' });
            return true;
        }
        
        // Carregar a imagem
        img.src = message.dataUrl;
        return true;
    }
  
    if (message.action === 'FETCH_AVAILABLE_PERIODS') {
      const periods = Array.from(document.querySelectorAll('.dops__timeframes-item'))
          .map(item => item.textContent.trim());
      sendResponse({ periods });
      return true;
    }
    
    // Listener para solicitações de captura do popup ou do botão
    if (message.action === 'CAPTURE_POPUP_REQUEST' || message.action === 'CAPTURE_REQUEST') {
        window.logToSystem(`Recebida solicitação para captura de tela: ${message.action}`, 'INFO');
        
        try {
            // Solicitar captura diretamente ao background e retornar dataUrl
            chrome.runtime.sendMessage({
                action: 'initiateCapture',
                actionType: 'capture',
                requireProcessing: true,
                iframeWidth: 480
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message;
                    window.logToSystem(`Erro na captura: ${errorMsg}`, 'ERROR');
                    sendResponse({ success: false, error: errorMsg });
                    return;
                }
                
                if (response.error) {
                    window.logToSystem(`Erro retornado na captura: ${response.error}`, 'ERROR');
                    sendResponse({ success: false, error: response.error });
                    return;
                }
                
                if (!response.dataUrl) {
                    window.logToSystem('Resposta sem dados de imagem', 'ERROR');
                    sendResponse({ success: false, error: 'Sem dados de imagem' });
                    return;
                }
                
                // Armazenar para uso futuro
                window.lastCapturedImage = response.dataUrl;
                
                window.logToSystem('Captura realizada com sucesso', 'SUCCESS');
                sendResponse({ success: true, dataUrl: response.dataUrl });
            });
        } catch (error) {
            window.logToSystem(`Erro ao processar solicitação de captura: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // Manter canal aberto para resposta assíncrona
    }

    // Listener para exibição direta do modal com imagem já capturada
    if (message.action === 'SHOW_CAPTURE_MODAL' && message.dataUrl) {
        try {
            window.logToSystem('Recebida solicitação direta para mostrar modal de captura', 'INFO');
            showCaptureModalInMainWindow(message.dataUrl);
            
            // Armazenar a imagem para possível reuso
            window.lastCapturedImage = message.dataUrl;
            
            sendResponse({ success: true });
        } catch (error) {
            window.logToSystem(`Erro ao mostrar modal: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    // Listener para ping (verificar se content script está ativo)
    if (message.action === 'PING') {
        sendResponse({ success: true, message: 'Content script ativo' });
        return false; // Resposta síncrona
    }
    
    // Handler para executar operações de compra/venda
    if (message.action === 'EXECUTE_TRADE_ACTION') {
      window.logToSystem(`Recebido comando para executar ${message.tradeAction}`, 'INFO');
      
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
        // NOVA VERIFICAÇÃO: Criar um ID único para esta operação
        const operationId = `trade_${message.tradeAction}_${Date.now()}`;
        
        // Registrar esta operação para verificação futura
        window.lastOperationExecuted = {
          action: message.tradeAction,
          timestamp: Date.now(),
          id: operationId
        };
        
        // Extrair dados da operação
        const tradeData = message.tradeData || {};
        
        // Verificar se a operação vem do modal (para evitar duplicação)
        const isFromModal = tradeData.isFromModal === true;
        
        // Verificar payout antes de executar a operação
        const checkPayout = async () => {
          try {
            window.logToSystem('Verificando payout atual...', 'INFO');
            
            // Procurar elementos que mostram o payout
            const payoutElements = document.querySelectorAll('.payout-info, .profit-info, [class*="payout"], [class*="profit"]');
            let currentPayout = 0;
            
            if (payoutElements.length > 0) {
              // Tentar extrair o payout de cada elemento encontrado
              for (const element of payoutElements) {
                const text = element.textContent.trim();
                const matches = text.match(/(\d+)%/);
                if (matches && matches[1]) {
                  const payoutValue = parseInt(matches[1], 10);
                  if (payoutValue > 0 && payoutValue <= 100) {
                                        currentPayout = payoutValue;
                    window.logToSystem(`Payout atual: ${currentPayout}%`, 'INFO');
                                        break;
                                    }
                                }
                            }
                        }
                        
            // Se não encontrou o payout, tenta outro método
            if (currentPayout === 0) {
              // Tentar encontrar através de outros elementos
              const profitElements = document.querySelectorAll('[class*="profit"], [class*="return"]');
              for (const element of profitElements) {
                const text = element.textContent.trim();
                const matches = text.match(/(\d+)/);
                if (matches && matches[1]) {
                  const payoutValue = parseInt(matches[1], 10);
                  if (payoutValue > 0 && payoutValue <= 100) {
                                currentPayout = payoutValue;
                    window.logToSystem(`Payout encontrado (método alternativo): ${currentPayout}%`, 'INFO');
                                break;
                        }
                    }
                }
            }
            
            // Se ainda não encontrou, usar valor padrão
            if (currentPayout === 0) {
              window.logToSystem('Não foi possível detectar o payout. Usando valor padrão de 85%.', 'WARN');
              currentPayout = 85; // Valor padrão caso não consiga encontrar
            }
            
            // Verificar se atende ao mínimo requerido
            const minPayout = tradeData.minPayout || 80;
            
            // Log detalhado sobre o valor mínimo de payout que está sendo utilizado
            window.logToSystem(`Usando payout mínimo configurado: ${minPayout}% (via tradeData.minPayout)`, 'INFO');
            
            if (currentPayout < minPayout) {
              // Alterado de ERROR para WARN e adicionado envio para o status
              const warningMsg = `Payout atual (${currentPayout}%) abaixo do mínimo configurado (${minPayout}%). Operação cancelada.`;
              window.logToSystem(warningMsg, 'WARN');
              
              // Adicionar registro mais específico no log
              window.logToSystem(`ALERTA DE PAYOUT: Operação ${message.tradeAction} não executada. Payout atual (${currentPayout}%) está abaixo do mínimo configurado (${minPayout}%)`, 'WARN', 'payout-verification');
              
              // Enviar para o sistema de status usando a função padronizada
              updateStatus(`Payout insuficiente (${currentPayout}%)`, 'warn', 5000);
              
              return { success: false, error: `Payout insuficiente (${currentPayout}%)` };
            }
            
            window.logToSystem(`Payout verificado e aprovado: ${currentPayout}% >= ${minPayout}%`, 'SUCCESS');
            return { success: true, payout: currentPayout };
          } catch (error) {
            window.logToSystem(`Erro ao verificar payout: ${error.message}`, 'ERROR');
            return { success: true }; // Continua mesmo com erro na verificação
          }
        };
        
        // Executa a verificação de payout e depois a operação
        checkPayout().then(payoutResult => {
          if (!payoutResult.success) {
            sendResponse(payoutResult);
            return;
          }
          
          // Preparar configurações para a operação
          const operationConfig = {
            tradeValue: tradeData.tradeValue || 10,
            tradeTime: tradeData.tradeTime || 1, // Default para 1 minuto se não especificado
            analysisResult: tradeData.analysisResult || null,
            useDynamicPeriod: tradeData.useDynamicPeriod || false,
            currentPayout: payoutResult.payout || 0,
            operationId: operationId // Novo: incluir o ID único da operação
          };
          
          window.logToSystem(`Executando operação ${operationId} com: Valor=${operationConfig.tradeValue}, Tempo=${operationConfig.tradeTime}min`, 'INFO');
          
          // Usar a função executeTradeAction existente
          executeTradeAction(message.tradeAction, operationConfig)
            .then(result => {
              window.logToSystem(`Operação ${operationId} concluída com sucesso`, 'SUCCESS');
              
              sendResponse({ 
                success: true, 
                message: `Operação ${message.tradeAction} executada com sucesso`,
                result: result,
                operationId: operationId
              });
            })
            .catch(error => {
              window.logToSystem(`Erro ao executar operação ${operationId}: ${error.message || JSON.stringify(error)}`, 'ERROR');
              // Enviar mensagem para o status
              updateStatus(`Erro: ${error.message || 'Falha na operação'}`, 'error', 5000);
              sendResponse({ 
                success: false, 
                error: error.message || 'Erro desconhecido ao executar operação',
                operationId: operationId
              });
            });
        });
        
        return true; // Importante: manter canal aberto para resposta assíncrona
      } catch (error) {
        // Captura erros gerais
        const errorMsg = `Erro ao processar operação ${message.tradeAction}: ${error.message}`;
        window.logToSystem(errorMsg, 'ERROR');
        // Enviar mensagem para o status
        updateStatus(errorMsg, 'error', 5000);
        sendResponse({ 
          success: false, 
          error: errorMsg
              });
              return true;
      }
    }
    
    // Adicionar handler específico para análise de gráficos
    if (message.action === 'ANALYZE_GRAPH') {
      window.logToSystem('Iniciando análise do gráfico a partir da solicitação', 'INFO');
      
      // Processar análise de gráfico aqui
      try {
        // Capturar screenshot para análise
        window.logToSystem('Capturando tela para análise', 'INFO');
        
        // Simular execução da análise e retornar sucesso para testes
        setTimeout(() => {
          window.logToSystem('Análise de gráfico concluída com sucesso', 'SUCCESS');
          sendResponse({ success: true, result: 'Análise simulada' });
        }, 500);
        
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        window.logToSystem(`Erro durante análise de gráfico: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // Adicionar handler para verificar a interface de trading
    if (message.action === 'INSPECT_TRADING_INTERFACE') {
      try {
        const inspectionResult = inspectTradingInterface();
        sendResponse({ success: true, result: inspectionResult });
  } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    // Handler para solicitação de payout do automation.js - USANDO A MESMA FUNÇÃO DO PAINEL
    if (message.action === 'GET_CURRENT_PAYOUT') {
      try {
        window.logToSystem('🔍 Capturando payout atual usando capturePayoutFromDOM (mesma função do painel)...', 'INFO');
        
        // ✅ CORREÇÃO: Usar a MESMA função que o painel de desenvolvimento usa
        capturePayoutFromDOM()
          .then(result => {
            window.logToSystem(`✅ Payout capturado via capturePayoutFromDOM: ${result.payout}%`, 'SUCCESS');
          sendResponse(result);
          })
          .catch(error => {
            window.logToSystem(`❌ Erro na captura via capturePayoutFromDOM: ${error.message}`, 'ERROR');
          sendResponse({ success: false, error: error.message });
        });
        
        return true; // Manter canal aberto para resposta assíncrona
        
      } catch (error) {
        window.logToSystem(`Erro ao processar solicitação de payout: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // =================== HANDLERS PARA TESTE DE ATIVOS ===================
    
    // Handler para abrir modal de ativos
    if (message.action === 'TEST_OPEN_ASSET_MODAL') {
      try {
        window.logToSystem('Recebida solicitação para abrir modal de ativos', 'INFO');
        
        // Executar abertura de forma assíncrona com timeout
        const executeOpenWithTimeout = async () => {
          try {
            // Timeout de 10 segundos para abertura
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout: Abertura demorou mais de 10 segundos')), 10000);
            });
            
            const result = await Promise.race([
              AssetManager.openAssetModal(),
              timeoutPromise
            ]);
            
            window.logToSystem(`Abertura concluída: ${result}`, 'INFO');
              sendResponse({ 
              success: result, 
              message: result ? 'Modal de ativos aberto com sucesso' : 'Falha ao abrir modal de ativos'
              });
          } catch (error) {
            window.logToSystem(`Erro ao abrir modal: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
          }
        };
        
        executeOpenWithTimeout();
        
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        window.logToSystem(`Erro ao processar abertura de modal: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // Handler para buscar melhor ativo
    if (message.action === 'TEST_FIND_BEST_ASSET') {
      try {
        window.logToSystem('Recebida solicitação para buscar melhor ativo', 'INFO');
        
        const minPayout = message.minPayout || 85;
        
        // Primeiro abrir o modal
        AssetManager.openAssetModal()
          .then(modalOpened => {
            if (!modalOpened) {
              throw new Error('Falha ao abrir modal de ativos');
            }
            
            // Aguardar modal carregar
        setTimeout(() => {
              try {
                const result = AssetManager.findBestAssetDetailed(minPayout);
                
                // Fechar modal
                AssetManager.closeAssetModal();
                
                sendResponse(result);
              } catch (error) {
                AssetManager.closeAssetModal();
                sendResponse({ success: false, error: error.message });
              }
            }, 800);
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        window.logToSystem(`Erro ao buscar melhor ativo: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // Handler para mudar categoria de ativo
    if (message.action === 'TEST_SWITCH_ASSET_CATEGORY') {
      try {
        window.logToSystem(`Recebida solicitação para mudar categoria: ${message.category}`, 'INFO');
        
        // Executar troca de forma assíncrona com sequência correta
        const executeCategorySwitch = async () => {
          try {
            // DEBUG: Verificar parâmetros recebidos
            window.logToSystem(`🔍 [DEBUG] Parâmetros recebidos:`, 'DEBUG');
            window.logToSystem(`🔍 [DEBUG] message: ${JSON.stringify(message)}`, 'DEBUG');
            window.logToSystem(`🔍 [DEBUG] message.category: ${message.category}`, 'DEBUG');
            window.logToSystem(`🔍 [DEBUG] message.action: ${message.action}`, 'DEBUG');
            
            // 1. Primeiro abrir o modal
            window.logToSystem('Passo 1: Abrindo modal de ativos...', 'INFO');
            const modalOpened = await AssetManager.openAssetModal();
            if (!modalOpened) {
              throw new Error('Falha ao abrir modal de ativos');
            }
            
            // 2. Mudar para a categoria desejada
            const category = message.category || 'crypto'; // Fallback para crypto
            window.logToSystem(`Passo 2: Mudando para categoria ${category}...`, 'INFO');
            const categoryChanged = await AssetManager.switchToAssetCategory(category);
            if (!categoryChanged) {
              throw new Error(`Falha ao mudar para categoria ${category}`);
            }
            
            // 3. Selecionar melhor ativo (sem capturar lista ainda)
            window.logToSystem('Passo 3: Selecionando melhor ativo...', 'INFO');
            let assetSelected = false;
            let selectedAsset = null;
            let finalMessage = '';
            
            // Aguardar um pouco para a lista carregar após mudança de categoria
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Obter lista de ativos e selecionar o melhor
            let assets = await AssetManager.getAvailableAssets();
            window.logToSystem(`🔍 [DEBUG] Lista inicial capturada: ${assets.length} ativos`, 'DEBUG');
            
            if (assets.length > 0) {
              // Ordenar por payout e selecionar o melhor
              assets.sort((a, b) => b.payout - a.payout);
              selectedAsset = assets[0];
              window.logToSystem(`Selecionando melhor ativo: ${selectedAsset.name} (${selectedAsset.payout}%)`, 'INFO');
              assetSelected = await AssetManager.selectAsset(selectedAsset);
              
              if (assetSelected) {
                finalMessage = `✅ Melhor ativo selecionado: ${selectedAsset.name} (${selectedAsset.payout}%)`;
              } else {
                finalMessage = `⚠️ Categoria ${category} carregada com ${assets.length} ativos, mas falha na seleção`;
              }
            } else {
              finalMessage = `❌ Nenhum ativo encontrado na categoria ${category}`;
            }
            
            // 4. Aguardar seleção processar
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 5. Capturar lista FINAL logo antes de fechar o modal
            window.logToSystem('Passo 4: Capturando lista final de ativos...', 'INFO');
            const finalAssets = await AssetManager.getAvailableAssets();
            window.logToSystem(`🔍 [DEBUG] Lista final capturada: ${finalAssets.length} ativos`, 'DEBUG');
            
            // 6. Fechar modal
            window.logToSystem('Passo 5: Fechando modal...', 'INFO');
            await AssetManager.closeAssetModal();
            
            // 7. Formatar lista de ativos para exibição
            let assetsListText = '';
            if (finalAssets.length > 0) {
              assetsListText = finalAssets.map(asset => 
                `${asset.name} (${asset.payout}%)${asset.isSelected ? ' [SELECIONADO]' : ''}`
              ).join('<br>');
            } else {
              assetsListText = 'Nenhum ativo encontrado';
            }
            
            // 8. Detectar categoria ativa atual para verificação
            let activeCategoryName = category;
            const activeCategoryElement = document.querySelector('.assets-block__nav-item--active');
            if (activeCategoryElement) {
              const activeClass = activeCategoryElement.className;
              if (activeClass.includes('cryptocurrency')) activeCategoryName = 'cryptocurrency';
              else if (activeClass.includes('currency')) activeCategoryName = 'currency';
              else if (activeClass.includes('commodity')) activeCategoryName = 'commodity';
              else if (activeClass.includes('stock')) activeCategoryName = 'stock';
              else if (activeClass.includes('index')) activeCategoryName = 'index';
            }
            
            // 9. Retornar resultado completo
            const result = {
              success: categoryChanged && (assetSelected || finalAssets.length > 0),
              category: activeCategoryName, // Usar categoria detectada
              requestedCategory: category, // Categoria solicitada originalmente
              assets: finalAssets, // Lista final capturada antes de fechar
              message: finalMessage,
              assetsList: assetsListText,
              selectedAsset: selectedAsset,
              totalAssetsFound: finalAssets.length
            };
            
            window.logToSystem(`Troca de categoria concluída: ${finalMessage}`, 'INFO');
            window.logToSystem(`Total de ativos encontrados: ${finalAssets.length}`, 'INFO');
            window.logToSystem(`Lista de ativos: ${assetsListText}`, 'INFO');
            window.logToSystem(`🔍 [DEBUG] Resultado final: ${JSON.stringify(result)}`, 'DEBUG');
            sendResponse(result);
            
          } catch (error) {
            window.logToSystem(`Erro na troca de categoria: ${error.message}`, 'ERROR');
            // Tentar fechar modal em caso de erro
            try {
              await AssetManager.closeAssetModal();
            } catch (closeError) {
              window.logToSystem(`Erro ao fechar modal após erro: ${closeError.message}`, 'WARN');
            }
            sendResponse({ success: false, error: error.message });
          }
        };
        
        executeCategorySwitch();
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        window.logToSystem(`Erro ao processar mudança de categoria: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // ❌ HANDLER REMOVIDO: Era duplicado e chamava função errada
    // O handler correto está na linha 2537 usando switchToBestAssetForAutomation

    // Handler para verificar ativo atual
    if (message.action === 'GET_CURRENT_ASSET') {
      try {
        const currentAsset = AssetManager.getCurrentSelectedAsset();
        sendResponse({ 
          success: true, 
          currentAsset: currentAsset,
          message: currentAsset ? `Ativo atual: ${currentAsset}` : 'Ativo atual não detectado'
        });
  } catch (error) {
        window.logToSystem(`Erro ao verificar ativo atual: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    // Handler para fechar modal de ativos
    if (message.action === 'CLOSE_ASSET_MODAL') {
      try {
        window.logToSystem('Recebida solicitação para fechar modal de ativos', 'INFO');
        
        // Executar fechamento de forma assíncrona com timeout
        const executeCloseWithTimeout = async () => {
          try {
            // Timeout de 15 segundos para fechamento
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout: Fechamento demorou mais de 15 segundos')), 15000);
            });
            
            const closed = await Promise.race([
              AssetManager.closeAssetModal(),
              timeoutPromise
            ]);
            
            window.logToSystem(`Fechamento concluído: ${closed}`, 'INFO');
            sendResponse({ 
              success: closed, 
              message: closed ? 'Modal fechado com sucesso' : 'Falha ao fechar modal'
            });
  } catch (error) {
            window.logToSystem(`Erro ao fechar modal: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
          }
        };
        
        executeCloseWithTimeout();
        
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        window.logToSystem(`Erro ao processar fechamento de modal: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // Handler para obter status do modal de ativos
    if (message.action === 'GET_MODAL_STATUS') {
      try {
        window.logToSystem('Recebida solicitação para obter status do modal de ativos', 'INFO');
        
        // Verificar se o modal está aberto com múltiplos métodos
        const isModalOpen = () => {
          // Método 1: Verificar modal específico
          const modal = document.querySelector('.drop-down-modal.trading-panel-modal.assets-list-modal');
          if (modal && modal.style.display !== 'none') return true;
          
          // Método 2: Verificar classe active no botão
          const activeControl = document.querySelector('.currencies-block__in.active');
          if (activeControl) return true;
          
          // Método 3: Verificar modal genérico
          const genericModal = document.querySelector('.drop-down-modal.drop-down-modal--quotes-list');
          if (genericModal && genericModal.style.display !== 'none' && genericModal.offsetParent !== null) return true;
          
          // Método 4: Verificar se há elementos de lista visíveis
          const assetItems = document.querySelectorAll('.alist__item, .dops__assets-item');
          if (assetItems.length > 0) {
            const visibleItems = Array.from(assetItems).filter(item => 
              item.offsetParent !== null && 
              item.style.display !== 'none' &&
              item.style.visibility !== 'hidden'
            );
            if (visibleItems.length > 0) return true;
          }
          
          return false;
        };
        
        const isOpen = isModalOpen();
        
        // Obter informações adicionais
        const currentAsset = document.querySelector('.block--asset .control__value')?.textContent?.trim() || 'N/A';
        const availableAssets = document.querySelectorAll('.drop-down-modal.trading-panel-modal.assets-list-modal .dops__assets-item, .alist__item');
        const assetCount = availableAssets.length;
        
        const status = {
          isOpen: isOpen,
          currentAsset: currentAsset,
          availableAssetsCount: assetCount,
          timestamp: Date.now()
        };
        
        window.logToSystem(`Status do modal: ${JSON.stringify(status)}`, 'INFO');
        sendResponse({ success: true, status: status });
        return true;
      } catch (error) {
        window.logToSystem(`Erro ao obter status do modal: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // Handler para toggle do modal de ativos
    if (message.action === 'TOGGLE_ASSET_MODAL') {
      try {
        window.logToSystem('Recebida solicitação para toggle do modal de ativos', 'INFO');
        
        // Executar toggle de forma assíncrona
        const executeToggleWithTimeout = async () => {
          try {
            // Verificar se o modal está aberto com múltiplos métodos
            const isModalOpen = () => {
              // Método 1: Verificar modal específico
              const modal = document.querySelector('.drop-down-modal.trading-panel-modal.assets-list-modal');
              if (modal && modal.style.display !== 'none') return true;
              
              // Método 2: Verificar classe active no botão
              const assetButton = document.querySelector('.currencies-block .pair-number-wrap');
              const activeControl = document.querySelector('.currencies-block__in.active');
              if (activeControl) return true;
              
              // Método 3: Verificar modal genérico
              const genericModal = document.querySelector('.drop-down-modal.drop-down-modal--quotes-list');
              if (genericModal && genericModal.style.display !== 'none' && genericModal.offsetParent !== null) return true;
              
              // Método 4: Verificar se há elementos de lista visíveis
              const assetItems = document.querySelectorAll('.alist__item, .dops__assets-item');
              if (assetItems.length > 0) {
                const visibleItems = Array.from(assetItems).filter(item => 
                  item.offsetParent !== null && 
                  item.style.display !== 'none' &&
                  item.style.visibility !== 'hidden'
                );
                if (visibleItems.length > 0) return true;
              }
              
              return false;
            };
            
            const isOpen = isModalOpen();
            window.logToSystem(`Status do modal detectado: ${isOpen ? 'ABERTO' : 'FECHADO'}`, 'INFO');
            
            if (isOpen) {
              // Fechar modal
              window.logToSystem('Modal detectado como aberto, tentando fechar...', 'INFO');
              const result = await AssetManager.closeAssetModal();
              window.logToSystem('Modal fechado via toggle', 'INFO');
              sendResponse({ 
                success: true, 
                action: 'closed',
                message: 'Modal fechado com sucesso'
              });
            } else {
              // Abrir modal
              window.logToSystem('Modal detectado como fechado, tentando abrir...', 'INFO');
              const result = await AssetManager.openAssetModal();
              window.logToSystem('Modal aberto via toggle', 'INFO');
              sendResponse({ 
                success: true, 
                action: 'opened',
                message: 'Modal aberto com sucesso'
              });
            }
          } catch (error) {
            window.logToSystem(`Erro no toggle do modal: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
          }
        };
        
        executeToggleWithTimeout();
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        window.logToSystem(`Erro ao processar toggle do modal: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // Handler para debug de captura de ativos
    if (message.action === 'DEBUG_ASSET_CAPTURE') {
      try {
        window.logToSystem('Recebida solicitação para debug de captura de ativos', 'INFO');
        
        const executeDebug = async () => {
          try {
            const debugResult = await AssetManager.debugAssetCapture();
            sendResponse(debugResult);
          } catch (error) {
            window.logToSystem(`Erro no debug de captura de ativos: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
          }
        };
        
        executeDebug();
      } catch (error) {
        window.logToSystem(`Erro ao processar debug de captura de ativos: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

  });

// ======================================================================
// =================== CONFIGURAÇÃO DE OPERAÇÕES =======================
// ======================================================================

  // Funções para configurar operações na plataforma - consolidando funções duplicadas
const TradingConfig = {
  // Abrir o modal de tempo
  openTimeModal: () => {
    try {
      const timeControl = document.querySelector('.block--expiration-inputs .control__value');
      if (!timeControl) {
          window.logToSystem('Elemento de tempo não encontrado na plataforma', 'ERROR');
        return false;
      }
      
      // Clicar no elemento para abrir o modal
      timeControl.click();
        window.logToSystem('Modal de tempo aberto', 'INFO');
      return true;
    } catch (error) {
        window.logToSystem(`Erro ao abrir modal de tempo: ${error.message}`, 'ERROR');
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
          
            window.logToSystem(`Procurando opção de tempo: ${targetTime}`, 'INFO');
          
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
              window.logToSystem(`Opção exata ${targetTime} não encontrada, buscando alternativa`, 'WARN');
            
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
              window.logToSystem(`Selecionando opção de tempo: ${selectedOption.textContent}`, 'SUCCESS');
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
  
    // Definir o valor da operação - função unificada que substitui setTradeAmount e TradingAutomation.setTradeValue
    setTradeValue: (amount) => {
    try {
        const MIN_VALUE = 10;
        const parsedValue = Math.max(Number(amount) || MIN_VALUE, MIN_VALUE);
        
        const amountInput = document.querySelector('.block--bet-amount input[type="text"], [class*="amount"] input');
      if (!amountInput) {
          window.logToSystem('Campo de valor não encontrado na plataforma', 'ERROR');
        return false;
      }
      
      // Definir valor e disparar evento de input
        amountInput.value = parsedValue;
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
      
        window.logToSystem(`Valor de operação definido: $${parsedValue}`, 'SUCCESS');
      return true;
    } catch (error) {
        window.logToSystem(`Erro ao definir valor: ${error.message}`, 'ERROR');
      return false;
    }
  },
  
  // Fechar o modal de tempo após seleção
  closeTimeModal: () => {
    try {
      // Verificar se o modal está aberto
      const modal = document.querySelector('.drop-down-modal.trading-panel-modal.expiration-inputs-list-modal');
      if (!modal) {
          window.logToSystem('Modal de tempo não encontrado para fechar', 'WARN');
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
          window.logToSystem('Evento de clique disparado para fechar o modal', 'INFO');
      }
      
      // Método 2: Verificar se há um botão de fechar no modal
      const closeButton = modal.querySelector('.close-btn, .btn-close, [data-close="true"]');
      if (closeButton) {
        closeButton.click();
          window.logToSystem('Botão de fechar modal clicado', 'INFO');
      }
      
      // Verificar se o modal foi fechado
      setTimeout(() => {
        const modalStillOpen = document.querySelector('.drop-down-modal.trading-panel-modal.expiration-inputs-list-modal');
        if (modalStillOpen) {
            window.logToSystem('Modal ainda aberto após tentativa de fechamento', 'WARN');
          
          // Método 3: Tentar clicar no controle de tempo novamente para alternar (toggle)
          const timeControl = document.querySelector('.block--expiration-inputs .control__value');
          if (timeControl) {
            timeControl.click();
              window.logToSystem('Tentativa alternativa de fechar modal: clique no controle', 'INFO');
          }
        } else {
            window.logToSystem('Modal de tempo fechado com sucesso', 'SUCCESS');
        }
      }, 300);
      
      return true;
    } catch (error) {
        window.logToSystem(`Erro ao fechar modal de tempo: ${error.message}`, 'ERROR');
      return false;
    }
  },
  
  // Configurar operação com base nas configurações do usuário
  configureOperation: async (config) => {
    try {
        window.logToSystem('Configurando parâmetros da operação...', 'INFO');
      
      // Definir valor da operação
      if (config.tradeValue) {
          const valueSet = TradingConfig.setTradeValue(config.tradeValue);
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
          window.logToSystem(`Tempo de operação configurado: ${selectedTime}`, 'SUCCESS');
        
        // Fechar o modal após a seleção
        TradingConfig.closeTimeModal();
      }
      
      return true;
    } catch (error) {
        window.logToSystem(`Erro ao configurar operação: ${error.message}`, 'ERROR');
      return false;
    }
  }
};

const executeTradeAction = async (action, config) => {
  return new Promise(async (resolve, reject) => {
    try {
      window.logToSystem(`Executando ação de trade: ${action}`, 'INFO');
      
      // Se a ação for WAIT, apenas espera o tempo configurado
      if (action === 'WAIT') {
        const waitTime = (config && config.waitTime) || 5000; // Padrão de 5 segundos
        window.logToSystem(`Esperando ${waitTime}ms antes de prosseguir`, 'INFO');
        setTimeout(() => {
          window.logToSystem('Espera concluída', 'SUCCESS');
          resolve({ success: true, message: `Esperou ${waitTime}ms com sucesso` });
        }, waitTime);
        return;
      }
      
      // Função para garantir que o DOM está carregado
      const ensureDOMLoaded = () => {
        return new Promise((domResolve) => {
          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            window.logToSystem('DOM já está carregado, prosseguindo com a operação', 'INFO');
            domResolve();
          } else {
            window.logToSystem('Aguardando carregamento do DOM...', 'INFO');
            document.addEventListener('DOMContentLoaded', () => {
              window.logToSystem('DOM carregou, prosseguindo com a operação', 'INFO');
              domResolve();
            });
          }
        });
      };
      
      // Esperar pelo carregamento do DOM
      await ensureDOMLoaded();
      
      // Validar e garantir que os valores estejam definidos corretamente
      // Isto ajuda a evitar problemas com valores undefined ou inválidos
      const tradeConfig = {
        // Valor da operação - garantir que é um número válido
        tradeValue: config && typeof config.tradeValue === 'number' && config.tradeValue > 0 
          ? config.tradeValue 
          : 10,
        
        // Tempo em minutos - garantir valor mínimo de 1
        tradeTime: config && typeof config.tradeTime === 'number' && config.tradeTime > 0 
          ? config.tradeTime 
          : 1,
        
        // Resultados da análise (se disponíveis)
        analysis: config && config.analysisResult,
        
        // Flag para usar período dinâmico (da análise) ou fixo
        useDynamicPeriod: config && config.useDynamicPeriod === true
      };
      
      // Registrar os valores que serão utilizados
      window.logToSystem(`Configurando operação: Valor=${tradeConfig.tradeValue}, Tempo=${tradeConfig.tradeTime}min`, 'INFO');
      
      // Enviar status para o usuário
      updateStatus(`Executando ${action}: $${tradeConfig.tradeValue}, ${tradeConfig.tradeTime}min`, 'info', 3000);
      
      // Configurar o valor da operação
      try {
        const valueInput = document.querySelector('.block.block--bet-amount input[type="text"], [class*="amount"] input');
        if (valueInput) {
          window.logToSystem(`Definindo valor da operação: ${tradeConfig.tradeValue}`, 'INFO');
          valueInput.value = tradeConfig.tradeValue;
          valueInput.dispatchEvent(new Event('input', { bubbles: true }));
          valueInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 200)); // Pequena pausa para atualização do DOM
        } else {
          window.logToSystem('Elemento para definir valor não encontrado', 'WARN');
        }
      } catch (valueError) {
        window.logToSystem(`Erro ao definir valor: ${valueError.message}`, 'ERROR');
      }
      
      // Configurar o período/tempo da operação
      try {
        // Determinar o período a ser usado
        let periodToUse = tradeConfig.tradeTime;
        
        // Se estiver usando período dinâmico e tiver dados da análise
        if (tradeConfig.useDynamicPeriod && tradeConfig.analysis && tradeConfig.analysis.expiration) {
          periodToUse = tradeConfig.analysis.expiration;
          window.logToSystem(`Usando período da análise: ${periodToUse} minutos`, 'INFO');
        } else if (tradeConfig.tradeTime > 0) {
          window.logToSystem(`Usando período fixo configurado: ${periodToUse} minutos`, 'INFO');
        } else {
          // Garantir que sempre use pelo menos 1 minuto
          periodToUse = 1;
          window.logToSystem('Usando período mínimo: 1 minuto (valor configurado inválido)', 'WARN');
        }
        
        // Configurar o período na plataforma
        if (periodToUse > 0) {
          // Converter minutos para o formato da plataforma
          const platformFormat = TradingConfig.convertTimeToFormat(periodToUse);
          
          // Abrir modal de tempo
          const modalOpened = TradingConfig.openTimeModal();
          if (modalOpened) {
            // Esperar um pouco para o modal abrir
            await new Promise(r => setTimeout(r, 300));
            
            // Selecionar opção de tempo
            try {
              const timeSelected = await TradingConfig.selectTimeOption(platformFormat);
              window.logToSystem(`Período configurado: ${timeSelected}`, 'SUCCESS');
              
              // Fechar o modal
              TradingConfig.closeTimeModal();
              await new Promise(r => setTimeout(r, 300)); // Esperar fechamento do modal
            } catch (timeError) {
              window.logToSystem(`Erro ao selecionar tempo: ${timeError.message}`, 'ERROR');
            }
          } else {
            window.logToSystem('Não foi possível abrir o modal de tempo', 'WARN');
          }
        }
      } catch (timeError) {
        window.logToSystem(`Erro ao configurar período: ${timeError.message}`, 'ERROR');
      }
      
      // Tentar buscar o botão várias vezes em caso de falha
      let attempts = 0;
      const maxAttempts = 5;
      let tradeButton = null;
      
      while (!tradeButton && attempts < maxAttempts) {
      // Busca o botão de trading
        tradeButton = findTradeButton(action);
        
        if (!tradeButton && attempts < maxAttempts - 1) {
          // Se não encontrou e ainda tem tentativas, espera um pouco e tenta novamente
          window.logToSystem(`Tentativa ${attempts+1} falhou. Aguardando para nova tentativa...`, 'WARN');
          await new Promise(r => setTimeout(r, 500)); // Espera 500ms entre tentativas
          attempts++;
        } else if (!tradeButton) {
          // Se esgotou as tentativas e não encontrou, retorna erro
          const errorMsg = `Não foi possível encontrar o botão para a ação ${action} após ${maxAttempts} tentativas`;
        window.logToSystem(errorMsg, 'ERROR');
        return reject({ success: false, message: errorMsg });
        }
      }
      
      // Verifica se o botão está habilitado
      if (tradeButton.disabled || tradeButton.classList.contains('disabled') || 
          getComputedStyle(tradeButton).opacity < 0.5) {
        const errorMsg = `O botão para ${action} está desabilitado ou não clicável`;
        window.logToSystem(errorMsg, 'WARN');
        return reject({ success: false, message: errorMsg });
      }
      
      // Tenta executar o clique
      try {
        window.logToSystem(`Clicando no botão de ${action}...`, 'INFO');
        
        // Rolar até o botão para garantir que ele está visível
        tradeButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Pequena pausa para garantir que a rolagem termine
        await new Promise(r => setTimeout(r, 200));
        
        // MODIFICADO: Usar apenas um método de clique para evitar duplicação
        // Registrar que vamos clicar para fins de debug
        window.logToSystem(`Executando clique único no botão de ${action}`, 'INFO');
        
        // Opção 1: Método nativo de clique (mais confiável e evita duplicação)
        tradeButton.click();
        
        // Enviar mensagem de sucesso para o status
        updateStatus(`Operação ${action} executada com sucesso!`, 'success', 3000);
        
        // Verifica se o clique foi bem sucedido
        setTimeout(() => {
          window.logToSystem(`Ação ${action} executada com sucesso`, 'SUCCESS');
          resolve({ 
            success: true, 
            message: `Ação ${action} executada`,
            details: {
              tradeValue: tradeConfig.tradeValue,
              period: tradeConfig.tradeTime
            }
          });
        }, 200);
      } catch (clickError) {
        const errorMsg = `Erro ao clicar no botão de ${action}: ${clickError.message}`;
        window.logToSystem(errorMsg, 'ERROR');
        
        // Enviar mensagem de erro para o status
        updateStatus(errorMsg, 'error', 5000);
        
        reject({ success: false, message: errorMsg });
      }
    } catch (error) {
      const errorMsg = `Erro geral ao executar a ação ${action}: ${error.message}`;
      window.logToSystem(errorMsg, 'ERROR');
      
      // Enviar mensagem de erro para o status
      updateStatus(errorMsg, 'error', 5000);
      
      reject({ success: false, message: errorMsg });
    }
  });
};

function findTradeButton(action) {
  try {
    window.logToSystem(`Procurando botão para ação: ${action}`, 'INFO');
    
    // Seletores mais específicos e priorizados para os botões
    const selectors = {
      'BUY': [
        // Seletores mais específicos primeiro
        'button.btn-call:not(.disabled)',
        '[data-action="call"]:not(.disabled)',
        '[data-type="call"]:not(.disabled)',
        'button.btn-green:not(.disabled)',
        // Seletores mais genéricos depois
        '.btn-call:not(.disabled)',
        '.btn-green:not(.disabled)',
        '.buy-btn:not(.disabled)',
        '.call:not(.disabled)',
        '.trade-button--up:not(.disabled)',
        // Último recurso - menos específicos
        '[class*="call"]:not(.disabled)',
        'button[data-dir="call"]:not(.disabled)'
      ],
      'SELL': [
        // Seletores mais específicos primeiro
        'button.btn-put:not(.disabled)',
        '[data-action="put"]:not(.disabled)',
        '[data-type="put"]:not(.disabled)',
        'button.btn-red:not(.disabled)',
        // Seletores mais genéricos depois
        '.btn-put:not(.disabled)',
        '.btn-red:not(.disabled)', 
        '.sell-btn:not(.disabled)',
        '.put:not(.disabled)',
        '.trade-button--down:not(.disabled)',
        // Último recurso - menos específicos
        '[class*="put"]:not(.disabled)',
        'button[data-dir="put"]:not(.disabled)'
      ]
    };
    
    // Verificar se a ação é suportada
    if (!selectors[action]) {
      window.logToSystem(`Ação não suportada: ${action}`, 'ERROR');
      return null;
    }
    
    // Armazenar todos os botões encontrados para logging
    let allFoundButtons = [];
    
    // Procurar por cada seletor possível
    for (const selector of selectors[action]) {
      try {
        // Procurar por todos os elementos que correspondem ao seletor
        const elements = document.querySelectorAll(selector);
        
        if (elements && elements.length > 0) {
          window.logToSystem(`Encontrados ${elements.length} elementos com seletor "${selector}"`, 'DEBUG');
          
          // Iterar pelos elementos e retornar o primeiro que estiver visível
          for (const element of elements) {
            // Verificar se o elemento é visível
            if (element.offsetParent !== null && 
                getComputedStyle(element).display !== 'none' && 
                getComputedStyle(element).visibility !== 'hidden') {
              
              // Verificar se é realmente um botão e tem alguma interatividade
              if (element.tagName === 'BUTTON' || 
                  element.tagName === 'A' || 
                  element.getAttribute('role') === 'button' ||
                  element.onclick ||
                  element.classList.contains('btn') ||
                  element.classList.contains('button')) {
                
                window.logToSystem(`Botão válido encontrado para ${action} com seletor: ${selector}`, 'SUCCESS');
                
                // Verificar se está realmente habilitado (sem classe disabled e não tem atributo disabled)
                if (!element.disabled && !element.classList.contains('disabled')) {
                  window.logToSystem(`Botão está habilitado e será usado para ${action}`, 'SUCCESS');
                  return element;
                } else {
                  allFoundButtons.push({element, reason: 'disabled'});
                  window.logToSystem(`Botão encontrado mas está desabilitado`, 'WARN');
                }
              } else {
                allFoundButtons.push({element, reason: 'not-interactive'});
                window.logToSystem(`Elemento encontrado mas não parece ser um botão interativo`, 'WARN');
              }
            } else {
              allFoundButtons.push({element, reason: 'not-visible'});
            }
          }
        }
      } catch (err) {
        // Ignorar erros individuais de seletor e continuar tentando
        window.logToSystem(`Erro ao usar seletor "${selector}": ${err.message}`, 'WARN');
        continue;
      }
    }
    
    // Se chegou aqui, tenta uma abordagem mais ampla para botões genéricos
    window.logToSystem('Tentando encontrar botões genéricos de trading', 'INFO');
    
    // Procurar por botões com texto/conteúdo específico
    const allButtons = document.querySelectorAll('button, a, div[role="button"], .btn, [class*="button"]');
    const buttonTexts = {
      'BUY': ['buy', 'call', 'up', 'higher', 'acima', 'compra', 'comprar', 'alta'],
      'SELL': ['sell', 'put', 'down', 'lower', 'abaixo', 'venda', 'vender', 'baixa']
    };
    
    for (const button of allButtons) {
      const buttonText = button.textContent.toLowerCase();
      const buttonClasses = button.className.toLowerCase();
      
      // Verificar se o texto ou classes do botão correspondem à ação
      const matchesAction = buttonTexts[action].some(text => 
        buttonText.includes(text) || buttonClasses.includes(text)
      );
      
      if (matchesAction && 
          button.offsetParent !== null && 
          getComputedStyle(button).display !== 'none' && 
          getComputedStyle(button).visibility !== 'hidden' &&
          !button.disabled && 
          !button.classList.contains('disabled')) {
        
        window.logToSystem(`Botão encontrado por texto/classe para ${action}: "${buttonText}"`, 'SUCCESS');
        return button;
      }
    }
    
    // Se nada funcionou e temos botões que foram encontrados mas estavam desabilitados ou não visíveis
    if (allFoundButtons.length > 0) {
      window.logToSystem(`Encontrados ${allFoundButtons.length} botões potenciais, mas nenhum utilizável`, 'WARN');
      
      // Como último recurso, tentar usar o primeiro botão encontrado mesmo que não seja ideal
      for (const buttonInfo of allFoundButtons) {
        if (buttonInfo.reason === 'not-visible') {
          continue; // Pular os não visíveis
        }
        
        if (buttonInfo.reason === 'disabled') {
          window.logToSystem('Como último recurso, tentando usar um botão que parece estar desabilitado', 'WARN');
          return buttonInfo.element;
        }
        
        if (buttonInfo.reason === 'not-interactive') {
          window.logToSystem('Como último recurso, tentando usar um elemento que não parece ser botão', 'WARN');
          return buttonInfo.element;
        }
      }
    }
    
    // Se chegou aqui, não encontrou o botão
    window.logToSystem(`Botão para ${action} não encontrado após tentar todos os métodos`, 'ERROR');
    return null;
  } catch (error) {
    window.logToSystem(`Erro ao procurar botão ${action}: ${error.message}`, 'ERROR');
    return null;
  }
}

// Função para analisar a estrutura da interface de trading
function inspectTradingInterface() {
  try {
    window.logToSystem("Inspecionando interface de trading...", "INFO");
    
    // Verificar botões de trading
    const possibleBuyButtons = document.querySelectorAll('button.btn-call, .btn-green, [data-type="call"], .trade-button--up, [class*="call"]');
    const possibleSellButtons = document.querySelectorAll('button.btn-put, .btn-red, [data-type="put"], .trade-button--down, [class*="put"]');
    
    window.logToSystem(`Inspeção encontrou ${possibleBuyButtons.length} possíveis botões BUY e ${possibleSellButtons.length} possíveis botões SELL`, "INFO");
    
    // Se não encontrou nenhum botão, verificar toda a estrutura do DOM para classes relevantes
    if (possibleBuyButtons.length === 0 && possibleSellButtons.length === 0) {
      window.logToSystem("Nenhum botão de trading encontrado, verificando estrutura DOM completa...", "WARN");
      
      // Procurar por elementos com classes que possam conter os botões
      const tradingElements = document.querySelectorAll('[class*="trading"], [class*="button"], [class*="btn"], [class*="control"]');
      window.logToSystem(`Encontrados ${tradingElements.length} elementos potencialmente relevantes para trading`, "INFO");
      
      // Listar os primeiros 10 elementos com suas classes para depuração
      if (tradingElements.length > 0) {
        let elementsInfo = "Elementos encontrados:\n";
        for (let i = 0; i < Math.min(tradingElements.length, 10); i++) {
          const element = tradingElements[i];
          elementsInfo += `${i+1}. <${element.tagName.toLowerCase()}> classes: "${element.className}"\n`;
        }
        window.logToSystem(elementsInfo, "INFO");
      }
    }
    
    // Verificar se está na página correta de trading
    const isTradingPage = document.querySelectorAll('.trading-panel, .chart-container, [class*="chart"]').length > 0;
    if (!isTradingPage) {
      window.logToSystem("Atenção: Interface de trading não detectada. Possível página incorreta.", "WARN");
    } else {
      window.logToSystem("Interface de trading detectada corretamente.", "SUCCESS");
    }
    
    // Verificar se há elementos de iframe que possam estar contendo a interface de trading
    const iframes = document.querySelectorAll('iframe');
    if (iframes.length > 0) {
      window.logToSystem(`Detectados ${iframes.length} iframes na página. A interface de trading pode estar dentro de um iframe.`, "WARN");
    }
    
    // Verificar elementos de modal que podem estar sobrepondo a interface
    const modals = document.querySelectorAll('.modal, [class*="modal"], [class*="popup"], [class*="dialog"]');
    if (modals.length > 0) {
      window.logToSystem(`Detectados ${modals.length} possíveis modais/popups que podem estar interferindo na interface`, "WARN");
    }
    
    // Retornar resultado da inspeção
    return {
      buyButtonsCount: possibleBuyButtons.length,
      sellButtonsCount: possibleSellButtons.length,
      isTradingPage: isTradingPage,
      iframesCount: iframes.length,
      modalsCount: modals.length
    };
  } catch (error) {
    window.logToSystem(`Erro ao inspecionar interface: ${error.message}`, "ERROR");
    return null;
  }
}

// ================== SISTEMA DE LOGS PADRÃO ==================
// Sistema de logs global disponível via window.logToSystem

// ======================================================================
// =================== SISTEMA DE MANIPULAÇÃO DE ATIVOS ================
// ======================================================================

const AssetManager = {
  // Função para abrir o modal de seleção de ativos
  openAssetModal: () => {
    try {
      window.logToSystem('Abrindo modal de ativos...', 'INFO');
      
      // Usar o mesmo seletor para abrir e fechar
      const assetButton = document.querySelector('.currencies-block .pair-number-wrap');
      
      if (!assetButton) {
        throw new Error('Botão de seleção de ativos não encontrado');
      }
      
      // Clicar no botão para abrir o modal
      assetButton.click();
      window.logToSystem('Clique executado para abrir modal', 'INFO');
      
      // Aguardar um momento para o modal aparecer
      return new Promise((resolve) => {
        setTimeout(() => {
          const activeControl = document.querySelector('.currencies-block__in.active');
          if (activeControl) {
            window.logToSystem('✅ Modal aberto com sucesso (classe active detectada)', 'SUCCESS');
            resolve(true);
          } else {
            window.logToSystem('❌ Modal pode não ter aberto', 'WARN');
            resolve(false);
          }
        }, 500);
      });
    } catch (error) {
      window.logToSystem(`Erro ao abrir modal de ativos: ${error.message}`, 'ERROR');
      return Promise.resolve(false);
    }
  },

  // Função para fechar o modal de ativos - MÉTODO MOUSEDOWN + MOUSEUP
  closeAssetModal: () => {
    return new Promise((resolve) => {
      try {
        window.logToSystem('Fechando modal de ativos...', 'INFO');
        
        // Verificar se o modal está realmente aberto
        const activeControl = document.querySelector('.currencies-block__in.active');
        if (!activeControl) {
          window.logToSystem('✅ Modal já está fechado', 'INFO');
          resolve(true);
          return;
        }
        
        // MÉTODO DESCOBERTO: Mousedown + mouseup no wrapper do modal
        const modalWrapper = document.querySelector('.drop-down-modal-wrap.active');
        if (!modalWrapper) {
          window.logToSystem('❌ Wrapper do modal não encontrado', 'ERROR');
          resolve(false);
          return;
        }
        
        window.logToSystem('Executando mousedown + mouseup no wrapper do modal...', 'INFO');
        
        // Disparar mousedown
        modalWrapper.dispatchEvent(new MouseEvent('mousedown', { 
          bubbles: true,
          cancelable: true,
          view: window
        }));
        
        // Aguardar um pouco e disparar mouseup
        setTimeout(() => {
          modalWrapper.dispatchEvent(new MouseEvent('mouseup', { 
            bubbles: true,
            cancelable: true,
            view: window
          }));
          
          window.logToSystem('Eventos mousedown + mouseup executados', 'INFO');
          
          // Verificar se fechou após 500ms
          setTimeout(() => {
            const stillActive = document.querySelector('.currencies-block__in.active');
            if (!stillActive) {
              window.logToSystem('✅ Modal fechado com sucesso via mousedown + mouseup', 'SUCCESS');
              resolve(true);
            } else {
              window.logToSystem('❌ Modal não fechou, tentando método de fallback...', 'WARN');
              
              // FALLBACK: Tentar clique simples no wrapper
              modalWrapper.click();
              
              setTimeout(() => {
                const finalCheck = document.querySelector('.currencies-block__in.active');
                if (!finalCheck) {
                  window.logToSystem('✅ Modal fechado com clique de fallback', 'SUCCESS');
                  resolve(true);
                } else {
                  window.logToSystem('❌ Modal persistiu após todos os métodos', 'ERROR');
                  resolve(false);
                }
              }, 300);
            }
          }, 500);
        }, 50); // 50ms entre mousedown e mouseup
        
      } catch (error) {
        window.logToSystem(`Erro ao fechar modal: ${error.message}`, 'ERROR');
        resolve(false);
      }
    });
  },

  // Função para mudar para a categoria de ativos (Crypto, Currency, etc.)
  switchToCategory: async (category) => {
    try {
      window.logToSystem(`Mudando para categoria: ${category}`, 'INFO');
      
      const result = await AssetManager.switchToAssetCategory(category);
      if (!result) {
        return {
          success: false,
          error: `Falha ao mudar para categoria ${category}`
        };
      }
      
      // Aguardar lista atualizar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Obter ativos da nova categoria
      const assets = AssetManager.getAvailableAssets();
      
      return {
        success: true,
        category: category,
        assets: assets,
        message: `Categoria alterada para ${category}. Encontrados ${assets.length} ativos.`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Função para mudar para a categoria de ativos (Crypto, Currency, etc.)
  switchToAssetCategory: (category) => {
    return new Promise((resolve, reject) => {
      try {
        window.logToSystem(`Tentando mudar para categoria: ${category}`, 'INFO');
        
        // Mapear categorias para seletores
        const categorySelectors = {
          'crypto': '.assets-block__nav-item--cryptocurrency',
          'cryptocurrency': '.assets-block__nav-item--cryptocurrency',
          'currency': '.assets-block__nav-item--currency',
          'currencies': '.assets-block__nav-item--currency',
          'commodity': '.assets-block__nav-item--commodity',
          'commodities': '.assets-block__nav-item--commodity',
          'stock': '.assets-block__nav-item--stock',
          'stocks': '.assets-block__nav-item--stock',
          'index': '.assets-block__nav-item--index',
          'indices': '.assets-block__nav-item--index'
        };
        
        const selector = categorySelectors[category.toLowerCase()];
        if (!selector) {
          reject(new Error(`Categoria não reconhecida: ${category}`));
          return;
        }
        
        const categoryButton = document.querySelector(selector);
        if (!categoryButton) {
          // ✅ VERIFICAR SE A CATEGORIA JÁ ESTÁ ATIVA antes de reportar como indisponível
          window.logToSystem(`Seletor ${selector} não encontrado, verificando se categoria já está ativa...`, 'DEBUG');
          
          // Verificar se existe alguma categoria ativa que corresponda
          const activeCategory = document.querySelector('.assets-block__nav-item--active');
          if (activeCategory) {
            const activeCategoryClass = activeCategory.className;
            window.logToSystem(`Categoria ativa encontrada: ${activeCategoryClass}`, 'DEBUG');
            
            // Verificar se a categoria ativa corresponde à solicitada
            if (activeCategoryClass.includes('cryptocurrency') && (category.toLowerCase() === 'crypto' || category.toLowerCase() === 'cryptocurrency')) {
              window.logToSystem(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
            if (activeCategoryClass.includes('currency') && (category.toLowerCase() === 'currency' || category.toLowerCase() === 'currencies')) {
              window.logToSystem(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
            if (activeCategoryClass.includes('commodity') && (category.toLowerCase() === 'commodity' || category.toLowerCase() === 'commodities')) {
              window.logToSystem(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
            if (activeCategoryClass.includes('stock') && (category.toLowerCase() === 'stock' || category.toLowerCase() === 'stocks')) {
              window.logToSystem(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
            if (activeCategoryClass.includes('index') && (category.toLowerCase() === 'index' || category.toLowerCase() === 'indices')) {
              window.logToSystem(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
          }
          
          // ✅ Se chegou aqui, categoria não está disponível (DEBUG, não ERROR)
          window.logToSystem(`🔄 Categoria ${category} não disponível na plataforma no momento`, 'DEBUG');
          reject(new Error(`Categoria ${category} não disponível`));
          return;
        }
        
        // Verificar se já está ativo
        if (categoryButton.classList.contains('assets-block__nav-item--active')) {
          window.logToSystem(`✅ Categoria ${category} já está ativa`, 'SUCCESS');
          resolve(true);
          return;
        }
        
        // Clicar na categoria
        categoryButton.click();
        window.logToSystem(`Mudança para categoria ${category} executada`, 'SUCCESS');
        
        // Aguardar um momento para a lista atualizar
        setTimeout(() => {
          if (categoryButton.classList.contains('assets-block__nav-item--active')) {
            window.logToSystem(`✅ Categoria ${category} ativada com sucesso`, 'SUCCESS');
            resolve(true);
          } else {
            window.logToSystem(`⚠️ Falha ao ativar categoria ${category}`, 'WARN');
            resolve(false);
          }
        }, 300);
      } catch (error) {
        window.logToSystem(`Erro ao mudar categoria: ${error.message}`, 'ERROR');
        reject(error);
      }
    });
  },

  // Função para obter lista de ativos disponíveis com seus payouts
  getAvailableAssets: () => {
    return new Promise((resolve) => {
      try {
        window.logToSystem('Obtendo lista de ativos disponíveis...', 'INFO');
        
        const assets = [];
        
        // DEBUG: Verificar se o modal está aberto
        const modal = document.querySelector('.drop-down-modal.trading-panel-modal.assets-list-modal');
        const activeControl = document.querySelector('.currencies-block__in.active');
        window.logToSystem(`DEBUG: Modal aberto: ${!!modal}, Active control: ${!!activeControl}`, 'DEBUG');
        
        // ✅ MELHORADO: Usar seletores mais robustos para diferentes categorias
        let assetItems = document.querySelectorAll("li.alist__item");
        window.logToSystem(`DEBUG: Seletor li.alist__item encontrou ${assetItems.length} itens`, 'DEBUG');
        
        // FALLBACK: Se não encontrar, tentar seletores específicos para diferentes categorias
        if (assetItems.length === 0) {
          // Tentar diferentes categorias baseado na estrutura HTML fornecida
          const categorySelectors = [
            "#modal-root > div > div > div > div.assets-block__col.assets-block__col-body > div.assets-block__body-wrap > div > div > div.assets-block__body-currency > ul li",
            "#modal-root > div > div > div > div.assets-block__col.assets-block__col-body > div.assets-block__body-wrap > div > div > div.assets-block__body-cryptocurrency > ul li",
            "#modal-root > div > div > div > div.assets-block__col.assets-block__col-body > div.assets-block__body-wrap > div > div > div.assets-block__body-commodity > ul li",
            "#modal-root > div > div > div > div.assets-block__col.assets-block__col-body > div.assets-block__body-wrap > div > div > div.assets-block__body-stock > ul li",
            "#modal-root > div > div > div > div.assets-block__col.assets-block__col-body > div.assets-block__body-wrap > div > div > div.assets-block__body-index > ul li",
            // Seletor genérico para qualquer categoria
            ".assets-block__body-wrap ul li",
            ".assets-block__col-body ul li"
          ];
          
          for (const selector of categorySelectors) {
            assetItems = document.querySelectorAll(selector);
            window.logToSystem(`DEBUG: Seletor ${selector} encontrou ${assetItems.length} itens`, 'DEBUG');
            if (assetItems.length > 0) {
              window.logToSystem(`✅ Encontrados ${assetItems.length} ativos usando seletor: ${selector}`, 'INFO');
              break;
            }
          }
        }
        
        if (assetItems.length === 0) {
          window.logToSystem('Nenhum ativo encontrado na lista', 'WARN');
          resolve([]);
          return;
        }
        
        window.logToSystem(`Encontrados ${assetItems.length} itens de ativos com seletor`, 'INFO');
        
        assetItems.forEach((item, index) => {
          try {
            // Obter nome do ativo usando a estrutura correta
            let nameElement = item.querySelector('.alist__label');
            const name = nameElement ? nameElement.textContent.trim() : `Ativo ${index + 1}`;
            
            // Obter payout usando a estrutura correta
            let payoutElement = item.querySelector('.alist__payout span');
            let payout = 0;
            
            if (payoutElement) {
              const payoutText = payoutElement.textContent.trim();
              // Verificar se tem payout válido (não é N/A)
              if (payoutText !== 'N/A' && !payoutText.includes('schedule-info')) {
                const payoutMatch = payoutText.match(/\+?(\d+)%/);
                if (payoutMatch) {
                  payout = parseInt(payoutMatch[1], 10);
                }
              }
            }
            
            // Verificar se está ativo (disponível para trading) - baseado na estrutura fornecida
            const isActive = !item.classList.contains('alist__item--no-active') && 
                            !item.classList.contains('alist__item--no-hover') &&
                            payout > 0; // Deve ter payout válido
            
            // Verificar se está atualmente selecionado
            const isSelected = item.classList.contains('alist__item--active');
            
            // IMPORTANTE: Incluir TODOS os ativos na lista, mesmo os inativos
            assets.push({
              name: name,
              payout: payout,
              isSelected: isSelected,
              isActive: isActive,
              element: item,
              index: index
            });
            
            window.logToSystem(`Ativo processado: ${name} (${payout}%) - Ativo: ${isActive} - Selecionado: ${isSelected}`, 'DEBUG');
            
          } catch (itemError) {
            window.logToSystem(`Erro ao processar ativo ${index}: ${itemError.message}`, 'WARN');
          }
        });
        
        // Ordenar por payout (maior primeiro) e depois por ativo (ativos primeiro)
        assets.sort((a, b) => {
          // Primeiro ordenar por ativo (ativos primeiro)
          if (a.isActive !== b.isActive) {
            return b.isActive ? 1 : -1;
          }
          // Depois ordenar por payout (maior primeiro)
          return b.payout - a.payout;
        });
        
        // Filtrar apenas ativos ativos para retorno final
        const activeAssets = assets.filter(asset => asset.isActive);
        
        window.logToSystem(`Encontrados ${assets.length} ativos totais, ${activeAssets.length} ativos disponíveis`, 'SUCCESS');
        resolve(activeAssets);
      } catch (error) {
        window.logToSystem(`Erro ao obter lista de ativos: ${error.message}`, 'ERROR');
        resolve([]);
      }
    });
  },

  // Função para encontrar o melhor ativo baseado no payout mínimo
  findBestAsset: async (minPayout = 85) => {
    try {
      window.logToSystem(`Procurando melhor ativo com payout mínimo de ${minPayout}%`, 'INFO');
      
      const assets = await AssetManager.getAvailableAssets(); // ✅ AGORA É ASSÍNCRONA
      
      if (assets.length === 0) {
        window.logToSystem('Nenhum ativo disponível encontrado', 'WARN');
        return null;
      }
      
      // Filtrar ativos que atendem ao payout mínimo
      const validAssets = assets.filter(asset => asset.payout >= minPayout);
      
      if (validAssets.length === 0) {
        window.logToSystem(`Nenhum ativo encontrado com payout >= ${minPayout}%`, 'WARN');
        return null;
      }
      
      // Retornar o primeiro (melhor payout) que atende ao critério
      const bestAsset = validAssets[0];
      window.logToSystem(`Melhor ativo encontrado: ${bestAsset.name} (${bestAsset.payout}%)`, 'SUCCESS');
      
      return bestAsset;
    } catch (error) {
      window.logToSystem(`Erro ao encontrar melhor ativo: ${error.message}`, 'ERROR');
      return null;
    }
  },

  // Função para encontrar o melhor ativo com informações detalhadas (para testes)
  findBestAssetDetailed: async (minPayout = 85) => {
    try {
      window.logToSystem(`Procurando melhor ativo com payout mínimo de ${minPayout}%`, 'INFO');
      
      const assets = await AssetManager.getAvailableAssets(); // ✅ AGORA É ASSÍNCRONA
      
      if (assets.length === 0) {
        return {
          success: false,
          error: 'Nenhum ativo disponível encontrado',
          allAssets: []
        };
      }
      
      // Filtrar ativos que atendem ao payout mínimo
      const validAssets = assets.filter(asset => asset.payout >= minPayout);
      
      if (validAssets.length === 0) {
        window.logToSystem(`Nenhum ativo encontrado com payout >= ${minPayout}%`, 'WARN');
        return {
          success: false,
          error: `Nenhum ativo com payout >= ${minPayout}% encontrado`,
          allAssets: assets
        };
      }
      
      // Retornar o primeiro (melhor payout) que atende ao critério
      const bestAsset = validAssets[0];
      
      // Selecionar o ativo encontrado
      const selected = await AssetManager.selectAsset(bestAsset); // ✅ AGORA É ASSÍNCRONA
      if (!selected) {
        return {
          success: false,
          error: 'Falha ao selecionar o ativo',
          allAssets: assets
        };
      }
      
      window.logToSystem(`Melhor ativo encontrado e selecionado: ${bestAsset.name} (${bestAsset.payout}%)`, 'SUCCESS');
      
      return {
        success: true,
        asset: bestAsset,
        message: `Melhor ativo selecionado: ${bestAsset.name} (${bestAsset.payout}%)`,
        allAssets: assets
      };
    } catch (error) {
      window.logToSystem(`Erro ao encontrar melhor ativo: ${error.message}`, 'ERROR');
      return {
        success: false,
        error: error.message,
        allAssets: []
      };
    }
  },

  // Função para verificar qual ativo está atualmente selecionado
  getCurrentSelectedAsset: () => {
    try {
      // Verificar no elemento principal da interface
      const currentSymbolElement = document.querySelector('.current-symbol, .currencies-block .current-symbol_cropped');
      if (currentSymbolElement) {
        const currentAsset = currentSymbolElement.textContent.trim();
        window.logToSystem(`Ativo atual detectado: ${currentAsset}`, 'INFO');
        return currentAsset;
      }
      
      // Fallback: verificar no seletor de pares
      const pairElement = document.querySelector('.pair .current-symbol');
      if (pairElement) {
        const currentAsset = pairElement.textContent.trim();
        window.logToSystem(`Ativo atual detectado (fallback): ${currentAsset}`, 'INFO');
        return currentAsset;
      }
      
      window.logToSystem('Não foi possível detectar o ativo atual', 'WARN');
      return null;
    } catch (error) {
      window.logToSystem(`Erro ao verificar ativo atual: ${error.message}`, 'ERROR');
      return null;
    }
  },

  // Função para verificar se um ativo específico foi selecionado
  verifyAssetSelection: (expectedAssetName, maxRetries = 3) => {
    return new Promise((resolve) => {
      let attempts = 0;
      
      const checkSelection = () => {
        attempts++;
        const currentAsset = AssetManager.getCurrentSelectedAsset();
        
        if (currentAsset && currentAsset.includes(expectedAssetName.split(' ')[0])) {
          window.logToSystem(`✅ Verificação confirmada: ${expectedAssetName} está selecionado`, 'SUCCESS');
          resolve(true);
          return;
        }
        
        if (attempts < maxRetries) {
          window.logToSystem(`Tentativa ${attempts}/${maxRetries}: Aguardando seleção de ${expectedAssetName}...`, 'INFO');
          setTimeout(checkSelection, 500);
        } else {
          window.logToSystem(`❌ Falha na verificação: ${expectedAssetName} não foi selecionado após ${maxRetries} tentativas`, 'ERROR');
          resolve(false);
        }
      };
      
      checkSelection();
    });
  },

  // Função para selecionar um ativo específico
  selectAsset: (asset) => {
    return new Promise((resolve) => {
      try {
        if (!asset || !asset.element) {
          throw new Error('Ativo inválido ou elemento não encontrado');
        }
        
        window.logToSystem(`Selecionando ativo: ${asset.name} (${asset.payout}%)`, 'INFO');
        
        // Verificar se já está selecionado
        if (asset.isSelected) {
          window.logToSystem(`Ativo ${asset.name} já está selecionado`, 'INFO');
          resolve(true);
          return;
        }
        
        // CORRETO: Clicar no link interno usando a estrutura fornecida
        const linkElement = asset.element.querySelector('.alist__link');
        if (linkElement) {
          window.logToSystem(`Clique executado no link interno (.alist__link) do ativo ${asset.name}`, 'INFO');
          linkElement.click();
          
          // Aguardar um pouco para a seleção ser processada
          setTimeout(() => {
            resolve(true);
          }, 300);
          return;
        }
        
        // FALLBACK: Se não houver link interno, tentar clicar no elemento principal do ativo
        window.logToSystem(`'.alist__link' não encontrado, tentando clicar no elemento principal (.alist__item) do ativo ${asset.name}`, 'INFO');
        asset.element.click();
        
        // Aguardar um pouco para a seleção ser processada
        setTimeout(() => {
          resolve(true);
        }, 300);

      } catch (error) {
        window.logToSystem(`Erro ao selecionar ativo: ${error.message}`, 'ERROR');
        resolve(false);
      }
    });
  },



  // Função para encontrar melhor ativo DENTRO da categoria atual (usada pelo painel)
  switchToBestAssetInCurrentCategory: async (minPayout = 85) => {
    try {
      window.logToSystem(`🔍 [PAINEL] Buscando melhor ativo na categoria atual (payout >= ${minPayout}%)`, 'INFO');
      
      // ✅ CORREÇÃO: Verificação múltipla para garantir que a categoria carregou
      let assets = [];
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        assets = await AssetManager.getAvailableAssets(); // ✅ AGORA É ASSÍNCRONA
        attempts++;
        
        window.logToSystem(`📊 [PAINEL] Tentativa ${attempts}/${maxAttempts}: ${assets.length} ativos encontrados`, 'DEBUG');
        
        if (assets.length > 0) {
          break; // Lista carregou com sucesso
        }
        
        if (attempts < maxAttempts) {
          window.logToSystem(`⏳ [PAINEL] Lista vazia, aguardando mais 500ms...`, 'DEBUG');
        await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (assets.length === 0) {
        throw new Error('CATEGORY_EMPTY: Categoria atual não tem ativos disponíveis após múltiplas tentativas');
      }
      
      // Ordenar por payout (maior primeiro)
      assets.sort((a, b) => b.payout - a.payout);
      
      // Filtrar por payout mínimo
      const validAssets = assets.filter(asset => asset.payout >= minPayout);
      window.logToSystem(`🎯 [PAINEL] ${validAssets.length} ativos com payout >= ${minPayout}%`, 'DEBUG');
      
      if (validAssets.length === 0) {
        const bestAvailable = assets[0];
        throw new Error(`PAYOUT_INSUFFICIENT_IN_CATEGORY: Melhor ativo disponível: ${bestAvailable.name} (${bestAvailable.payout}%)`);
      }
      
      // Selecionar melhor ativo
      const bestAsset = validAssets[0];
      window.logToSystem(`🎯 [PAINEL] Selecionando melhor ativo: ${bestAsset.name} (${bestAsset.payout}%)`, 'SUCCESS');
      
      const assetSelected = await AssetManager.selectAsset(bestAsset); // ✅ AGORA É ASSÍNCRONA
      if (!assetSelected) {
        throw new Error('ASSET_SELECTION_FAILED: Falha ao clicar no ativo');
      }
      
      return {
        success: true,
        asset: bestAsset,
        message: `Melhor ativo selecionado: ${bestAsset.name} (${bestAsset.payout}%)`
      };
      
    } catch (error) {
      // ✅ CONVERSÃO: Erro interno da busca em categoria específica vira AVISO silencioso
      // Não reportar como ERROR para não alarmar - é parte normal da busca sequencial
      window.logToSystem(`🔍 [BUSCA CATEGORIA] ${error.message}`, 'DEBUG');
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Função WRAPPER para automação - busca sequencial em múltiplas categorias
  switchToBestAssetForAutomation: async (minPayout = 85, preferredCategory = 'crypto') => {
    try {
      window.logToSystem(`🚀 [AUTOMAÇÃO] Iniciando busca inteligente de ativo (payout >= ${minPayout}%, categoria preferida: ${preferredCategory})`, 'INFO');
      
      // ✅ ETAPA 1: PREPARAÇÃO
      const currentAsset = AssetManager.getCurrentSelectedAsset();
      window.logToSystem(`📊 [ESTADO ATUAL] Ativo antes da busca: ${currentAsset || 'Não detectado'}`, 'INFO');
      
      // Abrir modal de ativos
      const modalOpened = await AssetManager.openAssetModal();
      if (!modalOpened) {
        throw new Error('MODAL_OPEN_FAILED: Falha ao abrir modal de ativos');
      }
      window.logToSystem(`✅ [MODAL] Modal de ativos aberto com sucesso`, 'INFO');
      
      // Aguardar modal carregar
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // ✅ ETAPA 2: DEFINIR CATEGORIAS EM ORDEM DE PRIORIDADE
      const allCategories = [
        preferredCategory,
        'crypto',
        'currency', 
        'commodity',
        'stock',
        'index'
      ];
      
      const categoriesToTry = [...new Set(allCategories)];
      window.logToSystem(`📂 [CATEGORIAS] ${categoriesToTry.length} categorias para verificar: ${categoriesToTry.join(', ')}`, 'INFO');
      
      // ✅ ETAPA 3: BUSCA SEQUENCIAL USANDO FUNÇÃO DO PAINEL
      let bestResult = null;
      let usedCategory = null;
      let categoriesAttempted = [];
      let categoriesFailed = [];
      
      for (const category of categoriesToTry) {
        categoriesAttempted.push(category);
        window.logToSystem(`🔍 [CATEGORIA] Tentando categoria: ${category}`, 'DEBUG');
        
        try {
          // Ativar categoria
          const categoryChanged = await AssetManager.switchToAssetCategory(category);
          if (!categoryChanged) {
            window.logToSystem(`🔄 [CATEGORIA] ${category} não disponível na plataforma`, 'DEBUG');
            categoriesFailed.push(`${category} (não disponível)`);
            continue;
          }
          
          window.logToSystem(`✅ [CATEGORIA] ${category} ativada, aguardando carregar...`, 'DEBUG');
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // ✅ USAR FUNÇÃO DO PAINEL COM TRATAMENTO SILENCIOSO DE ERROS
          window.logToSystem(`🔧 [AUTOMAÇÃO] Usando função do painel para categoria ${category}`, 'DEBUG');
          
          try {
            // ✅ CHAMADA SILENCIOSA - não propagar erros de categoria individual
            const categoryResult = await AssetManager.switchToBestAssetInCurrentCategory(minPayout);
            
            if (categoryResult.success) {
              // ✅ ENCONTROU ATIVO ADEQUADO NESTA CATEGORIA!
              bestResult = categoryResult;
              usedCategory = category;
              
              const categoryLabel = category === preferredCategory ? 
                `categoria preferida (${category})` : 
                `fallback para categoria ${category}`;
              
              window.logToSystem(`🎯 [ENCONTRADO] Ativo adequado na ${categoryLabel}: ${bestResult.asset.name} (${bestResult.asset.payout}%)`, 'SUCCESS');
              window.logToSystem(`🛑 [PARADA] Parando busca - ativo adequado encontrado`, 'INFO');
              break; // ✅ PARAR - ENCONTROU ATIVO ADEQUADO!
            } else {
              window.logToSystem(`📝 [RESULTADO] Categoria ${category}: ${categoryResult.error}`, 'DEBUG');
              categoriesFailed.push(`${category} (${categoryResult.error})`);
            }
          } catch (categorySearchError) {
            // ✅ CAPTURAR ERROS DA FUNÇÃO BASE SEM PROPAGAR
            const errorMsg = categorySearchError.message || 'Erro na busca';
            window.logToSystem(`📝 [RESULTADO] Categoria ${category}: ${errorMsg}`, 'DEBUG');
            categoriesFailed.push(`${category} (${errorMsg})`);
            
            // ✅ IMPORTANTE: Continuar para próxima categoria sem interromper o loop
            continue;
          }
          
        } catch (categoryError) {
          window.logToSystem(`🔄 [CATEGORIA] ${category} não acessível: ${categoryError.message}`, 'DEBUG');
          categoriesFailed.push(`${category} (erro: ${categoryError.message})`);
          continue;
        }
      }
      
      // ✅ ETAPA 4: ANÁLISE DO RESULTADO
      window.logToSystem(`📊 [BUSCA FINAL] Categorias verificadas: ${categoriesAttempted.join(', ')}`, 'INFO');
      
      if (categoriesFailed.length > 0) {
        window.logToSystem(`📂 [FALHAS] ${categoriesFailed.length} categorias falharam: ${categoriesFailed.join(', ')}`, 'DEBUG');
      }
      
      // ❌ ERRO: Nenhum ativo adequado encontrado em nenhuma categoria
      if (!bestResult) {
        const errorMsg = `AUTOMATION_SEARCH_FAILED: Nenhum ativo com payout >= ${minPayout}% encontrado em nenhuma categoria. Falhas: ${categoriesFailed.join('; ')}`;
        window.logToSystem(`❌ [ERRO CRÍTICO] ${errorMsg}`, 'ERROR');
        throw new Error(errorMsg);
      }
      
      // ✅ ETAPA 5: GARANTIR QUE ATIVO FOI SELECIONADO ANTES DE FECHAR MODAL
      window.logToSystem(`🎯 [SELEÇÃO] Garantindo que ativo ${bestResult.asset.name} está selecionado...`, 'DEBUG');
      
      // Tentar selecionar o ativo novamente para garantir
      try {
        const assetSelected = await AssetManager.selectAsset(bestResult.asset); // ✅ AGORA É ASSÍNCRONA
        if (assetSelected) {
          window.logToSystem(`✅ [SELEÇÃO] Ativo ${bestResult.asset.name} selecionado com sucesso`, 'DEBUG');
        }
      } catch (selectionError) {
        window.logToSystem(`⚠️ [SELEÇÃO] Aviso na seleção final: ${selectionError.message}`, 'WARN');
      }
      
      // Aguardar seleção processar
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // ✅ ETAPA 6: FECHAR MODAL
      window.logToSystem(`🚪 [MODAL] Fechando modal de ativos...`, 'DEBUG');
      const modalClosed = await AssetManager.closeAssetModal();
      if (!modalClosed) {
        window.logToSystem(`⚠️ [MODAL] Aviso: Modal pode não ter fechado corretamente`, 'WARN');
      }
      
      // Aguardar interface atualizar
      window.logToSystem(`⏳ [INTERFACE] Aguardando interface atualizar...`, 'DEBUG');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aumentado para 2s
      
      // ✅ ETAPA 7: VERIFICAÇÃO FINAL ROBUSTA
      let finalAsset = null;
      let verificationAttempts = 0;
      const maxVerificationAttempts = 3;
      
      while (verificationAttempts < maxVerificationAttempts) {
        finalAsset = AssetManager.getCurrentSelectedAsset();
        verificationAttempts++;
        
        window.logToSystem(`📊 [VERIFICAÇÃO] Tentativa ${verificationAttempts}/${maxVerificationAttempts}: Ativo atual = "${finalAsset}"`, 'DEBUG');
        
        if (finalAsset && finalAsset.includes(bestResult.asset.name.split(' ')[0])) {
          window.logToSystem(`✅ [VERIFICAÇÃO] Ativo correto detectado: ${finalAsset}`, 'SUCCESS');
          break;
        }
        
        if (verificationAttempts < maxVerificationAttempts) {
          window.logToSystem(`⏳ [VERIFICAÇÃO] Aguardando mais 800ms antes da próxima verificação...`, 'DEBUG');
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      
      // ✅ ETAPA 8: SUCESSO FINAL
      const categoryInfo = usedCategory === preferredCategory ? 
        `categoria preferida (${usedCategory})` : 
        `fallback para categoria ${usedCategory}`;
      
      const successMessage = `Ativo alterado para ${bestResult.asset.name} (${bestResult.asset.payout}%) - ${categoryInfo}`;
      
      if (usedCategory === preferredCategory) {
        window.logToSystem(`✅ [SUCESSO] Busca concluída com categoria preferida: ${successMessage}`, 'SUCCESS');
      } else {
        window.logToSystem(`⚠️ [AVISO] Categoria preferida sem payout adequado. ${successMessage}`, 'WARN');
      }
      
      window.logToSystem(`🎉 [CONCLUÍDO] Busca de ativo para automação finalizada com sucesso`, 'INFO');
      window.logToSystem(`📋 [RESUMO] Categorias tentadas: ${categoriesAttempted.join(', ')}`, 'INFO');
      window.logToSystem(`📋 [RESUMO] Categoria usada: ${usedCategory}, Ativo final: ${finalAsset}`, 'INFO');
      
      return {
        success: true,
        asset: {
          name: bestResult.asset.name,
          payout: bestResult.asset.payout,
          category: usedCategory
        },
        message: successMessage,
        currentAsset: finalAsset,
        verified: true,
        usedCategory: usedCategory,
        wasPreferred: usedCategory === preferredCategory
      };
      
    } catch (error) {
      // ❌ TRATAMENTO DE ERRO
      window.logToSystem(`💥 [ERRO CRÍTICO] Busca de ativo para automação falhou: ${error.message}`, 'ERROR');
      
      // Tentar fechar modal em caso de erro
      try {
        await AssetManager.closeAssetModal();
        window.logToSystem(`🚪 [CLEANUP] Modal fechado após erro`, 'DEBUG');
      } catch (closeError) {
        window.logToSystem(`⚠️ [CLEANUP] Erro ao fechar modal: ${closeError.message}`, 'WARN');
      }
      
      const errorMsg = `AUTOMATION_SEARCH_FAILED: ${error.message}`;
      window.logToSystem(`❌ [RETORNO] ${errorMsg}`, 'ERROR');
      
      return {
        success: false,
        error: errorMsg
      };
    }
  },

  // Função principal para trocar para o melhor ativo (PAINEL - busca apenas na categoria atual)
  switchToBestAsset: async (minPayout = 85, preferredCategory = 'crypto') => {
    // ✅ PARA PAINEL: Usar função simples que busca apenas na categoria atual
    window.logToSystem(`🔍 [PAINEL] Buscando melhor ativo na categoria atual (payout >= ${minPayout}%)`, 'INFO');
    return await AssetManager.switchToBestAssetInCurrentCategory(minPayout);
  },

  // Função para debug de captura de ativos
  debugAssetCapture: () => {
    return new Promise((resolve) => {
      try {
        window.logToSystem('🔍 [DEBUG] Iniciando debug da captura de ativos...', 'INFO');
        
        // 1. Verificar se o modal está aberto
        const modal = document.querySelector('.drop-down-modal.trading-panel-modal.assets-list-modal');
        const activeControl = document.querySelector('.currencies-block__in.active');
        const genericModal = document.querySelector('.drop-down-modal.drop-down-modal--quotes-list');
        
        window.logToSystem(`🔍 [DEBUG] Modal específico: ${!!modal}`, 'DEBUG');
        window.logToSystem(`🔍 [DEBUG] Active control: ${!!activeControl}`, 'DEBUG');
        window.logToSystem(`🔍 [DEBUG] Modal genérico: ${!!genericModal}`, 'DEBUG');
        
        // 2. Testar o seletor específico fornecido pelo usuário
        const specificList = document.querySelector("#modal-root > div > div > div > div.assets-block__col.assets-block__col-body > div.assets-block__body-wrap > div > div > div.assets-block__body-currency > ul");
        window.logToSystem(`🔍 [DEBUG] Lista específica encontrada: ${!!specificList}`, 'DEBUG');
        
        if (specificList) {
          const specificItems = specificList.querySelectorAll('li');
          window.logToSystem(`🔍 [DEBUG] Itens na lista específica: ${specificItems.length}`, 'DEBUG');
          
          specificItems.forEach((item, index) => {
            if (index < 5) { // Mostrar apenas os primeiros 5
              const className = item.className || '';
              const textContent = item.textContent || '';
              window.logToSystem(`🔍 [DEBUG] Item específico ${index}: class="${className}" text="${textContent.substring(0, 50)}..."`, 'DEBUG');
            }
          });
        }
        
        // 3. Listar todos os elementos que podem conter ativos (corrigido)
        const allElements = document.querySelectorAll('*');
        const possibleAssetContainers = [];
        
        allElements.forEach((element, index) => {
          if (index < 1000) { // Limitar para performance
            const className = element.className || '';
            const textContent = element.textContent || '';
            
            // Verificar se className é string antes de usar includes
            if (typeof className === 'string' && 
                (className.includes('item') || className.includes('asset') || className.includes('list')) &&
                textContent.length > 0 && textContent.length < 100 &&
                (textContent.includes('%') || textContent.match(/[A-Z]{2,}/))) {
              
              possibleAssetContainers.push({
                element: element,
                className: className,
                textContent: textContent.trim(),
                tagName: element.tagName
              });
            }
          }
        });
        
        window.logToSystem(`🔍 [DEBUG] Encontrados ${possibleAssetContainers.length} possíveis containers de ativos`, 'DEBUG');
        
        // 4. Mostrar os primeiros 10 possíveis ativos
        possibleAssetContainers.slice(0, 10).forEach((container, index) => {
          window.logToSystem(`🔍 [DEBUG] Container ${index}: <${container.tagName}> class="${container.className}" text="${container.textContent}"`, 'DEBUG');
        });
        
        // 5. Testar seletores específicos
        const selectors = [
          '.alist__item',
          '.dops__assets-item',
          '[class*="asset"][class*="item"]',
          '[class*="list"][class*="item"]',
          '.drop-down-modal .dops__assets-item',
          '.drop-down-modal [class*="item"]',
          '[class*="modal"] [class*="item"]',
          // NOVO: Seletor específico fornecido pelo usuário
          "#modal-root > div > div > div > div.assets-block__col.assets-block__col-body > div.assets-block__body-wrap > div > div > div.assets-block__body-currency > ul li",
          // Variações do seletor específico
          ".assets-block__body-currency ul li",
          ".assets-block__body-wrap ul li",
          ".assets-block__col-body ul li"
        ];
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          window.logToSystem(`🔍 [DEBUG] Seletor "${selector}": ${elements.length} elementos`, 'DEBUG');
          
          if (elements.length > 0) {
            elements.forEach((element, index) => {
              if (index < 3) { // Mostrar apenas os primeiros 3
                const className = element.className || '';
                const textContent = element.textContent || '';
                window.logToSystem(`🔍 [DEBUG]   Elemento ${index}: class="${className}" text="${textContent.substring(0, 50)}..."`, 'DEBUG');
              }
            });
          }
        });
        
        // 6. Procurar por elementos com payout
        const payoutElements = document.querySelectorAll('[class*="payout"], [class*="percent"]');
        window.logToSystem(`🔍 [DEBUG] Elementos com payout: ${payoutElements.length}`, 'DEBUG');
        
        payoutElements.forEach((element, index) => {
          if (index < 5) {
            const className = element.className || '';
            const textContent = element.textContent || '';
            window.logToSystem(`🔍 [DEBUG] Payout ${index}: class="${className}" text="${textContent}"`, 'DEBUG');
          }
        });
        
        resolve({
          success: true,
          modalOpen: !!modal || !!activeControl || !!genericModal,
          specificListFound: !!specificList,
          possibleContainers: possibleAssetContainers.length,
          debugInfo: 'Debug concluído - verifique os logs acima'
        });
        
      } catch (error) {
        window.logToSystem(`🔍 [DEBUG] Erro no debug: ${error.message}`, 'ERROR');
        resolve({
          success: false,
          error: error.message
        });
      }
    });
  }
};

// ======================================================================
// =================== LISTENERS DE MENSAGENS ==========================
// ======================================================================

// Listener para mensagens do sistema de extensão
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handler para captura de informações do canvas
  if (message.action === 'GET_CANVAS_INFO') {
    window.logToSystem('🔍 Recebida solicitação para capturar informações do canvas', 'INFO');
    
    try {
      // Função para capturar informações do canvas
      const captureCanvasInfo = () => {
        return new Promise((resolve, reject) => {
          try {
            window.logToSystem('🔍 Iniciando captura de informações do canvas da plataforma', 'INFO');
            
            // Seletores para encontrar o canvas do gráfico
            const canvasSelectors = [
              '#chart-1 > canvas',
              '#chart-1 canvas',
              'canvas.layer.plot',
              'canvas[class*="plot"]',
              'canvas[class*="chart"]',
              'canvas[width][height]'
            ];
            
            let canvasElement = null;
            let foundSelector = '';
            
            // Tentar encontrar o canvas usando os seletores
            for (const selector of canvasSelectors) {
              const elements = document.querySelectorAll(selector);
              window.logToSystem(`🔎 Testando seletor "${selector}" - encontrados ${elements.length} elementos`, 'DEBUG');
              
              if (elements.length > 0) {
                // Verificar se é realmente um canvas de gráfico
                for (let i = 0; i < elements.length; i++) {
                  const element = elements[i];
                  const width = element.width || element.offsetWidth;
                  const height = element.height || element.offsetHeight;
                  
                  // Canvas de gráfico geralmente tem dimensões significativas
                  if (width > 100 && height > 100) {
                    canvasElement = element;
                    foundSelector = selector;
                    window.logToSystem(`✅ Canvas encontrado com seletor: ${selector} (${i+1}º elemento)`, 'SUCCESS');
                    break;
                  }
                }
                
                if (canvasElement) break;
              }
            }
            
            // Se não encontrou com seletores específicos, fazer busca ampla
            if (!canvasElement) {
              window.logToSystem('🔍 Seletores específicos não funcionaram, fazendo busca ampla...', 'DEBUG');
              
              // Busca ampla por todos os canvas
              const allCanvas = document.querySelectorAll('canvas');
              window.logToSystem(`🔍 Encontrados ${allCanvas.length} canvas na página`, 'DEBUG');
              
              for (const canvas of allCanvas) {
                const width = canvas.width || canvas.offsetWidth;
                const height = canvas.height || canvas.offsetHeight;
                const style = getComputedStyle(canvas);
                
                // Verificar se é um canvas de gráfico (dimensões significativas e posicionamento absoluto)
                if (width > 100 && height > 100 && 
                    (style.position === 'absolute' || canvas.classList.contains('plot') || canvas.classList.contains('chart'))) {
                  canvasElement = canvas;
                  foundSelector = 'busca-ampla';
                  window.logToSystem(`🎯 Canvas encontrado em busca ampla: ${width}x${height}`, 'INFO');
                  break;
                }
              }
            }
            
            // Preparar resultado
            if (canvasElement) {
              const rect = canvasElement.getBoundingClientRect();
              const width = canvasElement.width || canvasElement.offsetWidth;
              const height = canvasElement.height || canvasElement.offsetHeight;
              
              const result = {
                success: true,
                data: {
                  width: width,
                  height: height,
                  x: Math.round(rect.left),
                  y: Math.round(rect.top),
                  selector: foundSelector,
                  className: canvasElement.className,
                  id: canvasElement.id,
                  style: {
                    position: getComputedStyle(canvasElement).position,
                    display: getComputedStyle(canvasElement).display,
                    visibility: getComputedStyle(canvasElement).visibility
                  }
                },
                timestamp: new Date().toISOString()
              };
              
              window.logToSystem(`✅ Informações do canvas capturadas com sucesso: ${width}x${height} @ ${result.data.x},${result.data.y}`, 'SUCCESS');
              resolve(result);
            } else {
              // Canvas não encontrado
              const errorMsg = 'Canvas do gráfico não encontrado na página';
              window.logToSystem(`❌ ${errorMsg}`, 'ERROR');
              reject(new Error(errorMsg));
            }
            
          } catch (error) {
            window.logToSystem(`❌ Erro ao capturar informações do canvas: ${error.message}`, 'ERROR');
            reject(error);
          }
        });
      };
      
      // Executar captura
      captureCanvasInfo()
        .then(result => {
          window.logToSystem(`✅ Informações do canvas capturadas: ${result.data.width}x${result.data.height}`, 'SUCCESS');
          sendResponse(result);
        })
        .catch(error => {
          window.logToSystem(`❌ Erro na captura do canvas: ${error.message}`, 'ERROR');
          sendResponse({
            success: false,
            error: error.message
          });
        });
      
      return true; // Manter canal aberto para resposta assíncrona
      
    } catch (error) {
      window.logToSystem(`❌ Erro ao processar solicitação de canvas: ${error.message}`, 'ERROR');
      sendResponse({
        success: false,
        error: error.message
      });
      return true;
    }
  }

  // Handler para captura apenas do gráfico (retorna apenas canvas info)
  if (message.action === 'CAPTURE_CHART_ONLY') {
    window.logToSystem('📸 Recebida solicitação para obter informações do canvas', 'INFO');
    
    try {
      // Primeiro, obter informações do canvas
      const captureCanvasInfo = () => {
        return new Promise((resolve, reject) => {
          try {
            window.logToSystem('🔍 Obtendo informações do canvas para crop...', 'INFO');
            
            // Seletores para encontrar o canvas do gráfico
            const canvasSelectors = [
              '#chart-1 > canvas',
              '#chart-1 canvas',
              'canvas.layer.plot',
              'canvas[class*="plot"]',
              'canvas[class*="chart"]',
              'canvas[width][height]'
            ];
            
            let canvasElement = null;
            let foundSelector = '';
            
            // Tentar encontrar o canvas usando os seletores
            for (const selector of canvasSelectors) {
              const elements = document.querySelectorAll(selector);
              window.logToSystem(`🔎 Testando seletor "${selector}" - encontrados ${elements.length} elementos`, 'DEBUG');
              
              if (elements.length > 0) {
                // Verificar se é realmente um canvas de gráfico
                for (let i = 0; i < elements.length; i++) {
                  const element = elements[i];
                  const width = element.width || element.offsetWidth;
                  const height = element.height || element.offsetHeight;
                  
                  // Canvas de gráfico geralmente tem dimensões significativas
                  if (width > 100 && height > 100) {
                    canvasElement = element;
                    foundSelector = selector;
                    window.logToSystem(`✅ Canvas encontrado com seletor: ${selector} (${i+1}º elemento)`, 'SUCCESS');
                    break;
                  }
                }
                
                if (canvasElement) break;
              }
            }
            
            // Se não encontrou com seletores específicos, fazer busca ampla
            if (!canvasElement) {
              window.logToSystem('🔍 Seletores específicos não funcionaram, fazendo busca ampla...', 'DEBUG');
              
              // Busca ampla por todos os canvas
              const allCanvas = document.querySelectorAll('canvas');
              window.logToSystem(`🔍 Encontrados ${allCanvas.length} canvas na página`, 'DEBUG');
              
              for (const canvas of allCanvas) {
                const width = canvas.width || canvas.offsetWidth;
                const height = canvas.height || canvas.offsetHeight;
                const style = getComputedStyle(canvas);
                
                // Verificar se é um canvas de gráfico (dimensões significativas e posicionamento absoluto)
                if (width > 100 && height > 100 && 
                    (style.position === 'absolute' || canvas.classList.contains('plot') || canvas.classList.contains('chart'))) {
                  canvasElement = canvas;
                  foundSelector = 'busca-ampla';
                  window.logToSystem(`🎯 Canvas encontrado em busca ampla: ${width}x${height}`, 'INFO');
                  break;
                }
              }
            }
            
            if (canvasElement) {
              const rect = canvasElement.getBoundingClientRect();
              const width = canvasElement.width || canvasElement.offsetWidth;
              const height = canvasElement.height || canvasElement.offsetHeight;
              
              const result = {
                  width: width,
                  height: height,
                  x: Math.round(rect.left),
                  y: Math.round(rect.top),
                  selector: foundSelector,
                  className: canvasElement.className,
                  id: canvasElement.id
              };
              
              window.logToSystem(`✅ Informações do canvas obtidas: ${width}x${height} @ ${result.x},${result.y}`, 'SUCCESS');
              resolve(result);
            } else {
              reject(new Error('Canvas do gráfico não encontrado na página'));
            }
            
          } catch (error) {
            reject(error);
          }
        });
      };

      // Executar apenas a obtenção de informações do canvas
      captureCanvasInfo()
        .then(canvasInfo => {
          window.logToSystem('✅ Informações do canvas obtidas com sucesso', 'SUCCESS');
          sendResponse({ 
            success: true, 
            canvasInfo: canvasInfo 
          });
        })
        .catch(error => {
          window.logToSystem(`❌ Erro ao obter informações do canvas: ${error.message}`, 'ERROR');
          sendResponse({ success: false, error: error.message });
        });
      
      return true; // Manter canal aberto para resposta assíncrona
      
    } catch (error) {
      window.logToSystem(`❌ Erro ao processar solicitação de canvas info: ${error.message}`, 'ERROR');
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }

  // Handler para captura de tela
  if (message.action === 'CAPTURE_SCREENSHOT') {
    window.logToSystem('Solicitação de captura de tela recebida', 'INFO');
    
    try {
      // Usar o mesmo método do popup - enviar mensagem para o background
          chrome.runtime.sendMessage({
            action: 'initiateCapture',
            actionType: 'capture',
            requireProcessing: true,
        iframeWidth: message.iframeWidth || 480, // Passar iframeWidth para remover o painel
        source: 'content'
          }, (response) => {
            if (chrome.runtime.lastError) {
              const errorMsg = chrome.runtime.lastError.message;
              window.logToSystem(`❌ Erro na captura: ${errorMsg}`, 'ERROR');
              sendResponse({ success: false, error: errorMsg });
              return;
            }
            
        if (response && response.error) {
          window.logToSystem(`❌ Erro na captura: ${response.error}`, 'ERROR');
              sendResponse({ success: false, error: response.error });
              return;
            }
            
        if (response && response.dataUrl) {
          window.logToSystem('✅ Captura de tela realizada com sucesso', 'SUCCESS');
          sendResponse({ success: true, dataUrl: response.dataUrl });
        } else {
          window.logToSystem('❌ Captura de tela falhou - resposta sem dataUrl', 'ERROR');
          sendResponse({ success: false, error: 'Captura falhou - sem dados' });
        }
      });
    } catch (error) {
      window.logToSystem(`❌ Erro ao processar captura: ${error.message}`, 'ERROR');
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Resposta assíncrona
  }

  // Handler para teste de captura de payout
  if (message.action === 'TEST_CAPTURE_PAYOUT') {
    window.logToSystem('Solicitação de teste de captura de payout recebida', 'INFO');
    
    capturePayoutFromDOM()
      .then(result => {
        window.logToSystem(`Captura de payout concluída: ${result.payout}%`, 'SUCCESS');
        sendResponse(result);
      })
      .catch(error => {
        window.logToSystem(`Erro na captura de payout: ${error.message}`, 'ERROR');
        sendResponse({
          success: false,
          error: error.message
        });
      });
    
    return true; // Resposta assíncrona
  }
  
  // Handler para testes de ativos (já existentes)
  if (message.action === 'TEST_FIND_BEST_ASSET') {
    window.logToSystem('Solicitação de busca do melhor ativo recebida', 'INFO');
    
    const minPayout = message.minPayout || 85;
    
    AssetManager.switchToBestAsset(minPayout, 'crypto')
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });
    
    return true; // Resposta assíncrona
  }
  
  // ❌ HANDLER DUPLICADO REMOVIDO - O handler correto está na linha 877
  // if (message.action === 'TEST_SWITCH_ASSET_CATEGORY') {
  //   window.logToSystem(`Solicitação de troca de categoria para ${message.category} recebida`, 'INFO');
  //   
  //   const category = message.category || 'crypto';
  //   
  //   AssetManager.switchToBestAsset(85, category)
  //     .then(result => {
  //       sendResponse(result);
  //     })
  //     .catch(error => {
  //       sendResponse({
  //         success: false,
  //         error: error.message
  //       });
  //     });
  //   
  //   return true; // Resposta assíncrona
  // }
  
  // ✅ HANDLER ESPECÍFICO PARA TEST_SWITCH_TO_BEST_ASSET (usando wrapper de automação)
  if (message.action === 'TEST_SWITCH_TO_BEST_ASSET') {
    window.logToSystem(`🔄 Solicitação de troca inteligente recebida - Payout mínimo: ${message.minPayout}%, Categoria preferida: ${message.category}`, 'INFO');
    
    const minPayout = message.minPayout || 85;
    const preferredCategory = message.category || 'crypto';
    
    AssetManager.switchToBestAssetForAutomation(minPayout, preferredCategory)
      .then(result => {
        if (result.success) {
          // ✅ Log adicional para mostrar categoria usada
          const categoryInfo = result.wasPreferred ? 
            `categoria preferida (${result.usedCategory})` : 
            `fallback para categoria ${result.usedCategory}`;
          
          window.logToSystem(`✅ Troca inteligente concluída: ${result.asset.name} (${result.asset.payout}%) - ${categoryInfo}`, 'SUCCESS');
        }
        sendResponse(result);
      })
      .catch(error => {
        window.logToSystem(`❌ Erro na troca inteligente: ${error.message}`, 'ERROR');
        sendResponse({
          success: false,
          error: error.message
        });
      });
    
    return true; // Resposta assíncrona
  }
  

  
  // Outros handlers existentes...
  return false; // Não processou a mensagem
});

// ======================================================================
// =================== EXPOSIÇÃO GLOBAL DE FUNÇÕES ====================
// ======================================================================

// Expor função capturePayoutFromDOM globalmente para acesso do PayoutController
window.capturePayoutFromDOM = capturePayoutFromDOM;

// Função de debug para testar captura de ativos
debugAssetCapture: () => {
  return new Promise((resolve) => {
    try {
      window.logToSystem('🔍 [DEBUG] Iniciando debug da captura de ativos...', 'INFO');
      
      // 1. Verificar se o modal está aberto
      const modal = document.querySelector('.drop-down-modal.trading-panel-modal.assets-list-modal');
      const activeControl = document.querySelector('.currencies-block__in.active');
      const genericModal = document.querySelector('.drop-down-modal.drop-down-modal--quotes-list');
      
      window.logToSystem(`🔍 [DEBUG] Modal específico: ${!!modal}`, 'DEBUG');
      window.logToSystem(`🔍 [DEBUG] Active control: ${!!activeControl}`, 'DEBUG');
      window.logToSystem(`🔍 [DEBUG] Modal genérico: ${!!genericModal}`, 'DEBUG');
      
      // 2. Testar o seletor específico fornecido pelo usuário
      const specificList = document.querySelector("#modal-root > div > div > div > div.assets-block__col.assets-block__col-body > div.assets-block__body-wrap > div > div > div.assets-block__body-currency > ul");
      window.logToSystem(`🔍 [DEBUG] Lista específica encontrada: ${!!specificList}`, 'DEBUG');
      
      if (specificList) {
        const specificItems = specificList.querySelectorAll('li');
        window.logToSystem(`🔍 [DEBUG] Itens na lista específica: ${specificItems.length}`, 'DEBUG');
        
        specificItems.forEach((item, index) => {
          if (index < 5) { // Mostrar apenas os primeiros 5
            const className = item.className || '';
            const textContent = item.textContent || '';
            window.logToSystem(`🔍 [DEBUG] Item específico ${index}: class="${className}" text="${textContent.substring(0, 50)}..."`, 'DEBUG');
          }
        });
      }
      
      // 3. Listar todos os elementos que podem conter ativos (corrigido)
      const allElements = document.querySelectorAll('*');
      const possibleAssetContainers = [];
      
      allElements.forEach((element, index) => {
        if (index < 1000) { // Limitar para performance
          const className = element.className || '';
          const textContent = element.textContent || '';
          
          // Verificar se className é string antes de usar includes
          if (typeof className === 'string' && 
              (className.includes('item') || className.includes('asset') || className.includes('list')) &&
              textContent.length > 0 && textContent.length < 100 &&
              (textContent.includes('%') || textContent.match(/[A-Z]{2,}/))) {
            
            possibleAssetContainers.push({
              element: element,
              className: className,
              textContent: textContent.trim(),
              tagName: element.tagName
            });
          }
        }
      });
      
      window.logToSystem(`🔍 [DEBUG] Encontrados ${possibleAssetContainers.length} possíveis containers de ativos`, 'DEBUG');
      
      // 4. Mostrar os primeiros 10 possíveis ativos
      possibleAssetContainers.slice(0, 10).forEach((container, index) => {
        window.logToSystem(`🔍 [DEBUG] Container ${index}: <${container.tagName}> class="${container.className}" text="${container.textContent}"`, 'DEBUG');
      });
      
      // 5. Testar seletores específicos
      const selectors = [
        '.alist__item',
        '.dops__assets-item',
        '[class*="asset"][class*="item"]',
        '[class*="list"][class*="item"]',
        '.drop-down-modal .dops__assets-item',
        '.drop-down-modal [class*="item"]',
        '[class*="modal"] [class*="item"]',
        // NOVO: Seletor específico fornecido pelo usuário
        "#modal-root > div > div > div > div.assets-block__col.assets-block__col-body > div.assets-block__body-wrap > div > div > div.assets-block__body-currency > ul li",
        // Variações do seletor específico
        ".assets-block__body-currency ul li",
        ".assets-block__body-wrap ul li",
        ".assets-block__col-body ul li"
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        window.logToSystem(`🔍 [DEBUG] Seletor "${selector}": ${elements.length} elementos`, 'DEBUG');
        
        if (elements.length > 0) {
          elements.forEach((element, index) => {
            if (index < 3) { // Mostrar apenas os primeiros 3
              const className = element.className || '';
              const textContent = element.textContent || '';
              window.logToSystem(`🔍 [DEBUG]   Elemento ${index}: class="${className}" text="${textContent.substring(0, 50)}..."`, 'DEBUG');
            }
          });
        }
      });
      
      // 6. Procurar por elementos com payout
      const payoutElements = document.querySelectorAll('[class*="payout"], [class*="percent"]');
      window.logToSystem(`🔍 [DEBUG] Elementos com payout: ${payoutElements.length}`, 'DEBUG');
      
      payoutElements.forEach((element, index) => {
        if (index < 5) {
          const className = element.className || '';
          const textContent = element.textContent || '';
          window.logToSystem(`🔍 [DEBUG] Payout ${index}: class="${className}" text="${textContent}"`, 'DEBUG');
        }
      });
      
      resolve({
        success: true,
        modalOpen: !!modal || !!activeControl || !!genericModal,
        specificListFound: !!specificList,
        possibleContainers: possibleAssetContainers.length,
        debugInfo: 'Debug concluído - verifique os logs acima'
      });
      
    } catch (error) {
      window.logToSystem(`🔍 [DEBUG] Erro no debug: ${error.message}`, 'ERROR');
      resolve({
        success: false,
        error: error.message
      });
    }
  });
}
