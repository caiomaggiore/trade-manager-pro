// Trade Manager Pro - Index Module
// Verifica se o m├│dulo j├í foi inicializado para evitar duplica├º├Áes
if (typeof window.TradeManagerIndexLoaded === 'undefined') {
    // Marca o m├│dulo como carregado
    window.TradeManagerIndexLoaded = true;
    
    // Verificar se o sistema de logs est├í dispon├¡vel
    let logInitialized = false;
    
    // Fun├º├úo para adicionar logs usando EXCLUSIVAMENTE chrome.runtime
    const addLog = (message, level = 'INFO') => {
        // Enviar para o sistema centralizado via mensagem
        try {
            // Certifique-se que o background script espera por 'action: logMessage' ou ajuste o 'action'
            chrome.runtime.sendMessage({
                action: 'addLog', // PADRONIZADO para addLog
                logMessage: `${message}`, // Usando logMessage
                level: level,
                source: 'index.js' // 'source' j├í ├® expl├¡cito aqui, mas pode ser ├║til para o receptor
            }); // Callback removido
        } catch (error) {
            console.warn('[index.js] Exce├º├úo ao tentar enviar log via runtime:', error);
        }
    };
    
    // Fun├º├úo para atualizar o status no UI e registrar um log
    const updateStatus = (message, level = 'INFO', duration = 3000) => {
        const statusElement = document.getElementById('status-processo');
        if (statusElement) {
            let statusClass = 'info'; // Default class
            switch (String(level).toUpperCase()) { // Garantir que level seja string
                case 'ERROR': statusClass = 'error'; break;
                case 'WARN': statusClass = 'warn'; break;
                case 'SUCCESS': statusClass = 'success'; break;
                // default ├® 'info'
            }
            
            statusElement.className = 'status-processo'; // Reset classes
            statusElement.classList.add(statusClass, 'visible');
            statusElement.textContent = message;
            
            // Limpar status ap├│s a dura├º├úo, se especificado e > 0
            if (typeof duration === 'number' && duration > 0) {
                setTimeout(() => {
                    if (statusElement.textContent === message) { // S├│ limpa se ainda for a mesma mensagem
                        statusElement.classList.remove('visible');
                    }
                }, duration);
            }
        } else {
            // Apenas logar no console se o elemento n├úo for encontrado
            console.warn('Elemento de status #status-processo n├úo encontrado na UI');
        }
    };
    
    // Iniciar sistema de logs ao carregar
    const initLogging = () => {
        if (logInitialized) return;
        
        try {
            // Verificar se o sistema de logs j├í existe
            if (typeof window.logToSystem === 'function') {
                addLog('Sistema de logs dispon├¡vel', 'DEBUG');
                logInitialized = true;
                return;
            }
            
            // Verificar se o LogSystem existe (pode estar carregado mas n├úo inicializado)
            if (typeof window.LogSystem === 'object') {
                window.LogSystem.init();
                addLog('Sistema de logs inicializado', 'INFO');
                logInitialized = true;
                return;
            }
            
            // Se o sistema n├úo est├í dispon├¡vel, tentar carregar via script
            addLog('Sistema de logs n├úo detectado, tentando carregar via script...', 'WARN');
            
            const script = document.createElement('script');
            script.src = '../content/log-sys.js';
            script.onload = () => {
                if (typeof window.LogSystem === 'object') {
                    window.LogSystem.init();
                    logInitialized = true;
                    addLog('Sistema de logs inicializado ap├│s carregamento din├ómico', 'SUCCESS');
                } else {
                    addLog('LogSystem n├úo dispon├¡vel mesmo ap├│s carregamento', 'ERROR');
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
    
    // ================== VERIFICA├ç├âO DE ELEMENTOS ==================
    const indexUI = {
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
    
    // ================== VARI├üVEIS GLOBAIS ==================
    let isAutomationRunning = false;
    let automationTimeout = null;
    let historyModuleInitialized = false;
    
    // Expor as constantes globalmente
    window.API_KEY = 'AIzaSyDeYcYUxAN52DNrgZeFNcEfceVMoWJDjWk';
    window.API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.API_KEY}`;
    
    // ================== INICIALIZA├ç├âO DO MONITORAMENTO ==================
    // REMOVIDO: Monitoramento de trade que estava duplicado com trade-history.js
    // document.addEventListener('DOMContentLoaded', async () => { // Linha original ~153
    // ... (Todo o bloco async () => { ... } at├® a linha ~387 original foi removido)

    // ================== FUN├ç├òES DE AN├üLISE ==================
    /**
     * Executa a an├ílise do gr├ífico atual
     * @returns {Promise<Object>} Resultado da an├ílise
     */
    const runAnalysis = async () => {
        try {
            updateStatus('Iniciando an├ílise...', 'info');
            addLog('Iniciando an├ílise do gr├ífico...');
            
            // ETAPA 1: Capturar a tela
            addLog('Iniciando captura de tela para an├ílise...', 'INFO');
            let dataUrl;
            
            // Verificar se o m├│dulo de captura est├í dispon├¡vel
            if (!window.CaptureScreen || typeof window.CaptureScreen.captureForAnalysis !== 'function') {
                addLog('M├│dulo de captura n├úo dispon├¡vel, tentando carregar dinamicamente', 'WARN');
                
                // Tentar carregar o m├│dulo dinamicamente
                try {
                    const script = document.createElement('script');
                    script.src = '../content/capture-screen.js';
                    
                    await new Promise((resolve, reject) => {
                        script.onload = () => {
                            addLog('M├│dulo de captura carregado dinamicamente', 'SUCCESS');
                            resolve();
                        };
                        script.onerror = (err) => {
                            addLog(`Erro ao carregar m├│dulo de captura: ${err}`, 'ERROR');
                            reject(new Error('Falha ao carregar m├│dulo de captura'));
                        };
                        document.head.appendChild(script);
                    });
                    
                    // Verificar se o carregamento foi bem-sucedido
                    if (!window.CaptureScreen || typeof window.CaptureScreen.captureForAnalysis !== 'function') {
                        throw new Error('M├│dulo de captura carregado, mas fun├º├úo captureForAnalysis n├úo dispon├¡vel');
                    }
                } catch (loadError) {
                    throw new Error(`N├úo foi poss├¡vel carregar o m├│dulo de captura: ${loadError.message}`);
                }
            }
            
            // Agora usar o m├│dulo de captura
            try {
                dataUrl = await window.CaptureScreen.captureForAnalysis();
                addLog('Captura de tela para an├ílise conclu├¡da com sucesso', 'SUCCESS');
            } catch (captureError) {
                throw new Error(`Falha ao capturar tela para an├ílise: ${captureError.message}`);
            }
            
            // Verificar se obtivemos uma captura v├ílida
            if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
                throw new Error('Dados de imagem inv├ílidos ou ausentes');
            }
            
            // Armazenar a captura para uso futuro
            window.lastCapturedImage = dataUrl;
            window.lastCapturedImageTimestamp = Date.now();
            
            // ETAPA 2: Processar a an├ílise
            addLog('Iniciando etapa de processamento de an├ílise...', 'INFO');
            
            try {
                // Obter configura├º├Áes
                const settings = window.StateManager ? window.StateManager.getConfig() || {} : {};
                
                // Enviar an├ílise usando o analyze-graph.js diretamente se dispon├¡vel
                if (window.AnalyzeGraph && typeof window.AnalyzeGraph.analyzeImage === 'function') {
                    addLog('Usando m├│dulo AnalyzeGraph para processamento...', 'INFO');
                    
                    const analysisResult = await window.AnalyzeGraph.analyzeImage(dataUrl, settings);
                    
                    // Formatar resultado
                    const formattedResult = {
                        success: true,
                        results: analysisResult
                    };
                    
                    // Registrar sucesso
                    addLog(`An├ílise conclu├¡da com sucesso: ${analysisResult.action}`, 'SUCCESS');
                    updateStatus(`An├ílise: ${analysisResult.action}`, 'success');
                    
                    // Mostrar modal
                    if (typeof showAnalysisModal === 'function') {
                        showAnalysisModal(analysisResult);
                    } else {
                        addLog('Fun├º├úo showAnalysisModal n├úo dispon├¡vel', 'WARN');
                    }
                    
                    return formattedResult;
                } else {
                    // Se o m├│dulo n├úo estiver dispon├¡vel, tentar carregar
                    addLog('M├│dulo AnalyzeGraph n├úo dispon├¡vel, tentando carregar dinamicamente', 'WARN');
                    
                    try {
                        // Tentar carregar o m├│dulo
                        const analyzeScript = document.createElement('script');
                        analyzeScript.src = '../content/analyze-graph.js';
                        
                        await new Promise((resolve, reject) => {
                            analyzeScript.onload = () => {
                                addLog('M├│dulo AnalyzeGraph carregado dinamicamente', 'SUCCESS');
                                resolve();
                            };
                            analyzeScript.onerror = (err) => {
                                addLog(`Erro ao carregar m├│dulo de an├ílise: ${err}`, 'ERROR');
                                reject(new Error('Falha ao carregar m├│dulo de an├ílise'));
                            };
                            document.head.appendChild(analyzeScript);
                        });
                        
                        // Verificar se o carregamento foi bem-sucedido
                        if (!window.AnalyzeGraph || typeof window.AnalyzeGraph.analyzeImage !== 'function') {
                            throw new Error('M├│dulo de an├ílise carregado, mas fun├º├úo analyzeImage n├úo dispon├¡vel');
                        }
                        
                        // Usar o m├│dulo rec├®m-carregado
                        const analysisResult = await window.AnalyzeGraph.analyzeImage(dataUrl, settings);
                        
                        // Formatar resultado
                        const formattedResult = {
                            success: true,
                            results: analysisResult
                        };
                        
                        // Registrar sucesso
                        addLog(`An├ílise conclu├¡da com sucesso: ${analysisResult.action}`, 'SUCCESS');
                        updateStatus(`An├ílise: ${analysisResult.action}`, 'success');
                        
                        // Mostrar modal
                        if (typeof showAnalysisModal === 'function') {
                            showAnalysisModal(analysisResult);
                        } else {
                            addLog('Fun├º├úo showAnalysisModal n├úo dispon├¡vel', 'WARN');
                        }
                        
                        return formattedResult;
                    } catch (analyzeLoadError) {
                        throw new Error(`N├úo foi poss├¡vel usar o m├│dulo de an├ílise: ${analyzeLoadError.message}`);
                    }
                }
            } catch (analysisError) {
                addLog(`Erro no processamento da an├ílise: ${analysisError.message}`, 'ERROR');
                updateStatus('Erro ao analisar o gr├ífico', 'error');
                throw analysisError;
            }
        } catch (error) {
            addLog(`Erro na an├ílise: ${error.message}`, 'ERROR');
            updateStatus('Erro ao realizar an├ílise', 'error');
            throw error;
        }
    };

    // Fun├º├úo para analisar na aba
    const analyzeInTab = async () => {
        try {
            const tab = await getActiveTab();
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'ANALYZE_GRAPH' });
            if (response && response.success) {
                updateStatus('An├ílise conclu├¡da com sucesso', 'success');
            } else {
                updateStatus('Erro ao analisar o gr├ífico', 'error');
            }
        } catch (error) {
            addLog(`Erro ao executar an├ílise na aba: ${error.message}`, 'ERROR');
            updateStatus('Erro ao executar an├ílise', 'error');
        }
    };

    // ================== INICIALIZA├ç├âO ==================
    document.addEventListener('DOMContentLoaded', async () => {
        // Inicializar sistema de logs
        initLogging();
        
        // Adicionar log de inicializa├º├úo
        addLog('Interface principal inicializada', 'INFO');
        
        // Tentar obter a vers├úo do Manifest e mostrar no rodap├®
        try {
            const manifest = chrome.runtime.getManifest();
            if (indexUI.version) {
                indexUI.version.textContent = manifest.version || '1.0.0';
                addLog(`Vers├úo do Trade Manager Pro: ${manifest.version}`, 'INFO');
            }
        } catch (error) {
            addLog('Erro ao obter vers├úo do sistema', 'ERROR');
            if (indexUI.version) {
                indexUI.version.textContent = '1.0.0';
            }
        }
        
        // Testar conex├úo com a API Gemini
        testGeminiConnection();
        
        // Carregar configura├º├Áes
        loadConfig();
        
        // Atualizar status inicial
        updateStatus('Sistema operando normalmente', 'INFO');
        
        // Adicionar event listeners
        addEventListeners();
        
        // Inicializar listener para StateManager
        initStateManagerListener();
        
        // Inicializar m├│dulo de hist├│rico
        initHistoryModule();
        
        // Configurar event listeners
        addLog('Event listeners configurados com sucesso', 'DEBUG');
        
        // Adicionar listener direto para mensagens da p├ígina de configura├º├Áes (mecanismo alternativo)
        window.addEventListener('message', (event) => {
            // Verificar se ├® uma mensagem de atualiza├º├úo de configura├º├Áes
            if (event.data && event.data.action === 'configUpdated' && event.data.settings) {
                addLog('Recebida mensagem direta de atualiza├º├úo de configura├º├Áes', 'INFO');
                
                const config = event.data.settings;
                // Atualizar campos da p├ígina principal
                updateCurrentSettings({
                    galeEnabled: config.gale.active,
                    galeLevel: config.gale.level,
                    dailyProfit: config.dailyProfit,
                    stopLoss: config.stopLoss,
                    tradeValue: config.value,
                    tradeTime: config.period,
                    autoActive: config.automation
                });
                
                // Atualizar apenas a UI de status de automa├º├úo, sem alterar o estado
                const automationStatus = config.automation || false;
                const automationStatusElement = document.querySelector('#automation-status');
                if (automationStatusElement) {
                    automationStatusElement.textContent = `Automa├º├úo: ${automationStatus ? 'Ativa' : 'Inativa'}`;
                    automationStatusElement.className = 'automation-status';
                    automationStatusElement.classList.add(automationStatus ? 'active' : 'inactive');
                    
                    addLog(`UI de status de automa├º├úo atualizada via postMessage: ${automationStatus ? 'Ativo' : 'Inativo'}`, 'DEBUG');
                }
                
                updateStatus('Configura├º├Áes atualizadas via mensagem direta', 'success', 2000);
                addLog('Configura├º├Áes atualizadas com sucesso via postMessage', 'SUCCESS');
            }
        });
        addLog('Listener de mensagens diretas configurado com sucesso', 'INFO');
        
        updateStatus('Sistema iniciado com sucesso!', 'success');
        addLog('Interface principal carregada e pronta', 'SUCCESS');
        
        // Verificar conex├úo com a extens├úo e processar opera├º├Áes pendentes
        checkExtensionConnection();
        
        // Tentar testar a conex├úo com a API Gemini
        testGeminiConnection()
            .then(connected => {
                if (connected) {
                    addLog('API Gemini conectada com sucesso', 'SUCCESS');
                } else {
                    addLog('N├úo foi poss├¡vel conectar ├á API Gemini', 'WARN');
                }
            })
            .catch(err => {
                addLog(`Erro ao testar conex├úo com API: ${err.message}`, 'ERROR');
            });
    });

    // ================== NOVAS FUN├ç├òES PARA AUTOMA├ç├âO ==================
    // Fun├º├úo para atualizar os elementos de UI com as configura├º├Áes atuais
    const updateCurrentSettings = (settings) => {
        // Verificar se temos as configura├º├Áes e elementos da UI
        if (!settings || !indexUI) {
            addLog('N├úo foi poss├¡vel atualizar configura├º├Áes na UI: dados ou elementos ausentes', 'WARN');
            return;
        }

        try {
            addLog(`Atualizando UI com novas configura├º├Áes: ${JSON.stringify(settings)}`, 'DEBUG');
            
            // Atualizar valores de lucro di├írio e stop loss
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
            
            // Atualizar configura├º├Áes de Gale
            if (indexUI.toggleGale && typeof settings.galeEnabled !== 'undefined') {
                indexUI.toggleGale.checked = settings.galeEnabled;
                addLog(`toggleGale atualizado para: ${settings.galeEnabled}`, 'DEBUG');
            }
            
            if (indexUI.galeSelect && typeof settings.galeLevel !== 'undefined') {
                indexUI.galeSelect.value = settings.galeLevel;
                if (indexUI.currentGale) {
                    if (settings.galeEnabled) {
                        indexUI.currentGale.textContent = `Gale: ${settings.galeLevel}`;
                        indexUI.currentGale.className = 'gale-status active';
                    } else {
                        indexUI.currentGale.textContent = 'Gale: Desativado';
                        indexUI.currentGale.className = 'gale-status inactive';
                    }
                }
            }
            
            // Atualizar status de automa├º├úo (padronizado)
            if (indexUI.automationStatus && typeof settings.autoActive !== 'undefined') {
                setAutomationStatusUI(settings.autoActive);
            }
            
            // Salvar as configura├º├Áes globalmente para acesso f├ícil
            window.currentSettings = settings;
            
            // For├ºa uma atualiza├º├úo da UI para garantir que as mudan├ºas sejam vis├¡veis
            setTimeout(() => {
                // Verifica elementos que podem n├úo ter sido atualizados
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
                if (indexUI.currentGale && typeof settings.galeLevel !== 'undefined') {
                    // Atualizar texto e classe do indicador de Gale
                    if (settings.galeEnabled) {
                        indexUI.currentGale.textContent = `Gale: ${settings.galeLevel}`;
                        indexUI.currentGale.className = 'gale-status active';
                    } else {
                        indexUI.currentGale.textContent = 'Gale: Desativado';
                        indexUI.currentGale.className = 'gale-status inactive';
                    }
                }
                
                addLog('Verifica├º├úo adicional de atualiza├º├úo da UI realizada', 'DEBUG');
            }, 100);
            
            addLog('Configura├º├Áes atualizadas na UI com sucesso', 'SUCCESS');
        } catch (error) {
            addLog(`Erro ao atualizar configura├º├Áes na UI: ${error.message}`, 'ERROR');
        }
    };

    // Fun├º├úo para calcular o lucro
    const sumeProfit = () => {
        const profit = document.querySelectorAll('.profit');
        let total = 0;
        profit.forEach((item) => {
            total += parseFloat(item.textContent.replace('R$ ', '')) || 0;
        });
        return total;
    };

    // Fun├º├úo para obter a aba ativa
    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // Fun├º├úo para testar a conex├úo com a API
    async function testGeminiConnection() {
        try {
            updateStatus('Testando conex├úo com Gemini...', 'info');
            addLog('Iniciando teste de conex├úo...');
            
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
                updateStatus('Conex├úo estabelecida!', 'success');
                addLog('Conex├úo com Gemini estabelecida com sucesso');
                return true;
            } else {
                throw new Error('Resposta inesperada da API');
            }
        } catch (error) {
            updateStatus(`Erro: ${error.message}`, 'error');
            addLog(`Erro no teste de conex├úo: ${error.message}`);
            return false;
        }
    }

    // Fun├º├úo para atualizar o contador
    const updateTradeCountdown = () => {
        const countdown = document.querySelector('#countdown');
        if (countdown) {
            countdown.textContent = `${tradeTime} minutos`;
            // Adicionar log para a atualiza├º├úo do contador
            addLog(`Contador atualizado para ${tradeTime} minutos`, 'INFO');
        }
    };

    // Fun├º├úo para iniciar o contador
    const startCountdown = () => {
        if (isAutomationRunning) {
            updateStatus('Automa├º├úo j├í est├í em execu├º├úo', 'error');
            return;
        }

        isAutomationRunning = true;
        updateAutomationStatus(true, false);
        updateTradeCountdown();
        
        addLog('Contador de automa├º├úo iniciado', 'INFO');

        const interval = setInterval(() => {
            tradeTime--;
            updateTradeCountdown();

            if (tradeTime <= 0) {
                clearInterval(interval);
                isAutomationRunning = false;
                updateAutomationStatus(false, false);
                updateStatus('Automa├º├úo conclu├¡da', 'success');
                addLog('Automa├º├úo conclu├¡da: contador chegou a zero', 'SUCCESS');
            }
        }, 1000);
    };

    // Fun├º├úo para cancelar o fechamento autom├ítico
    const cancelAutoClose = () => {
        if (automationTimeout) {
            clearTimeout(automationTimeout);
            automationTimeout = null;
            addLog('Temporizador de automa├º├úo cancelado', 'INFO');
        }
        isAutomationRunning = false;
        updateAutomationStatus(false, false);
        updateStatus('Opera├º├úo cancelada pelo usu├írio', 'info');
        addLog('Opera├º├úo cancelada manualmente pelo usu├írio', 'INFO');
    };

    // Fun├º├úo para capturar e analisar
    async function captureAndAnalyze() {
        try {
            addLog('Iniciando processo integrado de captura e an├ílise...', 'INFO');
            
            // Usar o m├│dulo de captura centralizado
            if (window.CaptureScreen) {
                // Capturar a tela para an├ílise usando a fun├º├úo centralizada
                await window.CaptureScreen.captureForAnalysis();
                addLog('Captura realizada com sucesso pelo m├│dulo centralizado', 'SUCCESS');
                // Executar a an├ílise com a imagem j├í capturada
                await runAnalysis();
            } else {
                // Fallback para o m├®todo antigo se o m├│dulo n├úo estiver dispon├¡vel
                addLog('M├│dulo CaptureScreen n├úo dispon├¡vel, tentando m├®todo alternativo', 'WARN');
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

    // Adicionar listeners para os bot├Áes de forma segura
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
            elements.startOperation.addEventListener('click', () => {
                // Verificar o estado atual da automa├º├úo no StateManager
                if (window.StateManager && typeof window.StateManager.getConfig === 'function') {
                    const currentConfig = window.StateManager.getConfig() || {};
                    const isAutomationActive = currentConfig.automation === true;
                    
                    // Verificar se o m├│dulo Hist├│ria est├í dispon├¡vel
                    if (window.TradeManager?.History) {
                        if (isAutomationActive) {
                            // Se a automa├º├úo j├í estiver ativa, apenas iniciar o monitoramento
                            addLog('Iniciando monitoramento de opera├º├Áes...', 'INFO');
                            window.TradeManager.History.startMonitoring()
                                .then(() => {
                                    updateStatus('Monitoramento de opera├º├Áes iniciado com sucesso', 'success');
                                })
                                .catch(error => {
                                    addLog(`Erro ao iniciar monitoramento: ${error.message}`, 'ERROR');
                                    updateStatus('Falha ao iniciar monitoramento', 'error');
                                });
                        } else {
                            // Se n├úo estiver ativa, apenas mostrar uma mensagem
                            addLog('Tentativa de iniciar monitoramento com automa├º├úo desativada', 'WARN');
                            updateStatus('A automa├º├úo est├í desativada. Ative-a nas configura├º├Áes.', 'warn');
                        }
                    } else {
                        // Fallback para mensagem de erro
                        addLog('M├│dulo de hist├│rico n├úo dispon├¡vel', 'ERROR');
                        updateStatus('M├│dulo de hist├│rico n├úo dispon├¡vel', 'error');
                    }
                } else {
                    // Se n├úo conseguir acessar o estado via StateManager
                    updateStatus('N├úo foi poss├¡vel verificar o status da automa├º├úo', 'error');
                }
            });
        }
        
        if (elements.cancelOperation) {
            elements.cancelOperation.addEventListener('click', () => {
                // Verificar o estado atual da automa├º├úo no StateManager
                if (window.StateManager && typeof window.StateManager.getConfig === 'function') {
                    const currentConfig = window.StateManager.getConfig() || {};
                    const isAutomationActive = currentConfig.automation === true;
                    
                    if (window.TradeManager?.History) {
                        if (isAutomationActive) {
                            // Se a automa├º├úo estiver ativa, apenas interromper o monitoramento sem alterar configura├º├úo
                            addLog('Interrompendo monitoramento de opera├º├Áes...', 'INFO');
                            window.TradeManager.History.stopMonitoring()
                                .then(() => {
                                    updateStatus('Monitoramento interrompido', 'info');
                                })
                                .catch(error => {
                                    addLog(`Erro ao interromper monitoramento: ${error.message}`, 'ERROR');
                                    updateStatus('Falha ao interromper monitoramento', 'error');
                                });
                        } else {
                            // Se n├úo estiver ativa, apenas mostrar uma mensagem
                            addLog('Tentativa de interromper monitoramento com automa├º├úo j├í desativada', 'WARN');
                            updateStatus('A automa├º├úo j├í est├í desativada', 'info');
                        }
                    } else {
                        // Fallback para fun├º├úo anterior sem alterar configura├º├úo
                        addLog('Cancelando opera├º├úo via m├®todo fallback...', 'INFO');
                        if (automationTimeout) {
                            clearTimeout(automationTimeout);
                            automationTimeout = null;
                            addLog('Temporizador de automa├º├úo cancelado', 'INFO');
                        }
                        updateStatus('Opera├º├úo cancelada pelo usu├írio', 'info');
                    }
                } else {
                    // Se n├úo conseguir acessar o estado via StateManager
                    updateStatus('N├úo foi poss├¡vel verificar o status da automa├º├úo', 'error');
                }
            });
        }
        
        if (elements.captureScreen) {
            elements.captureScreen.addEventListener('click', async () => {
                addLog('Bot├úo de captura clicado no index', 'INFO');
                
                try {
                    // Usar o sistema centralizado de captura
                    if (window.CaptureScreen && typeof window.CaptureScreen.captureAndShow === 'function') {
                        try {
                            // Chamar a fun├º├úo simplificada que captura e mostra em uma janela popup
                            await window.CaptureScreen.captureAndShow();
                            updateStatus('Captura de tela realizada com sucesso', 'success');
                        } catch (error) {
                            addLog(`Erro ao capturar tela: ${error.message}`, 'ERROR');
                            updateStatus('Falha na captura de tela', 'error');
                        }
                    } else {
                        // Se o m├│dulo n├úo estiver dispon├¡vel, carregar dinamicamente
                        addLog('M├│dulo de captura n├úo est├í dispon├¡vel, tentando carregamento din├ómico', 'WARN');
                        updateStatus('Carregando m├│dulo de captura...', 'info');
                        
                        // Tentar carregar o m├│dulo dinamicamente
                        const script = document.createElement('script');
                        script.src = '../content/capture-screen.js';
                        
                        // Promise para aguardar o carregamento do script
                        await new Promise((resolve, reject) => {
                            script.onload = () => {
                                addLog('M├│dulo de captura carregado dinamicamente', 'SUCCESS');
                                resolve();
                            };
                            script.onerror = (err) => {
                                addLog(`Erro ao carregar m├│dulo de captura: ${err}`, 'ERROR');
                                reject(new Error('Falha ao carregar m├│dulo de captura'));
                            };
                            document.head.appendChild(script);
                        });
                        
                        // Verificar novamente se o m├│dulo est├í dispon├¡vel ap├│s o carregamento
                        if (window.CaptureScreen && typeof window.CaptureScreen.captureAndShow === 'function') {
                            try {
                                await window.CaptureScreen.captureAndShow();
                                updateStatus('Captura realizada com sucesso', 'success');
                            } catch (captureError) {
                                addLog(`Erro ap├│s carregamento din├ómico: ${captureError.message}`, 'ERROR');
                                updateStatus('Falha na captura de tela', 'error');
                            }
                        } else {
                            addLog('M├│dulo carregado, mas fun├º├úo captureAndShow n├úo dispon├¡vel', 'ERROR');
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
                    addLog('Navigation n├úo est├í dispon├¡vel', 'ERROR');
                }
            });
        }
        
        if (elements.settingsBtn) {
            elements.settingsBtn.addEventListener('click', () => {
                if (window.Navigation) {
                    window.Navigation.openPage('settings');
                } else {
                    addLog('Navigation n├úo est├í dispon├¡vel', 'ERROR');
                }
            });
        }
    };

    // Inicializar quando o DOM estiver pronto - fun├º├úo separada para evitar duplica├º├úo
    function _setupLateInitialization() {
        // Inicializar sistema de logs
        initLogging();
        
        try {
            const manifestInfo = chrome.runtime.getManifest();
            addLog(`Sistema Trade Manager Pro v${manifestInfo.version} inicializado`, 'INFO');
            addLog(`Ambiente: ${manifestInfo.name} / ${navigator.userAgent}`, 'DEBUG');
        } catch (e) {
            addLog('Sistema Trade Manager Pro inicializado (vers├úo desconhecida)', 'INFO');
        }
        
        // Inicializar m├│dulo de hist├│rico
        initHistoryModule();
        
        // Configurar event listeners
        addEventListeners();
        addLog('Event listeners configurados com sucesso', 'DEBUG');
        
        // Configurar os bot├Áes de teste do sistema de Gale
        setupGaleTestButtons();
        
        // Inicializar o listener do StateManager para atualiza├º├Áes de configura├º├Áes
        initStateManagerListener();
        
        // Adicionar listener direto para mensagens da p├ígina de configura├º├Áes (mecanismo alternativo)
        window.addEventListener('message', (event) => {
            // Verificar se ├® uma mensagem de atualiza├º├úo de configura├º├Áes
            if (event.data && event.data.action === 'configUpdated' && event.data.settings) {
                addLog('Recebida mensagem direta de atualiza├º├úo de configura├º├Áes', 'INFO');
                
                const config = event.data.settings;
                // Atualizar campos da p├ígina principal
                updateCurrentSettings({
                    galeEnabled: config.gale.active,
                    galeLevel: config.gale.level,
                    dailyProfit: config.dailyProfit,
                    stopLoss: config.stopLoss,
                    tradeValue: config.value,
                    tradeTime: config.period,
                    autoActive: config.automation
                });
                                
                updateStatus('Configura├º├Áes atualizadas via mensagem direta', 'success', 2000);
                addLog('Configura├º├Áes atualizadas com sucesso via postMessage', 'SUCCESS');
            }
        });
        addLog('Listener de mensagens diretas configurado com sucesso', 'INFO');
        
        updateStatus('Sistema iniciado com sucesso!', 'success');
        addLog('Interface principal carregada e pronta', 'SUCCESS');
        
        // Verificar conex├úo com a extens├úo e processar opera├º├Áes pendentes
        checkExtensionConnection();
        
        // Tentar testar a conex├úo com a API Gemini
        testGeminiConnection()
            .then(connected => {
                if (connected) {
                    addLog('API Gemini conectada com sucesso', 'SUCCESS');
                } else {
                    addLog('N├úo foi poss├¡vel conectar ├á API Gemini', 'WARN');
                }
            })
            .catch(err => {
                addLog(`Erro ao testar conex├úo com API: ${err.message}`, 'ERROR');
            });
    }

    // Chamar a inicializa├º├úo tardia quando o documento estiver pronto
    document.addEventListener('DOMContentLoaded', _setupLateInitialization);

    // Configura├º├Áes padr├úo
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

    // Fun├º├úo para limpar configura├º├Áes antigas
    function clearOldConfig() {
        return new Promise((resolve) => {
            chrome.storage.sync.remove(['userConfig'], () => {
                addLog('Configura├º├Áes antigas removidas do storage.');
                resolve();
            });
        });
    }

    // Fun├º├úo para carregar configura├º├Áes
    function loadConfig() {
        return new Promise((resolve) => {
            addLog('Iniciando carregamento das configura├º├Áes...', 'INFO');
            updateStatus('Carregando configura├º├Áes...', 'info');

            // Utilizar o StateManager para carregar as configura├º├Áes
            if (window.StateManager) {
                addLog('Utilizando StateManager para carregar configura├º├Áes', 'INFO');
                window.StateManager.loadConfig()
                    .then(config => {
                        addLog('Configura├º├Áes carregadas via StateManager', 'SUCCESS');
                        
                        // Log espec├¡fico para status de automa├º├úo
                        addLog(`Status de automa├º├úo carregado: ${config.automation}`, 'DEBUG');
                        
                        // Atualizar campos da p├ígina principal
                        updateCurrentSettings({
                            galeEnabled: config.gale.active,
                            galeLevel: config.gale.level,
                            dailyProfit: config.dailyProfit,
                            stopLoss: config.stopLoss,
                            tradeValue: config.value,
                            tradeTime: config.period,
                            autoActive: config.automation
                        });
                        
                        // Atualizar visibilidade do painel de teste do Gale
                        updateGaleTestPanelVisibility(config.devMode);
                        
                        updateStatus('Configura├º├Áes carregadas com sucesso', 'success');
                        resolve(config);
                    })
                    .catch(error => {
                        addLog(`Erro ao carregar configura├º├Áes via StateManager: ${error.message}`, 'ERROR');
                        updateStatus('Erro ao carregar configura├º├Áes', 'error');
                        
                        // Em caso de erro, tentar usar a abordagem antiga como fallback
                        loadConfigLegacy()
                            .then(config => resolve(config))
                            .catch(err => {
                                addLog(`Erro tamb├®m no fallback: ${err.message}`, 'ERROR');
                                // Usar configura├º├Áes padr├úo em ├║ltimo caso
                                resolve(indexDefaultConfig);
                            });
                    });
            } else {
                // Fallback para o m├®todo antigo se o StateManager n├úo estiver dispon├¡vel
                addLog('StateManager n├úo encontrado, usando m├®todo legacy', 'WARN');
                loadConfigLegacy()
                    .then(config => resolve(config))
                    .catch(error => {
                        addLog(`Erro ao carregar configura├º├Áes: ${error.message}`, 'ERROR');
                        updateStatus('Erro ao carregar configura├º├Áes', 'error');
                        resolve(indexDefaultConfig);
                    });
            }
        });
    }

    // M├®todo legacy para carregar configura├º├Áes (para compatibilidade)
    function loadConfigLegacy() {
        return new Promise((resolve, reject) => {
            addLog('Utilizando m├®todo legacy para carregar configura├º├Áes', 'INFO');
            
            chrome.storage.sync.get(['userConfig'], (result) => {
                addLog(`Resultado do storage: ${JSON.stringify(result)}`, 'DEBUG');
                
                if (!result.userConfig || Object.keys(result.userConfig).length === 0) {
                    addLog('Configura├º├úo do usu├írio n├úo encontrada ou vazia. Usando configura├º├úo padr├úo.', 'INFO');
                    updateStatus('Usando configura├º├Áes padr├úo...', 'info');
                    
                    // Se n├úo houver configura├º├úo do usu├írio, usa a padr├úo
                    chrome.storage.sync.set({ userConfig: indexDefaultConfig }, () => {
                        addLog('Configura├º├Áes padr├úo salvas no storage.', 'INFO');
                        updateStatus('Configura├º├Áes padr├úo salvas', 'success');
                        
                        // Atualizar campos da p├ígina principal
                        updateCurrentSettings({
                            galeEnabled: indexDefaultConfig.gale.active,
                            galeLevel: indexDefaultConfig.gale.level,
                            dailyProfit: indexDefaultConfig.dailyProfit,
                            stopLoss: indexDefaultConfig.stopLoss,
                            tradeValue: indexDefaultConfig.value,
                            tradeTime: indexDefaultConfig.period,
                            autoActive: indexDefaultConfig.automation
                        });
                        
                        resolve(indexDefaultConfig);
                    });
                } else {
                    // Garantir que o per├¡odo seja um n├║mero inteiro
                    if (typeof result.userConfig.period === 'string') {
                        result.userConfig.period = parseInt(result.userConfig.period.replace(/[^0-9]/g, '')) || 1;
                    }
                    
                    addLog('Configura├º├úo do usu├írio encontrada e carregada.', 'INFO');
                    updateStatus('Configura├º├Áes do usu├írio carregadas', 'success');
                    
                    // Atualizar campos da p├ígina principal
                    updateCurrentSettings({
                        galeEnabled: result.userConfig.gale.active,
                        galeLevel: result.userConfig.gale.level,
                        dailyProfit: result.userConfig.dailyProfit,
                        stopLoss: result.userConfig.stopLoss,
                        tradeValue: result.userConfig.value,
                        tradeTime: result.userConfig.period,
                        autoActive: result.userConfig.automation
                    });
                    
                    resolve(result.userConfig);
                }
            });
        });
    }

    // Inicializa├º├úo do StateManager listener
    function initStateManagerListener() {
        if (window.StateManager) {
            addLog('Registrando listener para StateManager', 'INFO');
            
            // Registrar listener para atualiza├º├Áes de estado
            window.StateManager.subscribe((notification) => {
                // Formato de notifica├º├úo atualizado: {state, type, timestamp}
                const { state, type, timestamp } = notification;
                
                if (type === 'config') {
                    addLog(`Recebida atualiza├º├úo de configura├º├Áes do StateManager (${new Date(timestamp).toLocaleTimeString()})`, 'INFO');
                    
                    const config = state.config;
                    if (config) {
                        // Atualizar campos da p├ígina principal
                        updateCurrentSettings({
                            galeEnabled: config.gale.active,
                            galeLevel: config.gale.level,
                            dailyProfit: config.dailyProfit,
                            stopLoss: config.stopLoss,
                            tradeValue: config.value,
                            tradeTime: config.period,
                            autoActive: config.automation
                        });
                        
                        // Atualizar visibilidade do painel de teste do Gale baseado no modo desenvolvedor
                        updateGaleTestPanelVisibility(config.devMode);
                                              
                        updateStatus('Configura├º├Áes atualizadas', 'success', 2000);
                    }
                } 
                else if (type === 'automation') {
                    // Tratar atualiza├º├Áes espec├¡ficas do estado de automa├º├úo
                    addLog(`Recebida atualiza├º├úo de estado de AUTOMA├ç├âO (${new Date(timestamp).toLocaleTimeString()})`, 'WARN');
                    
                    const automationState = state.automation;
                    if (automationState) {
                        // Atualizar apenas a UI, sem modificar o estado
                        const isRunning = automationState.isRunning || false;
                        const automationStatusElement = document.querySelector('#automation-status');
                        if (automationStatusElement) {
                            automationStatusElement.textContent = `Automa├º├úo: ${isRunning ? 'Ativa' : 'Inativa'}`;
                            automationStatusElement.className = 'automation-status';
                            automationStatusElement.classList.add(isRunning ? 'active' : 'inactive');
                        }
                        
                        // Log adicional para depura├º├úo
                        addLog(`Estado de automa├º├úo atualizado na UI: isRunning=${isRunning}`, 'WARN');
                        
                        // Se houver uma opera├º├úo atual, podemos mostrar informa├º├Áes adicionais
                        if (automationState.currentOperation) {
                            addLog(`Opera├º├úo atual: ${JSON.stringify(automationState.currentOperation)}`, 'DEBUG');
                        }
                    }
                }
            });
            
            addLog('Listener registrado com sucesso', 'SUCCESS');
        } else {
            addLog('StateManager n├úo dispon├¡vel para registro de listener', 'WARN');
        }
    }

    // ================== ANALISADOR DE DADOS ==================
    class DataAnalyzer {
        constructor() {
            this.cache = {};
            this.processingQueue = [];
            this.isProcessing = false;
            
            // Inicializar
            addLog('Inicializando analisador de dados', 'DEBUG');
            
            // Expor m├®todos para a API global
            window.TRADE_ANALYZER_API = {
                analyze: this.analyze.bind(this),
                getAnalysisResult: this.getAnalysisResult.bind(this),
                clearCache: this.clearCache.bind(this)
            };
            
            addLog('API do analisador de dados exposta', 'DEBUG');
        }
        
        // M├®todo privado para logging da classe
        _log(message, level = 'DEBUG') {
            // Usar a fun├º├úo global de log se dispon├¡vel, adicionando prefix da classe
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
                    throw new Error('Dados inv├ílidos para an├ílise');
                }
                
                // Identificar o ativo
                const symbol = data.symbol || 'unknown';
                
                // Criar uma assinatura ├║nica para este conjunto de dados
                const dataSignature = `${symbol}_${data.candles.length}_${data.candles[0].time}_${data.candles[data.candles.length-1].time}`;
                
                // Verificar cache
                if (this.cache[dataSignature] && !options.forceReanalysis) {
                    this._log(`Usando resultado em cache para ${symbol}`, 'DEBUG');
                    return this.cache[dataSignature];
                }
                
                // Adicionar ├á fila de processamento
                return new Promise((resolve, reject) => {
                    this.processingQueue.push({
                        data,
                        options,
                        dataSignature,
                        resolve,
                        reject
                    });
                    
                    // Iniciar processamento se n├úo estiver em andamento
                    if (!this.isProcessing) {
                        this.processQueue();
                    }
                });
            } catch (error) {
                this._log(`Erro ao analisar dados: ${error.message}`, 'ERROR');
                throw error;
            }
        }
        
        // Processar fila de an├ílises
        async processQueue() {
            if (this.processingQueue.length === 0) {
                this.isProcessing = false;
                return;
            }
            
            this.isProcessing = true;
            const job = this.processingQueue.shift();
            
            try {
                this._log(`Processando an├ílise para ${job.data.symbol || 'desconhecido'}`, 'DEBUG');
                
                // Realizar an├ílise
                const result = await this.performAnalysis(job.data, job.options);
                
                // Armazenar no cache
                this.cache[job.dataSignature] = result;
                
                // Limitar tamanho do cache
                this.manageCacheSize();
                
                // Resolver promessa
                job.resolve(result);
            } catch (error) {
                this._log(`Erro na an├ílise: ${error.message}`, 'ERROR');
                job.reject(error);
            } finally {
                // Continuar processamento
                setTimeout(() => this.processQueue(), 10);
            }
        }
        
        // Realizar an├ílise dos dados
        async performAnalysis(data, options) {
            // Implementa├º├úo real da an├ílise
            const { candles, symbol } = data;
            
            // Resultados da an├ílise
            const result = {
                symbol,
                timestamp: Date.now(),
                indicators: {},
                signals: [],
                patterns: []
            };
            
            try {
                // Extrair dados para c├ílculos
                const closePrices = candles.map(c => c.close);
                const highPrices = candles.map(c => c.high);
                const lowPrices = candles.map(c => c.low);
                const volumes = candles.map(c => c.volume);
                
                // Calcular m├®dias m├│veis (exemplo)
                result.indicators.sma20 = this.calculateSMA(closePrices, 20);
                result.indicators.sma50 = this.calculateSMA(closePrices, 50);
                result.indicators.sma200 = this.calculateSMA(closePrices, 200);
                
                // Detectar sinais com base nos indicadores
                this.detectSignals(result);
                
                return result;
            } catch (error) {
                this._log(`Erro durante a an├ílise de ${symbol}: ${error.message}`, 'ERROR');
                throw error;
            }
        }
        
        // C├ílculo de M├®dia M├│vel Simples
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
        
        // Obter resultado de an├ílise do cache
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
        
        // Limpar cache de an├ílises
        clearCache() {
            this.cache = {};
            this._log('Cache de an├ílises limpo', 'INFO');
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
                
                this._log(`Cache de an├ílises otimizado: ${keysToRemove.length} itens removidos`, 'DEBUG');
            }
        }
    }

    // Inicializar analisador de dados em todas as p├íginas
    const analyzer = new DataAnalyzer();

    // ================== LISTENERS ==================
    document.addEventListener('DOMContentLoaded', () => {
        // Verificar se estamos na p├ígina de an├ílise
        if (window.location.pathname.includes('/analysis.html')) {
            addLog('Inicializando p├ígina de an├ílise', 'INFO');
            
            // Configurar ├írea de exibi├º├úo de gr├íficos
            const chartContainer = document.getElementById('chart-container');
            if (chartContainer) {
                addLog('Container de gr├ífico encontrado, configurando...', 'DEBUG');
                
                // Configura├º├úo de bot├Áes e controles
                const symbolInput = document.getElementById('symbol-input');
                const timeframeSelect = document.getElementById('timeframe-select');
                const loadDataBtn = document.getElementById('load-data-btn');
                
                if (symbolInput && timeframeSelect && loadDataBtn) {
                    loadDataBtn.addEventListener('click', () => {
                        const symbol = symbolInput.value.trim().toUpperCase();
                        const timeframe = timeframeSelect.value;
                        
                        if (!symbol) {
                            addLog('S├¡mbolo n├úo informado', 'WARN');
                            return;
                        }
                        
                        addLog(`Carregando dados para ${symbol} (${timeframe})`, 'INFO');
                        
                        // Simula├º├úo de carregamento de dados
                        setTimeout(() => {
                            try {
                                // Dados simulados para teste
                                const simulatedData = generateMockData(symbol, timeframe);
                                
                                // Analisar dados
                                analyzer.analyze(simulatedData)
                                    .then(result => {
                                        addLog(`An├ílise conclu├¡da para ${symbol}`, 'SUCCESS');
                                        renderAnalysisResults(result);
                                    })
                                    .catch(error => {
                                        addLog(`Falha na an├ílise: ${error.message}`, 'ERROR');
                                    });
                            } catch (error) {
                                addLog(`Erro ao processar dados: ${error.message}`, 'ERROR');
                            }
                        }, 1000);
                    });
                } else {
                    addLog('Elementos de controle n├úo encontrados', 'ERROR');
                }
            } else {
                addLog('Container de gr├ífico n├úo encontrado', 'ERROR');
            }
        }
    });

    // Fun├º├úo para gerar dados simulados
    function generateMockData(symbol, timeframe) {
        const candles = [];
        const now = Date.now();
        let lastPrice = Math.random() * 1000 + 100; // Pre├ºo inicial entre 100 e 1100
        
        // Gerar candles
        for (let i = 0; i < 200; i++) {
            const time = now - (200 - i) * getTimeframeMinutes(timeframe) * 60 * 1000;
            const range = lastPrice * 0.02; // Varia├º├úo de 2%
            
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

    // Renderizar resultados da an├ílise
    function renderAnalysisResults(result) {
        try {
            const resultsContainer = document.getElementById('analysis-results');
            if (!resultsContainer) {
                throw new Error('Container de resultados n├úo encontrado');
            }
            
            // Limpar container
            resultsContainer.innerHTML = '';
            
            // Criar cabe├ºalho
            const header = document.createElement('div');
            header.className = 'analysis-header';
            header.innerHTML = `<h3>An├ílise de ${result.symbol}</h3>
                              <p>Atualizada em: ${new Date(result.timestamp).toLocaleString()}</p>`;
            resultsContainer.appendChild(header);
            
            // Criar se├º├úo de indicadores
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
            
            // Criar se├º├úo de sinais
            const signalsSection = document.createElement('div');
            signalsSection.className = 'signals-section';
            signalsSection.innerHTML = `<h4>Sinais (${result.signals.length})</h4>`;
            
            if (result.signals.length > 0) {
                const signalsList = document.createElement('ul');
                result.signals.forEach(signal => {
                    const item = document.createElement('li');
                    item.className = `signal-item ${signal.significance.toLowerCase()}`;
                    item.innerHTML = `<strong>${signal.type}</strong>: ${signal.indicator1} ├ù ${signal.indicator2}`;
                    signalsList.appendChild(item);
                });
                signalsSection.appendChild(signalsList);
            } else {
                signalsSection.innerHTML += '<p>Nenhum sinal detectado</p>';
            }
            
            resultsContainer.appendChild(signalsSection);
            
            addLog('Resultados da an├ílise renderizados', 'SUCCESS');
        } catch (error) {
            addLog(`Erro ao renderizar resultados: ${error.message}`, 'ERROR');
        }
    }

    // Fun├º├úo unificada para logs e status
    const logAndUpdateStatus = (message, level = 'INFO', source = 'index.js', showStatus = true, duration = 3000) => {
        // Log para o sistema centralizado
        addLog(message, level);
        
        // Atualizar o status vis├¡vel se solicitado
        if (showStatus) {
            // Mapear n├¡vel de log para tipo de status
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

    // Fun├º├úo interna para atualizar apenas a UI de status, sem registrar logs
    const updateStatusUI = (message, type = 'info', duration = 3000) => {
        try {
            // Registrar no sistema de logs centralizado
            addLog(`Status UI atualizado: ${message}`, type.toUpperCase());
            
            // Buscar o elemento de status
            const statusElement = document.getElementById('status-processo');
            if (statusElement) {
                // Remover classes espec├¡ficas, mas manter a classe base 'status-processo'
                statusElement.className = 'status-processo';
                
                // Adicionar a classe apropriada
                statusElement.classList.add(type, 'visible');
                
                // Definir o texto
                statusElement.textContent = message;
                
                // Auto-limpar ap├│s dura├º├úo
                if (duration > 0) {
                    setTimeout(() => {
                        statusElement.classList.remove('visible');
                    }, duration);
                }
            } else {
                addLog('Elemento de status n├úo encontrado na UI', 'WARN');
            }
        } catch (error) {
            console.error(`Erro ao atualizar UI de status: ${error.message}`);
            addLog(`Erro ao atualizar UI de status: ${error.message}`, 'ERROR');
        }
    };

    //Adicionar um listener para mensagens do chrome.runtime
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Verificar se ├® uma mensagem de atualiza├º├úo de configura├º├Áes
        if (message && message.action === 'configUpdated' && message.settings) {
            addLog('Recebida mensagem via chrome.runtime para atualiza├º├úo de configura├º├Áes', 'INFO');
            
            const config = message.settings;
            // Atualizar campos da p├ígina principal
            updateCurrentSettings({
                galeEnabled: config.gale.active,
                galeLevel: config.gale.level,
                dailyProfit: config.dailyProfit,
                stopLoss: config.stopLoss,
                tradeValue: config.value,
                tradeTime: config.period,
                autoActive: config.automation
            });
            
            logAndUpdateStatus('Configura├º├Áes atualizadas via runtime', 'SUCCESS', 'index.js', true, 2000);
            addLog('Configura├º├Áes atualizadas com sucesso via chrome.runtime', 'SUCCESS');
            
            // Responder ├á mensagem se necess├írio
            if (sendResponse) {
                sendResponse({ success: true });
            }
        }
        
        // Retornar true para indicar que a resposta pode ser ass├¡ncrona
        return true;
    });

    // Fun├º├úo para verificar e processar opera├º├Áes pendentes
    const checkPendingOperations = () => {
        try {
            // Verificar se o contexto da extens├úo ├® v├ílido
            const isExtensionContextValid = () => {
                try {
                    return chrome.runtime && chrome.runtime.id;
                } catch (e) {
                    return false;
                }
            };

            if (!isExtensionContextValid()) {
                console.log('Contexto da extens├úo inv├ílido, n├úo ├® poss├¡vel processar opera├º├Áes pendentes');
                return;
            }

            // Recuperar opera├º├Áes pendentes
            const pendingOperations = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
            if (pendingOperations.length === 0) {
                return;
            }

            console.log(`Encontradas ${pendingOperations.length} opera├º├Áes pendentes para processamento`);
            logAndUpdateStatus(`Processando ${pendingOperations.length} opera├º├Áes pendentes`, 'INFO', 'trade-execution', true);

            // Limpar opera├º├Áes pendentes imediatamente para evitar processamento duplicado
            localStorage.removeItem('pendingOperations');

            // Processar no m├íximo 5 opera├º├Áes para evitar sobrecarga
            const operationsToProcess = pendingOperations.slice(0, 5);
            
            // Executar cada opera├º├úo pendente com intervalo
            operationsToProcess.forEach((op, index) => {
                setTimeout(() => {
                    try {
                        logAndUpdateStatus(`Executando opera├º├úo pendente: ${op.action}`, 'INFO', 'trade-execution', true);
                        
                        // Enviar para o background
                        chrome.runtime.sendMessage({ 
                            action: 'EXECUTE_TRADE_ACTION', 
                            tradeAction: op.action
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                logAndUpdateStatus(`Falha ao executar opera├º├úo pendente: ${chrome.runtime.lastError.message}`, 'ERROR', 'trade-execution', true);
                                return;
                            }
                            
                            if (response && response.success) {
                                logAndUpdateStatus(`Opera├º├úo pendente ${op.action} executada com sucesso`, 'SUCCESS', 'trade-execution', true);
                            } else {
                                const errorMsg = response ? response.error : 'Sem resposta do background';
                                logAndUpdateStatus(`Falha na execu├º├úo pendente: ${errorMsg}`, 'ERROR', 'trade-execution', true);
                            }
                        });
                    } catch (error) {
                        logAndUpdateStatus(`Erro ao executar opera├º├úo pendente: ${error.message}`, 'ERROR', 'trade-execution', true);
                    }
                }, index * 2000); // Executar a cada 2 segundos
            });
            
            // Se houver mais opera├º├Áes, armazenar para processamento posterior
            if (pendingOperations.length > 5) {
                const remainingOperations = pendingOperations.slice(5);
                localStorage.setItem('pendingOperations', JSON.stringify(remainingOperations));
                logAndUpdateStatus(`${remainingOperations.length} opera├º├Áes pendentes restantes ser├úo processadas posteriormente`, 'INFO', 'trade-execution', true);
            }
        } catch (error) {
            console.error('Erro ao processar opera├º├Áes pendentes:', error);
        }
    };

    // Adicionar fun├º├úo para verificar a conex├úo com a extens├úo e recuperar logs e opera├º├Áes pendentes
    const checkExtensionConnection = () => {
        // Verificar se o contexto da extens├úo ├® v├ílido
        const isExtensionContextValid = () => {
            try {
                return chrome.runtime && chrome.runtime.id;
            } catch (e) {
                return false;
            }
        };

        if (isExtensionContextValid()) {
            addLog('Conex├úo com a extens├úo estabelecida', 'SUCCESS');
            
            // Verificar opera├º├Áes pendentes
            checkPendingOperations();
            
            // Verificar logs pendentes
            if (window.LogSystem && typeof window.LogSystem.syncPendingLogs === 'function') {
                window.LogSystem.syncPendingLogs();
            }
        } else {
            addLog('Contexto da extens├úo inv├ílido, tentando novamente em 5 segundos...', 'WARN');
            setTimeout(checkExtensionConnection, 5000);
        }
    };

    // Inicializar integra├º├úo com o m├│dulo de hist├│rico
    const initHistoryModule = () => {
        try {
            // Verificar se o m├│dulo j├í foi inicializado
            if (historyModuleInitialized) return;
            
            // Verificar se o m├│dulo est├í dispon├¡vel
            if (!window.TradeManager?.History) {
                addLog('M├│dulo de hist├│rico n├úo dispon├¡vel. O monitoramento de opera├º├Áes n├úo estar├í ativo.', 'WARN');
                return false;
            }
            
            addLog('Inicializando integra├º├úo com m├│dulo de hist├│rico...', 'INFO');
            
            // Inicializar o m├│dulo se ainda n├úo estiver inicializado
            if (typeof window.TradeManager.History.init === 'function') {
                window.TradeManager.History.init();
            }
            
            historyModuleInitialized = true;
            addLog('Integra├º├úo com m├│dulo de hist├│rico conclu├¡da', 'SUCCESS');
            return true;
        } catch (error) {
            addLog(`Erro ao inicializar m├│dulo de hist├│rico: ${error.message}`, 'ERROR');
            return false;
        }
    };

    // Adicionar um listener para mensagens vindas de iframes e do background
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('message', (event) => {
            // Verificar se ├® uma mensagem de atualiza├º├úo de status
            if (event.data && event.data.action === 'updateStatus') {
                // Chamar a fun├º├úo de atualiza├º├úo de status
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
            // Usar a fun├º├úo de log interna de index.js se dispon├¡vel, ou console.log como fallback
            const logFunction = typeof sendToLogSystem === 'function' ? sendToLogSystem : console.log;
            logFunction(`Mensagem runtime recebida em index.js: action=${message.action}, type=${message.type}, source=${sender.id}`, 'DEBUG');

            // Verificar se estamos no contexto da extens├úo
            const isExtensionContext = () => {
                return window.location.href.includes('chrome-extension://');
            };

            // Handler para mensagens de status
            if (message.action === 'updateStatus') {
                // S├│ processa se estiver no contexto da extens├úo
                if (isExtensionContext()) {
                    logFunction(`Handler 'updateStatus' ativado por mensagem: ${message.message}`, 'DEBUG');
                    updateStatus(
                        message.message,
                        message.type || 'info',
                        message.duration || 3000
                    );
                    sendResponse({ success: true, status_updated_by_action_updateStatus: true });
                } else {
                    // Se n├úo estiver no contexto da extens├úo, apenas responde com sucesso
                    sendResponse({ success: true, status_ignored_not_extension_context: true });
                }
                return true;
            }

            // Adicione aqui outros 'else if (message.action === 'ALGUMA_OUTRA_ACTION')' que index.js deva tratar
            // e para os quais deva enviar uma resposta.
            // Se algum desses handlers for ass├¡ncrono, ele deve retornar true e chamar sendResponse mais tarde.

            // Para mensagens n├úo explicitamente tratadas acima (ex: 'logsCleaned' que ├® recebida mas n├úo tem um handler espec├¡fico aqui):
            // N├úo indicar uma resposta ass├¡ncrona, pois n├úo vamos enviar uma.
            // Isso evita o erro "A listener indicated an asynchronous response by returning true, 
            // but the message channel closed before a response was received" para essas mensagens.
            // Se o remetente original da mensagem n├úo tratada tinha um callback, ele receber├í um erro de port closed,
            // o que ├® esperado se este listener n├úo foi feito para responder a essa mensagem espec├¡fica.
            // No caso de 'logsCleaned', o emissor original (log-sys.js) n├úo tem callback, ent├úo est├í tudo bem.
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
                console.warn('Bot├Áes de teste de gale n├úo encontrados');
                return;
            }
            
            // Fun├º├úo para atualizar o display de status do gale
            const updateGaleStatusDisplay = (status) => {
                if (galeLevelDisplay) {
                    galeLevelDisplay.textContent = `N├¡vel ${status.level || 0}`;
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
            
            // Bot├úo para simular perda e aplicar gale
            simulateLossBtn.addEventListener('click', () => {
                if (window.GaleSystem) {
                    const result = window.GaleSystem.simulateGale();
                    updateStatus(`Simula├º├úo de perda: ${result.message}`, result.success ? 'success' : 'error');
                    
                    // Atualizar display
                    const updatedStatus = window.GaleSystem.getStatus();
                    updateGaleStatusDisplay(updatedStatus);
                } else {
                    updateStatus('Sistema de Gale n├úo est├í dispon├¡vel', 'error');
                }
            });
            
            // Bot├úo para simular ganho e resetar gale
            simulateWinBtn.addEventListener('click', () => {
                if (window.GaleSystem) {
                    const result = window.GaleSystem.simulateReset();
                    updateStatus(`Simula├º├úo de ganho: ${result.message}`, result.success ? 'success' : 'info');
                    
                    // Atualizar display
                    const updatedStatus = window.GaleSystem.getStatus();
                    updateGaleStatusDisplay(updatedStatus);
                } else {
                    updateStatus('Sistema de Gale n├úo est├í dispon├¡vel', 'error');
                }
            });
            
            // Bot├úo para verificar status do gale
            checkGaleStatusBtn.addEventListener('click', () => {
                if (window.GaleSystem) {
                    const status = window.GaleSystem.getStatus();
                    updateStatus(`Status do Gale: N├¡vel ${status.level}, Pr├│x. valor: R$ ${status.nextValue}`, 'info');
                    updateGaleStatusDisplay(status);
                    
                    // Adicionar log com detalhes completos
                    addLog(`Status do Gale - N├¡vel: ${status.level}, Ativo: ${status.active}, Valor original: ${status.originalValue}, Pr├│ximo valor: ${status.nextValue}`, 'INFO');
                } else {
                    updateStatus('Sistema de Gale n├úo est├í dispon├¡vel', 'error');
                }
            });
            
            addLog('Bot├Áes de teste do sistema de Gale configurados', 'INFO');
            
            // =================== CONFIGURAR BOT├òES DE TESTE DE ATIVOS ===================
            
            // Obter elementos dos bot├Áes de teste de ativos
            const testOpenAssetModalBtn = document.getElementById('test-open-asset-modal');
            const testFindBestAssetBtn = document.getElementById('test-find-best-asset');
            const testSwitchToCryptoBtn = document.getElementById('test-switch-to-crypto');
            const testSwitchToCurrencyBtn = document.getElementById('test-switch-to-currency');
            const minPayoutInput = document.getElementById('min-payout-input');
            const assetTestResult = document.getElementById('asset-test-result');
            
            // Fun├º├úo para atualizar resultado dos testes de ativos
            const updateAssetTestResult = (message, isError = false) => {
                if (assetTestResult) {
                    assetTestResult.innerHTML = message;
                    assetTestResult.style.color = isError ? '#d32f2f' : '#333';
                    assetTestResult.style.backgroundColor = isError ? '#ffebee' : '#f9f9f9';
                }
            };
            
            // Fun├º├úo auxiliar para formatar lista de ativos
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
                            updateAssetTestResult(`Ô£à ${response.message}`);
                        } else {
                            updateAssetTestResult(`ÔØî ${response?.error || 'Falha ao abrir modal'}`, true);
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
                            let resultText = `Ô£à ${response.message}<br><br>`;
                            resultText += `<strong>Todos os ativos encontrados:</strong><br>`;
                            resultText += formatAssetsList(response.allAssets);
                            updateAssetTestResult(resultText);
                        } else {
                            let errorText = `ÔØî ${response?.error || 'Falha ao buscar ativo'}`;
                            if (response?.allAssets && response.allAssets.length > 0) {
                                errorText += `<br><br><strong>Ativos dispon├¡veis:</strong><br>`;
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
                            let resultText = `Ô£à ${response.message}<br><br>`;
                            resultText += `<strong>Ativos de ${response.category}:</strong><br>`;
                            resultText += formatAssetsList(response.assets);
                            updateAssetTestResult(resultText);
                        } else {
                            updateAssetTestResult(`ÔØî ${response?.error || 'Falha ao mudar categoria'}`, true);
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
                            let resultText = `Ô£à ${response.message}<br><br>`;
                            resultText += `<strong>Ativos de ${response.category}:</strong><br>`;
                            resultText += formatAssetsList(response.assets);
                            updateAssetTestResult(resultText);
                        } else {
                            updateAssetTestResult(`ÔØî ${response?.error || 'Falha ao mudar categoria'}`, true);
                        }
                    });
                });
            }
            
            addLog('Bot├Áes de teste de ativos configurados', 'INFO');

            // =================== BOT├òES DE DEBUG DO MODAL ===================
            // Configurar bot├Áes de debug para testar abertura/fechamento do modal
            const debugOpenModalBtn = document.getElementById('debug-open-modal');
            const debugCloseModalBtn = document.getElementById('debug-close-modal');
            const debugCheckStatusBtn = document.getElementById('debug-check-status');
            const debugToggleModalBtn = document.getElementById('debug-toggle-modal');
            const modalDebugResult = document.getElementById('modal-debug-result');

            // Fun├º├úo para atualizar resultado do debug
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
                    updateModalDebugResult('­ƒöä Executando: AssetManager.openAssetModal()...');
                    
                    chrome.runtime.sendMessage({
                        action: 'TEST_OPEN_ASSET_MODAL'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            updateModalDebugResult(`ÔØî ERRO: ${chrome.runtime.lastError.message}`, true);
                            return;
                        }
                        
                        if (response && response.success) {
                            updateModalDebugResult(`Ô£à SUCESSO: ${response.message}`);
                        } else {
                            updateModalDebugResult(`ÔØî FALHA: ${response?.error || 'Erro desconhecido'}`, true);
                        }
                    });
                });
            }

            // Event listener para fechar modal (debug)
            if (debugCloseModalBtn) {
                debugCloseModalBtn.addEventListener('click', () => {
                    updateModalDebugResult('­ƒöä Executando: AssetManager.closeAssetModal()...');
                    
                    chrome.runtime.sendMessage({
                        action: 'CLOSE_ASSET_MODAL'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            updateModalDebugResult(`ÔØî ERRO: ${chrome.runtime.lastError.message}`, true);
                            return;
                        }
                        
                        if (response && response.success) {
                            updateModalDebugResult(`Ô£à SUCESSO: ${response.message}`);
                        } else {
                            updateModalDebugResult(`ÔØî FALHA: ${response?.error || 'Erro desconhecido'}`, true);
                        }
                    });
                });
            }

            // Event listener para verificar status do modal
            if (debugCheckStatusBtn) {
                debugCheckStatusBtn.addEventListener('click', () => {
                    updateModalDebugResult('­ƒöì Verificando status do modal...');
                    
                    // Executar script para verificar status do modal na p├ígina
                    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                        if (!tabs || !tabs.length) {
                            updateModalDebugResult('ÔØî ERRO: Aba ativa n├úo encontrada', true);
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
                                    currentAsset: currentAsset ? currentAsset.textContent.trim() : 'N├úo detectado',
                                    timestamp: new Date().toLocaleTimeString()
                                };
                            }
                        }, (results) => {
                            if (chrome.runtime.lastError) {
                                updateModalDebugResult(`ÔØî ERRO: ${chrome.runtime.lastError.message}`, true);
                                return;
                            }
                            
                            if (results && results[0] && results[0].result) {
                                const status = results[0].result;
                                let statusText = `­ƒôè STATUS DO MODAL [${status.timestamp}]:\n`;
                                statusText += `ÔÇó Bot├úo de controle: ${status.assetButtonExists ? 'Ô£à' : 'ÔØî'}\n`;
                                statusText += `ÔÇó Modal ativo (classe): ${status.modalIsActive ? 'Ô£à ABERTO' : 'ÔØî FECHADO'}\n`;
                                statusText += `ÔÇó Modal existe: ${status.modalExists ? 'Ô£à' : 'ÔØî'}\n`;
                                statusText += `ÔÇó Modal vis├¡vel: ${status.modalVisible ? 'Ô£à' : 'ÔØî'}\n`;
                                statusText += `ÔÇó Ativo atual: ${status.currentAsset}`;
                                
                                updateModalDebugResult(statusText.replace(/\n/g, '<br>'));
                            } else {
                                updateModalDebugResult('ÔØî ERRO: Nenhum resultado retornado', true);
                            }
                        });
                    });
                });
            }

            // Event listener para toggle do modal (abrir/fechar automaticamente)
            if (debugToggleModalBtn) {
                debugToggleModalBtn.addEventListener('click', () => {
                    updateModalDebugResult('­ƒöä Executando toggle do modal...');
                    
                    // Primeiro verificar status
                    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                        if (!tabs || !tabs.length) {
                            updateModalDebugResult('ÔØî ERRO: Aba ativa n├úo encontrada', true);
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
                                updateModalDebugResult(`ÔØî ERRO: ${chrome.runtime.lastError.message}`, true);
                                return;
                            }
                            
                            const isModalOpen = results && results[0] && results[0].result;
                            const action = isModalOpen ? 'CLOSE_ASSET_MODAL' : 'TEST_OPEN_ASSET_MODAL';
                            const actionText = isModalOpen ? 'fechar' : 'abrir';
                            
                            updateModalDebugResult(`­ƒöä Modal est├í ${isModalOpen ? 'ABERTO' : 'FECHADO'}, tentando ${actionText}...`);
                            
                            chrome.runtime.sendMessage({
                                action: action
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    updateModalDebugResult(`ÔØî ERRO: ${chrome.runtime.lastError.message}`, true);
                                    return;
                                }
                                
                                if (response && response.success) {
                                    updateModalDebugResult(`Ô£à SUCESSO: Modal ${isModalOpen ? 'fechado' : 'aberto'} com sucesso!`);
                                } else {
                                    updateModalDebugResult(`ÔØî FALHA: ${response?.error || 'Erro desconhecido'}`, true);
                                }
                            });
                        });
                    });
                });
            }







            addLog('Bot├Áes de debug do modal configurados', 'INFO');
            
            // =================== CONFIGURA├ç├òES DE ATIVOS MOVIDAS PARA SETTINGS.HTML ===================
            // As configura├º├Áes de troca de ativos agora est├úo na p├ígina de configura├º├Áes
            
            // Adicionar listener para atualiza├º├úo autom├ítica do status do Gale
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                // Verificar se ├® uma mensagem de atualiza├º├úo do Gale
                if (message.action === 'GALE_UPDATED' || message.action === 'GALE_RESET') {
                    if (window.GaleSystem) {
                        const updatedStatus = window.GaleSystem.getStatus();
                        updateGaleStatusDisplay(updatedStatus);
                        addLog(`Status do Gale atualizado automaticamente - N├¡vel: ${updatedStatus.level}, Valor atual: ${updatedStatus.currentValue}`, 'DEBUG');
                    }
                }
                return true;
            });
        } catch (error) {
            console.error('Erro ao configurar bot├Áes de teste do gale:', error);
            addLog(`Erro ao configurar bot├Áes de teste do gale: ${error.message}`, 'ERROR');
        }
    }

    // Fun├º├úo para atualizar a visibilidade do painel de teste do Gale baseado no modo desenvolvedor
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

    // Adicionar um listener para mensagens do chrome.runtime
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('index.js: Mensagem recebida:', message); 

            // Handler para o status global existente (usado por REQUEST_INDEX_DIRECT_UPDATE_STATUS)
            if (message.type === 'REQUEST_INDEX_DIRECT_UPDATE_STATUS') {
                console.log('index.js: Handler para REQUEST_INDEX_DIRECT_UPDATE_STATUS acionado.', message); 
                addLog(`index.js: Recebido REQUEST_INDEX_DIRECT_UPDATE_STATUS ('${message.text}')`, 'DEBUG');
                // Esta fun├º├úo j├í existe e deve ser usada para o status global
                if (window.IndexUIFunctions && typeof window.IndexUIFunctions.updateStatus === 'function') {
                    window.IndexUIFunctions.updateStatus(
                        message.text,
                        message.level || 'info',
                        typeof message.duration === 'number' ? message.duration : 5000
                    );
                    sendResponse({ success: true, status_updated: true });
                } else {
                    addLog('index.js: window.IndexUIFunctions.updateStatus n├úo dispon├¡vel.', 'ERROR');
                    sendResponse({ success: false, error: 'updateStatus function not found' });
                }
                return false; // Resposta s├¡ncrona.
            }

            // Manter outros handlers existentes (UPDATE_STATUS_MESSAGE, REQUEST_UI_AUTOMATION_STATUS_UPDATE, configUpdated)
            if (message.action === 'updateStatus' || message.type === 'UPDATE_STATUS_MESSAGE') {
                // ... (c├│digo existente)
                if (sendResponse) sendResponse({ success: true, received: true });
                return true; 
            }

            if (message.type === 'REQUEST_UI_AUTOMATION_STATUS_UPDATE') {
                // Atualizar status de automa├º├úo quando solicitado externamente
                try {
                    const isActive = message.data?.isActive === true;
                    
                    // Atualizar apenas a UI
                    const automationStatusElement = document.querySelector('#automation-status');
                    if (automationStatusElement) {
                        automationStatusElement.textContent = `Automa├º├úo: ${isActive ? 'Ativa' : 'Inativa'}`;
                        automationStatusElement.className = 'automation-status';
                        automationStatusElement.classList.add(isActive ? 'active' : 'inactive');
                        
                        if (isActive) {
                            automationStatusElement.style.color = '#4CAF50';
                            automationStatusElement.style.fontWeight = 'bold';
                        } else {
                            automationStatusElement.style.color = '#F44336';
                            automationStatusElement.style.fontWeight = 'normal';
                        }
                        
                        addLog(`UI de status de automa├º├úo atualizada via mensagem: ${isActive ? 'Ativo' : 'Inativo'}`, 'DEBUG');
                    }
                    
                    if (sendResponse) sendResponse({ success: true, updated: true });
                } catch (err) {
                    if (sendResponse) sendResponse({ success: false, error: err.message });
                }
                return false; 
            }

            if (message && message.action === 'configUpdated' && message.settings) {
                // ... (c├│digo existente)
                if (sendResponse) {
                        sendResponse({ success: true, received: true });
                }
                return false; 
            }
            
            // Fallback se nenhuma mensagem foi explicitamente tratada e esperava uma resposta s├¡ncrona.
            // Se um sender envia uma mensagem sem esperar callback, e nenhum handler retorna true,
            // n├úo h├í problema. Se um sender espera callback, um dos handlers DEVE retornar true ou chamar sendResponse.
            // Para seguran├ºa, se n├úo foi tratado, e pode haver um sender esperando, logar.
            // console.warn('index.js: Mensagem n├úo tratada por nenhum handler espec├¡fico que retorna s├¡ncronamente.', message);
            // sendResponse({success: false, error: 'Message not handled by index.js'}); // Opcional: responder que n├úo foi tratado
            return false; // Default para evitar port closed se nenhum outro handler retornou true.
        });
    }

    // Fun├º├úo para iniciar o monitoramento (usado como fallback)
    const startTradeMonitoring = () => {
        addLog('Iniciando monitoramento via m├®todo fallback...', 'INFO');
        
        // Atualizar o status de automa├º├úo no StateManager primeiro, se dispon├¡vel
        if (window.StateManager && typeof window.StateManager.saveConfig === 'function') {
            // Obter configura├º├úo atual
            const currentConfig = window.StateManager.getConfig() || {};
            
            // Ativar automa├º├úo na configura├º├úo
            currentConfig.automation = true;
            
            // Salvar no StateManager (que notificar├í os listeners)
            window.StateManager.saveConfig(currentConfig)
                .then(() => {
                    addLog('Status de automa├º├úo atualizado com sucesso no StateManager (fallback)', 'SUCCESS');
                    // Continuar com o startup da opera├º├úo
                    startAutomationProcess();
                })
                .catch(error => {
                    addLog(`Erro ao atualizar configura├º├úo: ${error.message}`, 'ERROR');
                    updateStatus('Falha ao iniciar automa├º├úo', 'error');
                });
        } else {
            // Caso n├úo tenha StateManager, atualizar diretamente
            isAutomationRunning = true;
            updateAutomationStatus(true, false);
            startAutomationProcess();
        }
    };
    
    // Fun├º├úo para realmente iniciar o processo de automa├º├úo ap├│s configura├º├úo atualizada
    const startAutomationProcess = () => {
        // Verificar o estado atual da automa├º├úo no StateManager
        if (window.StateManager && typeof window.StateManager.getConfig === 'function') {
            const currentConfig = window.StateManager.getConfig() || {};
            const isAutomationActive = currentConfig.automation === true;
            
            if (isAutomationActive) {
                // Se a automa├º├úo j├í estiver ativa, apenas informar
                updateStatus('Sistema de automa├º├úo j├í est├í ativo', 'info');
            } else {
                // Informar que a automa├º├úo est├í desativada
                updateStatus('A automa├º├úo est├í desativada. Ative-a nas configura├º├Áes.', 'warn');
            }
        } else {
            // Se n├úo conseguir verificar o status via StateManager
            updateStatus('N├úo foi poss├¡vel verificar o status da automa├º├úo', 'error');
        }
    };
    
    // Fun├º├úo para cancelar o monitoramento (usado como fallback)
    const cancelAutomationFallback = () => {
        addLog('Cancelando automa├º├úo via m├®todo fallback...', 'INFO');
        
        // Atualizar o status de automa├º├úo no StateManager primeiro, se dispon├¡vel
        if (window.StateManager && typeof window.StateManager.saveConfig === 'function') {
            // Obter configura├º├úo atual
            const currentConfig = window.StateManager.getConfig() || {};
            
            // Desativar automa├º├úo na configura├º├úo
            currentConfig.automation = false;
            
            // Salvar no StateManager (que notificar├í os listeners)
            window.StateManager.saveConfig(currentConfig)
                .then(() => {
                    addLog('Status de automa├º├úo (desativado) atualizado com sucesso no StateManager (fallback)', 'SUCCESS');
                    updateStatus('Automa├º├úo desativada', 'info');
                })
                .catch(error => {
                    addLog(`Erro ao atualizar configura├º├úo: ${error.message}`, 'ERROR');
                    updateStatus('Falha ao desativar automa├º├úo', 'error');
                });
        } else {
            // Caso n├úo tenha StateManager, atualizar diretamente
            if (automationTimeout) {
                clearTimeout(automationTimeout);
                automationTimeout = null;
                addLog('Temporizador de automa├º├úo cancelado', 'INFO');
            }
            isAutomationRunning = false;
            updateAutomationStatus(false, false);
            updateStatus('Opera├º├úo cancelada pelo usu├írio', 'info');
            addLog('Opera├º├úo cancelada manualmente pelo usu├írio', 'INFO');
        }
    };

    // Fun├º├úo para atualizar status de automa├º├úo (padronizada, sem estilos inline)
    function setAutomationStatusUI(isActive) {
        const automationStatusElement = document.querySelector('#automation-status');
        if (automationStatusElement) {
            automationStatusElement.textContent = `Automa├º├úo: ${isActive ? 'Ativa' : 'Inativa'}`;
            automationStatusElement.className = 'automation-status ' + (isActive ? 'active' : 'inactive');
        }
    }

    // Armazenar a ├║ltima imagem capturada globalmente para uso entre m├│dulos
    window.lastCapturedImage = null;

    // Listener para RUN_ANALYSIS
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'RUN_ANALYSIS') {
            runAnalysis()
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // resposta ass├¡ncrona
        }
        // ... outros handlers ...
    });
} else {
    console.log('Trade Manager Pro - Index Module j├í foi carregado anteriormente');
}
