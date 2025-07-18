// Trade Manager Pro - Index Module
// ================== VALIDAÇÃO DE DOMÍNIO ==================
// IMPORTANTE: Esta extensão só deve funcionar na Pocket Option
const validateDomain = () => {
    try {
        // Obter informações de localização de forma mais robusta
        const currentURL = window.location.href;
        const currentDomain = window.location.hostname;
        const currentOrigin = window.location.origin;
        
        // Verificar se estamos em um contexto de extensão (chrome-extension://)
        if (currentURL.startsWith('chrome-extension://')) {
            return true; // Permitir execução em contexto de extensão
        }
        
        // Verificar se estamos em um iframe ou contexto aninhado
        if (window !== window.top) {
            try {
                const parentURL = window.top.location.href;
                const parentDomain = window.top.location.hostname;
                if (parentDomain === 'pocketoption.com' || parentDomain === 'www.pocketoption.com') {
                    return true;
                }
            } catch (e) {
                // Cross-origin iframe, não podemos acessar o parent
            }
        }
        
        // Lista de domínios e padrões permitidos
        const allowedDomains = ['pocketoption.com', 'www.pocketoption.com'];
        const allowedPatterns = [
            /^https?:\/\/(www\.)?pocketoption\.com/,
            /pocketoption\.com/
        ];
        
        // Verificar se o domínio está na lista permitida
        const isDomainAllowed = allowedDomains.includes(currentDomain);
        
        // Verificar se a URL corresponde aos padrões permitidos
        const isPatternAllowed = allowedPatterns.some(pattern => pattern.test(currentURL));
        
        // Validação de domínio
        if (!isDomainAllowed && !isPatternAllowed) {
            
            // Mostrar aviso visual apenas se não estivermos em contexto de extensão e for a janela principal
            if (!currentURL.includes('chrome-extension://') && window === window.top) {
                const warningDiv = document.createElement('div');
                warningDiv.style.cssText = `
                    position: fixed; top: 20px; right: 20px; z-index: 999999;
                    background: #ff4444; color: white; padding: 15px; border-radius: 8px;
                    font-family: Arial, sans-serif; font-size: 14px; max-width: 300px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                `;
                warningDiv.innerHTML = `
                    <strong>⚠️ Trade Manager Pro</strong><br>
                    Esta extensão só funciona na plataforma Pocket Option.<br>
                    Acesse: <a href="https://pocketoption.com" style="color: #ffdddd;">pocketoption.com</a>
                `;
                document.body.appendChild(warningDiv);
                
                // Remover aviso após 10 segundos
                setTimeout(() => {
                    if (warningDiv.parentNode) {
                        warningDiv.parentNode.removeChild(warningDiv);
                    }
                }, 10000);
            }
            
            return false; // Domínio não autorizado
        }
        
        return true; // Domínio autorizado
        
    } catch (error) {
        // Em caso de erro, permitir execução para não quebrar a funcionalidade
        return true;
    }
};

// Verificar domínio antes de inicializar
if (!validateDomain()) {
    // Não continuar com a inicialização
} else {

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
            // Erro silencioso
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
            // Silenciar warning para evitar spam no console
            // console.warn('Elemento de status #status-processo não encontrado na UI');
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
    
    // ================== ORQUESTRADOR DE ANÁLISE ==================
    const analysisOrchestrator = new AnalysisOrchestrator({
        log: addLog,
        updateStatus: updateStatus,
        updateSystemStatus: updateSystemOperationalStatus,
        stateManager: window.StateManager,
        showAnalysisModal: window.showAnalysisModal,
        safeExecute: safeExecute
    });

    /**
     * Analisa o screenshot de uma guia específica.
     * @param {number} tabId
     */
    const runAnalysis = async () => {
        return safeExecute(async () => {
            // Iniciar status operacional
            if (window.StateManager) {
                window.StateManager.startOperation('analysis');
            }
            updateSystemOperationalStatus('Operando...');
            
            updateStatus('Iniciando análise...', 'info');
            addLog('🚀 [RUNANALYSIS] Iniciando análise do gráfico...');
            addLog('🚀 [RUNANALYSIS] Função runAnalysis chamada com sucesso', 'DEBUG');
            
            // NOTA: Verificação de payout removida do runAnalysis para evitar duplicação
            // A verificação de payout agora é feita APENAS na automação (automation.js)
            // antes de chamar runAnalysis, eliminando verificações duplicadas
            addLog('ℹ️ [RUNANALYSIS] Payout já verificado pela automação - prosseguindo diretamente com análise', 'INFO');
            
            // ETAPA 1: Capturar a tela
            addLog('📸 [RUNANALYSIS] Iniciando captura de tela para análise...', 'INFO');
            let dataUrl;
            
            // Verificar se o sistema de captura está disponível
            if (!window.CaptureScreen || typeof window.CaptureScreen.captureForAnalysis !== 'function') {
                addLog('Sistema de captura não disponível, tentando carregar dinamicamente', 'WARN');
                
                // Tentar carregar o módulo de captura dinamicamente
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
                addLog('✅ [RUNANALYSIS] Captura de tela para análise concluída com sucesso', 'SUCCESS');
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
            addLog('🧠 [RUNANALYSIS] Iniciando etapa de processamento de análise...', 'INFO');
            
            try {
                // Obter configurações
                const settings = window.StateManager ? window.StateManager.getConfig() || {} : {};
                
                // Verificar se está em modo de teste
                if (settings.testMode) {
                    addLog('Modo de teste ativado - usando análise simplificada', 'INFO');
                    updateStatus('Executando análise de teste...', 'info');
                    
                    // Simular análise com dados mock
                    const mockResult = {
                        action: Math.random() > 0.5 ? 'BUY' : 'SELL',
                        confidence: Math.floor(Math.random() * 40) + 60, // 60-100%
                        period: settings.period ? `${settings.period}min` : '1min',
                        value: settings.value ? `R$ ${settings.value.toFixed(2)}` : 'R$ 10,00',
                        reason: 'Análise de teste executada com dados simulados. Este resultado não deve ser usado para operações reais.',
                        isTestMode: true
                    };
                    
                    // Finalizar operação com sucesso - só alterar status se não estiver em modo automático
                    if (window.StateManager) {
                        const automationState = window.StateManager.getAutomationState();
                        const isInAutomaticMode = automationState && automationState.isRunning;
                        
                        if (!isInAutomaticMode) {
                            window.StateManager.stopOperation('completed');
                            updateSystemOperationalStatus('Pronto');
                        }
                    } else {
                        updateSystemOperationalStatus('Pronto');
                    }
                    
                    addLog(`Análise de teste concluída: ${mockResult.action}`, 'SUCCESS');
                    updateStatus(`Análise de teste: ${mockResult.action}`, 'success');
                    
                    // Mostrar modal
                    if (typeof showAnalysisModal === 'function') {
                        showAnalysisModal(mockResult);
                    }
                    
                    return {
                        success: true,
                        results: mockResult
                    };
                }
                
                // Enviar análise usando o analyze-graph.js diretamente se disponível
                if (window.AnalyzeGraph && typeof window.AnalyzeGraph.analyzeImage === 'function') {
                    addLog('🧠 [RUNANALYSIS] Usando módulo AnalyzeGraph para processamento...', 'INFO');
                    
                    const analysisResult = await window.AnalyzeGraph.analyzeImage(dataUrl, settings);
                    addLog('🧠 [RUNANALYSIS] AnalyzeGraph.analyzeImage concluído', 'DEBUG');
                    
                    // Formatar resultado
                    const formattedResult = {
                        success: true,
                        results: analysisResult
                    };
                    
                    // Finalizar operação com sucesso - só alterar status se não estiver em modo automático
                    if (window.StateManager) {
                        const automationState = window.StateManager.getAutomationState();
                        const isInAutomaticMode = automationState && automationState.isRunning;
                        
                        if (!isInAutomaticMode) {
                            // Só parar operação se não estiver em modo automático
                            window.StateManager.stopOperation('completed');
                            updateSystemOperationalStatus('Pronto');
                        }
                        // Em modo automático, manter status "Operando..." e deixar o sistema de automação controlar
                    } else {
                        updateSystemOperationalStatus('Pronto');
                    }
                    
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
                        
                        // Finalizar operação com sucesso - só alterar status se não estiver em modo automático
                        if (window.StateManager) {
                            const automationState = window.StateManager.getAutomationState();
                            const isInAutomaticMode = automationState && automationState.isRunning;
                            
                            if (!isInAutomaticMode) {
                                // Só parar operação se não estiver em modo automático
                                window.StateManager.stopOperation('completed');
                                updateSystemOperationalStatus('Pronto');
                            }
                            // Em modo automático, manter status "Operando..." e deixar o sistema de automação controlar
                        } else {
                            updateSystemOperationalStatus('Pronto');
                        }
                        
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
        }, 'runAnalysis');
    };

    // Função para analisar na aba
    const analyzeInTab = async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
    // Inicialização removida - usando _setupLateInitialization

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
            
            // Atualizar configurações de Gale (usando estrutura correta)
            const galeEnabled = settings.gale?.active ?? settings.galeEnabled ?? false;
            const galeLevel = settings.gale?.level ?? settings.galeLevel ?? '20%';
            
            if (indexUI.toggleGale) {
                indexUI.toggleGale.checked = galeEnabled;
                addLog(`toggleGale atualizado para: ${galeEnabled}`, 'DEBUG');
            }
            
            // Atualizar status do Gale na UI
            updateGaleStatusUI(galeEnabled, galeLevel, settings.galeProfit);
            
            // Atualizar payout mínimo no dashboard
            updateMinPayoutDisplay(settings);
            
            // Atualizar ganhos e perdas no dashboard
            updateProfitLossDisplay();
            
            // Atualizar status de automação (usando estrutura correta)
            const automationActive = settings.automation ?? settings.autoActive ?? false;
            if (indexUI.automationStatus) {
                updateAutomationStatusUI(automationActive);
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
                const galeEnabled = settings.gale?.active ?? settings.galeEnabled ?? false;
                const galeLevel = settings.gale?.level ?? settings.galeLevel ?? '20%';
                updateGaleStatusUI(galeEnabled, galeLevel, settings.galeProfit);
                
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
        const automationLed = document.querySelector('#automation-led');
        
        if (automationStatusElement) {
            automationStatusElement.textContent = isActive ? 'Ativado' : 'Desativado';
            automationStatusElement.className = 'status-value';
            addLog(`Status de automação atualizado na UI: ${isActive ? 'Ativo' : 'Inativo'}`, 'DEBUG');
        } else {
            addLog('Elemento automation-status não encontrado na UI', 'WARN');
        }
        
        // Atualizar LED de automação
        if (automationLed) {
            automationLed.className = 'status-led automation-led';
            automationLed.classList.add(isActive ? 'active' : 'inactive');
        }
    };

    // Função para atualizar o status de Gale na UI
    const updateGaleStatusUI = (galeEnabled, galeLevel, galeProfit) => {
        const galeStatusElement = document.querySelector('#gale-status');
        const galeLed = document.querySelector('#gale-led');
        const galeProfitElement = document.querySelector('#gale-profit-percent');
        
        if (galeStatusElement) {
            if (galeEnabled) {
                galeStatusElement.textContent = 'Ativado';
                addLog(`Status de Gale atualizado na UI: Ativo (Nível ${galeLevel})`, 'DEBUG');
            } else {
                galeStatusElement.textContent = 'Desativado';
                addLog('Status de Gale atualizado na UI: Inativo', 'DEBUG');
            }
            galeStatusElement.className = 'status-value';
        } else {
            addLog('Elemento gale-status não encontrado na UI', 'WARN');
        }
        
        // Atualizar porcentagem de lucro do Gale
        if (galeProfitElement) {
            if (galeEnabled && galeProfit) {
                // Extrair apenas o número da porcentagem (ex: "25%" -> "25")
                const profitNumber = galeProfit.toString().replace(/[^\d]/g, '');
                if (profitNumber && profitNumber !== '0') {
                    galeProfitElement.textContent = `lucro ${profitNumber}%`;
                    galeProfitElement.style.display = 'inline';
                } else {
                    galeProfitElement.style.display = 'none';
                }
            } else {
                galeProfitElement.style.display = 'none';
            }
        }
        
        // Atualizar LED de Gale
        if (galeLed) {
            galeLed.className = 'status-led gale-led';
            galeLed.classList.add(galeEnabled ? 'active' : 'inactive');
        }
        
        // Atualizar nível de Gale no dashboard
        updateGaleLevelDisplay();
    };

    // Função para atualizar o nível de Gale no dashboard
    const updateGaleLevelDisplay = () => {
        const currentGaleElement = document.querySelector('#current-gale');
        if (!currentGaleElement) {
            addLog('Elemento current-gale não encontrado na UI', 'WARN');
            return;
        }

        // Verificar se o GaleSystem está disponível
        if (window.GaleSystem && typeof window.GaleSystem.getStatus === 'function') {
            try {
                const galeStatus = window.GaleSystem.getStatus();
                if (galeStatus) {
                    const level = galeStatus.level || 0;
                    currentGaleElement.textContent = level.toString().padStart(2, '0');
                    addLog(`Nível de Gale atualizado no dashboard: ${level}`, 'DEBUG');
                } else {
                    currentGaleElement.textContent = '00';
                    addLog('Status do Gale não disponível, definindo nível como 00', 'DEBUG');
                }
            } catch (error) {
                addLog(`Erro ao obter status do Gale: ${error.message}`, 'ERROR');
                currentGaleElement.textContent = '00';
            }
        } else {
            // Fallback: tentar via chrome.runtime.sendMessage
            try {
                chrome.runtime.sendMessage({
                    action: 'GET_GALE_STATUS'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        addLog(`Erro ao obter status do Gale via runtime: ${chrome.runtime.lastError.message}`, 'ERROR');
                        currentGaleElement.textContent = '00';
                        return;
                    }
                    
                    if (response && response.success && response.data) {
                        const level = response.data.level || 0;
                        currentGaleElement.textContent = level.toString().padStart(2, '0');
                        addLog(`Nível de Gale atualizado via runtime: ${level}`, 'DEBUG');
                    } else {
                        currentGaleElement.textContent = '00';
                        addLog('Status do Gale não disponível via runtime, definindo nível como 00', 'DEBUG');
                    }
                });
            } catch (error) {
                addLog(`Erro ao solicitar status do Gale via runtime: ${error.message}`, 'ERROR');
                currentGaleElement.textContent = '00';
            }
        }
    };

    // Função para atualizar o payout mínimo no dashboard
    const updateMinPayoutDisplay = (config) => {
        const minPayoutElement = document.querySelector('#min-payout');
        if (!minPayoutElement) {
            addLog('Elemento min-payout não encontrado na UI', 'WARN');
            return;
        }

        const minPayout = config.minPayout || 80;
        minPayoutElement.textContent = `${minPayout}%`;
        addLog(`Payout mínimo atualizado no dashboard: ${minPayout}%`, 'DEBUG');
    };

    // Função para atualizar ganhos e perdas no dashboard
    const updateProfitLossDisplay = () => {
        const lastProfitElement = document.querySelector('#last-profit');
        if (!lastProfitElement) {
            addLog('Elemento last-profit não encontrado na UI', 'WARN');
            return;
        }

        try {
            // Calcular lucro/prejuízo total das operações
            let totalProfit = 0;
            const savedOperations = localStorage.getItem('tradeOperations');
            
            if (savedOperations) {
                const operations = JSON.parse(savedOperations);
                operations.forEach(op => {
                    if (op.status === 'Closed') {
                        if (op.success) {
                            totalProfit += parseFloat(op.profit || 0);
                        } else {
                            totalProfit -= parseFloat(op.amount || 0);
                        }
                    }
                });
            }

            // Formatar e exibir o valor
            const formattedProfit = totalProfit.toFixed(2);
            const displayValue = totalProfit >= 0 ? `+R$ ${formattedProfit}` : `-R$ ${Math.abs(totalProfit).toFixed(2)}`;
            lastProfitElement.textContent = displayValue;
            
            addLog(`Ganhos e perdas atualizados no dashboard: ${displayValue}`, 'DEBUG');
        } catch (error) {
            addLog(`Erro ao calcular ganhos e perdas: ${error.message}`, 'ERROR');
            lastProfitElement.textContent = 'R$ 0,00';
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

    // Função simplificada removida - usar chrome.tabs.query diretamente

    // Função simplificada para teste de conectividade
    const testGeminiConnection = async () => {
        try {
            addLog('Verificando conectividade do sistema...', 'INFO');
            updateStatus('Sistema verificando conectividade...', 'info');
            
            // Verificação básica sem fazer requisição real
            if (window.API_KEY && window.API_URL) {
                addLog('Configurações de API encontradas', 'SUCCESS');
                updateStatus('Sistema pronto para análises', 'success');
                return true;
            } else {
                addLog('Configurações de API não encontradas', 'WARN');
                updateStatus('Sistema em modo limitado', 'warn');
                return false;
            }
        } catch (error) {
            addLog(`Erro na verificação: ${error.message}`, 'ERROR');
            updateStatus('Erro na verificação do sistema', 'error');
            return false;
        }
    };

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
    const cancelCurrentOperation = (reason = 'Cancelado pelo usuário') => {
        addLog(`Cancelando operação atual: ${reason}`, 'INFO');
        
        // *** CORREÇÃO: Usar chrome.runtime ao invés de window.StateManager ***
        chrome.runtime.sendMessage({
            action: 'CANCEL_OPERATION_REQUEST',
            reason: reason,
            timestamp: Date.now()
        }, (response) => {
            if (response && response.success) {
                addLog(`Cancelamento processado: ${reason}`, 'SUCCESS');
                
                // Atualizar status local
                updateSystemOperationalStatus('Pronto');
                
                // Atualizar visibilidade dos botões
                const automationActive = response.automationActive || false;
                updateUserControlsVisibility(automationActive, false);
            } else {
                addLog(`Erro no cancelamento: ${response ? response.error : 'Sem resposta'}`, 'ERROR');
            }
        });
        
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
        if (window.PayoutController && typeof window.PayoutController.cancelPayoutMonitoring === 'function') {
            window.PayoutController.cancelPayoutMonitoring();
            addLog('Monitoramento de payout cancelado via PayoutController', 'DEBUG');
        } else if (typeof cancelPayoutMonitoring === 'function') {
            cancelPayoutMonitoring();
            addLog('Monitoramento de payout cancelado via função local', 'DEBUG');
        }
        
        // *** NOVO: Parar monitoramento contínuo de payout ***
        try {
            chrome.runtime.sendMessage({
                action: 'STOP_PAYOUT_MONITORING',
                reason: reason
            });
            addLog('Solicitação de parada do monitoramento contínuo enviada', 'DEBUG');
        } catch (error) {
            addLog(`Erro ao solicitar parada do monitoramento contínuo: ${error.message}`, 'WARN');
        }
        
        // Atualizar status
        updateStatus(reason, 'info');
        addLog(`Operação cancelada: ${reason}`, 'SUCCESS');
    };

    // Expor função globalmente para uso em outros módulos
    window.cancelCurrentOperation = cancelCurrentOperation;

    // Função para capturar e analisar - delegada para módulo de captura
    async function captureAndAnalyze() {
        try {
            addLog('Iniciando processo integrado de captura e análise...', 'INFO');
            
            // Usar o módulo de captura existente
            if (window.CaptureScreen && typeof window.CaptureScreen.captureForAnalysis === 'function') {
                await window.CaptureScreen.captureForAnalysis();
                addLog('Captura realizada com sucesso pelo módulo de captura', 'SUCCESS');
                await runAnalysis();
                addLog('Processo integrado de captura e análise concluído com sucesso', 'SUCCESS');
                updateStatus('Captura e análise realizadas com sucesso', 'success');
            } else {
                // Fallback para método alternativo
                addLog('Módulo de captura não disponível, usando método alternativo', 'WARN');
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
                const currentState = window.StateManager.getAutomationState();
                if (currentState && currentState.isRunning) {
                    addLog('Automação já está em execução, botão não deveria estar visível.', 'WARN');
                    return;
                }
                
                addLog('Botão Iniciar Automático clicado', 'INFO');
                // Inicia a automação através do StateManager
                if (window.AutomationSystem) {
                    window.AutomationSystem.start();
                } else {
                    addLog('Sistema de Automação não encontrado', 'ERROR');
                }
            });
        }
        
        if (elements.cancelOperation) {
            elements.cancelOperation.addEventListener('click', () => {
                addLog('Cancelando operação automática...', 'INFO');
                updateStatus('Cancelando operação...', 'warn');
                
                // Limpar estado de operação no StateManager
                if (window.StateManager) {
                    const currentState = window.StateManager.getAutomationState();
                    const currentConfig = window.StateManager.getConfig() || {};
                    const isAutomationActive = currentConfig.automation === true;
                    
                    // Atualizar estado para indicar que não há operação em andamento
                    window.StateManager.updateAutomationState(isAutomationActive, null);
                    
                    // Atualizar visibilidade dos botões imediatamente
                    updateUserControlsVisibility(isAutomationActive, false);
                }
                
                // Interromper monitoramento se disponível
                    if (window.TradeManager?.History) {
                            window.TradeManager.History.stopMonitoring()
                                .then(() => {
                            addLog('Operação automática cancelada com sucesso', 'SUCCESS');
                            updateStatus('Operação cancelada pelo usuário', 'info');
                            
                            // *** CORREÇÃO: Atualizar status do sistema ***
                            updateSystemOperationalStatus('Pronto');
                                })
                                .catch(error => {
                            addLog(`Erro ao cancelar operação: ${error.message}`, 'ERROR');
                            updateStatus('Erro ao cancelar operação', 'error');
                            
                            // *** CORREÇÃO: Mesmo em caso de erro, voltar para Pronto ***
                            updateSystemOperationalStatus('Pronto');
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
                        
                        // *** CORREÇÃO: Atualizar status do sistema ***
                        updateSystemOperationalStatus('Pronto');
                    }
                
                        // Cancelar qualquer monitoramento de payout em andamento
        if (window.PayoutController && typeof window.PayoutController.cancelPayoutMonitoring === 'function') {
            window.PayoutController.cancelPayoutMonitoring();
            addLog('Monitoramento de payout cancelado via PayoutController', 'DEBUG');
        } else if (typeof cancelPayoutMonitoring === 'function') {
            cancelPayoutMonitoring();
            addLog('Monitoramento de payout cancelado via função local', 'DEBUG');
        }
            });
        }
        
        // Botão de captura de tela movido para dev-tools.js
        
        if (elements.analyzeBtn) {
            elements.analyzeBtn.addEventListener('click', analysisOrchestrator.execute.bind(analysisOrchestrator));
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
        
        // Adicionar log de inicialização
        addLog('Interface principal inicializada', 'INFO');
        
        // Tentar obter a versão do Manifest e mostrar no rodapé
        try {
            const manifest = chrome.runtime.getManifest();
            if (indexUI.version) {
                indexUI.version.textContent = manifest.version || '1.0.0';
                addLog(`Versão do Trade Manager Pro: ${manifest.version}`, 'INFO');
            }
            addLog(`Sistema Trade Manager Pro v${manifest.version} inicializado`, 'INFO');
            addLog(`Ambiente: ${manifest.name} / ${navigator.userAgent}`, 'DEBUG');
        } catch (e) {
            addLog('Sistema Trade Manager Pro inicializado (versão desconhecida)', 'INFO');
            if (indexUI.version) {
                indexUI.version.textContent = '1.0.0';
            }
        }
        
        // Testar conexão com a API Gemini
        testGeminiConnection();
        
        // Carregar configurações
        loadConfig();
        
        // Atualizar status inicial
        updateStatus('Sistema operando normalmente', 'INFO');
        
        // Inicializar módulo de histórico
        initHistoryModule();
        
        // Configurar event listeners
        addEventListeners();
        addLog('Event listeners configurados com sucesso', 'DEBUG');
        
        // Configurar os botões de teste do sistema de Gale
        setupGaleTestButtons();
        
        // Configurar botão de teste de análise no modo desenvolvedor
        setupDevAnalysisButton();
        
        // Inicializar DevTools se devMode ativo
        if (window.StateManager) {
            const config = window.StateManager.getConfig();
            addLog(`Configuração carregada - devMode: ${config?.devMode}`, 'DEBUG');
            
            if (config && config.devMode) {
                addLog('Modo desenvolvedor ativo, verificando DevTools...', 'INFO');
                
                // Inicializar DevTools via chrome.runtime (seguindo arquitetura)
                try {
                    chrome.runtime.sendMessage({
                        action: 'INIT_DEV_TOOLS'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            addLog(`Erro ao inicializar DevTools: ${chrome.runtime.lastError.message}`, 'WARN');
                        } else if (response && response.success) {
                            addLog('DevTools inicializado via chrome.runtime', 'SUCCESS');
                        }
                    });
                } catch (error) {
                    addLog(`Erro ao enviar mensagem de inicialização para DevTools: ${error.message}`, 'WARN');
                }
                
                // Atualizar visibilidade do painel de desenvolvimento na inicialização
                updateDevPanelVisibility(config.devMode);
            } else {
                addLog('Modo desenvolvedor não ativo', 'DEBUG');
                // Garantir que o painel esteja oculto na inicialização
                updateDevPanelVisibility(false);
            }
        }
        

        
        // Inicializar o listener do StateManager para atualizações de configurações
        initStateManagerListener();
        
        // Configurar listener para sistema de Gale
        setupGaleListener();
        
        // Atualização inicial do dashboard e status operacional
        setTimeout(() => {
            if (window.StateManager) {
                const config = window.StateManager.getConfig();
                const operationalStatus = window.StateManager.getOperationalStatus();
                
                if (config) {
                    updateMinPayoutDisplay(config);
                    updateProfitLossDisplay();
                    updateGaleLevelDisplay();
                    addLog('Dashboard atualizado com configurações iniciais', 'DEBUG');
                }
                
                if (operationalStatus) {
                    updateSystemOperationalStatus(operationalStatus.status);
                    addLog(`Status operacional carregado: ${operationalStatus.status}`, 'DEBUG');
                }
            }
        }, 1500);
        
        // Adicionar listener direto para mensagens da página de configurações (mecanismo alternativo)
        window.addEventListener('message', (event) => {
            // Verificar se é uma mensagem de atualização de configurações
            if (event.data && event.data.action === 'configUpdated' && event.data.settings) {
                addLog('Recebida mensagem direta de atualização de configurações', 'INFO');
                addLog(`Dados recebidos: ${JSON.stringify(event.data.settings)}`, 'DEBUG');
                
                const config = event.data.settings;
                // Atualizar campos da página principal
                updateCurrentSettings({
                    galeEnabled: config.gale?.active || false,
                    galeLevel: config.gale?.level || '1.2x',
                    galeProfit: config.gale?.level || '20%', // Adicionando galeProfit
                    dailyProfit: config.dailyProfit || 150,
                    stopLoss: config.stopLoss || 30,
                    tradeValue: config.value || 10,
                    tradeTime: config.period || 1,
                    autoActive: config.automation || false
                });
                
                // Forçar atualização do dashboard
                setTimeout(() => {
                    updateMinPayoutDisplay(config);
                    updateProfitLossDisplay();
                    updateGaleLevelDisplay();
                    addLog('Dashboard forçado a atualizar após receber configurações', 'DEBUG');
                }, 100);
                                
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
    function loadConfig() {
        return new Promise((resolve) => {
            addLog('Iniciando carregamento das configurações...', 'INFO');
            updateStatus('Carregando configurações...', 'info');

            // Aguardar StateManager estar disponível
            const waitForStateManager = () => {
                return new Promise((resolveWait) => {
                    let attempts = 0;
                    const maxAttempts = 20;
                    
                    const checkStateManager = () => {
                        attempts++;
                        
                        if (window.StateManager && typeof window.StateManager.getConfig === 'function') {
                            addLog('StateManager encontrado e disponível para loadConfig', 'SUCCESS');
                            resolveWait(true);
                        } else if (attempts >= maxAttempts) {
                            addLog('StateManager não encontrado após múltiplas tentativas em loadConfig', 'WARN');
                            resolveWait(false);
                        } else {
                            addLog(`Aguardando StateManager em loadConfig... tentativa ${attempts}/${maxAttempts}`, 'DEBUG');
                            setTimeout(checkStateManager, 100);
                        }
                    };
                    
                    checkStateManager();
                });
            };

            // Utilizar o StateManager para carregar as configurações
            waitForStateManager().then(stateManagerAvailable => {
                if (stateManagerAvailable) {
                    addLog('Utilizando StateManager para carregar configurações', 'INFO');
                    
                    try {
                        const config = window.StateManager.getConfig();
                        
                        if (config) {
                            addLog('Configurações carregadas via StateManager', 'SUCCESS');
                            
                            // Log específico para status de automação e gale
                            addLog(`Status carregado - Gale: ${config.gale?.active} (${config.gale?.level}), Automação: ${config.automation}`, 'DEBUG');
                            
                            // Atualizar campos da página principal
                            updateCurrentSettings({
                                galeEnabled: config.gale?.active || false,
                                galeLevel: config.gale?.level || '20%',
                                galeProfit: config.gale?.level || '20%', // Adicionando galeProfit
                                dailyProfit: config.dailyProfit || 150,
                                stopLoss: config.stopLoss || 30,
                                tradeValue: config.value || 10,
                                tradeTime: config.period || 1,
                                autoActive: config.automation || false
                            });
                            
                            // Atualizar dashboard
                            updateMinPayoutDisplay(config);
                            updateProfitLossDisplay();
                            updateGaleLevelDisplay();
                            
                            // Atualizar visibilidade dos botões principais
                            updateUserControlsVisibility(config.automation, false);
                            
                            updateStatus('Configurações carregadas com sucesso', 'success');
                            resolve(config);
                        } else {
                            addLog('StateManager retornou configuração vazia, usando fallback', 'WARN');
                            loadConfigLegacy().then(config => resolve(config));
                        }
                    } catch (error) {
                        addLog(`Erro ao acessar StateManager: ${error.message}`, 'ERROR');
                        loadConfigLegacy().then(config => resolve(config));
                    }
                                 } else {
                     addLog('StateManager não disponível, usando método legacy', 'WARN');
                     loadConfigLegacy().then(config => resolve(config));
                 }
             }).catch(error => {
                addLog(`Erro ao aguardar StateManager: ${error.message}`, 'ERROR');
                loadConfigLegacy().then(config => resolve(config));
            });
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
        if (window.StateManager) {
            addLog('Registrando listener para StateManager', 'INFO');
            
            // Carregar configurações iniciais imediatamente
            try {
                const initialConfig = window.StateManager.getConfig();
                if (initialConfig) {
                    addLog('Carregando configurações iniciais do StateManager', 'INFO');
                    updateCurrentSettings({
                        galeEnabled: initialConfig.gale?.active || false,
                        galeLevel: initialConfig.gale?.level || '20%',
                        galeProfit: initialConfig.gale?.level || '20%',
                        dailyProfit: initialConfig.dailyProfit || 150,
                        stopLoss: initialConfig.stopLoss || 30,
                        tradeValue: initialConfig.value || 10,
                        tradeTime: initialConfig.period || 1,
                        autoActive: initialConfig.automation || false
                    });
                    updateMinPayoutDisplay(initialConfig);
                    updateProfitLossDisplay();
                    updateGaleLevelDisplay();
                }
            } catch (error) {
                addLog(`Erro ao carregar configurações iniciais: ${error.message}`, 'ERROR');
            }
            
            // Registrar listener para atualizações de estado
            window.StateManager.subscribe((notification) => {
                // Formato de notificação atualizado: {state, type, timestamp}
                const { state, type, timestamp } = notification;
                
                if (type === 'config') {
                    addLog(`Recebida atualização de configurações do StateManager (${new Date(timestamp).toLocaleTimeString()})`, 'INFO');
                    
                    const config = state.config;
                    if (config) {
                        // Log detalhado das configurações atualizadas
                        addLog(`Configurações atualizadas - Gale: ${config.gale?.active} (${config.gale?.level}), Automação: ${config.automation}`, 'DEBUG');
                        
                        // Atualizar campos da página principal
                        updateCurrentSettings({
                            galeEnabled: config.gale?.active || false,
                            galeLevel: config.gale?.level || '1.2x',
                            galeProfit: config.gale?.level || '20%', // Adicionando galeProfit
                            dailyProfit: config.dailyProfit || 150,
                            stopLoss: config.stopLoss || 30,
                            tradeValue: config.value || 10,
                            tradeTime: config.period || 1,
                            autoActive: config.automation || false
                        });
                        
                        // *** CORREÇÃO: Atualizar payout mínimo no dashboard ***
                        updateMinPayoutDisplay(config);
                        
                        // Atualizar visibilidade do painel de desenvolvimento baseado no modo desenvolvedor
                        updateDevPanelVisibility(config.devMode);
                        
                        // Log específico para debug do painel de desenvolvimento
                        addLog(`Painel de desenvolvimento - devMode: ${config.devMode}, chamando updateDevPanelVisibility`, 'DEBUG');
                        
                        // Aplicar configurações de modo de teste
                        if (config.testMode) {
                            addLog('Modo de teste ativado - análises usarão algoritmo simplificado', 'INFO');
                        }
                        
                        // Aplicar configurações de modo desenvolvedor
                        if (config.devMode) {
                            addLog('Modo desenvolvedor ativado - painel de testes disponível', 'INFO');
                            setupDevAnalysisButton();
                        }
                        
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
                                              
                        updateStatus('Configurações atualizadas', 'success', 2000);
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
                            automationStatusElement.textContent = isRunning ? 'Ativado' : 'Desativado';
                            automationStatusElement.className = 'status-value';
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
                else if (type === 'operationalStatus') {
                    // Tratar atualizações do status operacional
                    addLog(`Recebida atualização de STATUS OPERACIONAL (${new Date(timestamp).toLocaleTimeString()})`, 'INFO');
                    
                    const operationalStatus = state.operationalStatus;
                    if (operationalStatus) {
                        updateSystemOperationalStatus(operationalStatus.status);
                        
                        // Se for erro, mostrar detalhes no log
                        if (operationalStatus.status === 'Parado Erro' && operationalStatus.errorDetails) {
                            addLog(`Detalhes do erro: ${operationalStatus.errorDetails.message}`, 'ERROR');
                        }
                        
                        addLog(`Status operacional atualizado via listener: ${operationalStatus.status}`, 'INFO');
                    }
                }
            });
            
            addLog('Listener registrado com sucesso', 'SUCCESS');
        } else {
            addLog('StateManager não disponível para registro de listener', 'WARN');
        }
    }

    // ================== ANALISADOR DE DADOS ==================
    // A classe DataAnalyzer foi movida para o seu próprio arquivo em src/content/analyzers/data-analyzer.js
    const analyzer = new DataAnalyzer(addLog);

    /**
     * @typedef {object} GeminiAnalysisResult
     */

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
            
            updateStatus(message, statusType, duration);
        }
    };

    // Função removida - usar updateStatus() diretamente

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
        
        // *** NOVO: Handler para cancelamento de operação pelo controle de payout ***
        if (message && message.action === 'CANCEL_OPERATION_NOTIFICATION') {
            addLog(`Recebida notificação de cancelamento: ${message.reason}`, 'INFO');
            
            // Executar cancelamento usando a função existente
            cancelCurrentOperation(message.reason);
            
            // Responder à mensagem
            if (sendResponse) {
                sendResponse({ success: true, cancelled: true });
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

            // *** NOVO: Handler para cancelamento forçado via chrome.runtime ***
            if (message.action === 'FORCE_CANCEL_OPERATION') {
                logFunction(`Handler 'FORCE_CANCEL_OPERATION' recebida: ${message.reason}`, 'INFO');
                
                try {
                    // *** EXCEÇÃO: Acesso direto ao StateManager para cancelamento urgente ***
                    if (window.StateManager) {
                        window.StateManager.stopOperation('cancelled');
                        
                        const currentConfig = window.StateManager.getConfig() || {};
                        const isAutomationActive = currentConfig.automation === true;
                        
                        // Limpar operação atual mas manter estado de automação
                        window.StateManager.updateAutomationState(isAutomationActive, null);
                        
                        addLog(`Operação cancelada via FORCE_CANCEL: ${message.reason}`, 'SUCCESS');
                    }
                    
                    // Interromper monitoramento se disponível
                    if (window.TradeManager?.History) {
                        window.TradeManager.History.stopMonitoring()
                            .catch(error => {
                                addLog(`Erro ao parar monitoramento: ${error.message}`, 'ERROR');
                            });
                    }
                    
                    // Cancelar timeouts locais
                    if (typeof automationTimeout !== 'undefined' && automationTimeout) {
                        clearTimeout(automationTimeout);
                        automationTimeout = null;
                        addLog('Temporizador de automação cancelado', 'DEBUG');
                    }
                } catch (error) {
                    addLog(`Erro no cancelamento forçado: ${error.message}`, 'ERROR');
                }
                
                return; // Sair do handler
            }

            // *** NOVO: Handler para notificação de parada automática ***
            if (message.action === 'AUTOMATION_STOPPED_NOTIFICATION') {
                const { reason, data } = message;
                
                addLog(`Recebida notificação de parada automática: ${reason}`, 'INFO');
                
                try {
                    // Atualizar UI baseado no motivo da parada
                    switch (reason) {
                        case 'daily_profit_reached':
                            updateStatus(`🎯 Meta de lucro atingida! Automação parada automaticamente.`, 'success', 10000);
                            break;
                        case 'stop_loss_triggered':
                            updateStatus(`🛑 STOP LOSS acionado! Automação parada automaticamente.`, 'error', 10000);
                            break;
                        default:
                            updateStatus(`Automação parada automaticamente: ${reason}`, 'info', 5000);
                    }
                    
                    // Garantir que o status do sistema seja atualizado
                    updateSystemOperationalStatus('Pronto');
                    
                    // Atualizar visibilidade dos controles
                    updateUserControlsVisibility(false, false);
                    
                    addLog(`Interface atualizada após parada automática: ${reason}`, 'SUCCESS');
                } catch (error) {
                    addLog(`Erro ao processar notificação de parada automática: ${error.message}`, 'ERROR');
                }
                
                return; // Sair do handler
            }

            // *** NOVO: Handler para violações de limites do LimitsChecker ***
            if (message.action === 'LIMITS_VIOLATION') {
                const { type, data } = message;
                
                addLog(`Violação de limite detectada: ${type}`, 'WARN');
                
                try {
                    // Resetar UI
                    updateSystemOperationalStatus('Pronto');
                    
                    // Atualizar visibilidade dos controles
                    updateUserControlsVisibility(false, false);
                    
                    // Exibir notificação apropriada
                    let notificationMsg = '';
                    let notificationType = 'error';
                    
                    switch (type) {
                        case 'EMERGENCY_STOP':
                            notificationMsg = `🚨 PARADA DE EMERGÊNCIA: ${data?.reason || 'Condição crítica detectada'}`;
                            notificationType = 'error';
                            break;
                        case 'CRITICAL_STOP':
                            notificationMsg = `⚠️ PARADA CRÍTICA: ${data?.reason || 'Limite crítico atingido'}`;
                            notificationType = 'error';
                            break;
                        case 'TARGET_REACHED':
                            notificationMsg = `🎯 Meta atingida! Sistema pronto para nova sessão.`;
                            notificationType = 'success';
                            
                            // *** RESETAR STATUS E INTERFACE ***
                            setTimeout(() => {
                                updateSystemOperationalStatus('Pronto');
                                updateAutomationStatusUI(false); // Desativar controles de automação
                                
                                // Resetar StateManager se disponível
                                if (window.StateManager) {
                                    try {
                                        // Usar métodos que existem no StateManager
                                        window.StateManager.updateOperationalStatus('Pronto');
                                        window.StateManager.updateAutomationState(false, null);
                                    } catch (error) {
                                        addLog(`Erro ao resetar StateManager: ${error.message}`, 'WARN');
                                    }
                                }
                                
                                addLog('🎯 Sistema resetado para "Pronto" após meta atingida', 'SUCCESS');
                            }, 2000);
                            break;
                        default:
                            notificationMsg = `Limite violado: ${type}`;
                            notificationType = 'warn';
                    }
                    
                    updateStatus(notificationMsg, notificationType, 15000);
                    addLog(`Interface atualizada após violação de limite: ${type}`, 'SUCCESS');
                    
                } catch (error) {
                    addLog(`Erro ao processar violação de limite: ${error.message}`, 'ERROR');
                }
                
                return; // Sair do handler
            }

            // *** NOVO: Handler para iniciar operação forçada via chrome.runtime ***
            if (message.action === 'FORCE_START_OPERATION') {
                logFunction(`Handler 'FORCE_START_OPERATION' recebida`, 'INFO');
                
                try {
                    // *** EXCEÇÃO: Acesso direto ao StateManager para iniciar operação ***
                    if (window.StateManager) {
                        window.StateManager.startOperation('automatic_monitoring');
                        
                        const currentConfig = window.StateManager.getConfig() || {};
                        const isAutomationActive = currentConfig.automation === true;
                        
                        // Atualizar estado para operação em execução
                        window.StateManager.updateAutomationState(isAutomationActive, {
                            type: 'automatic_monitoring',
                            status: 'running',
                            startTime: Date.now()
                        });
                        
                        addLog('Operação iniciada via FORCE_START_OPERATION', 'SUCCESS');
                    }
                    
                    // Iniciar monitoramento se disponível
                    if (window.TradeManager?.History) {
                        window.TradeManager.History.startMonitoring()
                            .then(() => {
                                addLog('Monitoramento de operações iniciado com sucesso', 'SUCCESS');
                            })
                            .catch(error => {
                                addLog(`Erro ao iniciar monitoramento: ${error.message}`, 'ERROR');
                            });
                    }
                    
                } catch (error) {
                    addLog(`Erro no handler FORCE_START_OPERATION: ${error.message}`, 'ERROR');
                }
                
                sendResponse({ success: true, force_start_processed: true });
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
            
            // Botão para resetar status de erro do sistema
            const resetSystemErrorBtn = document.getElementById('reset-system-error');
            if (resetSystemErrorBtn) {
                resetSystemErrorBtn.addEventListener('click', () => {
                    if (window.StateManager) {
                        const wasReset = window.StateManager.resetErrorStatus();
                        if (wasReset) {
                            updateSystemOperationalStatus('Pronto');
                            updateStatus('Status de erro resetado com sucesso', 'success');
                            addLog('Status de erro do sistema resetado manualmente', 'INFO');
                        } else {
                            updateStatus('Sistema não estava em estado de erro', 'info');
                            addLog('Tentativa de reset, mas sistema não estava em erro', 'DEBUG');
                        }
                    } else {
                        updateStatus('StateManager não disponível', 'error');
                        addLog('StateManager não disponível para reset de erro', 'ERROR');
                    }
                });
                addLog('Botão de reset de status de erro configurado', 'DEBUG');
            }
            
            addLog('Botões de teste do sistema de Gale configurados', 'INFO');
            
            // =================== CONFIGURAR BOTÕES DE TESTE DE ATIVOS ===================
            
            // Obter elementos dos botões de teste de ativos
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
            

            
            // Event listener para buscar melhor ativo
            if (testFindBestAssetBtn) {
                testFindBestAssetBtn.addEventListener('click', async () => {
                    const minPayout = parseInt(minPayoutInput?.value || '85', 10);
                    updateAssetTestResult(`Buscando melhor ativo (payout >= ${minPayout}%)...`);
                    
                    try {
                        const result = await testFindBestAsset(minPayout);
                        updateAssetTestResult(result.message);
                    } catch (error) {
                        updateAssetTestResult(typeof error === 'string' ? error : error.message, true);
                    }
                });
            }

            // Event listener para mudar para moedas
            if (testSwitchToCurrencyBtn) {
                testSwitchToCurrencyBtn.addEventListener('click', async () => {
                    updateAssetTestResult('Mudando para categoria Currencies...');
                    
                    try {
                        const result = await testSwitchAssetCategory('currency');
                        updateAssetTestResult(result.message);
                    } catch (error) {
                        updateAssetTestResult(typeof error === 'string' ? error : error.message, true);
                    }
                });
            }
            
            // Event listener para mudar para crypto
            if (testSwitchToCryptoBtn) {
                testSwitchToCryptoBtn.addEventListener('click', async () => {
                    updateAssetTestResult('Mudando para categoria Cryptocurrencies...');
                    
                    try {
                        const result = await testSwitchAssetCategory('crypto');
                        updateAssetTestResult(result.message);
                    } catch (error) {
                        updateAssetTestResult(typeof error === 'string' ? error : error.message, true);
                    }
                });
            }
            
            addLog('Botões de teste de ativos configurados', 'INFO');

            // =================== BOTÃO DE TESTE DE PAYOUT ===================
            // Configurar botão de teste de captura de payout
            const testCapturePayoutBtn = document.getElementById('test-capture-payout');
            const payoutResult = document.getElementById('payout-result');
            
            if (testCapturePayoutBtn) {
                testCapturePayoutBtn.addEventListener('click', async () => {
                    // Atualizar resultado na tela
                    if (payoutResult) {
                        payoutResult.textContent = 'Capturando payout...';
                        payoutResult.style.backgroundColor = '#f0f8ff';
                    }
                    
                    addLog('Iniciando teste de captura de payout via content.js', 'INFO');
                    updateStatus('Capturando payout do DOM...', 'info');
                    
                    try {
                        // ✅ CORREÇÃO: Usar chrome.runtime para comunicar com content.js que tem acesso ao DOM
                        const response = await new Promise((resolve, reject) => {
                            // Timeout de segurança
                            const timeoutId = setTimeout(() => {
                                reject(new Error('Timeout: Captura de payout demorou mais de 10 segundos'));
                            }, 10000);
                            
                            chrome.runtime.sendMessage({
                                action: 'TEST_CAPTURE_PAYOUT'
                            }, (response) => {
                                clearTimeout(timeoutId);
                                
                                if (chrome.runtime.lastError) {
                                    reject(new Error(`Erro de comunicação: ${chrome.runtime.lastError.message}`));
                                    return;
                                }
                                
                                if (!response || !response.success) {
                                    reject(new Error(response?.error || 'Erro desconhecido na captura'));
                                    return;
                                }
                                
                                resolve(response);
                            });
                        });
                        
                        const message = `Payout: ${response.payout}% (Fonte: ${response.source})`;
                        addLog(`Payout capturado com sucesso: ${message}`, 'SUCCESS');
                        updateStatus(message, 'success');
                        
                        // Atualizar elemento de resultado na interface
                        if (payoutResult) {
                            payoutResult.innerHTML = `
                                <div><strong>Resultado:</strong> ${response.payout}%</div>
                                <div><strong>Fonte:</strong> ${response.source}</div>
                                <div><strong>Seletor:</strong> ${response.selector || 'N/A'}</div>
                                <div><strong>Timestamp:</strong> ${response.timestamp || 'N/A'}</div>
                            `;
                            payoutResult.style.backgroundColor = '#ddffdd';
                        }
                    } catch (error) {
                        const errorMsg = error.message || error;
                        addLog(`Erro na captura: ${errorMsg}`, 'ERROR');
                        updateStatus(`Erro: ${errorMsg}`, 'error');
                        
                        if (payoutResult) {
                            payoutResult.textContent = `Erro: ${errorMsg}`;
                            payoutResult.style.backgroundColor = '#ffdddd';
                        }
                    }
                });
                
                addLog('Botão de teste de captura de payout configurado (via PayoutController)', 'INFO');
            } else {
                addLog('Botão de teste de captura de payout não encontrado', 'WARN');
            }

            // =================== BOTÕES DE DEBUG DO MODAL ===================
            // Configurar botões de debug para testar abertura/fechamento do modal
            const debugOpenModalBtn = document.getElementById('debug-open-modal');
            const debugCloseModalBtn = document.getElementById('debug-close-modal');
            const debugCheckStatusBtn = document.getElementById('debug-check-status');
            const debugToggleModalBtn = document.getElementById('debug-toggle-modal');
            const modalDebugResult = document.getElementById('modal-debug-result');

            // Função para atualizar resultado do debug
            const updateModalDebugResult = (message, isError = false) => {
                const resultEl = document.getElementById('modal-debug-result');
                if (resultEl) {
                    resultEl.textContent = message;
                    resultEl.style.color = isError ? '#ff6b6b' : '#a9a9a9';
                }
            };

            // Event listener para abrir modal (debug)
            if (debugOpenModalBtn) {
                debugOpenModalBtn.addEventListener('click', async () => {
                    updateModalDebugResult('🔄 Executando: AssetManager.openAssetModal()...');
                    
                    try {
                        const result = await testOpenAssetModal();
                        updateModalDebugResult(result);
                    } catch (error) {
                        updateModalDebugResult(error, true);
                    }
                });
            }

            // Event listener para fechar modal (debug)
            if (debugCloseModalBtn) {
                debugCloseModalBtn.addEventListener('click', async () => {
                    updateModalDebugResult('🔄 Executando: AssetManager.closeAssetModal()...');
                    
                    try {
                        const result = await testCloseAssetModal();
                        updateModalDebugResult(result);
                    } catch (error) {
                        updateModalDebugResult(error, true);
                    }
                });
            }

            // Event listener para verificar status do modal
            if (debugCheckStatusBtn) {
                debugCheckStatusBtn.addEventListener('click', async () => {
                    updateModalDebugResult('🔍 Verificando status do modal...');
                    
                    try {
                        const result = await checkModalStatus();
                        updateModalDebugResult(result);
                    } catch (error) {
                        updateModalDebugResult(error, true);
                    }
                });
            }

            // Event listener para toggle do modal (abrir/fechar automaticamente)
            if (debugToggleModalBtn) {
                debugToggleModalBtn.addEventListener('click', async () => {
                    updateModalDebugResult('🔄 Executando toggle do modal...');
                    
                    try {
                        const result = await testToggleModal();
                        updateModalDebugResult(result);
                    } catch (error) {
                        updateModalDebugResult(error, true);
                    }
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

            // Botões de captura movidos para dev-tools.js
            // DevTools é responsável por configurar todos os botões do painel de desenvolvimento

            // Listener para o botão de abrir o modal de análise
            const openModalBtn = document.getElementById('open-analysis-modal');
            if (openModalBtn) {
                openModalBtn.addEventListener('click', () => {
                    // ... (resto do arquivo)
                });
            }
        } catch (error) {
            console.error('Erro ao configurar botões de teste do gale:', error);
            addLog(`Erro ao configurar botões de teste do gale: ${error.message}`, 'ERROR');
        }
    }

    // Função para atualizar a visibilidade do painel de desenvolvimento baseado no modo desenvolvedor
    const updateDevPanelVisibility = (devModeEnabled) => {
        addLog(`Tentando atualizar visibilidade do painel de desenvolvimento: ${devModeEnabled}`, 'DEBUG');
        
        // Teste direto primeiro
        const devPanel = document.getElementById('gale-test-panel');
        if (!devPanel) {
            addLog('Painel de desenvolvimento não encontrado no DOM', 'ERROR');
            return;
        }
        
        addLog(`Estado atual do painel: ${devPanel.classList.contains('hidden') ? 'oculto' : 'visível'}`, 'DEBUG');
        
        if (devModeEnabled) {
            devPanel.classList.remove('hidden');
            addLog('Painel de desenvolvimento EXIBIDO', 'INFO');
        } else {
            devPanel.classList.add('hidden');
            addLog('Painel de desenvolvimento OCULTO', 'INFO');
        }
        
        // Verificar se funcionou
        setTimeout(() => {
            const isVisible = !devPanel.classList.contains('hidden');
            addLog(`Verificação pós-alteração: painel de desenvolvimento ${isVisible ? 'visível' : 'ainda oculto'}`, 'DEBUG');
        }, 100);
        
        // Notificar DevTools via chrome.runtime (seguindo arquitetura)
        try {
            chrome.runtime.sendMessage({
                action: 'UPDATE_DEV_PANEL_VISIBILITY',
                devModeEnabled: devModeEnabled
            }, (response) => {
                if (chrome.runtime.lastError) {
                    addLog(`Erro ao notificar DevTools: ${chrome.runtime.lastError.message}`, 'WARN');
                } else if (response && response.success) {
                    addLog('DevTools notificado sobre mudança de visibilidade', 'DEBUG');
                }
            });
        } catch (error) {
            addLog(`Erro ao enviar mensagem para DevTools: ${error.message}`, 'WARN');
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
            analysisOrchestrator.execute()
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // resposta assíncrona
        }
        // ... outros handlers ...
    });

    // Listener para mensagens do sistema de Gale
    const setupGaleListener = () => {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Atualizar nível de Gale quando houver mudanças
            if (message.action === 'GALE_UPDATED' || message.action === 'GALE_RESET') {
                addLog(`Recebida atualização do sistema de Gale: ${message.action}`, 'DEBUG');
                updateGaleLevelDisplay();
                
                // Também atualizar ganhos e perdas quando houver operações
                updateProfitLossDisplay();
                
                sendResponse({ success: true });
                return true;
            }
            
            // Atualizar ganhos e perdas quando houver nova operação
            if (message.type === 'TRADE_RESULT' || message.action === 'OPERATION_ADDED') {
                addLog('Recebida nova operação, atualizando ganhos e perdas', 'DEBUG');
                updateProfitLossDisplay();
                
                sendResponse({ success: true });
                return true;
            }
            
            // Tratar erros do sistema reportados por outros módulos
            if (message.action === 'SYSTEM_ERROR_OCCURRED') {
                const { error } = message;
                addLog(`ERRO DO SISTEMA (${error.source}): ${error.message}`, 'ERROR');
                
                // Se o StateManager estiver disponível, reportar o erro
                if (window.StateManager) {
                    window.StateManager.reportError(error.message, {
                        ...error.details,
                        originalSource: error.source,
                        receivedAt: Date.now()
                    });
                } else {
                    // Fallback: atualizar status diretamente
                    updateSystemOperationalStatus('Parado Erro');
                    updateStatus(`Sistema parou por erro: ${error.message}`, 'error');
                }
                
                sendResponse({ success: true });
                return true;
            }
            
            return false;
        });
        
        addLog('Listener do sistema de Gale configurado', 'DEBUG');
    };

    // Função para atualizar o status operacional do sistema na UI
    function updateSystemOperationalStatus(status) {
        const systemStatusElement = document.querySelector('#system-status');
        const systemLed = document.querySelector('#system-led');
        
        if (systemStatusElement) {
            systemStatusElement.textContent = status;
            addLog(`Status operacional do sistema atualizado: ${status}`, 'INFO');
        }
        
        if (systemLed) {
            // Remover todas as classes de status
            systemLed.classList.remove('ready', 'operating', 'error');
            
            // Adicionar classe apropriada baseada no status
            switch (status) {
                case 'Pronto':
                    systemLed.classList.add('ready');
                    break;
                case 'Operando...':
                    systemLed.classList.add('operating');
                    break;
                case 'Parado Erro':
                    systemLed.classList.add('error');
                    break;
                default:
                    systemLed.classList.add('ready');
            }
        }
    }

    // Função para reportar erro ao StateManager e atualizar UI
    function reportSystemError(errorMessage, errorDetails = null) {
        addLog(`ERRO DO SISTEMA: ${errorMessage}`, 'ERROR');
        
        if (window.StateManager) {
            const errorInfo = window.StateManager.reportError(errorMessage, errorDetails);
            updateSystemOperationalStatus('Parado Erro');
            updateStatus(`Sistema parou por erro: ${errorMessage}`, 'error');
            return errorInfo;
        } else {
            addLog('StateManager não disponível para reportar erro', 'ERROR');
            updateSystemOperationalStatus('Parado Erro');
            updateStatus(`Sistema parou por erro: ${errorMessage}`, 'error');
            return null;
        }
    }

    // Função wrapper para try-catch automático nas funções críticas
    async function safeExecute(fn, functionName, ...args) {
        try {
            return await fn(...args);
        } catch (error) {
            reportSystemError(`Erro em ${functionName}: ${error.message}`, {
                function: functionName,
                args: args,
                stack: error.stack
            });
            throw error;
        }
    }

    // *** NOVO: Listener para eventos críticos que resetam status ***
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'CRITICAL_STOP' || 
            request.action === 'EMERGENCY_STOP' || 
            request.action === 'TARGET_REACHED' ||
            request.action === 'LIMITS_VIOLATION') {
            
            // Log do evento recebido
            console.log('[Index] Evento crítico recebido:', request.action);
            
                                    // Resetar status para "Pronto" após evento crítico
                        setTimeout(() => {
                            updateSystemOperationalStatus('Pronto');
                            console.log('[Index] Status resetado para "Pronto" após:', request.action);
                
                // Notificação especial para TARGET_REACHED
                if (request.action === 'TARGET_REACHED') {
                    updateStatus('🎯 Meta de lucro atingida! Sistema pronto para nova sessão.', 'success', 8000);
                }
            }, 1500); // 1.5 segundo de delay
        }
        
        // *** LISTENER ESPECÍFICO PARA LIMITS_VIOLATION ***
        if (request.action === 'LIMITS_VIOLATION' && request.type === 'TARGET_REACHED') {
            // Reset imediato para meta atingida
            setTimeout(() => {
                updateSystemOperationalStatus('Pronto');
                updateStatus('🎯 Parabéns! Meta de lucro foi atingida!', 'success', 10000);
                console.log('[Index] Status resetado: Meta de lucro atingida');
            }, 500);
        }
    });
} else {
    console.log('Trade Manager Pro - Index Module já foi carregado anteriormente');
}

} // Fechamento do bloco de validação de domínio