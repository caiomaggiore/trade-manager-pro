// Trade Manager Pro - Index Module
// Verifica se o módulo já foi inicializado para evitar duplicações
if (typeof window.TradeManagerIndexLoaded === 'undefined') {
    // Marca o módulo como carregado
    window.TradeManagerIndexLoaded = true;
    
    // Verificar se o sistema de logs está disponível
    let logInitialized = false;
    
    // Função para adicionar logs usando EXCLUSIVAMENTE chrome.runtime
    const addLog = (message, level = 'INFO') => {
        // Enviar para o sistema centralizado via mensagem
        try {
            // Certifique-se que o background script espera por 'action: logMessage' ou ajuste o 'action'
            chrome.runtime.sendMessage({
                action: 'addLog', // PADRONIZADO para addLog
                logMessage: `${message}`, // Usando logMessage
                level: level,
                source: 'index.js' // 'source' já é explícito aqui, mas pode ser útil para o receptor
            }); // Callback removido
        } catch (error) {
            console.warn('[index.js] Exceção ao tentar enviar log via runtime:', error);
        }
    };
    
    // Função para atualizar o status no UI e registrar um log
    const updateStatus = (message, level = 'INFO', duration = 3000) => {
        const statusElement = document.getElementById('status-processo');
        if (statusElement) {
            let statusClass = 'info'; // Default class
            switch (String(level).toUpperCase()) { // Garantir que level seja string
                case 'ERROR': statusClass = 'error'; break;
                case 'WARN': statusClass = 'warn'; break;
                case 'SUCCESS': statusClass = 'success'; break;
                // default é 'info'
            }
            
            statusElement.className = 'status-processo'; // Reset classes
            statusElement.classList.add(statusClass, 'visible');
            statusElement.textContent = message;
            
            // Limpar status após a duração, se especificado e > 0
            if (typeof duration === 'number' && duration > 0) {
                setTimeout(() => {
                    if (statusElement.textContent === message) { // Só limpa se ainda for a mesma mensagem
                        statusElement.classList.remove('visible');
                    }
                }, duration);
            }
        } else {
            // Apenas logar no console se o elemento não for encontrado
            console.warn('Elemento de status #status-processo não encontrado na UI');
        }
    };
    
    // Iniciar sistema de logs ao carregar
    const initLogging = () => {
        if (logInitialized) return;
        
        try {
            // Verificar se o sistema de logs já existe
            if (typeof window.logToSystem === 'function') {
                addLog('Sistema de logs disponível', 'DEBUG');
                logInitialized = true;
                return;
            }
            
            // Verificar se o LogSystem existe (pode estar carregado mas não inicializado)
            if (typeof window.LogSystem === 'object') {
                window.LogSystem.init();
                addLog('Sistema de logs inicializado', 'INFO');
                logInitialized = true;
                return;
            }
            
            // Se o sistema não está disponível, tentar carregar via script
            addLog('Sistema de logs não detectado, tentando carregar via script...', 'WARN');
            
            const script = document.createElement('script');
            script.src = '../content/log-sys.js';
            script.onload = () => {
                if (typeof window.LogSystem === 'object') {
                    window.LogSystem.init();
                    logInitialized = true;
                    addLog('Sistema de logs inicializado após carregamento dinâmico', 'SUCCESS');
                } else {
                    addLog('LogSystem não disponível mesmo após carregamento', 'ERROR');
                }
            };
            script.onerror = (err) => {
                addLog('Erro ao carregar sistema de logs: ' + err, 'ERROR');
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Erro ao inicializar sistema de logs:', error);
        }
    };
    
    // ================== VERIFICAÇÃO DE ELEMENTOS ==================
    // Função para obter elementos da UI de forma segura
    const getUIElements = () => {
        return {
            settingsPanel:  document.querySelector('#settings-panel'),
            settingsBtn:    document.querySelector('#settings-btn'),
            backBtn:        document.querySelector('#back-btn'),
            saveBtn:        document.querySelector('#save-settings'),
            exportBtn:      document.querySelector('#export-csv'),
            operationsBody: document.querySelector('#operations-body'),
            version:        document.querySelector('#version'),
            currentGale:    document.querySelector('#current-gale'),
            currentProfit:  document.querySelector('#current-profit'),
            currentStop:    document.querySelector('#current-stop'),
            currentValue:   document.querySelector('#current-value'),
            currentTime:    document.querySelector('#current-time'),
            toggleAuto:     document.querySelector('#toggleAuto'),
            toggleGale:     document.querySelector('#toggleGale'),
            galeSelect:     document.querySelector('#gale-select'),
            automationStatus:document.querySelector('#automation-status'),
            startOperation: document.querySelector('#start-operation'),
            analyzeBtn:     document.querySelector('#analyzeBtn'),
            captureScreen:  document.querySelector('#captureBtn'),
            cancelOperation: document.querySelector('#cancel-operation'),
            statusProcesso: document.querySelector('#status-processo'),
            dailyProfit:    document.querySelector('#daily-profit'),
            stopLoss:       document.querySelector('#stop-loss'),
            entryValue:     document.querySelector('#trade-value'),
            timePeriod:     document.querySelector('#trade-time')
        };
    };
    
    // Inicializar elementos da UI
    let indexUI = getUIElements();
    
    // ================== VARIÁVEIS GLOBAIS ==================
    let isAutomationRunning = false;
    let automationTimeout = null;
    let historyModuleInitialized = false;
    
    // Expor as constantes globalmente
    window.API_KEY = 'AIzaSyDeYcYUxAN52DNrgZeFNcEfceVMoWJDjWk';
    window.API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.API_KEY}`;
    
    // ================== INICIALIZAÇÃO DO MONITORAMENTO ==================
    // REMOVIDO: Monitoramento de trade que estava duplicado com trade-history.js
    // document.addEventListener('DOMContentLoaded', async () => { // Linha original ~153
    // ... (Todo o bloco async () => { ... } até a linha ~387 original foi removido)

    // ================== FUNÇÕES DE ANÁLISE ==================
    /**
     * Executa a análise do gráfico atual
     * @returns {Promise<Object>} Resultado da análise
     */
    const runAnalysis = async () => {
        try {
            updateStatus('Iniciando análise...', 'info');
            addLog('Iniciando análise do gráfico...');
            
            // ETAPA 1: Capturar a tela
            addLog('Iniciando captura de tela para análise...', 'INFO');
            let dataUrl;
            
            // Verificar se o módulo de captura está disponível
            if (!window.CaptureScreen || typeof window.CaptureScreen.captureForAnalysis !== 'function') {
                addLog('Módulo de captura não disponível, tentando carregar dinamicamente', 'WARN');
                
                // Tentar carregar o módulo dinamicamente
                try {
                    const script = document.createElement('script');
                    script.src = '../content/capture-screen.js';
                    
                    await new Promise((resolve, reject) => {
                        script.onload = () => {
                            addLog('Módulo de captura carregado dinamicamente', 'SUCCESS');
                            resolve();
                        };
                        script.onerror = (err) => {
                            addLog(`Erro ao carregar módulo de captura: ${err}`, 'ERROR');
                            reject(new Error('Falha ao carregar módulo de captura'));
                        };
                        document.head.appendChild(script);
                    });
                    
                    // Verificar se o carregamento foi bem-sucedido
                    if (!window.CaptureScreen || typeof window.CaptureScreen.captureForAnalysis !== 'function') {
                        throw new Error('Módulo de captura carregado, mas função captureForAnalysis não disponível');
                    }
                } catch (loadError) {
                    throw new Error(`Não foi possível carregar o módulo de captura: ${loadError.message}`);
                }
            }
            
            // Agora usar o módulo de captura
            try {
                dataUrl = await window.CaptureScreen.captureForAnalysis();
                addLog('Captura de tela para análise concluída com sucesso', 'SUCCESS');
            } catch (captureError) {
                throw new Error(`Falha ao capturar tela para análise: ${captureError.message}`);
            }
            
            // Verificar se obtivemos uma captura válida
            if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
                throw new Error('Dados de imagem inválidos ou ausentes');
            }
            
            // Armazenar a captura para uso futuro
            window.lastCapturedImage = dataUrl;
            window.lastCapturedImageTimestamp = Date.now();
            
            // ETAPA 2: Processar a análise
            addLog('Iniciando etapa de processamento de análise...', 'INFO');
            
            try {
                // Obter configurações
                const settings = window.StateManager ? window.StateManager.getConfig() : {};
                
                // Enviar análise usando o analyze-graph.js diretamente se disponível
                if (window.AnalyzeGraph && typeof window.AnalyzeGraph.analyzeImage === 'function') {
                    addLog('Usando módulo AnalyzeGraph para processamento...', 'INFO');
                    
                    const analysisResult = await window.AnalyzeGraph.analyzeImage(dataUrl, settings);
                    
                    // Formatar resultado
                    const formattedResult = {
                        success: true,
                        results: analysisResult
                    };
                    
                    // Registrar sucesso
                    addLog(`Análise concluída com sucesso: ${analysisResult.action}`, 'SUCCESS');
                    updateStatus(`Análise: ${analysisResult.action}`, 'success');
                    
                    // Mostrar modal
                    if (typeof showAnalysisModal === 'function') {
                        showAnalysisModal(analysisResult);
                    } else {
                        addLog('Função showAnalysisModal não disponível', 'WARN');
                    }
                    
                    return formattedResult;
                } else {
                    // Se o módulo não estiver disponível, tentar carregar
                    addLog('Módulo AnalyzeGraph não disponível, tentando carregar dinamicamente', 'WARN');
                    
                    try {
                        // Tentar carregar o módulo
                        const analyzeScript = document.createElement('script');
                        analyzeScript.src = '../content/analyze-graph.js';
                        
                        await new Promise((resolve, reject) => {
                            analyzeScript.onload = () => {
                                addLog('Módulo AnalyzeGraph carregado dinamicamente', 'SUCCESS');
                                resolve();
                            };
                            analyzeScript.onerror = (err) => {
                                addLog(`Erro ao carregar módulo de análise: ${err}`, 'ERROR');
                                reject(new Error('Falha ao carregar módulo de análise'));
                            };
                            document.head.appendChild(analyzeScript);
                        });
                        
                        // Verificar se o carregamento foi bem-sucedido
                        if (!window.AnalyzeGraph || typeof window.AnalyzeGraph.analyzeImage !== 'function') {
                            throw new Error('Módulo de análise carregado, mas função analyzeImage não disponível');
                        }
                        
                        // Usar o módulo recém-carregado
                        const analysisResult = await window.AnalyzeGraph.analyzeImage(dataUrl, settings);
                        
                        // Formatar resultado
                        const formattedResult = {
                            success: true,
                            results: analysisResult
                        };
                        
                        // Registrar sucesso
                        addLog(`Análise concluída com sucesso: ${analysisResult.action}`, 'SUCCESS');
                        updateStatus(`Análise: ${analysisResult.action}`, 'success');
                        
                        // Mostrar modal
                        if (typeof showAnalysisModal === 'function') {
                            showAnalysisModal(analysisResult);
                        } else {
                            addLog('Função showAnalysisModal não disponível', 'WARN');
                        }
                        
                        return formattedResult;
                    } catch (analyzeLoadError) {
                        throw new Error(`Não foi possível usar o módulo de análise: ${analyzeLoadError.message}`);
                    }
                }
            } catch (analysisError) {
                addLog(`Erro no processamento da análise: ${analysisError.message}`, 'ERROR');
                updateStatus('Erro ao analisar o gráfico', 'error');
                throw analysisError;
            }
        } catch (error) {
            addLog(`Erro na análise: ${error.message}`, 'ERROR');
            updateStatus('Erro ao realizar análise', 'error');
            throw error;
        }
    };

    // Função para analisar na aba
    const analyzeInTab = async () => {
        try {
            const tab = await getActiveTab();
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'ANALYZE_GRAPH' });
            if (response && response.success) {
                updateStatus('Análise concluída com sucesso', 'success');
            } else {
                updateStatus('Erro ao analisar o gráfico', 'error');
            }
        } catch (error) {
            addLog(`Erro ao executar análise na aba: ${error.message}`, 'ERROR');
            updateStatus('Erro ao executar análise', 'error');
        }
    };

    // ================== INICIALIZAÇÃO ==================
    document.addEventListener('DOMContentLoaded', async () => {
        // Inicializar sistema de logs
        initLogging();
        
        // Adicionar log de inicialização
        addLog('Interface principal inicializada', 'INFO');
        
        // Tentar obter a versão do Manifest e mostrar no rodapé
        try {
            const manifest = chrome.runtime.getManifest();
            if (indexUI.version) {
                indexUI.version.textContent = manifest.version || '1.0.0';
                addLog(`Versão do Trade Manager Pro: ${manifest.version}`, 'INFO');
            }
        } catch (error) {
            addLog('Erro ao obter versão do sistema', 'ERROR');
            if (indexUI.version) {
                indexUI.version.textContent = '1.0.0';
            }
        }
        
        // Testar conexão com a API Gemini
        testGeminiConnection();
        
        // Carregar configurações
        loadConfig();
        
        // Adicionar logs de debug para rastrear configurações
        setTimeout(async () => {
            try {
                const config = window.StateManager.getConfig();
                addLog(`[DEBUG] Configurações após carregamento: ${JSON.stringify(config)}`, 'DEBUG');
                addLog(`[DEBUG] Modo desenvolvedor: ${config?.devMode}`, 'DEBUG');
                
                // Forçar atualização do status de automação na inicialização
                await updateAutomationStatus(config?.automation || false, false);
            } catch (error) {
                addLog(`[DEBUG] Erro ao obter configurações: ${error.message}`, 'WARN');
            }
        }, 500);
        
        // Verificação adicional após 1 segundo
        setTimeout(async () => {
            try {
                const config = window.StateManager.getConfig();
                addLog(`[DEBUG] Verificação 1s - Automação: ${config?.automation}`, 'DEBUG');
            } catch (error) {
                addLog(`[DEBUG] Erro na verificação 1s: ${error.message}`, 'WARN');
            }
        }, 1000);
        
        // Atualizar status inicial
        updateStatus('Sistema operando normalmente', 'INFO');
        
        // Adicionar event listeners
        addEventListeners();
        
        // Inicializar listener para StateManager
        initStateManagerListener();
        
        // Inicializar módulo de histórico
        initHistoryModule();
        
        // Configurar event listeners
        addLog('Event listeners configurados com sucesso', 'DEBUG');
        
        // Adicionar listener direto para mensagens da página de configurações (mecanismo alternativo)
        window.addEventListener('message', (event) => {
            // Verificar se é uma mensagem de atualização de configurações
            if (event.data && event.data.action === 'configUpdated' && event.data.settings) {
                addLog('Recebida mensagem direta de atualização de configurações', 'INFO');
                
                const config = event.data.settings;
                // Atualizar campos da página principal
                updateCurrentSettings({
                    galeEnabled: config.gale.active,
                    galeLevel: config.gale.level,
                    dailyProfit: config.dailyProfit,
                    stopLoss: config.stopLoss,
                    tradeValue: config.value,
                    tradeTime: config.period,
                    autoActive: config.automation
                });
                
                // Atualizar apenas a UI de status de automação, sem alterar o estado
                const automationStatus = config.automation || false;
                const automationStatusElement = document.querySelector('#automation-status');
                if (automationStatusElement) {
                    automationStatusElement.textContent = `Automação: ${automationStatus ? 'Ativa' : 'Inativa'}`;
                    automationStatusElement.className = 'automation-status';
                    automationStatusElement.classList.add(automationStatus ? 'active' : 'inactive');
                    
                    addLog(`UI de status de automação atualizada via postMessage: ${automationStatus ? 'Ativo' : 'Inativo'}`, 'DEBUG');
                }
                
                updateStatus('Configurações atualizadas via mensagem direta', 'success', 2000);
                addLog('Configurações atualizadas com sucesso via postMessage', 'SUCCESS');
            }
        });
        addLog('Listener de mensagens diretas configurado com sucesso', 'INFO');
        
        updateStatus('Sistema iniciado com sucesso!', 'success');
        addLog('Interface principal carregada e pronta', 'SUCCESS');
        
        // Verificar conexão com a extensão e processar operações pendentes
        checkExtensionConnection();
        
        // Tentar testar a conexão com a API Gemini
        testGeminiConnection()
            .then(connected => {
                if (connected) {
                    addLog('API Gemini conectada com sucesso', 'SUCCESS');
                } else {
                    addLog('Não foi possível conectar à API Gemini', 'WARN');
                }
            })
            .catch(err => {
                addLog(`Erro ao testar conexão com API: ${err.message}`, 'ERROR');
            });
    });

    // ================== NOVAS FUNÇÕES PARA AUTOMAÇÃO ==================
    // Função para atualizar os elementos de UI com as configurações atuais
    const updateCurrentSettings = (settings) => {
        // Verificar se temos as configurações
        if (!settings) {
            addLog('Não foi possível atualizar configurações na UI: configurações ausentes', 'WARN');
            return;
        }
        
        // Recarregar elementos da UI para garantir que estão atualizados
        indexUI = getUIElements();
        
        // Verificar se conseguimos encontrar os elementos principais
        const missingElements = [];
        if (!indexUI.currentGale) missingElements.push('current-gale');
        if (!indexUI.automationStatus) missingElements.push('automation-status');
        if (!indexUI.currentProfit) missingElements.push('current-profit');
        if (!indexUI.currentStop) missingElements.push('current-stop');
        if (!indexUI.currentValue) missingElements.push('current-value');
        if (!indexUI.currentTime) missingElements.push('current-time');
        
        if (missingElements.length > 0) {
            addLog(`Elementos da UI não encontrados: ${missingElements.join(', ')}`, 'WARN');
        }

        try {
            addLog(`Atualizando UI com novas configurações: ${JSON.stringify(settings)}`, 'DEBUG');
            
            // Atualizar valores de lucro diário e stop loss
            if (indexUI.dailyProfit && typeof settings.dailyProfit !== 'undefined') {
                indexUI.dailyProfit.value = settings.dailyProfit;
                if (indexUI.currentProfit) {
                    indexUI.currentProfit.textContent = `R$ ${settings.dailyProfit}`;
                    addLog(`currentProfit atualizado para: R$ ${settings.dailyProfit}`, 'DEBUG');
                }
            }
            
            if (indexUI.stopLoss && typeof settings.stopLoss !== 'undefined') {
                indexUI.stopLoss.value = settings.stopLoss;
                if (indexUI.currentStop) {
                    indexUI.currentStop.textContent = `R$ ${settings.stopLoss}`;
                    addLog(`currentStop atualizado para: R$ ${settings.stopLoss}`, 'DEBUG');
                }
            }
            
            // Atualizar valor de entrada e periodo
            if (indexUI.entryValue && typeof settings.tradeValue !== 'undefined') {
                indexUI.entryValue.value = settings.tradeValue;
                if (indexUI.currentValue) {
                    indexUI.currentValue.textContent = `R$ ${settings.tradeValue}`;
                    addLog(`currentValue atualizado para: R$ ${settings.tradeValue}`, 'DEBUG');
                }
            }
            
            if (indexUI.timePeriod && typeof settings.tradeTime !== 'undefined') {
                indexUI.timePeriod.value = settings.tradeTime;
                if (indexUI.currentTime) {
                    indexUI.currentTime.textContent = `${settings.tradeTime} min`;
                    addLog(`currentTime atualizado para: ${settings.tradeTime} min`, 'DEBUG');
                }
            }
            
            // Atualizar configurações de Gale
            if (indexUI.toggleGale && typeof settings.galeEnabled !== 'undefined') {
                indexUI.toggleGale.checked = settings.galeEnabled;
                addLog(`toggleGale atualizado para: ${settings.galeEnabled}`, 'DEBUG');
            }
            
            // Atualizar status do Gale na UI
            updateGaleStatusUI(settings.galeEnabled, settings.galeLevel);
            
            // Atualizar status de automação (padronizado)
            if (indexUI.automationStatus && typeof settings.autoActive !== 'undefined') {
                updateAutomationStatusUI(settings.autoActive);
            }
            
            // Salvar as configurações globalmente para acesso fácil
            window.currentSettings = settings;
            
            // Força uma atualização da UI para garantir que as mudanças sejam visíveis
            setTimeout(() => {
                // Verifica elementos que podem não ter sido atualizados
                if (indexUI.currentProfit && typeof settings.dailyProfit !== 'undefined') {
                    indexUI.currentProfit.textContent = `R$ ${settings.dailyProfit}`;
                }
                if (indexUI.currentStop && typeof settings.stopLoss !== 'undefined') {
                    indexUI.currentStop.textContent = `R$ ${settings.stopLoss}`;
                }
                if (indexUI.currentValue && typeof settings.tradeValue !== 'undefined') {
                    indexUI.currentValue.textContent = `R$ ${settings.tradeValue}`;
                }
                if (indexUI.currentTime && typeof settings.tradeTime !== 'undefined') {
                    indexUI.currentTime.textContent = `${settings.tradeTime} min`;
                }
                // Atualizar status do Gale novamente para garantir
                if (typeof settings.galeEnabled !== 'undefined' && typeof settings.galeLevel !== 'undefined') {
                    updateGaleStatusUI(settings.galeEnabled, settings.galeLevel);
                }
                
                addLog('Verificação adicional de atualização da UI realizada', 'DEBUG');
            }, 100);
            
            addLog('Configurações atualizadas na UI com sucesso', 'SUCCESS');
        } catch (error) {
            addLog(`Erro ao atualizar configurações na UI: ${error.message}`, 'ERROR');
        }
    };

    // Função para atualizar o status de automação na UI
    const updateAutomationStatusUI = (isActive) => {
        const automationStatusElement = document.querySelector('#automation-status');
        if (automationStatusElement) {
            automationStatusElement.textContent = `Automação: ${isActive ? 'Ativa' : 'Inativa'}`;
            automationStatusElement.className = 'automation-status';
            automationStatusElement.classList.add(isActive ? 'active' : 'inactive');
            addLog(`Status de automação atualizado na UI: ${isActive ? 'Ativo' : 'Inativo'}`, 'DEBUG');
        } else {
            addLog('Elemento automation-status não encontrado na UI', 'WARN');
        }
    };

    // Função para atualizar o status do Gale na UI
    const updateGaleStatusUI = (galeEnabled, galeLevel) => {
        const currentGaleElement = document.querySelector('#current-gale');
        const galeSelectElement = document.querySelector('#gale-select');
        
        // Atualizar o select do Gale se disponível
        if (galeSelectElement && typeof galeLevel !== 'undefined') {
            galeSelectElement.value = galeLevel;
            addLog(`galeSelect atualizado para: ${galeLevel}`, 'DEBUG');
        }
        
        // Atualizar o display do status do Gale
        if (currentGaleElement) {
            if (galeEnabled && galeLevel) {
                currentGaleElement.textContent = `Gale: ${galeLevel}`;
                currentGaleElement.className = 'gale-status active';
                addLog(`Status do Gale atualizado: Ativo (${galeLevel})`, 'DEBUG');
            } else {
                currentGaleElement.textContent = 'Gale: Desativado';
                currentGaleElement.className = 'gale-status inactive';
                addLog('Status do Gale atualizado: Desativado', 'DEBUG');
            }
        } else {
            addLog('Elemento current-gale não encontrado na UI', 'WARN');
        }
    };

    // Função para calcular o lucro
    const sumeProfit = () => {
        const profit = document.querySelectorAll('.profit');
        let total = 0;
        profit.forEach((item) => {
            total += parseFloat(item.textContent.replace('R$ ', '')) || 0;
        });
        return total;
    };

    // Função para obter a aba ativa
    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // Função para testar a conexão com a API
    async function testGeminiConnection() {
        try {
            updateStatus('Testando conexão com Gemini...', 'info');
            addLog('Iniciando teste de conexão...');
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: "Me responda com OK" }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            
            if (text.includes('OK')) {
                updateStatus('Conexão estabelecida!', 'success');
                addLog('Conexão com Gemini estabelecida com sucesso');
                return true;
            } else {
                throw new Error('Resposta inesperada da API');
            }
        } catch (error) {
            updateStatus(`Erro: ${error.message}`, 'error');
            addLog(`Erro no teste de conexão: ${error.message}`);
            return false;
        }
    }

    // Função para atualizar o contador
    const updateTradeCountdown = () => {
        const countdown = document.querySelector('#countdown');
        if (countdown) {
            countdown.textContent = `${tradeTime} minutos`;
            // Adicionar log para a atualização do contador
            addLog(`Contador atualizado para ${tradeTime} minutos`, 'INFO');
        }
    };

    // Função para iniciar o contador
    const startCountdown = () => {
        if (isAutomationRunning) {
            updateStatus('Automação já está em execução', 'error');
            return;
        }

        isAutomationRunning = true;
        updateAutomationStatus(true, false);
        updateTradeCountdown();
        
        addLog('Contador de automação iniciado', 'INFO');

        const interval = setInterval(() => {
            tradeTime--;
            updateTradeCountdown();

            if (tradeTime <= 0) {
                clearInterval(interval);
                isAutomationRunning = false;
                updateAutomationStatus(false, false);
                updateStatus('Automação concluída', 'success');
                addLog('Automação concluída: contador chegou a zero', 'SUCCESS');
            }
        }, 1000);
    };

    // Função para cancelar operações (pode ser chamada de qualquer lugar)
    const cancelCurrentOperation = async (reason = 'Cancelado pelo usuário') => {
        addLog(`Cancelando operação atual: ${reason}`, 'INFO');
        
        // Limpar estado de operação no StateManager
        if (window.StateManager) {
            const currentConfig = window.StateManager.getConfig() || {};
            const isAutomationActive = currentConfig.automation === true;
            
            // Atualizar estado para indicar que não há operação em andamento
            window.StateManager.updateAutomationState(false, null);
            
            // Atualizar visibilidade dos botões
            updateUserControlsVisibility(isAutomationActive, false);
        }
        
        // Interromper monitoramento se disponível
        if (window.TradeManager?.History) {
            window.TradeManager.History.stopMonitoring()
                .catch(error => {
                    addLog(`Erro ao parar monitoramento: ${error.message}`, 'ERROR');
                });
        }
        
        // Cancelar timeouts
        if (typeof automationTimeout !== 'undefined' && automationTimeout) {
            clearTimeout(automationTimeout);
            automationTimeout = null;
            addLog('Temporizador de automação cancelado', 'DEBUG');
        }
        
        // Cancelar monitoramento de payout
        if (typeof cancelPayoutMonitoring === 'function') {
            cancelPayoutMonitoring();
            addLog('Monitoramento de payout cancelado', 'DEBUG');
        }
        
        // Atualizar status
        updateStatus(reason, 'info');
        addLog(`Operação cancelada: ${reason}`, 'SUCCESS');
    };

    // Função para cancelar o fechamento automático (compatibilidade)
    const cancelAutoClose = () => {
        cancelCurrentOperation('Operação cancelada pelo usuário');
    };
    
    // Expor função globalmente para uso em outros módulos
    window.cancelCurrentOperation = cancelCurrentOperation;

    // Função para capturar e analisar
    async function captureAndAnalyze() {
        try {
            addLog('Iniciando processo integrado de captura e análise...', 'INFO');
            
            // Usar o módulo de captura centralizado
            if (window.CaptureScreen) {
                // Capturar a tela para análise usando a função centralizada
                await window.CaptureScreen.captureForAnalysis();
                addLog('Captura realizada com sucesso pelo módulo centralizado', 'SUCCESS');
                // Executar a análise com a imagem já capturada
                await runAnalysis();
            } else {
                // Fallback para o método antigo se o módulo não estiver disponível
                addLog('Módulo CaptureScreen não disponível, tentando método alternativo', 'WARN');
                const tab = await getActiveTab();
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'CAPTURE_SCREENSHOT' });
                if (response && response.success) {
                    updateStatus('Captura realizada com sucesso', 'success');
                    await runAnalysis();
                } else {
                    updateStatus('Erro ao capturar a tela', 'error');
                }
            }
        } catch (error) {
            addLog(`Erro ao capturar e analisar: ${error.message}`, 'ERROR');
            updateStatus('Erro ao capturar e analisar', 'error');
        }
    }

    // Adicionar listeners para os botões de forma segura
    const addEventListeners = () => {
        const elements = {
            startOperation: document.querySelector('#start-operation'),
            cancelOperation: document.querySelector('#cancel-operation'),
            captureScreen: document.querySelector('#captureBtn'),
            analyzeBtn: document.querySelector('#analyzeBtn'),
            logsBtn: document.querySelector('#logs-btn'),
            settingsBtn: document.querySelector('#settings-btn'),
            exportBtn: document.querySelector('#export-csv')
        };

        if (elements.startOperation) {
            elements.startOperation.addEventListener('click', async () => {
                // Verificar o estado atual da automação no StateManager
                try {
                    const currentConfig = window.StateManager.getConfig();
                    const isAutomationActive = currentConfig?.automation === true;
                    
                    // Verificar se o módulo História está disponível
                    if (window.TradeManager?.History) {
                        if (isAutomationActive) {
                            // Marcar que uma operação está iniciando
                            addLog('Iniciando operação automática...', 'INFO');
                            updateStatus('Iniciando operação automática...', 'info');
                            
                            // Atualizar estado no StateManager para indicar operação em andamento
                            window.StateManager.updateAutomationState(true, {
                                id: Date.now(),
                                type: 'automatic_monitoring',
                                startTime: new Date().toISOString(),
                                status: 'starting'
                            });
                            
                            // Atualizar visibilidade dos botões imediatamente
                            updateUserControlsVisibility(true, true);
                            
                            // Iniciar o monitoramento
                            window.TradeManager.History.startMonitoring()
                                .then(async () => {
                                    addLog('Monitoramento de operações iniciado com sucesso', 'SUCCESS');
                                    updateStatus('Operação automática em andamento', 'success');
                                    
                                    // Atualizar estado para operação em execução
                                    const currentState = window.StateManager.getAutomationState();
                                    if (currentState.currentOperation) {
                                        window.StateManager.updateAutomationState(true, {
                                            ...currentState.currentOperation,
                                            status: 'running'
                                        });
                                    }
                                })
                                .catch(async (error) => {
                                    addLog(`Erro ao iniciar monitoramento: ${error.message}`, 'ERROR');
                                    updateStatus('Falha ao iniciar operação automática', 'error');
                                    
                                    // Limpar estado de operação em caso de erro
                                    window.StateManager.updateAutomationState(true, null);
                                    updateUserControlsVisibility(true, false);
                                });
                        } else {
                            // Se não estiver ativa, apenas mostrar uma mensagem
                            addLog('Tentativa de iniciar operação com automação desativada', 'WARN');
                            updateStatus('A automação está desativada. Ative-a nas configurações.', 'warn');
                        }
                    } else {
                        // Fallback para mensagem de erro
                        addLog('Módulo de histórico não disponível', 'ERROR');
                        updateStatus('Módulo de histórico não disponível', 'error');
                    }
                } catch (error) {
                    // Se não conseguir acessar o estado via StateManager
                    addLog(`Erro ao verificar estado da automação: ${error.message}`, 'ERROR');
                    updateStatus('Não foi possível verificar o status da automação', 'error');
                }
            });
        }
        
        if (elements.cancelOperation) {
            elements.cancelOperation.addEventListener('click', async () => {
                addLog('Cancelando operação automática...', 'INFO');
                updateStatus('Cancelando operação...', 'warn');
                
                // Limpar estado de operação no StateManager
                try {
                    const currentState = window.StateManager.getAutomationState();
                    const currentConfig = window.StateManager.getConfig();
                    const isAutomationActive = currentConfig?.automation === true;
                    
                    // Atualizar estado para indicar que não há operação em andamento
                    window.StateManager.updateAutomationState(isAutomationActive, null);
                    
                    // Atualizar visibilidade dos botões imediatamente
                    updateUserControlsVisibility(isAutomationActive, false);
                } catch (error) {
                    addLog(`Erro ao atualizar estado no StateManager: ${error.message}`, 'ERROR');
                }
                
                // Interromper monitoramento se disponível
                if (window.TradeManager?.History) {
                    window.TradeManager.History.stopMonitoring()
                        .then(() => {
                            addLog('Operação automática cancelada com sucesso', 'SUCCESS');
                            updateStatus('Operação cancelada pelo usuário', 'info');
                        })
                        .catch(error => {
                            addLog(`Erro ao cancelar operação: ${error.message}`, 'ERROR');
                            updateStatus('Erro ao cancelar operação', 'error');
                        });
                } else {
                    // Fallback para cancelamento direto
                    addLog('Cancelando operação via método fallback...', 'INFO');
                    if (typeof automationTimeout !== 'undefined' && automationTimeout) {
                        clearTimeout(automationTimeout);
                        automationTimeout = null;
                        addLog('Temporizador de automação cancelado', 'INFO');
                    }
                    updateStatus('Operação cancelada pelo usuário', 'info');
                }
                
                // Cancelar qualquer monitoramento de payout em andamento
                if (typeof cancelPayoutMonitoring === 'function') {
                    cancelPayoutMonitoring();
                    addLog('Monitoramento de payout cancelado', 'DEBUG');
                }
            });
        }
        
        if (elements.captureScreen) {
            elements.captureScreen.addEventListener('click', async () => {
                addLog('Botão de captura clicado no index', 'INFO');
                
                try {
                    // Usar o sistema centralizado de captura
                    if (window.CaptureScreen && typeof window.CaptureScreen.captureAndShow === 'function') {
                        try {
                            // Chamar a função simplificada que captura e mostra em uma janela popup
                            await window.CaptureScreen.captureAndShow();
                            updateStatus('Captura de tela realizada com sucesso', 'success');
                        } catch (error) {
                            addLog(`Erro ao capturar tela: ${error.message}`, 'ERROR');
                            updateStatus('Falha na captura de tela', 'error');
                        }
                    } else {
                        // Se o módulo não estiver disponível, carregar dinamicamente
                        addLog('Módulo de captura não está disponível, tentando carregamento dinâmico', 'WARN');
                        updateStatus('Carregando módulo de captura...', 'info');
                        
                        // Tentar carregar o módulo dinamicamente
                        const script = document.createElement('script');
                        script.src = '../content/capture-screen.js';
                        
                        // Promise para aguardar o carregamento do script
                        await new Promise((resolve, reject) => {
                            script.onload = () => {
                                addLog('Módulo de captura carregado dinamicamente', 'SUCCESS');
                                resolve();
                            };
                            script.onerror = (err) => {
                                addLog(`Erro ao carregar módulo de captura: ${err}`, 'ERROR');
                                reject(new Error('Falha ao carregar módulo de captura'));
                            };
                            document.head.appendChild(script);
                        });
                        
                        // Verificar novamente se o módulo está disponível após o carregamento
                        if (window.CaptureScreen && typeof window.CaptureScreen.captureAndShow === 'function') {
                            try {
                                await window.CaptureScreen.captureAndShow();
                                updateStatus('Captura realizada com sucesso', 'success');
                            } catch (captureError) {
                                addLog(`Erro após carregamento dinâmico: ${captureError.message}`, 'ERROR');
                                updateStatus('Falha na captura de tela', 'error');
                            }
                        } else {
                            addLog('Módulo carregado, mas função captureAndShow não disponível', 'ERROR');
                            updateStatus('Erro no sistema de captura', 'error');
                        }
                    }
                } catch (error) {
                    addLog(`Erro geral na captura: ${error.message}`, 'ERROR');
                    updateStatus('Erro no processo de captura', 'error');
                }
            });
        }
        
        if (elements.analyzeBtn) {
            elements.analyzeBtn.addEventListener('click', runAnalysis);
        }
        
        if (elements.logsBtn) {
            elements.logsBtn.addEventListener('click', () => {
                if (window.Navigation) {
                    window.Navigation.openPage('logs');
                } else {
                    addLog('Navigation não está disponível', 'ERROR');
                }
            });
        }
        
        if (elements.settingsBtn) {
            elements.settingsBtn.addEventListener('click', () => {
                if (window.Navigation) {
                    window.Navigation.openPage('settings');
                } else {
                    addLog('Navigation não está disponível', 'ERROR');
                }
            });
        }
    };

    // Inicializar quando o DOM estiver pronto - função separada para evitar duplicação
    function _setupLateInitialization() {
        // Inicializar sistema de logs
        initLogging();
        
        try {
            const manifestInfo = chrome.runtime.getManifest();
            addLog(`Sistema Trade Manager Pro v${manifestInfo.version} inicializado`, 'INFO');
            addLog(`Ambiente: ${manifestInfo.name} / ${navigator.userAgent}`, 'DEBUG');
        } catch (e) {
            addLog('Sistema Trade Manager Pro inicializado (versão desconhecida)', 'INFO');
        }
        
        // Inicializar módulo de histórico
        initHistoryModule();
        
        // Configurar event listeners
        addEventListeners();
        addLog('Event listeners configurados com sucesso', 'DEBUG');
        
        // Configurar os botões de teste do sistema de Gale
        setupGaleTestButtons();
        
        // Configurar botão de teste de análise no modo desenvolvedor
        setupDevAnalysisButton();
        
        // Inicializar o listener do StateManager para atualizações de configurações
        initStateManagerListener();
        
        // Adicionar listener direto para mensagens da página de configurações (mecanismo alternativo)
        window.addEventListener('message', (event) => {
            // Verificar se é uma mensagem de atualização de configurações
            if (event.data && event.data.action === 'configUpdated' && event.data.settings) {
                addLog('Recebida mensagem direta de atualização de configurações', 'INFO');
                
                const config = event.data.settings;
                // Atualizar campos da página principal
                updateCurrentSettings({
                    galeEnabled: config.gale.active,
                    galeLevel: config.gale.level,
                    dailyProfit: config.dailyProfit,
                    stopLoss: config.stopLoss,
                    tradeValue: config.value,
                    tradeTime: config.period,
                    autoActive: config.automation
                });
                                
                updateStatus('Configurações atualizadas via mensagem direta', 'success', 2000);
                addLog('Configurações atualizadas com sucesso via postMessage', 'SUCCESS');
            }
        });
        addLog('Listener de mensagens diretas configurado com sucesso', 'INFO');
        
        updateStatus('Sistema iniciado com sucesso!', 'success');
        addLog('Interface principal carregada e pronta', 'SUCCESS');
        
        // Verificar conexão com a extensão e processar operações pendentes
        checkExtensionConnection();
        
        // Tentar testar a conexão com a API Gemini
        testGeminiConnection()
            .then(connected => {
                if (connected) {
                    addLog('API Gemini conectada com sucesso', 'SUCCESS');
                } else {
                    addLog('Não foi possível conectar à API Gemini', 'WARN');
                }
            })
            .catch(err => {
                addLog(`Erro ao testar conexão com API: ${err.message}`, 'ERROR');
            });
    }

    // Chamar a inicialização tardia quando o documento estiver pronto
    document.addEventListener('DOMContentLoaded', _setupLateInitialization);

    // Configurações padrão
    const indexDefaultConfig = window.StateManager?.getConfig() || {
        gale: {
            active: true,
            level: '1.2x'
        },
        dailyProfit: 150,
        stopLoss: 30,
        automation: false,
        value: 10,
        period: 1
    };

    // Função para limpar configurações antigas
    function clearOldConfig() {
        return new Promise((resolve) => {
            chrome.storage.sync.remove(['userConfig'], () => {
                addLog('Configurações antigas removidas do storage.');
                resolve();
            });
        });
    }

    // Função para carregar configurações
    async function loadConfig() {
        return new Promise(async (resolve) => {
            addLog('Iniciando carregamento das configurações...', 'INFO');
            updateStatus('Carregando configurações...', 'info');

            // Utilizar o StateManager diretamente como funcionava na versão beta
            try {
                addLog('Utilizando StateManager para carregar configurações', 'INFO');
                const config = window.StateManager.loadConfig();
                addLog('Configurações carregadas via StateManager', 'SUCCESS');
                
                // Log específico para status de automação e gale
                addLog(`Status carregado - Gale: ${config.gale?.active} (${config.gale?.level}), Automação: ${config.automation}`, 'DEBUG');
                
                // Atualizar campos da página principal usando StateManager
                updateCurrentSettings({
                    galeEnabled: config.gale?.active || false,
                    galeLevel: config.gale?.level || '1.2x',
                    dailyProfit: config.dailyProfit || 150,
                    stopLoss: config.stopLoss || 30,
                    tradeValue: config.value || 10,
                    tradeTime: config.period || 1,
                    autoActive: config.automation || false
                });
                
                // Atualizar visibilidade do painel de teste do Gale
                updateGaleTestPanelVisibility(config.devMode);
                
                // Atualizar visibilidade dos botões principais
                updateUserControlsVisibility(config.automation, false);
                
                updateStatus('Configurações carregadas com sucesso', 'success');
                resolve(config);
            } catch (error) {
                addLog(`Erro ao carregar configurações via StateManager: ${error.message}`, 'ERROR');
                updateStatus('Erro ao carregar configurações', 'error');
                
                // Em caso de erro, tentar usar a abordagem antiga como fallback
                loadConfigLegacy()
                    .then(config => resolve(config))
                    .catch(err => {
                        addLog(`Erro também no fallback: ${err.message}`, 'ERROR');
                        // Usar configurações padrão em último caso
                        resolve(indexDefaultConfig);
                    });
            }
        });
    }

    // Método legacy para carregar configurações (para compatibilidade)
    function loadConfigLegacy() {
        return new Promise((resolve, reject) => {
            addLog('Utilizando método legacy para carregar configurações', 'INFO');
            
            chrome.storage.sync.get(['userConfig'], (result) => {
                addLog(`Resultado do storage: ${JSON.stringify(result)}`, 'DEBUG');
                
                if (!result.userConfig || Object.keys(result.userConfig).length === 0) {
                    addLog('Configuração do usuário não encontrada ou vazia. Usando configuração padrão.', 'INFO');
                    updateStatus('Usando configurações padrão...', 'info');
                    
                    // Se não houver configuração do usuário, usa a padrão
                    chrome.storage.sync.set({ userConfig: indexDefaultConfig }, () => {
                        addLog('Configurações padrão salvas no storage.', 'INFO');
                        updateStatus('Configurações padrão salvas', 'success');
                        
                        // Log das configurações padrão sendo aplicadas
                        addLog(`Aplicando configurações padrão - Gale: ${indexDefaultConfig.gale?.active} (${indexDefaultConfig.gale?.level}), Automação: ${indexDefaultConfig.automation}`, 'DEBUG');
                        
                        // Atualizar campos da página principal
                        updateCurrentSettings({
                            galeEnabled: indexDefaultConfig.gale?.active || false,
                            galeLevel: indexDefaultConfig.gale?.level || '1.2x',
                            dailyProfit: indexDefaultConfig.dailyProfit || 150,
                            stopLoss: indexDefaultConfig.stopLoss || 30,
                            tradeValue: indexDefaultConfig.value || 10,
                            tradeTime: indexDefaultConfig.period || 1,
                            autoActive: indexDefaultConfig.automation || false
                        });
                        
                        resolve(indexDefaultConfig);
                    });
                } else {
                    // Garantir que o período seja um número inteiro
                    if (typeof result.userConfig.period === 'string') {
                        result.userConfig.period = parseInt(result.userConfig.period.replace(/[^0-9]/g, '')) || 1;
                    }
                    
                    addLog('Configuração do usuário encontrada e carregada.', 'INFO');
                    updateStatus('Configurações do usuário carregadas', 'success');
                    
                    // Log das configurações do usuário sendo aplicadas
                    addLog(`Aplicando configurações do usuário - Gale: ${result.userConfig.gale?.active} (${result.userConfig.gale?.level}), Automação: ${result.userConfig.automation}`, 'DEBUG');
                    
                    // Atualizar campos da página principal
                    updateCurrentSettings({
                        galeEnabled: result.userConfig.gale?.active || false,
                        galeLevel: result.userConfig.gale?.level || '1.2x',
                        dailyProfit: result.userConfig.dailyProfit || 150,
                        stopLoss: result.userConfig.stopLoss || 30,
                        tradeValue: result.userConfig.value || 10,
                        tradeTime: result.userConfig.period || 1,
                        autoActive: result.userConfig.automation || false
                    });
                    
                    resolve(result.userConfig);
                }
            });
        });
    }

    // Inicialização do StateManager listener
    function initStateManagerListener() {
        addLog('Registrando listener para StateManager', 'INFO');
        
        // Registrar listener para atualizações de estado usando StateManager
        window.StateManager.subscribe((notification) => {
            // Formato de notificação: {state, type, timestamp}
            const { state, type, timestamp } = notification;
            
            if (type === 'config') {
                addLog(`Recebida atualização de configurações do StateManager (${new Date(timestamp).toLocaleTimeString()})`, 'INFO');
                
                const config = state.config;
                if (config) {
                    // Log detalhado das configurações atualizadas
                    addLog(`Configurações atualizadas - Gale: ${config.gale?.active} (${config.gale?.level}), Automação: ${config.automation}`, 'DEBUG');
                    
                    // REMOVIDO: updateCurrentSettings para evitar loops
                    // O StateManager já atualiza o dashboard automaticamente
                    
                    // Atualizar visibilidade do painel de teste do Gale baseado no modo desenvolvedor
                    updateGaleTestPanelVisibility(config.devMode);
                    
                    // Atualizar visibilidade dos botões principais baseado no estado da automação
                    updateUserControlsVisibility(config.automation, false);
                    
                    // Se a automação foi desativada e havia uma operação em andamento, cancelar
                    if (!config.automation) {
                        const currentState = window.StateManager.getAutomationState();
                        if (currentState.currentOperation) {
                            addLog('Automação desativada com operação em andamento - cancelando operação', 'WARN');
                            cancelCurrentOperation('Automação desativada nas configurações');
                        }
                    }
                }
            } 
            else if (type === 'automation') {
                // Tratar atualizações específicas do estado de automação
                addLog(`Recebida atualização de estado de AUTOMAÇÃO (${new Date(timestamp).toLocaleTimeString()})`, 'WARN');
                
                const automationState = state.automation;
                if (automationState) {
                    // Atualizar apenas a UI, sem modificar o estado
                    const isRunning = automationState.isRunning || false;
                    const automationStatusElement = document.querySelector('#automation-status');
                    if (automationStatusElement) {
                        automationStatusElement.textContent = `Automação: ${isRunning ? 'Ativa' : 'Inativa'}`;
                        automationStatusElement.className = 'automation-status';
                        automationStatusElement.classList.add(isRunning ? 'active' : 'inactive');
                    }
                    
                    // Log adicional para depuração
                    addLog(`Estado de automação atualizado na UI: isRunning=${isRunning}`, 'WARN');
                    
                    // Atualizar visibilidade dos botões baseado no estado da automação
                    const operationInProgress = automationState.currentOperation ? true : false;
                    updateUserControlsVisibility(isRunning, operationInProgress);
                    
                    // Se houver uma operação atual, podemos mostrar informações adicionais
                    if (automationState.currentOperation) {
                        addLog(`Operação atual: ${JSON.stringify(automationState.currentOperation)}`, 'DEBUG');
                    }
                }
            }
            else if (type === 'performance') {
                // Atualizar dashboard quando dados de performance mudarem
                addLog(`Recebida atualização de performance (${new Date(timestamp).toLocaleTimeString()})`, 'DEBUG');
                // O StateManager já atualiza o dashboard automaticamente
            }
            else if (type === 'system') {
                // Atualizar dashboard quando estado do sistema mudar
                addLog(`Recebida atualização de sistema (${new Date(timestamp).toLocaleTimeString()})`, 'DEBUG');
                // O StateManager já atualiza o dashboard automaticamente
            }
        });
        
        addLog('Listener registrado com sucesso', 'SUCCESS');
    }

    // ================== ANALISADOR DE DADOS ==================
    class DataAnalyzer {
        constructor() {
            this.cache = {};
            this.processingQueue = [];
            this.isProcessing = false;
            
            // Inicializar
            addLog('Inicializando analisador de dados', 'DEBUG');
            
            // Expor métodos para a API global
            window.TRADE_ANALYZER_API = {
                analyze: this.analyze.bind(this),
                getAnalysisResult: this.getAnalysisResult.bind(this),
                clearCache: this.clearCache.bind(this)
            };
            
            addLog('API do analisador de dados exposta', 'DEBUG');
        }
        
        // Método privado para logging da classe
        _log(message, level = 'DEBUG') {
            // Usar a função global de log se disponível, adicionando prefix da classe
            if (typeof addLog === 'function') {
                addLog(`[DataAnalyzer] ${message}`, level);
            } else if (typeof window.logToSystem === 'function') {
                window.logToSystem(`[DataAnalyzer] ${message}`, level, 'analysis.js');
            } else {
                console.log(`[${level}][DataAnalyzer] ${message}`);
            }
        }
        
        // Analisar dados de trading
        async analyze(data, options = {}) {
            try {
                // Validar dados
                if (!data || !Array.isArray(data.candles) || data.candles.length === 0) {
                    throw new Error('Dados inválidos para análise');
                }
                
                // Identificar o ativo
                const symbol = data.symbol || 'unknown';
                
                // Criar uma assinatura única para este conjunto de dados
                const dataSignature = `${symbol}_${data.candles.length}_${data.candles[0].time}_${data.candles[data.candles.length-1].time}`;
                
                // Verificar cache
                if (this.cache[dataSignature] && !options.forceReanalysis) {
                    this._log(`Usando resultado em cache para ${symbol}`, 'DEBUG');
                    return this.cache[dataSignature];
                }
                
                // Adicionar à fila de processamento
                return new Promise((resolve, reject) => {
                    this.processingQueue.push({
                        data,
                        options,
                        dataSignature,
                        resolve,
                        reject
                    });
                    
                    // Iniciar processamento se não estiver em andamento
                    if (!this.isProcessing) {
                        this.processQueue();
                    }
                });
            } catch (error) {
                this._log(`Erro ao analisar dados: ${error.message}`, 'ERROR');
                throw error;
            }
        }
        
        // Processar fila de análises
        async processQueue() {
            if (this.processingQueue.length === 0) {
                this.isProcessing = false;
                return;
            }
            
            this.isProcessing = true;
            const job = this.processingQueue.shift();
            
            try {
                this._log(`Processando análise para ${job.data.symbol || 'desconhecido'}`, 'DEBUG');
                
                // Realizar análise
                const result = await this.performAnalysis(job.data, job.options);
                
                // Armazenar no cache
                this.cache[job.dataSignature] = result;
                
                // Limitar tamanho do cache
                this.manageCacheSize();
                
                // Resolver promessa
                job.resolve(result);
            } catch (error) {
                this._log(`Erro na análise: ${error.message}`, 'ERROR');
                job.reject(error);
            } finally {
                // Continuar processamento
                setTimeout(() => this.processQueue(), 10);
            }
        }
        
        // Realizar análise dos dados
        async performAnalysis(data, options) {
            // Implementação real da análise
            const { candles, symbol } = data;
            
            // Resultados da análise
            const result = {
                symbol,
                timestamp: Date.now(),
                indicators: {},
                signals: [],
                patterns: []
            };
            
            try {
                // Extrair dados para cálculos
                const closePrices = candles.map(c => c.close);
                const highPrices = candles.map(c => c.high);
                const lowPrices = candles.map(c => c.low);
                const volumes = candles.map(c => c.volume);
                
                // Calcular médias móveis (exemplo)
                result.indicators.sma20 = this.calculateSMA(closePrices, 20);
                result.indicators.sma50 = this.calculateSMA(closePrices, 50);
                result.indicators.sma200 = this.calculateSMA(closePrices, 200);
                
                // Detectar sinais com base nos indicadores
                this.detectSignals(result);
                
                return result;
            } catch (error) {
                this._log(`Erro durante a análise de ${symbol}: ${error.message}`, 'ERROR');
                throw error;
            }
        }
        
        // Cálculo de Média Móvel Simples
        calculateSMA(prices, period) {
            if (prices.length < period) {
                return null;
            }
            
            const result = [];
            
            for (let i = 0; i < prices.length; i++) {
                if (i < period - 1) {
                    result.push(null);
                    continue;
                }
                
                let sum = 0;
                for (let j = 0; j < period; j++) {
                    sum += prices[i - j];
                }
                
                result.push(sum / period);
            }
            
            return result;
        }
        
        // Detectar sinais de trading
        detectSignals(result) {
            try {
                const { sma20, sma50, sma200 } = result.indicators;
                
                if (!sma20 || !sma50 || !sma200) {
                    return;
                }
                
                // Pegar os valores mais recentes
                const lastIndex = sma20.length - 1;
                const prevIndex = lastIndex - 1;
                
                if (lastIndex < 1 || prevIndex < 0) {
                    return;
                }
                
                // Verificar cruzamento SMA 20 e SMA 50
                if (sma20[prevIndex] < sma50[prevIndex] && sma20[lastIndex] > sma50[lastIndex]) {
                    result.signals.push({
                        type: 'CROSS_ABOVE',
                        indicator1: 'SMA20',
                        indicator2: 'SMA50',
                        position: lastIndex,
                        significance: 'MEDIUM'
                    });
                } else if (sma20[prevIndex] > sma50[prevIndex] && sma20[lastIndex] < sma50[lastIndex]) {
                    result.signals.push({
                        type: 'CROSS_BELOW',
                        indicator1: 'SMA20',
                        indicator2: 'SMA50',
                        position: lastIndex,
                        significance: 'MEDIUM'
                    });
                }
            } catch (error) {
                this._log(`Erro ao detectar sinais: ${error.message}`, 'ERROR');
            }
        }
        
        // Obter resultado de análise do cache
        getAnalysisResult(symbol, timestamp) {
            // Procurar no cache
            for (const key in this.cache) {
                const result = this.cache[key];
                if (result.symbol === symbol && (!timestamp || result.timestamp === timestamp)) {
                    return result;
                }
            }
            
            return null;
        }
        
        // Limpar cache de análises
        clearCache() {
            this.cache = {};
            this._log('Cache de análises limpo', 'INFO');
            return true;
        }
        
        // Gerenciar tamanho do cache
        manageCacheSize() {
            const MAX_CACHE_ITEMS = 50;
            const cacheKeys = Object.keys(this.cache);
            
            if (cacheKeys.length > MAX_CACHE_ITEMS) {
                // Remover entradas mais antigas
                const keysToRemove = cacheKeys
                    .map(key => ({ key, timestamp: this.cache[key].timestamp }))
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .slice(0, cacheKeys.length - MAX_CACHE_ITEMS)
                    .map(item => item.key);
                
                keysToRemove.forEach(key => {
                    delete this.cache[key];
                });
                
                this._log(`Cache de análises otimizado: ${keysToRemove.length} itens removidos`, 'DEBUG');
            }
        }
    }

    // Inicializar analisador de dados em todas as páginas
    const analyzer = new DataAnalyzer();

    // ================== LISTENERS ==================
    document.addEventListener('DOMContentLoaded', () => {
        // Verificar se estamos na página de análise
        if (window.location.pathname.includes('/analysis.html')) {
            addLog('Inicializando página de análise', 'INFO');
            
            // Configurar área de exibição de gráficos
            const chartContainer = document.getElementById('chart-container');
            if (chartContainer) {
                addLog('Container de gráfico encontrado, configurando...', 'DEBUG');
                
                // Configuração de botões e controles
                const symbolInput = document.getElementById('symbol-input');
                const timeframeSelect = document.getElementById('timeframe-select');
                const loadDataBtn = document.getElementById('load-data-btn');
                
                if (symbolInput && timeframeSelect && loadDataBtn) {
                    loadDataBtn.addEventListener('click', () => {
                        const symbol = symbolInput.value.trim().toUpperCase();
                        const timeframe = timeframeSelect.value;
                        
                        if (!symbol) {
                            addLog('Símbolo não informado', 'WARN');
                            return;
                        }
                        
                        addLog(`Carregando dados para ${symbol} (${timeframe})`, 'INFO');
                        
                        // Simulação de carregamento de dados
                        setTimeout(() => {
                            try {
                                // Dados simulados para teste
                                const simulatedData = generateMockData(symbol, timeframe);
                                
                                // Analisar dados
                                analyzer.analyze(simulatedData)
                                    .then(result => {
                                        addLog(`Análise concluída para ${symbol}`, 'SUCCESS');
                                        renderAnalysisResults(result);
                                    })
                                    .catch(error => {
                                        addLog(`Falha na análise: ${error.message}`, 'ERROR');
                                    });
                            } catch (error) {
                                addLog(`Erro ao processar dados: ${error.message}`, 'ERROR');
                            }
                        }, 1000);
                    });
                } else {
                    addLog('Elementos de controle não encontrados', 'ERROR');
                }
            } else {
                addLog('Container de gráfico não encontrado', 'ERROR');
            }
        }
    });

    // Função para gerar dados simulados
    function generateMockData(symbol, timeframe) {
        const candles = [];
        const now = Date.now();
        let lastPrice = Math.random() * 1000 + 100; // Preço inicial entre 100 e 1100
        
        // Gerar candles
        for (let i = 0; i < 200; i++) {
            const time = now - (200 - i) * getTimeframeMinutes(timeframe) * 60 * 1000;
            const range = lastPrice * 0.02; // Variação de 2%
            
            const open = lastPrice;
            const close = lastPrice + (Math.random() * range * 2 - range);
            const high = Math.max(open, close) + Math.random() * range * 0.5;
            const low = Math.min(open, close) - Math.random() * range * 0.5;
            const volume = Math.floor(Math.random() * 1000) + 100;
            
            candles.push({ time, open, high, low, close, volume });
            lastPrice = close;
        }
        
        addLog(`Gerados ${candles.length} candles simulados para ${symbol}`, 'DEBUG');
        
        return {
            symbol,
            timeframe,
            candles
        };
    }

    // Converter timeframe para minutos
    function getTimeframeMinutes(timeframe) {
        switch (timeframe) {
            case '1m': return 1;
            case '5m': return 5;
            case '15m': return 15;
            case '30m': return 30;
            case '1h': return 60;
            case '4h': return 240;
            case '1d': return 1440;
            default: return 60;
        }
    }

    // Renderizar resultados da análise
    function renderAnalysisResults(result) {
        try {
            const resultsContainer = document.getElementById('analysis-results');
            if (!resultsContainer) {
                throw new Error('Container de resultados não encontrado');
            }
            
            // Limpar container
            resultsContainer.innerHTML = '';
            
            // Criar cabeçalho
            const header = document.createElement('div');
            header.className = 'analysis-header';
            header.innerHTML = `<h3>Análise de ${result.symbol}</h3>
                              <p>Atualizada em: ${new Date(result.timestamp).toLocaleString()}</p>`;
            resultsContainer.appendChild(header);
            
            // Criar seção de indicadores
            const indicatorsSection = document.createElement('div');
            indicatorsSection.className = 'indicators-section';
            indicatorsSection.innerHTML = `<h4>Indicadores</h4>`;
            
            // Adicionar valores de indicadores
            const indList = document.createElement('ul');
            for (const [key, value] of Object.entries(result.indicators)) {
                if (value && value.length > 0) {
                    const lastValue = value[value.length - 1];
                    if (lastValue !== null) {
                        const item = document.createElement('li');
                        item.textContent = `${key.toUpperCase()}: ${lastValue.toFixed(2)}`;
                        indList.appendChild(item);
                    }
                }
            }
            indicatorsSection.appendChild(indList);
            resultsContainer.appendChild(indicatorsSection);
            
            // Criar seção de sinais
            const signalsSection = document.createElement('div');
            signalsSection.className = 'signals-section';
            signalsSection.innerHTML = `<h4>Sinais (${result.signals.length})</h4>`;
            
            if (result.signals.length > 0) {
                const signalsList = document.createElement('ul');
                result.signals.forEach(signal => {
                    const item = document.createElement('li');
                    item.className = `signal-item ${signal.significance.toLowerCase()}`;
                    item.innerHTML = `<strong>${signal.type}</strong>: ${signal.indicator1} × ${signal.indicator2}`;
                    signalsList.appendChild(item);
                });
                signalsSection.appendChild(signalsList);
            } else {
                signalsSection.innerHTML += '<p>Nenhum sinal detectado</p>';
            }
            
            resultsContainer.appendChild(signalsSection);
            
            addLog('Resultados da análise renderizados', 'SUCCESS');
        } catch (error) {
            addLog(`Erro ao renderizar resultados: ${error.message}`, 'ERROR');
        }
    }

    // Função unificada para logs e status
    const logAndUpdateStatus = (message, level = 'INFO', source = 'index.js', showStatus = true, duration = 3000) => {
        // Log para o sistema centralizado
        addLog(message, level);
        
        // Atualizar o status visível se solicitado
        if (showStatus) {
            // Mapear nível de log para tipo de status
            let statusType = 'info';
            switch (level.toUpperCase()) {
                case 'ERROR': statusType = 'error'; break;
                case 'WARN': statusType = 'warn'; break;
                case 'SUCCESS': statusType = 'success'; break;
                default: statusType = 'info';
            }
            
            updateStatusUI(message, statusType, duration);
        }
    };

    // Função interna para atualizar apenas a UI de status, sem registrar logs
    const updateStatusUI = (message, type = 'info', duration = 3000) => {
        try {
            // Registrar no sistema de logs centralizado
            addLog(`Status UI atualizado: ${message}`, type.toUpperCase());
            
            // Buscar o elemento de status
            const statusElement = document.getElementById('status-processo');
            if (statusElement) {
                // Remover classes específicas, mas manter a classe base 'status-processo'
                statusElement.className = 'status-processo';
                
                // Adicionar a classe apropriada
                statusElement.classList.add(type, 'visible');
                
                // Definir o texto
                statusElement.textContent = message;
                
                // Auto-limpar após duração
                if (duration > 0) {
                    setTimeout(() => {
                        statusElement.classList.remove('visible');
                    }, duration);
                }
            } else {
                addLog('Elemento de status não encontrado na UI', 'WARN');
            }
        } catch (error) {
            console.error(`Erro ao atualizar UI de status: ${error.message}`);
            addLog(`Erro ao atualizar UI de status: ${error.message}`, 'ERROR');
        }
    };

    //Adicionar um listener para mensagens do chrome.runtime
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Verificar se é uma mensagem de atualização de configurações
        if (message && message.action === 'configUpdated' && message.settings) {
            addLog('Recebida mensagem via chrome.runtime para atualização de configurações', 'INFO');
            
            const config = message.settings;
            // Atualizar campos da página principal
            updateCurrentSettings({
                galeEnabled: config.gale.active,
                galeLevel: config.gale.level,
                dailyProfit: config.dailyProfit,
                stopLoss: config.stopLoss,
                tradeValue: config.value,
                tradeTime: config.period,
                autoActive: config.automation
            });
            
            logAndUpdateStatus('Configurações atualizadas via runtime', 'SUCCESS', 'index.js', true, 2000);
            addLog('Configurações atualizadas com sucesso via chrome.runtime', 'SUCCESS');
            
            // Responder à mensagem se necessário
            if (sendResponse) {
                sendResponse({ success: true });
            }
        }
        
        // Retornar true para indicar que a resposta pode ser assíncrona
        return true;
    });

    // Função para verificar e processar operações pendentes
    const checkPendingOperations = () => {
        try {
            // Verificar se o contexto da extensão é válido
            const isExtensionContextValid = () => {
                try {
                    return chrome.runtime && chrome.runtime.id;
                } catch (e) {
                    return false;
                }
            };

            if (!isExtensionContextValid()) {
                console.log('Contexto da extensão inválido, não é possível processar operações pendentes');
                return;
            }

            // Recuperar operações pendentes
            const pendingOperations = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
            if (pendingOperations.length === 0) {
                return;
            }

            console.log(`Encontradas ${pendingOperations.length} operações pendentes para processamento`);
            logAndUpdateStatus(`Processando ${pendingOperations.length} operações pendentes`, 'INFO', 'trade-execution', true);

            // Limpar operações pendentes imediatamente para evitar processamento duplicado
            localStorage.removeItem('pendingOperations');

            // Processar no máximo 5 operações para evitar sobrecarga
            const operationsToProcess = pendingOperations.slice(0, 5);
            
            // Executar cada operação pendente com intervalo
            operationsToProcess.forEach((op, index) => {
                setTimeout(() => {
                    try {
                        logAndUpdateStatus(`Executando operação pendente: ${op.action}`, 'INFO', 'trade-execution', true);
                        
                        // Enviar para o background
                        chrome.runtime.sendMessage({ 
                            action: 'EXECUTE_TRADE_ACTION', 
                            tradeAction: op.action
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                logAndUpdateStatus(`Falha ao executar operação pendente: ${chrome.runtime.lastError.message}`, 'ERROR', 'trade-execution', true);
                                return;
                            }
                            
                            if (response && response.success) {
                                logAndUpdateStatus(`Operação pendente ${op.action} executada com sucesso`, 'SUCCESS', 'trade-execution', true);
                            } else {
                                const errorMsg = response ? response.error : 'Sem resposta do background';
                                logAndUpdateStatus(`Falha na execução pendente: ${errorMsg}`, 'ERROR', 'trade-execution', true);
                            }
                        });
                    } catch (error) {
                        logAndUpdateStatus(`Erro ao executar operação pendente: ${error.message}`, 'ERROR', 'trade-execution', true);
                    }
                }, index * 2000); // Executar a cada 2 segundos
            });
            
            // Se houver mais operações, armazenar para processamento posterior
            if (pendingOperations.length > 5) {
                const remainingOperations = pendingOperations.slice(5);
                localStorage.setItem('pendingOperations', JSON.stringify(remainingOperations));
                logAndUpdateStatus(`${remainingOperations.length} operações pendentes restantes serão processadas posteriormente`, 'INFO', 'trade-execution', true);
            }
        } catch (error) {
            console.error('Erro ao processar operações pendentes:', error);
        }
    };

    // Adicionar função para verificar a conexão com a extensão e recuperar logs e operações pendentes
    const checkExtensionConnection = () => {
        // Verificar se o contexto da extensão é válido
        const isExtensionContextValid = () => {
            try {
                return chrome.runtime && chrome.runtime.id;
            } catch (e) {
                return false;
            }
        };

        if (isExtensionContextValid()) {
            addLog('Conexão com a extensão estabelecida', 'SUCCESS');
            
            // Verificar operações pendentes
            checkPendingOperations();
            
            // Verificar logs pendentes
            if (window.LogSystem && typeof window.LogSystem.syncPendingLogs === 'function') {
                window.LogSystem.syncPendingLogs();
            }
        } else {
            addLog('Contexto da extensão inválido, tentando novamente em 5 segundos...', 'WARN');
            setTimeout(checkExtensionConnection, 5000);
        }
    };

    // Inicializar integração com o módulo de histórico
    const initHistoryModule = () => {
        try {
            // Verificar se o módulo já foi inicializado
            if (historyModuleInitialized) return;
            
            // Verificar se o módulo está disponível
            if (!window.TradeManager?.History) {
                addLog('Módulo de histórico não disponível. O monitoramento de operações não estará ativo.', 'WARN');
                return false;
            }
            
            addLog('Inicializando integração com módulo de histórico...', 'INFO');
            
            // Inicializar o módulo se ainda não estiver inicializado
            if (typeof window.TradeManager.History.init === 'function') {
                window.TradeManager.History.init();
            }
            
            historyModuleInitialized = true;
            addLog('Integração com módulo de histórico concluída', 'SUCCESS');
            return true;
        } catch (error) {
            addLog(`Erro ao inicializar módulo de histórico: ${error.message}`, 'ERROR');
            return false;
        }
    };

    // Adicionar um listener para mensagens vindas de iframes e do background
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('message', (event) => {
            // Verificar se é uma mensagem de atualização de status
            if (event.data && event.data.action === 'updateStatus') {
                // Chamar a função de atualização de status
                updateStatus(
                    event.data.message, 
                    event.data.type || 'info'
                );
            }
        });
    }

    // Adicionar um listener para mensagens do chrome.runtime
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Usar a função de log interna de index.js se disponível, ou console.log como fallback
            const logFunction = typeof sendToLogSystem === 'function' ? sendToLogSystem : console.log;
            logFunction(`Mensagem runtime recebida em index.js: action=${message.action}, type=${message.type}, source=${sender.id}`, 'DEBUG');

            // Verificar se estamos no contexto da extensão
            const isExtensionContext = () => {
                return window.location.href.includes('chrome-extension://');
            };

            // Handler para mensagens de status
            if (message.action === 'updateStatus') {
                // Só processa se estiver no contexto da extensão
                if (isExtensionContext()) {
                    logFunction(`Handler 'updateStatus' ativado por mensagem: ${message.message}`, 'DEBUG');
                    updateStatus(
                        message.message,
                        message.type || 'info',
                        message.duration || 3000
                    );
                    sendResponse({ success: true, status_updated_by_action_updateStatus: true });
                } else {
                    // Se não estiver no contexto da extensão, apenas responde com sucesso
                    sendResponse({ success: true, status_ignored_not_extension_context: true });
                }
                return true;
            }

            // Adicione aqui outros 'else if (message.action === 'ALGUMA_OUTRA_ACTION')' que index.js deva tratar
            // e para os quais deva enviar uma resposta.
            // Se algum desses handlers for assíncrono, ele deve retornar true e chamar sendResponse mais tarde.

            // Para mensagens não explicitamente tratadas acima (ex: 'logsCleaned' que é recebida mas não tem um handler específico aqui):
            // Não indicar uma resposta assíncrona, pois não vamos enviar uma.
            // Isso evita o erro "A listener indicated an asynchronous response by returning true, 
            // but the message channel closed before a response was received" para essas mensagens.
            // Se o remetente original da mensagem não tratada tinha um callback, ele receberá um erro de port closed,
            // o que é esperado se este listener não foi feito para responder a essa mensagem específica.
            // No caso de 'logsCleaned', o emissor original (log-sys.js) não tem callback, então está tudo bem.
            return false; 
        });
    }
    
    // Configurar funcionalidades para o sistema de gale
    function setupGaleTestButtons() {
        try {
            const simulateLossBtn = document.getElementById('simulate-loss');
            const simulateWinBtn = document.getElementById('simulate-win');
            const checkGaleStatusBtn = document.getElementById('check-gale-status');
            const galeLevelDisplay = document.getElementById('gale-level');
            const galeValueDisplay = document.getElementById('gale-value');
            
            if (!simulateLossBtn || !simulateWinBtn || !checkGaleStatusBtn) {
                console.warn('Botões de teste de gale não encontrados');
                return;
            }
            
            // Função para atualizar o display de status do gale
            const updateGaleStatusDisplay = (status) => {
                if (galeLevelDisplay) {
                    galeLevelDisplay.textContent = `Nível ${status.level || 0}`;
                }
                if (galeValueDisplay) {
                    galeValueDisplay.textContent = `Valor atual: R$ ${status.currentValue || status.originalValue || 0}`;
                }
            };
            
            // Verifica o status inicial
            if (window.GaleSystem) {
                const initialStatus = window.GaleSystem.getStatus();
                updateGaleStatusDisplay(initialStatus);
            }
            
            // Botão para simular perda e aplicar gale
            simulateLossBtn.addEventListener('click', () => {
                if (window.GaleSystem) {
                    const result = window.GaleSystem.simulateGale();
                    updateStatus(`Simulação de perda: ${result.message}`, result.success ? 'success' : 'error');
                    
                    // Atualizar display
                    const updatedStatus = window.GaleSystem.getStatus();
                    updateGaleStatusDisplay(updatedStatus);
                } else {
                    updateStatus('Sistema de Gale não está disponível', 'error');
                }
            });
            
            // Botão para simular ganho e resetar gale
            simulateWinBtn.addEventListener('click', () => {
                if (window.GaleSystem) {
                    const result = window.GaleSystem.simulateReset();
                    updateStatus(`Simulação de ganho: ${result.message}`, result.success ? 'success' : 'info');
                    
                    // Atualizar display
                    const updatedStatus = window.GaleSystem.getStatus();
                    updateGaleStatusDisplay(updatedStatus);
                } else {
                    updateStatus('Sistema de Gale não está disponível', 'error');
                }
            });
            
            // Botão para verificar status do gale
            checkGaleStatusBtn.addEventListener('click', () => {
                if (window.GaleSystem) {
                    const status = window.GaleSystem.getStatus();
                    updateStatus(`Status do Gale: Nível ${status.level}, Próx. valor: R$ ${status.nextValue}`, 'info');
                    updateGaleStatusDisplay(status);
                    
                    // Adicionar log com detalhes completos
                    addLog(`Status do Gale - Nível: ${status.level}, Ativo: ${status.active}, Valor original: ${status.originalValue}, Próximo valor: ${status.nextValue}`, 'INFO');
                } else {
                    updateStatus('Sistema de Gale não está disponível', 'error');
                }
            });
            
            addLog('Botões de teste do sistema de Gale configurados', 'INFO');
            
            // =================== CONFIGURAR BOTÕES DE TESTE DE ATIVOS ===================
            
            // Obter elementos dos botões de teste de ativos
            const testOpenAssetModalBtn = document.getElementById('test-open-asset-modal');
            const testFindBestAssetBtn = document.getElementById('test-find-best-asset');
            const testSwitchToCryptoBtn = document.getElementById('test-switch-to-crypto');
            const testSwitchToCurrencyBtn = document.getElementById('test-switch-to-currency');
            const minPayoutInput = document.getElementById('min-payout-input');
            const assetTestResult = document.getElementById('asset-test-result');
            
            // Função para atualizar resultado dos testes de ativos
            const updateAssetTestResult = (message, isError = false) => {
                if (assetTestResult) {
                    assetTestResult.innerHTML = message;
                    assetTestResult.style.color = isError ? '#d32f2f' : '#333';
                    assetTestResult.style.backgroundColor = isError ? '#ffebee' : '#f9f9f9';
                }
            };
            
            // Função auxiliar para formatar lista de ativos
            const formatAssetsList = (assets) => {
                if (!assets || assets.length === 0) return 'Nenhum ativo encontrado';
                
                return assets.map((asset, index) => 
                    `${index + 1}. ${asset.name} - ${asset.payout}%${asset.isSelected ? ' (SELECIONADO)' : ''}`
                ).join('<br>');
            };
            
            // Event listener para abrir modal de ativos
            if (testOpenAssetModalBtn) {
                testOpenAssetModalBtn.addEventListener('click', () => {
                    updateAssetTestResult('Abrindo modal de ativos...');
                    
                    chrome.runtime.sendMessage({
                        action: 'TEST_OPEN_ASSET_MODAL'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            updateAssetTestResult(`Erro: ${chrome.runtime.lastError.message}`, true);
                            return;
                        }
                        
                        if (response && response.success) {
                            updateAssetTestResult(`✅ ${response.message}`);
                        } else {
                            updateAssetTestResult(`❌ ${response?.error || 'Falha ao abrir modal'}`, true);
                        }
                    });
                });
            }
            
            // Event listener para buscar melhor ativo
            if (testFindBestAssetBtn) {
                testFindBestAssetBtn.addEventListener('click', () => {
                    const minPayout = parseInt(minPayoutInput?.value || '85', 10);
                    updateAssetTestResult(`Buscando melhor ativo (payout >= ${minPayout}%)...`);
                    
                    chrome.runtime.sendMessage({
                        action: 'TEST_FIND_BEST_ASSET',
                        minPayout: minPayout
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            updateAssetTestResult(`Erro: ${chrome.runtime.lastError.message}`, true);
                            return;
                        }
                        
                        if (response && response.success) {
                            const asset = response.asset;
                            let resultText = `✅ ${response.message}<br><br>`;
                            resultText += `<strong>Todos os ativos encontrados:</strong><br>`;
                            resultText += formatAssetsList(response.allAssets);
                            updateAssetTestResult(resultText);
                        } else {
                            let errorText = `❌ ${response?.error || 'Falha ao buscar ativo'}`;
                            if (response?.allAssets && response.allAssets.length > 0) {
                                errorText += `<br><br><strong>Ativos disponíveis:</strong><br>`;
                                errorText += formatAssetsList(response.allAssets);
                            }
                            updateAssetTestResult(errorText, true);
                        }
                    });
                });
            }
            
            // Event listener para mudar para crypto
            if (testSwitchToCryptoBtn) {
                testSwitchToCryptoBtn.addEventListener('click', () => {
                    updateAssetTestResult('Mudando para categoria Cryptocurrencies...');
                    
                    chrome.runtime.sendMessage({
                        action: 'TEST_SWITCH_ASSET_CATEGORY',
                        category: 'crypto'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            updateAssetTestResult(`Erro: ${chrome.runtime.lastError.message}`, true);
                            return;
                        }
                        
                        if (response && response.success) {
                            let resultText = `✅ ${response.message}<br><br>`;
                            resultText += `<strong>Ativos de ${response.category}:</strong><br>`;
                            resultText += formatAssetsList(response.assets);
                            updateAssetTestResult(resultText);
                        } else {
                            updateAssetTestResult(`❌ ${response?.error || 'Falha ao mudar categoria'}`, true);
                        }
                    });
                });
            }
            
            // Event listener para mudar para moedas
            if (testSwitchToCurrencyBtn) {
                testSwitchToCurrencyBtn.addEventListener('click', () => {
                    updateAssetTestResult('Mudando para categoria Currencies...');
                    
                    chrome.runtime.sendMessage({
                        action: 'TEST_SWITCH_ASSET_CATEGORY',
                        category: 'currency'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            updateAssetTestResult(`Erro: ${chrome.runtime.lastError.message}`, true);
                            return;
                        }
                        
                        if (response && response.success) {
                            let resultText = `✅ ${response.message}<br><br>`;
                            resultText += `<strong>Ativos de ${response.category}:</strong><br>`;
                            resultText += formatAssetsList(response.assets);
                            updateAssetTestResult(resultText);
                        } else {
                            updateAssetTestResult(`❌ ${response?.error || 'Falha ao mudar categoria'}`, true);
                        }
                    });
                });
            }
            
            addLog('Botões de teste de ativos configurados', 'INFO');

            // =================== BOTÕES DE DEBUG DO MODAL ===================
            // Configurar botões de debug para testar abertura/fechamento do modal
            const debugOpenModalBtn = document.getElementById('debug-open-modal');
            const debugCloseModalBtn = document.getElementById('debug-close-modal');
            const debugCheckStatusBtn = document.getElementById('debug-check-status');
            const debugToggleModalBtn = document.getElementById('debug-toggle-modal');
            const modalDebugResult = document.getElementById('modal-debug-result');

            // Função para atualizar resultado do debug
            const updateModalDebugResult = (message, isError = false) => {
                if (modalDebugResult) {
                    const timestamp = new Date().toLocaleTimeString();
                    modalDebugResult.innerHTML = `[${timestamp}] ${message}`;
                    modalDebugResult.style.backgroundColor = isError ? '#ffdddd' : '#ddffdd';
                    modalDebugResult.style.color = isError ? '#cc0000' : '#006600';
                }
            };

            // Event listener para abrir modal (debug)
            if (debugOpenModalBtn) {
                debugOpenModalBtn.addEventListener('click', () => {
                    updateModalDebugResult('🔄 Executando: AssetManager.openAssetModal()...');
                    
                    chrome.runtime.sendMessage({
                        action: 'TEST_OPEN_ASSET_MODAL'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            updateModalDebugResult(`❌ ERRO: ${chrome.runtime.lastError.message}`, true);
                            return;
                        }
                        
                        if (response && response.success) {
                            updateModalDebugResult(`✅ SUCESSO: ${response.message}`);
                        } else {
                            updateModalDebugResult(`❌ FALHA: ${response?.error || 'Erro desconhecido'}`, true);
                        }
                    });
                });
            }

            // Event listener para fechar modal (debug)
            if (debugCloseModalBtn) {
                debugCloseModalBtn.addEventListener('click', () => {
                    updateModalDebugResult('🔄 Executando: AssetManager.closeAssetModal()...');
                    
                    chrome.runtime.sendMessage({
                        action: 'CLOSE_ASSET_MODAL'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            updateModalDebugResult(`❌ ERRO: ${chrome.runtime.lastError.message}`, true);
                            return;
                        }
                        
                        if (response && response.success) {
                            updateModalDebugResult(`✅ SUCESSO: ${response.message}`);
                        } else {
                            updateModalDebugResult(`❌ FALHA: ${response?.error || 'Erro desconhecido'}`, true);
                        }
                    });
                });
            }

            // Event listener para verificar status do modal
            if (debugCheckStatusBtn) {
                debugCheckStatusBtn.addEventListener('click', () => {
                    updateModalDebugResult('🔍 Verificando status do modal...');
                    
                    // Executar script para verificar status do modal na página
                    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                        if (!tabs || !tabs.length) {
                            updateModalDebugResult('❌ ERRO: Aba ativa não encontrada', true);
                            return;
                        }
                        
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            func: () => {
                                // Verificar elementos do modal
                                const assetButton = document.querySelector('.currencies-block .pair-number-wrap');
                                const activeControl = document.querySelector('.currencies-block__in.active');
                                const modal = document.querySelector('.drop-down-modal.drop-down-modal--quotes-list');
                                const currentAsset = document.querySelector('.current-symbol, .currencies-block .current-symbol_cropped');
                                
                                return {
                                    assetButtonExists: !!assetButton,
                                    modalIsActive: !!activeControl,
                                    modalExists: !!modal,
                                    modalVisible: modal ? (modal.style.display !== 'none' && modal.offsetParent !== null) : false,
                                    currentAsset: currentAsset ? currentAsset.textContent.trim() : 'Não detectado',
                                    timestamp: new Date().toLocaleTimeString()
                                };
                            }
                        }, (results) => {
                            if (chrome.runtime.lastError) {
                                updateModalDebugResult(`❌ ERRO: ${chrome.runtime.lastError.message}`, true);
                                return;
                            }
                            
                            if (results && results[0] && results[0].result) {
                                const status = results[0].result;
                                let statusText = `📊 STATUS DO MODAL [${status.timestamp}]:\n`;
                                statusText += `• Botão de controle: ${status.assetButtonExists ? '✅' : '❌'}\n`;
                                statusText += `• Modal ativo (classe): ${status.modalIsActive ? '✅ ABERTO' : '❌ FECHADO'}\n`;
                                statusText += `• Modal existe: ${status.modalExists ? '✅' : '❌'}\n`;
                                statusText += `• Modal visível: ${status.modalVisible ? '✅' : '❌'}\n`;
                                statusText += `• Ativo atual: ${status.currentAsset}`;
                                
                                updateModalDebugResult(statusText.replace(/\n/g, '<br>'));
                            } else {
                                updateModalDebugResult('❌ ERRO: Nenhum resultado retornado', true);
                            }
                        });
                    });
                });
            }

            // Event listener para toggle do modal (abrir/fechar automaticamente)
            if (debugToggleModalBtn) {
                debugToggleModalBtn.addEventListener('click', () => {
                    updateModalDebugResult('🔄 Executando toggle do modal...');
                    
                    // Primeiro verificar status
                    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                        if (!tabs || !tabs.length) {
                            updateModalDebugResult('❌ ERRO: Aba ativa não encontrada', true);
                            return;
                        }
                        
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            func: () => {
                                const activeControl = document.querySelector('.currencies-block__in.active');
                                return !!activeControl; // true se modal estiver aberto
                            }
                        }, (results) => {
                            if (chrome.runtime.lastError) {
                                updateModalDebugResult(`❌ ERRO: ${chrome.runtime.lastError.message}`, true);
                                return;
                            }
                            
                            const isModalOpen = results && results[0] && results[0].result;
                            const action = isModalOpen ? 'CLOSE_ASSET_MODAL' : 'TEST_OPEN_ASSET_MODAL';
                            const actionText = isModalOpen ? 'fechar' : 'abrir';
                            
                            updateModalDebugResult(`🔄 Modal está ${isModalOpen ? 'ABERTO' : 'FECHADO'}, tentando ${actionText}...`);
                            
                            chrome.runtime.sendMessage({
                                action: action
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    updateModalDebugResult(`❌ ERRO: ${chrome.runtime.lastError.message}`, true);
                                    return;
                                }
                                
                                if (response && response.success) {
                                    updateModalDebugResult(`✅ SUCESSO: Modal ${isModalOpen ? 'fechado' : 'aberto'} com sucesso!`);
                                } else {
                                    updateModalDebugResult(`❌ FALHA: ${response?.error || 'Erro desconhecido'}`, true);
                                }
                            });
                        });
                    });
                });
            }







            addLog('Botões de debug do modal configurados', 'INFO');
            
            // =================== CONFIGURAÇÕES DE ATIVOS MOVIDAS PARA SETTINGS.HTML ===================
            // As configurações de troca de ativos agora estão na página de configurações
            
            // Adicionar listener para atualização automática do status do Gale
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                // Verificar se é uma mensagem de atualização do Gale
                if (message.action === 'GALE_UPDATED' || message.action === 'GALE_RESET') {
                    if (window.GaleSystem) {
                        const updatedStatus = window.GaleSystem.getStatus();
                        updateGaleStatusDisplay(updatedStatus);
                        addLog(`Status do Gale atualizado automaticamente - Nível: ${updatedStatus.level}, Valor atual: ${updatedStatus.currentValue}`, 'DEBUG');
                    }
                }
                return true;
            });
        } catch (error) {
            console.error('Erro ao configurar botões de teste do gale:', error);
            addLog(`Erro ao configurar botões de teste do gale: ${error.message}`, 'ERROR');
        }
    }

    // Função para atualizar a visibilidade do painel de teste do Gale baseado no modo desenvolvedor
    const updateGaleTestPanelVisibility = (devModeEnabled) => {
        const galeTestPanel = document.getElementById('gale-test-panel');
        if (!galeTestPanel) return;
        
        if (devModeEnabled) {
            galeTestPanel.classList.remove('hidden');
            addLog('Painel de teste do Gale exibido (Modo Desenvolvedor ativo)', 'INFO');
        } else {
            galeTestPanel.classList.add('hidden');
            addLog('Painel de teste do Gale ocultado', 'DEBUG');
        }
    };

    // Função para controlar visibilidade dos botões principais (modo usuário)
    const updateUserControlsVisibility = (automationActive = false, operationInProgress = false) => {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const startOperationBtn = document.getElementById('start-operation');
        const cancelOperationBtn = document.getElementById('cancel-operation');
        
        addLog(`Atualizando visibilidade dos controles: automação=${automationActive}, operação=${operationInProgress}`, 'DEBUG');
        
        if (!analyzeBtn || !startOperationBtn || !cancelOperationBtn) {
            addLog('Botões de controle não encontrados para atualização de visibilidade', 'WARN');
            return;
        }

        // Resetar todas as classes hidden
        analyzeBtn.classList.remove('hidden');
        startOperationBtn.classList.remove('hidden');
        cancelOperationBtn.classList.remove('hidden');

        if (operationInProgress) {
            // Quando operação está em andamento: apenas botão cancelar
            analyzeBtn.classList.add('hidden');
            startOperationBtn.classList.add('hidden');
            // cancelOperationBtn fica visível
            addLog('✅ Controles atualizados: OPERAÇÃO EM ANDAMENTO - Apenas botão "Cancelar Operação" visível', 'INFO');
        } else if (automationActive) {
            // Quando automação ativa mas sem operação: apenas botão iniciar automático
            analyzeBtn.classList.add('hidden');
            cancelOperationBtn.classList.add('hidden');
            // startOperationBtn fica visível
            addLog('✅ Controles atualizados: AUTOMAÇÃO ATIVA - Apenas botão "Iniciar Automático" visível', 'INFO');
        } else {
            // Quando automação desativa: apenas botão análise manual
            startOperationBtn.classList.add('hidden');
            cancelOperationBtn.classList.add('hidden');
            // analyzeBtn fica visível
            addLog('✅ Controles atualizados: AUTOMAÇÃO INATIVA - Apenas botão "Iniciar Análise" visível', 'INFO');
        }
    };

    // Função para adicionar botão de teste de análise no modo desenvolvedor
    const setupDevAnalysisButton = () => {
        const testAnalysisBtn = document.getElementById('test-analysis');
        if (testAnalysisBtn) {
            testAnalysisBtn.addEventListener('click', async () => {
                addLog('Executando teste de análise (modo desenvolvedor)', 'INFO');
                try {
                    // Simular análise com dados mock
                    const mockResult = {
                        action: Math.random() > 0.5 ? 'BUY' : 'SELL',
                        confidence: Math.floor(Math.random() * 40) + 60, // 60-100%
                        period: '1m',
                        value: 'R$ 10,00',
                        reason: 'Análise de teste executada com dados simulados para desenvolvimento.',
                        isTestMode: true
                    };
                    
                    // Mostrar modal com resultado
                    if (typeof showAnalysisModal === 'function') {
                        showAnalysisModal(mockResult);
                        addLog('Modal de análise de teste exibido com sucesso', 'SUCCESS');
                    } else {
                        addLog('Função showAnalysisModal não encontrada', 'ERROR');
                    }
                } catch (error) {
                    addLog(`Erro no teste de análise: ${error.message}`, 'ERROR');
                }
            });
            addLog('Botão de teste de análise configurado', 'DEBUG');
        }
    };

    // Adicionar um listener para mensagens do chrome.runtime
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'RUN_ANALYSIS') {
            runAnalysis()
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // resposta assíncrona
        }
        // ... outros handlers ...
    });

    // ================== FUNÇÃO DE ATUALIZAÇÃO DE STATUS DE AUTOMAÇÃO ==================
    // Função para atualizar o status de automação (restaurada da versão original)
    const updateAutomationStatus = async (isRunning, operationInProgress = false) => {
        addLog(`Atualizando status de automação: isRunning=${isRunning}, operationInProgress=${operationInProgress}`, 'DEBUG');
        
        // Atualizar via StateManager se disponível (método híbrido)
        try {
            window.StateManager.updateAutomationState(isRunning, operationInProgress ? {
                id: Date.now(),
                type: 'automation_operation',
                startTime: new Date().toISOString(),
                status: 'running'
            } : null);
        } catch (error) {
            addLog(`Erro ao atualizar estado via StateManager: ${error.message}`, 'ERROR');
        }
        
        // Atualizar elementos de UI diretamente para compatibilidade
        const automationStatusElement = document.querySelector('#automation-status');
        if (automationStatusElement) {
            automationStatusElement.textContent = `Automação: ${isRunning ? 'Ativa' : 'Inativa'}`;
            automationStatusElement.className = 'automation-status';
            automationStatusElement.classList.add(isRunning ? 'active' : 'inactive');
        }
        
        // Atualizar visibilidade dos botões
        updateUserControlsVisibility(isRunning, operationInProgress);
        
        addLog(`Status de automação atualizado: ${isRunning ? 'Ativo' : 'Inativo'}`, 'DEBUG');
    };

    // ================== INICIALIZAÇÃO DO MONITORAMENTO ==================

    // ================== VERIFICAÇÃO DE ELEMENTOS ==================
} else {
    console.log('Trade Manager Pro - Index Module já foi carregado anteriormente');
}