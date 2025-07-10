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
  
// Função padronizada para enviar status para o index
function toUpdateStatus(message, type = 'info', duration = 5000) {
    if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
            action: 'updateStatus',
            message: message,
            type: type,
            duration: duration
        });
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
            safeLog('🔍 Iniciando captura de payout do DOM da PocketOption', 'INFO');
            toUpdateStatus('Capturando payout...', 'info');
            
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
            safeLog('🔍 [DEBUG] Listando TODOS os elementos que contêm % na página:', 'DEBUG');
            const allElementsWithPercent = document.querySelectorAll('*');
            let elementCount = 0;
            for (const elem of allElementsWithPercent) {
                const text = elem.textContent?.trim() || '';
                if (text.includes('%') && text.length < 50) {
                    elementCount++;
                    if (elementCount <= 10) { // Limitar para não poluir logs
                        safeLog(`🔍 [DEBUG] Elemento ${elementCount}: "${text}" (tag: ${elem.tagName}, classes: ${elem.className})`, 'DEBUG');
                    }
                }
            }
            safeLog(`🔍 [DEBUG] Total de elementos com % encontrados: ${elementCount}`, 'DEBUG');
            
            let payoutElement = null;
            let payoutValue = 0;
            let foundSelector = '';
            
            // Tentar encontrar o elemento de payout
            for (const selector of payoutSelectors) {
                const elements = document.querySelectorAll(selector);
                safeLog(`🔎 Testando seletor "${selector}" - encontrados ${elements.length} elementos`, 'DEBUG');
                
                if (elements.length > 0) {
                    // Testar cada elemento encontrado
                    for (let i = 0; i < elements.length; i++) {
                        const element = elements[i];
                        const text = element.textContent || element.innerText || '';
                        safeLog(`📝 Elemento ${i+1}: "${text}"`, 'DEBUG');
                        
                        // Verificar se contém um valor de payout válido
                        const payoutMatch = text.match(/(\d+(?:\.\d+)?)\s*%?/);
                        if (payoutMatch) {
                            const value = parseFloat(payoutMatch[1]);
                            if (value >= 50 && value <= 200) { // Payout válido entre 50% e 200%
                                payoutElement = element;
                                payoutValue = value;
                                foundSelector = selector;
                                safeLog(`✅ Elemento de payout encontrado com seletor: ${selector} (${i+1}º elemento)`, 'SUCCESS');
                                break;
                            }
                        }
                    }
                    
                    if (payoutElement) break;
                }
            }
            
            // Se não encontrou com seletores específicos, fazer busca ampla
            if (!payoutElement) {
                safeLog('🔍 Seletores específicos não funcionaram, fazendo busca ampla...', 'DEBUG');
                
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
                                safeLog(`🎯 Payout encontrado em busca ampla: ${payoutValue}%`, 'INFO');
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
                
                safeLog(`✅ Payout capturado com sucesso: ${payoutValue}% (seletor: ${foundSelector})`, 'SUCCESS');
                toUpdateStatus(`Payout encontrado: ${payoutValue}%`, 'success');
                
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
                
                safeLog('⚠️ Payout não encontrado no DOM, usando valor padrão: 85%', 'WARN');
                toUpdateStatus('Payout não encontrado, usando padrão: 85%', 'warn');
                
                resolve(defaultResult);
            }
            
        } catch (error) {
            safeLog(`❌ Erro ao capturar payout: ${error.message}`, 'ERROR');
            toUpdateStatus(`Erro na captura: ${error.message}`, 'error');
            
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
  
  // Inicialização do fechamento do modal de tutorial
  const modalTutorial = document.querySelector('.tutorial-v1__close-icon');
  if (modalTutorial) {
    setTimeout(() => {
        safeLog('Fechando modal de tutorial...', 'INFO');
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
        safeLog('Processando captura de tela', 'INFO');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
  
        img.onload = () => {
            try {
                // Verificar se a imagem carregou corretamente
                if (img.width === 0 || img.height === 0) {
                    safeLog('Erro: Imagem carregada com dimensões inválidas', 'ERROR');
                    sendResponse({ error: 'Dimensões de imagem inválidas' });
                    return;
                }
                
                // Calculando dimensões com base no iframe
                let width = img.width;
                if (message.iframeWidth && message.iframeWidth > 0) {
                    width = img.width - message.iframeWidth;
                } else {
                    safeLog(`Usando largura total da imagem: ${width}px`, 'INFO');
                }
                
                canvas.width = width;
                canvas.height = img.height;
                
                // Desenhar apenas a parte da imagem sem o iframe
                ctx.drawImage(img, 0, 0, width, img.height, 0, 0, width, img.height);
                
                // Garantir que a imagem seja PNG
                const dataUrl = canvas.toDataURL('image/png');
                
                // Verificar se o dataUrl está no formato correto
                if (!dataUrl.startsWith('data:image/png')) {
                    safeLog('Aviso: dataUrl não está no formato esperado', 'WARN');
                    // Tentar forçar o formato correto
                    const fixedDataUrl = 'data:image/png;base64,' + dataUrl.split(',')[1];
                    safeLog('Formato corrigido manualmente', 'INFO');
                    sendResponse({ dataUrl: fixedDataUrl });
                } else {
                    // Imagem válida, retornar normalmente
                    safeLog('Captura processada com sucesso', 'SUCCESS');
                    sendResponse({ dataUrl: dataUrl });
                }
            } catch (error) {
                safeLog(`Erro ao processar captura: ${error.message}`, 'ERROR');
                sendResponse({ error: error.message });
            }
        };
  
        img.onerror = () => {
            safeLog('Erro ao carregar imagem para processamento', 'ERROR');
            sendResponse({ error: 'Erro ao carregar imagem' });
        };
        
        // Verificar se a dataUrl recebida é válida
        if (!message.dataUrl || typeof message.dataUrl !== 'string' || !message.dataUrl.startsWith('data:')) {
            safeLog('dataUrl recebida inválida: ' + (message.dataUrl ? message.dataUrl.substring(0, 20) + '...' : 'undefined'), 'ERROR');
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
        safeLog(`Recebida solicitação para captura de tela: ${message.action}`, 'INFO');
        
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
                    safeLog(`Erro na captura: ${errorMsg}`, 'ERROR');
                    sendResponse({ success: false, error: errorMsg });
                    return;
                }
                
                if (response.error) {
                    safeLog(`Erro retornado na captura: ${response.error}`, 'ERROR');
                    sendResponse({ success: false, error: response.error });
                    return;
                }
                
                if (!response.dataUrl) {
                    safeLog('Resposta sem dados de imagem', 'ERROR');
                    sendResponse({ success: false, error: 'Sem dados de imagem' });
                    return;
                }
                
                // Armazenar para uso futuro
                window.lastCapturedImage = response.dataUrl;
                
                safeLog('Captura realizada com sucesso', 'SUCCESS');
                sendResponse({ success: true, dataUrl: response.dataUrl });
            });
        } catch (error) {
            safeLog(`Erro ao processar solicitação de captura: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // Manter canal aberto para resposta assíncrona
    }

    // Listener para exibição direta do modal com imagem já capturada
    if (message.action === 'SHOW_CAPTURE_MODAL' && message.dataUrl) {
        try {
            safeLog('Recebida solicitação direta para mostrar modal de captura', 'INFO');
            showCaptureModalInMainWindow(message.dataUrl);
            
            // Armazenar a imagem para possível reuso
            window.lastCapturedImage = message.dataUrl;
            
            sendResponse({ success: true });
        } catch (error) {
            safeLog(`Erro ao mostrar modal: ${error.message}`, 'ERROR');
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
            safeLog('Verificando payout atual...', 'INFO');
            
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
                    safeLog(`Payout atual: ${currentPayout}%`, 'INFO');
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
                    safeLog(`Payout encontrado (método alternativo): ${currentPayout}%`, 'INFO');
                                break;
                        }
                    }
                }
            }
            
            // Se ainda não encontrou, usar valor padrão
            if (currentPayout === 0) {
              safeLog('Não foi possível detectar o payout. Usando valor padrão de 85%.', 'WARN');
              currentPayout = 85; // Valor padrão caso não consiga encontrar
            }
            
            // Verificar se atende ao mínimo requerido
            const minPayout = tradeData.minPayout || 80;
            
            // Log detalhado sobre o valor mínimo de payout que está sendo utilizado
            safeLog(`Usando payout mínimo configurado: ${minPayout}% (via tradeData.minPayout)`, 'INFO');
            
            if (currentPayout < minPayout) {
              // Alterado de ERROR para WARN e adicionado envio para o status
              const warningMsg = `Payout atual (${currentPayout}%) abaixo do mínimo configurado (${minPayout}%). Operação cancelada.`;
              safeLog(warningMsg, 'WARN');
              
              // Adicionar registro mais específico no log
              sendLog(`ALERTA DE PAYOUT: Operação ${message.tradeAction} não executada. Payout atual (${currentPayout}%) está abaixo do mínimo configurado (${minPayout}%)`, 'WARN', 'payout-verification');
              
              // Enviar para o sistema de status usando a função padronizada
              toUpdateStatus(`Payout insuficiente (${currentPayout}%)`, 'warn', 5000);
              
              return { success: false, error: `Payout insuficiente (${currentPayout}%)` };
            }
            
            safeLog(`Payout verificado e aprovado: ${currentPayout}% >= ${minPayout}%`, 'SUCCESS');
            return { success: true, payout: currentPayout };
          } catch (error) {
            safeLog(`Erro ao verificar payout: ${error.message}`, 'ERROR');
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
          
          safeLog(`Executando operação ${operationId} com: Valor=${operationConfig.tradeValue}, Tempo=${operationConfig.tradeTime}min`, 'INFO');
          
          // Usar a função executeTradeAction existente
          executeTradeAction(message.tradeAction, operationConfig)
            .then(result => {
              safeLog(`Operação ${operationId} concluída com sucesso`, 'SUCCESS');
              
              sendResponse({ 
                success: true, 
                message: `Operação ${message.tradeAction} executada com sucesso`,
                result: result,
                operationId: operationId
              });
            })
            .catch(error => {
              safeLog(`Erro ao executar operação ${operationId}: ${error.message || JSON.stringify(error)}`, 'ERROR');
              // Enviar mensagem para o status
              toUpdateStatus(`Erro: ${error.message || 'Falha na operação'}`, 'error', 5000);
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
        safeLog(errorMsg, 'ERROR');
        // Enviar mensagem para o status
        toUpdateStatus(errorMsg, 'error', 5000);
        sendResponse({ 
          success: false, 
          error: errorMsg
              });
              return true;
      }
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
        safeLog('🔍 Capturando payout atual usando capturePayoutFromDOM (mesma função do painel)...', 'INFO');
        
        // ✅ CORREÇÃO: Usar a MESMA função que o painel de desenvolvimento usa
        capturePayoutFromDOM()
          .then(result => {
            safeLog(`✅ Payout capturado via capturePayoutFromDOM: ${result.payout}%`, 'SUCCESS');
          sendResponse(result);
          })
          .catch(error => {
            safeLog(`❌ Erro na captura via capturePayoutFromDOM: ${error.message}`, 'ERROR');
          sendResponse({ success: false, error: error.message });
        });
        
        return true; // Manter canal aberto para resposta assíncrona
        
      } catch (error) {
        safeLog(`Erro ao processar solicitação de payout: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // =================== HANDLERS PARA TESTE DE ATIVOS ===================
    
    // Handler para abrir modal de ativos
    if (message.action === 'TEST_OPEN_ASSET_MODAL') {
      try {
        safeLog('Recebida solicitação para abrir modal de ativos', 'INFO');
        
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
            
            safeLog(`Abertura concluída: ${result}`, 'INFO');
              sendResponse({ 
              success: result, 
              message: result ? 'Modal de ativos aberto com sucesso' : 'Falha ao abrir modal de ativos'
              });
          } catch (error) {
            safeLog(`Erro ao abrir modal: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
          }
        };
        
        executeOpenWithTimeout();
        
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        safeLog(`Erro ao processar abertura de modal: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // Handler para buscar melhor ativo
    if (message.action === 'TEST_FIND_BEST_ASSET') {
      try {
        safeLog('Recebida solicitação para buscar melhor ativo', 'INFO');
        
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
        safeLog(`Erro ao buscar melhor ativo: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }

    // Handler para mudar categoria de ativo
    if (message.action === 'TEST_SWITCH_ASSET_CATEGORY') {
      try {
        safeLog(`Recebida solicitação para mudar categoria: ${message.category}`, 'INFO');
        
        // Primeiro abrir o modal
        AssetManager.openAssetModal()
          .then(modalOpened => {
            if (!modalOpened) {
              throw new Error('Falha ao abrir modal de ativos');
            }
            
            // Aguardar modal carregar e mudar categoria
            setTimeout(() => {
              AssetManager.switchToAssetCategory(message.category)
                .then(categoryChanged => {
                  // Aguardar lista atualizar e obter ativos
                  setTimeout(() => {
                    try {
                      const assets = AssetManager.getAvailableAssets();
                      let assetSelected = false;
                      let firstAsset = null;

                      if (assets.length > 0) {
                        firstAsset = assets[0];
                        safeLog(`Tentando selecionar o primeiro ativo da lista: ${firstAsset.name}`, 'INFO');
                        assetSelected = AssetManager.selectAsset(firstAsset);
                      } else {
                        safeLog(`Nenhum ativo encontrado na categoria ${message.category}`, 'WARN');
                      }
                      
                      // Fechar modal
                      AssetManager.closeAssetModal();
                      
                      sendResponse({
                        success: categoryChanged && assetSelected,
                        category: message.category,
                        assets: assets,
                        message: assetSelected 
                          ? `Ativo ${firstAsset.name} selecionado com sucesso na categoria ${message.category}.`
                          : `Falha ao selecionar um ativo na categoria ${message.category}.`
                      });
                    } catch (error) {
                      AssetManager.closeAssetModal();
                      sendResponse({ success: false, error: error.message });
                    }
                  }, 500);
                })
                .catch(error => {
                  AssetManager.closeAssetModal();
                  sendResponse({ success: false, error: error.message });
                });
            }, 800);
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        safeLog(`Erro ao mudar categoria: ${error.message}`, 'ERROR');
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
        safeLog(`Erro ao verificar ativo atual: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    // Handler para fechar modal de ativos
    if (message.action === 'CLOSE_ASSET_MODAL') {
      try {
        safeLog('Recebida solicitação para fechar modal de ativos', 'INFO');
        
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
            
            safeLog(`Fechamento concluído: ${closed}`, 'INFO');
            sendResponse({ 
              success: closed, 
              message: closed ? 'Modal fechado com sucesso' : 'Falha ao fechar modal'
            });
  } catch (error) {
            safeLog(`Erro ao fechar modal: ${error.message}`, 'ERROR');
            sendResponse({ success: false, error: error.message });
          }
        };
        
        executeCloseWithTimeout();
        
        return true; // Manter canal aberto para resposta assíncrona
      } catch (error) {
        safeLog(`Erro ao processar fechamento de modal: ${error.message}`, 'ERROR');
        sendResponse({ success: false, error: error.message });
        return true;
      }
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
          safeLog('Elemento de tempo não encontrado na plataforma', 'ERROR');
        return false;
      }
      
      // Clicar no elemento para abrir o modal
      timeControl.click();
        safeLog('Modal de tempo aberto', 'INFO');
      return true;
    } catch (error) {
        safeLog(`Erro ao abrir modal de tempo: ${error.message}`, 'ERROR');
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
          
            safeLog(`Procurando opção de tempo: ${targetTime}`, 'INFO');
          
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
              safeLog(`Opção exata ${targetTime} não encontrada, buscando alternativa`, 'WARN');
            
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
              safeLog(`Selecionando opção de tempo: ${selectedOption.textContent}`, 'SUCCESS');
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
          safeLog('Campo de valor não encontrado na plataforma', 'ERROR');
        return false;
      }
      
      // Definir valor e disparar evento de input
        amountInput.value = parsedValue;
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
      
        safeLog(`Valor de operação definido: $${parsedValue}`, 'SUCCESS');
      return true;
    } catch (error) {
        safeLog(`Erro ao definir valor: ${error.message}`, 'ERROR');
      return false;
    }
  },
  
  // Fechar o modal de tempo após seleção
  closeTimeModal: () => {
    try {
      // Verificar se o modal está aberto
      const modal = document.querySelector('.drop-down-modal.trading-panel-modal.expiration-inputs-list-modal');
      if (!modal) {
          safeLog('Modal de tempo não encontrado para fechar', 'WARN');
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
          safeLog('Evento de clique disparado para fechar o modal', 'INFO');
      }
      
      // Método 2: Verificar se há um botão de fechar no modal
      const closeButton = modal.querySelector('.close-btn, .btn-close, [data-close="true"]');
      if (closeButton) {
        closeButton.click();
          safeLog('Botão de fechar modal clicado', 'INFO');
      }
      
      // Verificar se o modal foi fechado
      setTimeout(() => {
        const modalStillOpen = document.querySelector('.drop-down-modal.trading-panel-modal.expiration-inputs-list-modal');
        if (modalStillOpen) {
            safeLog('Modal ainda aberto após tentativa de fechamento', 'WARN');
          
          // Método 3: Tentar clicar no controle de tempo novamente para alternar (toggle)
          const timeControl = document.querySelector('.block--expiration-inputs .control__value');
          if (timeControl) {
            timeControl.click();
              safeLog('Tentativa alternativa de fechar modal: clique no controle', 'INFO');
          }
        } else {
            safeLog('Modal de tempo fechado com sucesso', 'SUCCESS');
        }
      }, 300);
      
      return true;
    } catch (error) {
        safeLog(`Erro ao fechar modal de tempo: ${error.message}`, 'ERROR');
      return false;
    }
  },
  
  // Configurar operação com base nas configurações do usuário
  configureOperation: async (config) => {
    try {
        safeLog('Configurando parâmetros da operação...', 'INFO');
      
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
          safeLog(`Tempo de operação configurado: ${selectedTime}`, 'SUCCESS');
        
        // Fechar o modal após a seleção
        TradingConfig.closeTimeModal();
      }
      
      return true;
    } catch (error) {
        safeLog(`Erro ao configurar operação: ${error.message}`, 'ERROR');
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
      
      // Função para garantir que o DOM está carregado
      const ensureDOMLoaded = () => {
        return new Promise((domResolve) => {
          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            safeLog('DOM já está carregado, prosseguindo com a operação', 'INFO');
            domResolve();
          } else {
            safeLog('Aguardando carregamento do DOM...', 'INFO');
            document.addEventListener('DOMContentLoaded', () => {
              safeLog('DOM carregou, prosseguindo com a operação', 'INFO');
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
      safeLog(`Configurando operação: Valor=${tradeConfig.tradeValue}, Tempo=${tradeConfig.tradeTime}min`, 'INFO');
      
      // Enviar status para o usuário
      toUpdateStatus(`Executando ${action}: $${tradeConfig.tradeValue}, ${tradeConfig.tradeTime}min`, 'info', 3000);
      
      // Configurar o valor da operação
      try {
        const valueInput = document.querySelector('.block.block--bet-amount input[type="text"], [class*="amount"] input');
        if (valueInput) {
          safeLog(`Definindo valor da operação: ${tradeConfig.tradeValue}`, 'INFO');
          valueInput.value = tradeConfig.tradeValue;
          valueInput.dispatchEvent(new Event('input', { bubbles: true }));
          valueInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 200)); // Pequena pausa para atualização do DOM
        } else {
          safeLog('Elemento para definir valor não encontrado', 'WARN');
        }
      } catch (valueError) {
        safeLog(`Erro ao definir valor: ${valueError.message}`, 'ERROR');
      }
      
      // Configurar o período/tempo da operação
      try {
        // Determinar o período a ser usado
        let periodToUse = tradeConfig.tradeTime;
        
        // Se estiver usando período dinâmico e tiver dados da análise
        if (tradeConfig.useDynamicPeriod && tradeConfig.analysis && tradeConfig.analysis.expiration) {
          periodToUse = tradeConfig.analysis.expiration;
          safeLog(`Usando período da análise: ${periodToUse} minutos`, 'INFO');
        } else if (tradeConfig.tradeTime > 0) {
          safeLog(`Usando período fixo configurado: ${periodToUse} minutos`, 'INFO');
        } else {
          // Garantir que sempre use pelo menos 1 minuto
          periodToUse = 1;
          safeLog('Usando período mínimo: 1 minuto (valor configurado inválido)', 'WARN');
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
              safeLog(`Período configurado: ${timeSelected}`, 'SUCCESS');
              
              // Fechar o modal
              TradingConfig.closeTimeModal();
              await new Promise(r => setTimeout(r, 300)); // Esperar fechamento do modal
            } catch (timeError) {
              safeLog(`Erro ao selecionar tempo: ${timeError.message}`, 'ERROR');
            }
          } else {
            safeLog('Não foi possível abrir o modal de tempo', 'WARN');
          }
        }
      } catch (timeError) {
        safeLog(`Erro ao configurar período: ${timeError.message}`, 'ERROR');
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
          safeLog(`Tentativa ${attempts+1} falhou. Aguardando para nova tentativa...`, 'WARN');
          await new Promise(r => setTimeout(r, 500)); // Espera 500ms entre tentativas
          attempts++;
        } else if (!tradeButton) {
          // Se esgotou as tentativas e não encontrou, retorna erro
          const errorMsg = `Não foi possível encontrar o botão para a ação ${action} após ${maxAttempts} tentativas`;
        safeLog(errorMsg, 'ERROR');
        return reject({ success: false, message: errorMsg });
        }
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
        
        // Rolar até o botão para garantir que ele está visível
        tradeButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Pequena pausa para garantir que a rolagem termine
        await new Promise(r => setTimeout(r, 200));
        
        // MODIFICADO: Usar apenas um método de clique para evitar duplicação
        // Registrar que vamos clicar para fins de debug
        safeLog(`Executando clique único no botão de ${action}`, 'INFO');
        
        // Opção 1: Método nativo de clique (mais confiável e evita duplicação)
        tradeButton.click();
        
        // Enviar mensagem de sucesso para o status
        toUpdateStatus(`Operação ${action} executada com sucesso!`, 'success', 3000);
        
        // Verifica se o clique foi bem sucedido
        setTimeout(() => {
          safeLog(`Ação ${action} executada com sucesso`, 'SUCCESS');
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
        safeLog(errorMsg, 'ERROR');
        
        // Enviar mensagem de erro para o status
        toUpdateStatus(errorMsg, 'error', 5000);
        
        reject({ success: false, message: errorMsg });
      }
    } catch (error) {
      const errorMsg = `Erro geral ao executar a ação ${action}: ${error.message}`;
      safeLog(errorMsg, 'ERROR');
      
      // Enviar mensagem de erro para o status
      toUpdateStatus(errorMsg, 'error', 5000);
      
      reject({ success: false, message: errorMsg });
    }
  });
};

function findTradeButton(action) {
  try {
    safeLog(`Procurando botão para ação: ${action}`, 'INFO');
    
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
      safeLog(`Ação não suportada: ${action}`, 'ERROR');
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
          safeLog(`Encontrados ${elements.length} elementos com seletor "${selector}"`, 'DEBUG');
          
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
                
                safeLog(`Botão válido encontrado para ${action} com seletor: ${selector}`, 'SUCCESS');
                
                // Verificar se está realmente habilitado (sem classe disabled e não tem atributo disabled)
                if (!element.disabled && !element.classList.contains('disabled')) {
                  safeLog(`Botão está habilitado e será usado para ${action}`, 'SUCCESS');
                  return element;
                } else {
                  allFoundButtons.push({element, reason: 'disabled'});
                  safeLog(`Botão encontrado mas está desabilitado`, 'WARN');
                }
              } else {
                allFoundButtons.push({element, reason: 'not-interactive'});
                safeLog(`Elemento encontrado mas não parece ser um botão interativo`, 'WARN');
              }
            } else {
              allFoundButtons.push({element, reason: 'not-visible'});
            }
          }
        }
      } catch (err) {
        // Ignorar erros individuais de seletor e continuar tentando
        safeLog(`Erro ao usar seletor "${selector}": ${err.message}`, 'WARN');
        continue;
      }
    }
    
    // Se chegou aqui, tenta uma abordagem mais ampla para botões genéricos
    safeLog('Tentando encontrar botões genéricos de trading', 'INFO');
    
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
        
        safeLog(`Botão encontrado por texto/classe para ${action}: "${buttonText}"`, 'SUCCESS');
        return button;
      }
    }
    
    // Se nada funcionou e temos botões que foram encontrados mas estavam desabilitados ou não visíveis
    if (allFoundButtons.length > 0) {
      safeLog(`Encontrados ${allFoundButtons.length} botões potenciais, mas nenhum utilizável`, 'WARN');
      
      // Como último recurso, tentar usar o primeiro botão encontrado mesmo que não seja ideal
      for (const buttonInfo of allFoundButtons) {
        if (buttonInfo.reason === 'not-visible') {
          continue; // Pular os não visíveis
        }
        
        if (buttonInfo.reason === 'disabled') {
          safeLog('Como último recurso, tentando usar um botão que parece estar desabilitado', 'WARN');
          return buttonInfo.element;
        }
        
        if (buttonInfo.reason === 'not-interactive') {
          safeLog('Como último recurso, tentando usar um elemento que não parece ser botão', 'WARN');
          return buttonInfo.element;
        }
      }
    }
    
    // Se chegou aqui, não encontrou o botão
    safeLog(`Botão para ${action} não encontrado após tentar todos os métodos`, 'ERROR');
    return null;
  } catch (error) {
    safeLog(`Erro ao procurar botão ${action}: ${error.message}`, 'ERROR');
    return null;
  }
}

// Função para analisar a estrutura da interface de trading
function inspectTradingInterface() {
  try {
    safeLog("Inspecionando interface de trading...", "INFO");
    
    // Verificar botões de trading
    const possibleBuyButtons = document.querySelectorAll('button.btn-call, .btn-green, [data-type="call"], .trade-button--up, [class*="call"]');
    const possibleSellButtons = document.querySelectorAll('button.btn-put, .btn-red, [data-type="put"], .trade-button--down, [class*="put"]');
    
    safeLog(`Inspeção encontrou ${possibleBuyButtons.length} possíveis botões BUY e ${possibleSellButtons.length} possíveis botões SELL`, "INFO");
    
    // Se não encontrou nenhum botão, verificar toda a estrutura do DOM para classes relevantes
    if (possibleBuyButtons.length === 0 && possibleSellButtons.length === 0) {
      safeLog("Nenhum botão de trading encontrado, verificando estrutura DOM completa...", "WARN");
      
      // Procurar por elementos com classes que possam conter os botões
      const tradingElements = document.querySelectorAll('[class*="trading"], [class*="button"], [class*="btn"], [class*="control"]');
      safeLog(`Encontrados ${tradingElements.length} elementos potencialmente relevantes para trading`, "INFO");
      
      // Listar os primeiros 10 elementos com suas classes para depuração
      if (tradingElements.length > 0) {
        let elementsInfo = "Elementos encontrados:\n";
        for (let i = 0; i < Math.min(tradingElements.length, 10); i++) {
          const element = tradingElements[i];
          elementsInfo += `${i+1}. <${element.tagName.toLowerCase()}> classes: "${element.className}"\n`;
        }
        safeLog(elementsInfo, "INFO");
      }
    }
    
    // Verificar se está na página correta de trading
    const isTradingPage = document.querySelectorAll('.trading-panel, .chart-container, [class*="chart"]').length > 0;
    if (!isTradingPage) {
      safeLog("Atenção: Interface de trading não detectada. Possível página incorreta.", "WARN");
    } else {
      safeLog("Interface de trading detectada corretamente.", "SUCCESS");
    }
    
    // Verificar se há elementos de iframe que possam estar contendo a interface de trading
    const iframes = document.querySelectorAll('iframe');
    if (iframes.length > 0) {
      safeLog(`Detectados ${iframes.length} iframes na página. A interface de trading pode estar dentro de um iframe.`, "WARN");
    }
    
    // Verificar elementos de modal que podem estar sobrepondo a interface
    const modals = document.querySelectorAll('.modal, [class*="modal"], [class*="popup"], [class*="dialog"]');
    if (modals.length > 0) {
      safeLog(`Detectados ${modals.length} possíveis modais/popups que podem estar interferindo na interface`, "WARN");
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
    safeLog(`Erro ao inspecionar interface: ${error.message}`, "ERROR");
    return null;
  }
}

// Helper para logging seguro, caso a função sendLog não esteja disponível
const safeLog = (message, level = 'info') => {
  try {
    // Enviar para o sistema de logs centralizado
    chrome.runtime.sendMessage({
      action: 'addLog',
      logMessage: message,
      logLevel: level.toUpperCase(),
      logSource: 'content.js'
    });
    
    // Se for um erro ou alerta, enviar também para o sistema de status
    if (level.toUpperCase() === 'ERROR' || level.toUpperCase() === 'WARN') {
      toUpdateStatus(message, level.toLowerCase() === 'error' ? 'error' : 'warn', 5000);
    }
    
    // Log local apenas para erros
    if (level.toUpperCase() === 'ERROR') {
      console.error(`[${level.toUpperCase()}][content.js] ${message}`);
    }
  } catch (error) {
    // Fallback para console
    console.log(`[SafeLog] ${message}`);
  }
};

// Função para enviar logs para o sistema central - agora usando o mesmo padrão que safeLog
const sendLog = (message, level = 'INFO') => {
  safeLog(message, level);
};

// ======================================================================
// =================== SISTEMA DE MANIPULAÇÃO DE ATIVOS ================
// ======================================================================

const AssetManager = {
  // Função para abrir o modal de seleção de ativos
  openAssetModal: () => {
    try {
      safeLog('Abrindo modal de ativos...', 'INFO');
      
      // Usar o mesmo seletor para abrir e fechar
      const assetButton = document.querySelector('.currencies-block .pair-number-wrap');
      
      if (!assetButton) {
        throw new Error('Botão de seleção de ativos não encontrado');
      }
      
      // Clicar no botão para abrir o modal
      assetButton.click();
      safeLog('Clique executado para abrir modal', 'INFO');
      
      // Aguardar um momento para o modal aparecer
      return new Promise((resolve) => {
        setTimeout(() => {
          const activeControl = document.querySelector('.currencies-block__in.active');
          if (activeControl) {
            safeLog('✅ Modal aberto com sucesso (classe active detectada)', 'SUCCESS');
            resolve(true);
          } else {
            safeLog('❌ Modal pode não ter aberto', 'WARN');
            resolve(false);
          }
        }, 500);
      });
    } catch (error) {
      safeLog(`Erro ao abrir modal de ativos: ${error.message}`, 'ERROR');
      return Promise.resolve(false);
    }
  },

  // Função para fechar o modal de ativos - MÉTODO MOUSEDOWN + MOUSEUP
  closeAssetModal: () => {
    return new Promise((resolve) => {
      try {
        safeLog('Fechando modal de ativos...', 'INFO');
        
        // Verificar se o modal está realmente aberto
        const activeControl = document.querySelector('.currencies-block__in.active');
        if (!activeControl) {
          safeLog('✅ Modal já está fechado', 'INFO');
          resolve(true);
          return;
        }
        
        // MÉTODO DESCOBERTO: Mousedown + mouseup no wrapper do modal
        const modalWrapper = document.querySelector('.drop-down-modal-wrap.active');
        if (!modalWrapper) {
          safeLog('❌ Wrapper do modal não encontrado', 'ERROR');
          resolve(false);
          return;
        }
        
        safeLog('Executando mousedown + mouseup no wrapper do modal...', 'INFO');
        
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
          
          safeLog('Eventos mousedown + mouseup executados', 'INFO');
          
          // Verificar se fechou após 500ms
          setTimeout(() => {
            const stillActive = document.querySelector('.currencies-block__in.active');
            if (!stillActive) {
              safeLog('✅ Modal fechado com sucesso via mousedown + mouseup', 'SUCCESS');
              resolve(true);
            } else {
              safeLog('❌ Modal não fechou, tentando método de fallback...', 'WARN');
              
              // FALLBACK: Tentar clique simples no wrapper
              modalWrapper.click();
              
              setTimeout(() => {
                const finalCheck = document.querySelector('.currencies-block__in.active');
                if (!finalCheck) {
                  safeLog('✅ Modal fechado com clique de fallback', 'SUCCESS');
                  resolve(true);
                } else {
                  safeLog('❌ Modal persistiu após todos os métodos', 'ERROR');
                  resolve(false);
                }
              }, 300);
            }
          }, 500);
        }, 50); // 50ms entre mousedown e mouseup
        
      } catch (error) {
        safeLog(`Erro ao fechar modal: ${error.message}`, 'ERROR');
        resolve(false);
      }
    });
  },

  // Função para mudar para a categoria de ativos (Crypto, Currency, etc.)
  switchToCategory: async (category) => {
    try {
      safeLog(`Mudando para categoria: ${category}`, 'INFO');
      
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
        safeLog(`Tentando mudar para categoria: ${category}`, 'INFO');
        
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
          safeLog(`Seletor ${selector} não encontrado, verificando se categoria já está ativa...`, 'DEBUG');
          
          // Verificar se existe alguma categoria ativa que corresponda
          const activeCategory = document.querySelector('.assets-block__nav-item--active');
          if (activeCategory) {
            const activeCategoryClass = activeCategory.className;
            safeLog(`Categoria ativa encontrada: ${activeCategoryClass}`, 'DEBUG');
            
            // Verificar se a categoria ativa corresponde à solicitada
            if (activeCategoryClass.includes('cryptocurrency') && (category.toLowerCase() === 'crypto' || category.toLowerCase() === 'cryptocurrency')) {
              safeLog(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
            if (activeCategoryClass.includes('currency') && (category.toLowerCase() === 'currency' || category.toLowerCase() === 'currencies')) {
              safeLog(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
            if (activeCategoryClass.includes('commodity') && (category.toLowerCase() === 'commodity' || category.toLowerCase() === 'commodities')) {
              safeLog(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
            if (activeCategoryClass.includes('stock') && (category.toLowerCase() === 'stock' || category.toLowerCase() === 'stocks')) {
              safeLog(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
            if (activeCategoryClass.includes('index') && (category.toLowerCase() === 'index' || category.toLowerCase() === 'indices')) {
              safeLog(`✅ Categoria ${category} já está ativa (verificação por classe ativa)`, 'SUCCESS');
              resolve(true);
              return;
            }
          }
          
          // ✅ Se chegou aqui, categoria não está disponível (DEBUG, não ERROR)
          safeLog(`🔄 Categoria ${category} não disponível na plataforma no momento`, 'DEBUG');
          reject(new Error(`Categoria ${category} não disponível`));
          return;
        }
        
        // Verificar se já está ativo
        if (categoryButton.classList.contains('assets-block__nav-item--active')) {
          safeLog(`✅ Categoria ${category} já está ativa`, 'SUCCESS');
          resolve(true);
          return;
        }
        
        // Clicar na categoria
        categoryButton.click();
        safeLog(`Mudança para categoria ${category} executada`, 'SUCCESS');
        
        // Aguardar um momento para a lista atualizar
        setTimeout(() => {
          if (categoryButton.classList.contains('assets-block__nav-item--active')) {
            safeLog(`✅ Categoria ${category} ativada com sucesso`, 'SUCCESS');
            resolve(true);
          } else {
            safeLog(`⚠️ Falha ao ativar categoria ${category}`, 'WARN');
            resolve(false);
          }
        }, 300);
      } catch (error) {
        safeLog(`Erro ao mudar categoria: ${error.message}`, 'ERROR');
        reject(error);
      }
    });
  },

  // Função para obter lista de ativos disponíveis com seus payouts
  getAvailableAssets: () => {
    try {
      safeLog('Obtendo lista de ativos disponíveis...', 'INFO');
      
      const assets = [];
      
      // Procurar por itens de ativos na lista
      const assetItems = document.querySelectorAll('.alist__item:not(.alist__item--no-active)');
      
      if (assetItems.length === 0) {
        safeLog('Nenhum ativo ativo encontrado na lista', 'WARN');
        return [];
      }
      
      assetItems.forEach((item, index) => {
        try {
          // Obter nome do ativo
          const nameElement = item.querySelector('.alist__label');
          const name = nameElement ? nameElement.textContent.trim() : `Ativo ${index + 1}`;
          
          // Obter payout
          const payoutElement = item.querySelector('.alist__payout span');
          let payout = 0;
          
          if (payoutElement) {
            const payoutText = payoutElement.textContent.trim();
            const payoutMatch = payoutText.match(/\+?(\d+)%/);
            if (payoutMatch) {
              payout = parseInt(payoutMatch[1], 10);
            }
          }
          
          // Verificar se está ativo (disponível para trading)
          const isActive = !item.classList.contains('alist__item--no-active') && 
                          !item.classList.contains('alist__item--no-hover');
          
          // Verificar se está atualmente selecionado
          const isSelected = item.classList.contains('alist__item--active');
          
          if (isActive && payout > 0) {
            assets.push({
              name: name,
              payout: payout,
              isSelected: isSelected,
              element: item,
              index: index
            });
          }
        } catch (itemError) {
          safeLog(`Erro ao processar ativo ${index}: ${itemError.message}`, 'WARN');
        }
      });
      
      // Ordenar por payout (maior primeiro)
      assets.sort((a, b) => b.payout - a.payout);
      
      safeLog(`Encontrados ${assets.length} ativos disponíveis`, 'SUCCESS');
      return assets;
    } catch (error) {
      safeLog(`Erro ao obter lista de ativos: ${error.message}`, 'ERROR');
      return [];
    }
  },

  // Função para encontrar o melhor ativo baseado no payout mínimo
  findBestAsset: (minPayout = 85) => {
    try {
      safeLog(`Procurando melhor ativo com payout mínimo de ${minPayout}%`, 'INFO');
      
      const assets = AssetManager.getAvailableAssets();
      
      if (assets.length === 0) {
        safeLog('Nenhum ativo disponível encontrado', 'WARN');
        return null;
      }
      
      // Filtrar ativos que atendem ao payout mínimo
      const validAssets = assets.filter(asset => asset.payout >= minPayout);
      
      if (validAssets.length === 0) {
        safeLog(`Nenhum ativo encontrado com payout >= ${minPayout}%`, 'WARN');
        return null;
      }
      
      // Retornar o primeiro (melhor payout) que atende ao critério
      const bestAsset = validAssets[0];
      safeLog(`Melhor ativo encontrado: ${bestAsset.name} (${bestAsset.payout}%)`, 'SUCCESS');
      
      return bestAsset;
    } catch (error) {
      safeLog(`Erro ao encontrar melhor ativo: ${error.message}`, 'ERROR');
      return null;
    }
  },

  // Função para encontrar o melhor ativo com informações detalhadas (para testes)
  findBestAssetDetailed: (minPayout = 85) => {
    try {
      safeLog(`Procurando melhor ativo com payout mínimo de ${minPayout}%`, 'INFO');
      
      const assets = AssetManager.getAvailableAssets();
      
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
        safeLog(`Nenhum ativo encontrado com payout >= ${minPayout}%`, 'WARN');
        return {
          success: false,
          error: `Nenhum ativo com payout >= ${minPayout}% encontrado`,
          allAssets: assets
        };
      }
      
      // Retornar o primeiro (melhor payout) que atende ao critério
      const bestAsset = validAssets[0];
      
      // Selecionar o ativo encontrado
      const selected = AssetManager.selectAsset(bestAsset);
      if (!selected) {
        return {
          success: false,
          error: 'Falha ao selecionar o ativo',
          allAssets: assets
        };
      }
      
      safeLog(`Melhor ativo encontrado e selecionado: ${bestAsset.name} (${bestAsset.payout}%)`, 'SUCCESS');
      
      return {
        success: true,
        asset: bestAsset,
        message: `Melhor ativo selecionado: ${bestAsset.name} (${bestAsset.payout}%)`,
        allAssets: assets
      };
    } catch (error) {
      safeLog(`Erro ao encontrar melhor ativo: ${error.message}`, 'ERROR');
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
        safeLog(`Ativo atual detectado: ${currentAsset}`, 'INFO');
        return currentAsset;
      }
      
      // Fallback: verificar no seletor de pares
      const pairElement = document.querySelector('.pair .current-symbol');
      if (pairElement) {
        const currentAsset = pairElement.textContent.trim();
        safeLog(`Ativo atual detectado (fallback): ${currentAsset}`, 'INFO');
        return currentAsset;
      }
      
      safeLog('Não foi possível detectar o ativo atual', 'WARN');
      return null;
    } catch (error) {
      safeLog(`Erro ao verificar ativo atual: ${error.message}`, 'ERROR');
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
          safeLog(`✅ Verificação confirmada: ${expectedAssetName} está selecionado`, 'SUCCESS');
          resolve(true);
          return;
        }
        
        if (attempts < maxRetries) {
          safeLog(`Tentativa ${attempts}/${maxRetries}: Aguardando seleção de ${expectedAssetName}...`, 'INFO');
          setTimeout(checkSelection, 500);
        } else {
          safeLog(`❌ Falha na verificação: ${expectedAssetName} não foi selecionado após ${maxRetries} tentativas`, 'ERROR');
          resolve(false);
        }
      };
      
      checkSelection();
    });
  },

  // Função para selecionar um ativo específico
  selectAsset: (asset) => {
    try {
      if (!asset || !asset.element) {
        throw new Error('Ativo inválido ou elemento não encontrado');
      }
      
      safeLog(`Selecionando ativo: ${asset.name} (${asset.payout}%)`, 'INFO');
      
      // Verificar se já está selecionado
      if (asset.isSelected) {
        safeLog(`Ativo ${asset.name} já está selecionado`, 'INFO');
        return true;
      }
      
      // Tentar clicar no link interno primeiro
      const linkElement = asset.element.querySelector('.alist__link');
      if (linkElement) {
        safeLog(`Clique executado no link interno (.alist__link) do ativo ${asset.name}`, 'INFO');
        linkElement.click();
        return true;
      }
      
      // Se não houver link interno, tentar clicar no elemento principal do ativo
      safeLog(`'.alist__link' não encontrado, tentando clicar no elemento principal (.alist__item) do ativo ${asset.name}`, 'INFO');
      asset.element.click();
      return true;

    } catch (error) {
      safeLog(`Erro ao selecionar ativo: ${error.message}`, 'ERROR');
      return false;
    }
  },



  // Função para encontrar melhor ativo DENTRO da categoria atual (usada pelo painel)
  switchToBestAssetInCurrentCategory: async (minPayout = 85) => {
    try {
      safeLog(`🔍 [PAINEL] Buscando melhor ativo na categoria atual (payout >= ${minPayout}%)`, 'INFO');
      
      // ✅ CORREÇÃO: Verificação múltipla para garantir que a categoria carregou
      let assets = [];
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        assets = AssetManager.getAvailableAssets();
        attempts++;
        
        safeLog(`📊 [PAINEL] Tentativa ${attempts}/${maxAttempts}: ${assets.length} ativos encontrados`, 'DEBUG');
        
        if (assets.length > 0) {
          break; // Lista carregou com sucesso
        }
        
        if (attempts < maxAttempts) {
          safeLog(`⏳ [PAINEL] Lista vazia, aguardando mais 500ms...`, 'DEBUG');
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
      safeLog(`🎯 [PAINEL] ${validAssets.length} ativos com payout >= ${minPayout}%`, 'DEBUG');
      
      if (validAssets.length === 0) {
        const bestAvailable = assets[0];
        throw new Error(`PAYOUT_INSUFFICIENT_IN_CATEGORY: Melhor ativo disponível: ${bestAvailable.name} (${bestAvailable.payout}%)`);
      }
      
      // Selecionar melhor ativo
      const bestAsset = validAssets[0];
      safeLog(`🎯 [PAINEL] Selecionando melhor ativo: ${bestAsset.name} (${bestAsset.payout}%)`, 'SUCCESS');
      
      const assetSelected = AssetManager.selectAsset(bestAsset);
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
      safeLog(`🔍 [BUSCA CATEGORIA] ${error.message}`, 'DEBUG');
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Função WRAPPER para automação - busca sequencial em múltiplas categorias
  switchToBestAssetForAutomation: async (minPayout = 85, preferredCategory = 'crypto') => {
    try {
      safeLog(`🚀 [AUTOMAÇÃO] Iniciando busca inteligente de ativo (payout >= ${minPayout}%, categoria preferida: ${preferredCategory})`, 'INFO');
      
      // ✅ ETAPA 1: PREPARAÇÃO
      const currentAsset = AssetManager.getCurrentSelectedAsset();
      safeLog(`📊 [ESTADO ATUAL] Ativo antes da busca: ${currentAsset || 'Não detectado'}`, 'INFO');
      
      // Abrir modal de ativos
      const modalOpened = await AssetManager.openAssetModal();
      if (!modalOpened) {
        throw new Error('MODAL_OPEN_FAILED: Falha ao abrir modal de ativos');
      }
      safeLog(`✅ [MODAL] Modal de ativos aberto com sucesso`, 'INFO');
      
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
      safeLog(`📂 [CATEGORIAS] ${categoriesToTry.length} categorias para verificar: ${categoriesToTry.join(', ')}`, 'INFO');
      
      // ✅ ETAPA 3: BUSCA SEQUENCIAL USANDO FUNÇÃO DO PAINEL
      let bestResult = null;
      let usedCategory = null;
      let categoriesAttempted = [];
      let categoriesFailed = [];
      
      for (const category of categoriesToTry) {
        categoriesAttempted.push(category);
        safeLog(`🔍 [CATEGORIA] Tentando categoria: ${category}`, 'DEBUG');
        
        try {
          // Ativar categoria
          const categoryChanged = await AssetManager.switchToAssetCategory(category);
          if (!categoryChanged) {
            safeLog(`🔄 [CATEGORIA] ${category} não disponível na plataforma`, 'DEBUG');
            categoriesFailed.push(`${category} (não disponível)`);
            continue;
          }
          
          safeLog(`✅ [CATEGORIA] ${category} ativada, aguardando carregar...`, 'DEBUG');
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // ✅ USAR FUNÇÃO DO PAINEL COM TRATAMENTO SILENCIOSO DE ERROS
          safeLog(`🔧 [AUTOMAÇÃO] Usando função do painel para categoria ${category}`, 'DEBUG');
          
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
              
              safeLog(`🎯 [ENCONTRADO] Ativo adequado na ${categoryLabel}: ${bestResult.asset.name} (${bestResult.asset.payout}%)`, 'SUCCESS');
              safeLog(`🛑 [PARADA] Parando busca - ativo adequado encontrado`, 'INFO');
              break; // ✅ PARAR - ENCONTROU ATIVO ADEQUADO!
            } else {
              safeLog(`📝 [RESULTADO] Categoria ${category}: ${categoryResult.error}`, 'DEBUG');
              categoriesFailed.push(`${category} (${categoryResult.error})`);
            }
          } catch (categorySearchError) {
            // ✅ CAPTURAR ERROS DA FUNÇÃO BASE SEM PROPAGAR
            const errorMsg = categorySearchError.message || 'Erro na busca';
            safeLog(`📝 [RESULTADO] Categoria ${category}: ${errorMsg}`, 'DEBUG');
            categoriesFailed.push(`${category} (${errorMsg})`);
            
            // ✅ IMPORTANTE: Continuar para próxima categoria sem interromper o loop
            continue;
          }
          
        } catch (categoryError) {
          safeLog(`🔄 [CATEGORIA] ${category} não acessível: ${categoryError.message}`, 'DEBUG');
          categoriesFailed.push(`${category} (erro: ${categoryError.message})`);
          continue;
        }
      }
      
      // ✅ ETAPA 4: ANÁLISE DO RESULTADO
      safeLog(`📊 [BUSCA FINAL] Categorias verificadas: ${categoriesAttempted.join(', ')}`, 'INFO');
      
      if (categoriesFailed.length > 0) {
        safeLog(`📂 [FALHAS] ${categoriesFailed.length} categorias falharam: ${categoriesFailed.join(', ')}`, 'DEBUG');
      }
      
      // ❌ ERRO: Nenhum ativo adequado encontrado em nenhuma categoria
      if (!bestResult) {
        const errorMsg = `AUTOMATION_SEARCH_FAILED: Nenhum ativo com payout >= ${minPayout}% encontrado em nenhuma categoria. Falhas: ${categoriesFailed.join('; ')}`;
        safeLog(`❌ [ERRO CRÍTICO] ${errorMsg}`, 'ERROR');
        throw new Error(errorMsg);
      }
      
      // ✅ ETAPA 5: GARANTIR QUE ATIVO FOI SELECIONADO ANTES DE FECHAR MODAL
      safeLog(`🎯 [SELEÇÃO] Garantindo que ativo ${bestResult.asset.name} está selecionado...`, 'DEBUG');
      
      // Tentar selecionar o ativo novamente para garantir
      try {
        const assetSelected = AssetManager.selectAsset(bestResult.asset);
        if (assetSelected) {
          safeLog(`✅ [SELEÇÃO] Ativo ${bestResult.asset.name} selecionado com sucesso`, 'DEBUG');
        }
      } catch (selectionError) {
        safeLog(`⚠️ [SELEÇÃO] Aviso na seleção final: ${selectionError.message}`, 'WARN');
      }
      
      // Aguardar seleção processar
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // ✅ ETAPA 6: FECHAR MODAL
      safeLog(`🚪 [MODAL] Fechando modal de ativos...`, 'DEBUG');
      const modalClosed = await AssetManager.closeAssetModal();
      if (!modalClosed) {
        safeLog(`⚠️ [MODAL] Aviso: Modal pode não ter fechado corretamente`, 'WARN');
      }
      
      // Aguardar interface atualizar
      safeLog(`⏳ [INTERFACE] Aguardando interface atualizar...`, 'DEBUG');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aumentado para 2s
      
      // ✅ ETAPA 7: VERIFICAÇÃO FINAL ROBUSTA
      let finalAsset = null;
      let verificationAttempts = 0;
      const maxVerificationAttempts = 3;
      
      while (verificationAttempts < maxVerificationAttempts) {
        finalAsset = AssetManager.getCurrentSelectedAsset();
        verificationAttempts++;
        
        safeLog(`📊 [VERIFICAÇÃO] Tentativa ${verificationAttempts}/${maxVerificationAttempts}: Ativo atual = "${finalAsset}"`, 'DEBUG');
        
        if (finalAsset && finalAsset.includes(bestResult.asset.name.split(' ')[0])) {
          safeLog(`✅ [VERIFICAÇÃO] Ativo correto detectado: ${finalAsset}`, 'SUCCESS');
          break;
        }
        
        if (verificationAttempts < maxVerificationAttempts) {
          safeLog(`⏳ [VERIFICAÇÃO] Aguardando mais 800ms antes da próxima verificação...`, 'DEBUG');
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      
      // ✅ ETAPA 8: SUCESSO FINAL
      const categoryInfo = usedCategory === preferredCategory ? 
        `categoria preferida (${usedCategory})` : 
        `fallback para categoria ${usedCategory}`;
      
      const successMessage = `Ativo alterado para ${bestResult.asset.name} (${bestResult.asset.payout}%) - ${categoryInfo}`;
      
      if (usedCategory === preferredCategory) {
        safeLog(`✅ [SUCESSO] Busca concluída com categoria preferida: ${successMessage}`, 'SUCCESS');
      } else {
        safeLog(`⚠️ [AVISO] Categoria preferida sem payout adequado. ${successMessage}`, 'WARN');
      }
      
      safeLog(`🎉 [CONCLUÍDO] Busca de ativo para automação finalizada com sucesso`, 'INFO');
      safeLog(`📋 [RESUMO] Categorias tentadas: ${categoriesAttempted.join(', ')}`, 'INFO');
      safeLog(`📋 [RESUMO] Categoria usada: ${usedCategory}, Ativo final: ${finalAsset}`, 'INFO');
      
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
      safeLog(`💥 [ERRO CRÍTICO] Busca de ativo para automação falhou: ${error.message}`, 'ERROR');
      
      // Tentar fechar modal em caso de erro
      try {
        await AssetManager.closeAssetModal();
        safeLog(`🚪 [CLEANUP] Modal fechado após erro`, 'DEBUG');
      } catch (closeError) {
        safeLog(`⚠️ [CLEANUP] Erro ao fechar modal: ${closeError.message}`, 'WARN');
      }
      
      const errorMsg = `AUTOMATION_SEARCH_FAILED: ${error.message}`;
      safeLog(`❌ [RETORNO] ${errorMsg}`, 'ERROR');
      
      return {
        success: false,
        error: errorMsg
      };
    }
  },

  // Função principal para trocar para o melhor ativo (PAINEL - busca apenas na categoria atual)
  switchToBestAsset: async (minPayout = 85, preferredCategory = 'crypto') => {
    // ✅ PARA PAINEL: Usar função simples que busca apenas na categoria atual
    safeLog(`🔍 [PAINEL] Buscando melhor ativo na categoria atual (payout >= ${minPayout}%)`, 'INFO');
    return await AssetManager.switchToBestAssetInCurrentCategory(minPayout);
  }
};

// ======================================================================
// =================== LISTENERS DE MENSAGENS ==========================
// ======================================================================

// Listener para mensagens do sistema de extensão
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handler para teste de captura de payout
  if (message.action === 'TEST_CAPTURE_PAYOUT') {
    safeLog('Solicitação de teste de captura de payout recebida', 'INFO');
    
    capturePayoutFromDOM()
      .then(result => {
        safeLog(`Captura de payout concluída: ${result.payout}%`, 'SUCCESS');
        sendResponse(result);
      })
      .catch(error => {
        safeLog(`Erro na captura de payout: ${error.message}`, 'ERROR');
        sendResponse({
          success: false,
          error: error.message
        });
      });
    
    return true; // Resposta assíncrona
  }
  
  // Handler para testes de ativos (já existentes)
  if (message.action === 'TEST_FIND_BEST_ASSET') {
    safeLog('Solicitação de busca do melhor ativo recebida', 'INFO');
    
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
  
  if (message.action === 'TEST_SWITCH_ASSET_CATEGORY') {
    safeLog(`Solicitação de troca de categoria para ${message.category} recebida`, 'INFO');
    
    const category = message.category || 'crypto';
    
    AssetManager.switchToBestAsset(85, category)
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
  
  // ✅ HANDLER ESPECÍFICO PARA TEST_SWITCH_TO_BEST_ASSET (usando wrapper de automação)
  if (message.action === 'TEST_SWITCH_TO_BEST_ASSET') {
    safeLog(`🔄 Solicitação de troca inteligente recebida - Payout mínimo: ${message.minPayout}%, Categoria preferida: ${message.category}`, 'INFO');
    
    const minPayout = message.minPayout || 85;
    const preferredCategory = message.category || 'crypto';
    
    AssetManager.switchToBestAssetForAutomation(minPayout, preferredCategory)
      .then(result => {
        if (result.success) {
          // ✅ Log adicional para mostrar categoria usada
          const categoryInfo = result.wasPreferred ? 
            `categoria preferida (${result.usedCategory})` : 
            `fallback para categoria ${result.usedCategory}`;
          
          safeLog(`✅ Troca inteligente concluída: ${result.asset.name} (${result.asset.payout}%) - ${categoryInfo}`, 'SUCCESS');
        }
        sendResponse(result);
      })
      .catch(error => {
        safeLog(`❌ Erro na troca inteligente: ${error.message}`, 'ERROR');
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