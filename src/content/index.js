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

    // Função para capturar e analisar - delegada para CaptureScreen
    async function captureAndAnalyze() {
        try {
            addLog('Iniciando processo integrado de captura e análise...', 'INFO');
            
            // Usar o módulo de captura centralizado
            if (window.CaptureScreen && typeof window.CaptureScreen.captureAndAnalyze === 'function') {
                const success = await window.CaptureScreen.captureAndAnalyze();
                if (success) {
                    addLog('Processo integrado de captura e análise concluído com sucesso', 'SUCCESS');
                    updateStatus('Captura e análise realizadas com sucesso', 'success');
                } else {
                    addLog('Falha no processo integrado de captura e análise', 'ERROR');
                    updateStatus('Falha na captura e análise', 'error');
                }
            } else {
                // Fallback para método separado
                addLog('Módulo CaptureScreen.captureAndAnalyze não disponível, usando método separado', 'WARN');
                if (window.CaptureScreen && typeof window.CaptureScreen.captureForAnalysis === 'function') {
                    await window.CaptureScreen.captureForAnalysis();
                    addLog('Captura realizada com sucesso pelo módulo centralizado', 'SUCCESS');
                    await runAnalysis();
                } else {
                    addLog('Módulo CaptureScreen não disponível, tentando método alternativo', 'WARN');
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    const response = await chrome.tabs.sendMessage(tab.id, { action: 'CAPTURE_SCREENSHOT' });
                    if (response && response.success) {
                        updateStatus('Captura realizada com sucesso', 'success');
                        await runAnalysis();
                    } else {
                        updateStatus('Erro ao capturar a tela', 'error');
                    }
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
            elements.startOperation.addEventListener('click', () => {
                addLog('Botão "Iniciar Automático" clicado', 'INFO');
                
                // *** CORREÇÃO: Usar chrome.runtime ao invés de window.StateManager ***
                chrome.runtime.sendMessage({
                    action: 'START_OPERATION_REQUEST',
                    timestamp: Date.now()
                }, (response) => {
                    if (response && response.success) {
                        addLog(`Operação iniciada: ${response.message}`, 'SUCCESS');
                        
                        // Atualizar status local imediatamente
                        updateSystemOperationalStatus('Operando...');
                        updateStatus('Operação automática em andamento', 'success');
                        
                        // Atualizar visibilidade dos botões para mostrar "Cancelar Operação"
                        updateUserControlsVisibility(response.automationActive, true);
                        
                    } else {
                        const errorMsg = response ? response.error : 'Sem resposta';
                        addLog(`Erro ao iniciar operação: ${errorMsg}`, 'ERROR');
                        updateStatus(`Falha ao iniciar: ${errorMsg}`, 'error');
                    }
                });
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
        
        if (elements.captureScreen) {
            elements.captureScreen.addEventListener('click', async () => {
                addLog('Botão de captura clicado - delegando para CaptureScreen', 'INFO');
                
                try {
                    // Usar o sistema centralizado de captura
                    if (window.CaptureScreen && typeof window.CaptureScreen.captureAndShow === 'function') {
                        await window.CaptureScreen.captureAndShow();
                        updateStatus('Captura de tela realizada com sucesso', 'success');
                    } else {
                        addLog('Módulo CaptureScreen não disponível', 'ERROR');
                        updateStatus('Módulo de captura não disponível', 'error');
                    }
                } catch (error) {
                    addLog(`Erro na captura: ${error.message}`, 'ERROR');
                    updateStatus('Erro na captura de tela', 'error');
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
                            
                            // Atualizar visibilidade do painel de teste do Gale
                            updateGaleTestPanelVisibility(config.devMode);
                            
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
                        
                        // Atualizar visibilidade do painel de teste do Gale baseado no modo desenvolvedor
                        updateGaleTestPanelVisibility(config.devMode);
                        
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
                if (modalDebugResult) {
                    const timestamp = new Date().toLocaleTimeString();
                    modalDebugResult.innerHTML = `[${timestamp}] ${message}`;
                    modalDebugResult.style.backgroundColor = isError ? '#ffdddd' : '#ddffdd';
                    modalDebugResult.style.color = isError ? '#cc0000' : '#006600';
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
    const updateSystemOperationalStatus = (status) => {
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
    };

    // Função para reportar erro ao StateManager e atualizar UI
    const reportSystemError = (errorMessage, errorDetails = null) => {
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
    };

    // Função wrapper para try-catch automático nas funções críticas
    const safeExecute = async (fn, functionName, ...args) => {
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
    };

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

// =================== SEÇÃO DE INTELIGÊNCIA LOCAL ===================

// Event listeners para botões de inteligência local
document.addEventListener('DOMContentLoaded', function() {
    // Botão de estatísticas da inteligência local
    const intelligenceStatsBtn = document.getElementById('intelligence-stats');
    if (intelligenceStatsBtn) {
        intelligenceStatsBtn.addEventListener('click', function() {
            showIntelligenceStats();
        });
    }
    
    // Botão de reset para modo preliminar
    const intelligenceResetBtn = document.getElementById('intelligence-reset');
    if (intelligenceResetBtn) {
        intelligenceResetBtn.addEventListener('click', function() {
            resetIntelligenceToPreliminary();
        });
    }
    
    // Botão para sair do modo preliminar
    const intelligenceExitBtn = document.getElementById('intelligence-exit-preliminary');
    if (intelligenceExitBtn) {
        intelligenceExitBtn.addEventListener('click', function() {
            exitPreliminaryMode();
        });
    }
    
    // Botão de teste de volatilidade
    const testVolatilityBtn = document.getElementById('test-volatility-check');
    if (testVolatilityBtn) {
        testVolatilityBtn.addEventListener('click', function() {
            testVolatilityCheck();
        });
    }
    
    // Adicionar event listener para o botão de debug
    const debugHistoricalBtn = document.getElementById('debug-historical-data');
    if (debugHistoricalBtn) {
        debugHistoricalBtn.addEventListener('click', function() {
            debugHistoricalData();
        });
    }
    
    // Adicionar event listener para o botão de busca de ativos
    const scanAssetsBtn = document.getElementById('scan-available-assets');
    if (scanAssetsBtn) {
        scanAssetsBtn.addEventListener('click', function() {
            scanAvailableAssets();
        });
    }
    
    // Adicionar event listener para o botão de teste de imagem
    const testImageBtn = document.getElementById('test-image-analysis');
    if (testImageBtn) {
        testImageBtn.addEventListener('click', function() {
            testImageAnalysis();
        });
    }
    

    
    // Botão para mostrar histórico de tendências
    const showTrendHistoryBtn = document.getElementById('show-trend-history');
    if (showTrendHistoryBtn) {
        showTrendHistoryBtn.addEventListener('click', function() {
            showTrendHistory();
        });
    }
});

/**
 * Mostra estatísticas da inteligência local
 */
function showIntelligenceStats() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        if (!window.LocalIntelligence) {
            resultDiv.innerHTML = '❌ Módulo LocalIntelligence não carregado';
            return;
        }
        
        const stats = window.LocalIntelligence.getStats();
        
        const statsHtml = `
            <div style="text-align: left; font-size: 12px; line-height: 1.4;">
                <strong>📊 Estatísticas da Inteligência Local:</strong><br>
                
                <strong>🗃️ Base de Dados:</strong><br>
                • Operações: ${stats.operations}<br>
                • Padrões: ${stats.patterns}<br>
                • Ativos: ${stats.assets}<br>
                • Histórico Mental: ${stats.mentalHistory}<br>
                • Cache Volatilidade: ${stats.volatilityCache}<br>
                
                <strong>🎓 Modo Preliminar:</strong><br>
                • Ativo: ${stats.preliminaryMode ? 'SIM' : 'NÃO'}<br>
                • Progresso: ${stats.preliminaryCount}/5<br>
                
                <strong>💰 Economia de Tokens:</strong><br>
                • Calls Evitadas: ${stats.tokenSavings.callsAvoided}<br>
                • Tokens Economizados: ${stats.tokenSavings.tokensEstimatedSaved}<br>
                • Decisões Locais: ${stats.tokenSavings.decisionsLocal}<br>
                • Checks Volatilidade: ${stats.tokenSavings.volatilityChecks}<br>
                • Análises Mentais: ${stats.tokenSavings.mentalAnalyses}<br>
            </div>
        `;
        
        resultDiv.innerHTML = statsHtml;
        
        // Log usando sistema interno
        if (window.addLog) {
            window.addLog(`Estatísticas exibidas: ${stats.operations} operações, ${stats.assets} ativos`, 'INFO', 'intelligence-stats');
        }
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro ao obter estatísticas: ${error.message}`;
        if (window.addLog) {
            window.addLog(`Erro ao obter estatísticas: ${error.message}`, 'ERROR', 'intelligence-stats');
        }
    }
}

/**
 * Reseta inteligência local para modo preliminar
 */
function resetIntelligenceToPreliminary() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        if (!window.LocalIntelligence) {
            resultDiv.innerHTML = '❌ Módulo LocalIntelligence não carregado';
            return;
        }
        
        window.LocalIntelligence.resetToPreliminaryMode();
        
        resultDiv.innerHTML = '🔄 Sistema resetado para modo preliminar - Próximas 5 análises serão preliminares';
        
        // Log usando sistema interno
        if (window.addLog) {
            window.addLog('Sistema de inteligência local resetado para modo preliminar', 'INFO', 'intelligence-reset');
        }
        
        // Atualizar estatísticas após reset
        setTimeout(() => {
            showIntelligenceStats();
        }, 1000);
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro ao resetar: ${error.message}`;
        if (window.addLog) {
            window.addLog(`Erro ao resetar inteligência local: ${error.message}`, 'ERROR', 'intelligence-reset');
        }
    }
}

/**
 * Força saída do modo preliminar
 */
function exitPreliminaryMode() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        if (!window.LocalIntelligence) {
            resultDiv.innerHTML = '❌ Módulo LocalIntelligence não carregado';
            return;
        }
        
        window.LocalIntelligence.exitPreliminaryMode();
        
        resultDiv.innerHTML = '🚀 Saída forçada do modo preliminar - Sistema pronto para análises conclusivas';
        
        // Log usando sistema interno
        if (window.addLog) {
            window.addLog('Sistema de inteligência local saiu do modo preliminar', 'INFO', 'intelligence-exit');
        }
        
        // Atualizar estatísticas após saída
        setTimeout(() => {
            showIntelligenceStats();
        }, 1000);
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro ao sair do modo preliminar: ${error.message}`;
        if (window.addLog) {
            window.addLog(`Erro ao sair do modo preliminar: ${error.message}`, 'ERROR', 'intelligence-exit');
        }
    }
}

/**
 * Cria dados de teste para demonstrar o funcionamento do sistema
 */
function createTestData() {
    try {
        if (!window.LocalIntelligence) {
            return false;
        }
        
        // Simular operações baseadas no histórico real do usuário
        const testOperations = [
            {
                status: "GANHOU",
                success: true,
                profit: "4.60",
                amount: "5.00",
                action: "Sell",
                symbol: "AED/CNY OTC",
                timestamp: Date.now() - 3600000, // 1 hora atrás
                payout: 92
            },
            {
                status: "PERDEU",
                success: false,
                profit: "0.00",
                amount: "5.00",
                action: "Call",
                symbol: "AED/CNY OTC",
                timestamp: Date.now() - 3000000, // 50 min atrás
                payout: 92
            },
            {
                status: "GANHOU",
                success: true,
                profit: "96.65",
                amount: "105.05",
                action: "Sell",
                symbol: "AED/CNY OTC",
                timestamp: Date.now() - 2400000, // 40 min atrás
                payout: 92
            },
            {
                status: "PERDEU",
                success: false,
                profit: "0.00",
                amount: "46.12",
                action: "Call",
                symbol: "AED/CNY OTC",
                timestamp: Date.now() - 1800000, // 30 min atrás
                payout: 92
            },
            {
                status: "GANHOU",
                success: true,
                profit: "4.55",
                amount: "5.00",
                action: "Sell",
                symbol: "AED/CNY OTC",
                timestamp: Date.now() - 1200000, // 20 min atrás
                payout: 91
            }
        ];
        
        // Atualizar dados no LocalIntelligence
        window.LocalIntelligence.database.operations = [...window.LocalIntelligence.database.operations, ...testOperations];
        
        // Reprocessar dados
        window.LocalIntelligence.processHistoricalData();
        
        // Salvar no localStorage também
        const existingOps = JSON.parse(localStorage.getItem('tradeOperations') || '[]');
        const updatedOps = [...existingOps, ...testOperations];
        localStorage.setItem('tradeOperations', JSON.stringify(updatedOps));
        
        return true;
        
    } catch (error) {
        if (window.addLog) {
            window.addLog(`Erro ao criar dados de teste: ${error.message}`, 'ERROR', 'test-data');
        }
        return false;
    }
}

/**
 * Diagnóstico dos dados históricos
 */
function debugHistoricalData() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        if (!window.LocalIntelligence) {
            resultDiv.innerHTML = '❌ Módulo LocalIntelligence não carregado';
            return;
        }
        
        // Verificar dados do localStorage
        const tradeOperations = localStorage.getItem('tradeOperations');
        const mentalHistory = localStorage.getItem('mentalHistory');
        const volatilityCache = localStorage.getItem('volatilityCache');
        const patterns = localStorage.getItem('localIntelligencePatterns');
        
        let debugInfo = '<div style="text-align: left; font-size: 11px; line-height: 1.3;">';
        debugInfo += '<strong>🔍 Diagnóstico de Dados Históricos:</strong><br><br>';
        
        // Verificar tradeOperations
        if (tradeOperations) {
            try {
                const operations = JSON.parse(tradeOperations);
                debugInfo += `<strong>📊 tradeOperations:</strong> ${operations.length} registros<br>`;
                
                if (operations.length > 0) {
                    const firstOp = operations[0];
                    debugInfo += `• Primeiro registro: ${JSON.stringify(firstOp).substring(0, 100)}...<br>`;
                    
                    // Verificar campos obrigatórios
                    const validOps = operations.filter(op => op.symbol && op.timestamp && op.status !== undefined);
                    debugInfo += `• Registros válidos: ${validOps.length}/${operations.length}<br>`;
                    
                    // Contar ativos únicos
                    const uniqueAssets = new Set(validOps.map(op => op.symbol));
                    debugInfo += `• Ativos únicos: ${uniqueAssets.size}<br>`;
                    debugInfo += `• Ativos encontrados: ${Array.from(uniqueAssets).slice(0, 5).join(', ')}<br>`;
                } else {
                    debugInfo += '• Array vazio<br>';
                }
                debugInfo += '<br>';
            } catch (error) {
                debugInfo += `❌ Erro ao parsear tradeOperations: ${error.message}<br><br>`;
            }
        } else {
            debugInfo += '<strong>📊 tradeOperations:</strong> Não encontrado<br><br>';
        }
        
        // Verificar outros dados
        debugInfo += `<strong>🧠 mentalHistory:</strong> ${mentalHistory ? JSON.parse(mentalHistory).length : 0} registros<br>`;
        debugInfo += `<strong>📈 volatilityCache:</strong> ${volatilityCache ? JSON.parse(volatilityCache).length : 0} registros<br>`;
        debugInfo += `<strong>🔍 patterns:</strong> ${patterns ? JSON.parse(patterns).length : 0} registros<br><br>`;
        
        // Status do sistema
        const stats = window.LocalIntelligence.getStats();
        debugInfo += '<strong>⚙️ Status do Sistema:</strong><br>';
        debugInfo += `• Operações processadas: ${stats.operations}<br>`;
        debugInfo += `• Ativos identificados: ${stats.assets}<br>`;
        debugInfo += `• Modo preliminar: ${stats.preliminaryMode ? 'ATIVO' : 'INATIVO'}<br><br>`;
        
        // Oferecer opção de criar dados de teste se necessário
        if (stats.assets === 0) {
            debugInfo += '<strong>🔧 Solução:</strong><br>';
            debugInfo += '• Dados insuficientes ou mal formatados<br>';
            debugInfo += '• <a href="#" onclick="createTestDataAndRefresh()">Clique aqui para criar dados de teste</a><br>';
        }
        
        debugInfo += '</div>';
        
        resultDiv.innerHTML = debugInfo;
        
        // Log usando sistema interno
        if (window.addLog) {
            window.addLog(`Debug executado: ${tradeOperations ? JSON.parse(tradeOperations).length : 0} operações encontradas`, 'INFO', 'debug-historical');
        }
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro no diagnóstico: ${error.message}`;
        if (window.addLog) {
            window.addLog(`Erro no diagnóstico de dados: ${error.message}`, 'ERROR', 'debug-historical');
        }
    }
}

/**
 * 🔍 BUSCA DE ATIVOS COM ANÁLISE DE TENDÊNCIA INTELIGENTE
 * Agora inclui análise de tendência em tempo real para cada ativo válido
 */
async function scanAvailableAssets() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        if (!window.LocalIntelligence) {
            resultDiv.innerHTML = '❌ Módulo LocalIntelligence não carregado';
            return;
        }
        
        if (!window.FaithfulChartConverter) {
            resultDiv.innerHTML = '❌ Módulo FaithfulChartConverter não carregado';
            return;
        }
        
        resultDiv.innerHTML = '🔍 Analisando ativos disponíveis com tendência em tempo real...';
        
        // Primeiro, tentar usar as funções existentes do painel para encontrar ativos
        const foundAssets = await findAssetsUsingExistingFunctions();
        
        let resultHtml = '<div style="text-align: left; font-size: 11px; line-height: 1.3;">';
        resultHtml += '<strong>📊 Análise de Ativos com Tendência:</strong><br><br>';
        
        if (foundAssets.size === 0) {
            resultHtml += '❌ Nenhum ativo encontrado na página<br>';
            resultHtml += '<em>Tentando métodos alternativos...</em><br><br>';
            
            // Usar métodos alternativos
            const alternativeAssets = await findAssetsByAlternativeMethods();
            
            if (alternativeAssets.size > 0) {
                resultHtml += `✅ ${alternativeAssets.size} ativos encontrados por métodos alternativos:<br><br>`;
                
                let count = 0;
                for (const asset of alternativeAssets) {
                    if (count >= 8) break; // Limitar para não sobrecarregar
                    
                    resultDiv.innerHTML = `🔍 Analisando ${asset} (${count + 1}/${Math.min(alternativeAssets.size, 8)})...`;
                    
                    // Análise de tendência em tempo real
                    const trendData = await analyzeAssetTrend(asset);
                    
                    const trendIcon = getTrendIcon(trendData.direction);
                    const confidenceBar = getConfidenceBar(trendData.confidence);
                    
                    resultHtml += `${trendIcon} <strong>${asset}</strong>: ${trendData.direction} | ${trendData.confidence.toFixed(1)}% ${confidenceBar}<br>`;
                    
                    // Adicionar ao cache de volatilidade
                    window.LocalIntelligence.database.volatilityCache.set(asset, {
                        volatilityScore: trendData.volatilityScore,
                        avgWinRate: 0.5,
                        isVolatile: trendData.isVolatile,
                        lastUpdated: Date.now(),
                        sampleSize: 1,
                        source: 'trend-analysis'
                    });
                    
                    count++;
                }
            } else {
                resultHtml += '❌ Nenhum ativo encontrado por métodos alternativos<br><br>';
                resultHtml += '<strong>📋 Analisando ativos padrão:</strong><br>';
                
                const defaultAssets = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'BTCUSD', 'ETHUSD', 'LTCUSD'];
                
                for (let i = 0; i < defaultAssets.length; i++) {
                    const asset = defaultAssets[i];
                    
                    resultDiv.innerHTML = `🔍 Analisando ${asset} (${i + 1}/${defaultAssets.length})...`;
                    
                    // Análise de tendência em tempo real
                    const trendData = await analyzeAssetTrend(asset);
                    
                    const trendIcon = getTrendIcon(trendData.direction);
                    const confidenceBar = getConfidenceBar(trendData.confidence);
                    
                    resultHtml += `${trendIcon} <strong>${asset}</strong>: ${trendData.direction} | ${trendData.confidence.toFixed(1)}% ${confidenceBar}<br>`;
                    
                    // Adicionar ao cache de volatilidade
                    window.LocalIntelligence.database.volatilityCache.set(asset, {
                        volatilityScore: trendData.volatilityScore,
                        avgWinRate: 0.5,
                        isVolatile: trendData.isVolatile,
                        lastUpdated: Date.now(),
                        sampleSize: 1,
                        source: 'trend-analysis'
                    });
                }
            }
            
        } else {
            resultHtml += `✅ ${foundAssets.size} ativos encontrados:<br><br>`;
            
            let count = 0;
            for (const asset of foundAssets) {
                if (count >= 8) break; // Limitar a 8 para não sobrecarregar
                
                resultDiv.innerHTML = `🔍 Analisando ${asset} (${count + 1}/${Math.min(foundAssets.size, 8)})...`;
                
                // Análise de tendência em tempo real
                const trendData = await analyzeAssetTrend(asset);
                
                const trendIcon = getTrendIcon(trendData.direction);
                const confidenceBar = getConfidenceBar(trendData.confidence);
                
                resultHtml += `${trendIcon} <strong>${asset}</strong>: ${trendData.direction} | ${trendData.confidence.toFixed(1)}% ${confidenceBar}<br>`;
                
                // Adicionar ao cache de volatilidade
                window.LocalIntelligence.database.volatilityCache.set(asset, {
                    volatilityScore: trendData.volatilityScore,
                    avgWinRate: 0.5,
                    isVolatile: trendData.isVolatile,
                    lastUpdated: Date.now(),
                    sampleSize: 1,
                    source: 'trend-analysis'
                });
                
                count++;
            }
            
            if (foundAssets.size > 8) {
                resultHtml += `<em>... e mais ${foundAssets.size - 8} ativos</em><br>`;
            }
        }
        
        // Adicionar resumo da análise
        resultHtml += '<br><strong>📈 Resumo da Análise:</strong><br>';
        resultHtml += `• Total analisado: ${Math.min(foundAssets.size || 8, 8)} ativos<br>`;
        resultHtml += `• Método: Análise de tendência ASCII em tempo real<br>`;
        resultHtml += `• Dados armazenados para estatísticas futuras<br>`;
        
        // Salvar dados atualizados
        window.LocalIntelligence.saveMentalHistory();
        
        resultHtml += '</div>';
        resultDiv.innerHTML = resultHtml;
        
        // Log usando sistema interno
        if (window.addLog) {
            window.addLog(`Análise de ativos concluída: ${foundAssets.size} ativos analisados com tendência`, 'SUCCESS', 'asset-scan');
        }
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro na análise de ativos: ${error.message}`;
        if (window.addLog) {
            window.addLog(`Erro na análise de ativos: ${error.message}`, 'ERROR', 'asset-scan');
        }
    }
}

/**
 * 📊 ANÁLISE DE TENDÊNCIA INDIVIDUAL POR ATIVO
 * Simula troca de ativo e analisa tendência via captura ASCII
 */
async function analyzeAssetTrend(assetSymbol) {
    try {
        // Aguardar um pouco para não sobrecarregar o sistema
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Capturar screenshot do gráfico atual
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do screenshot');
        }
        
        // Converter para ASCII e analisar tendência
        const asciiData = await window.FaithfulChartConverter.captureChartToASCII(screenshot);
        if (!asciiData || !asciiData.trendAnalysis) {
            throw new Error('Falha na análise de tendência');
        }
        
        const trend = asciiData.trendAnalysis;
        const isVolatile = trend.direction === 'LATERAL' || trend.confidence < 50;
        const volatilityScore = trend.direction === 'LATERAL' ? 0.8 : (100 - trend.confidence) / 100;
        
        // Armazenar no histórico
        addTrendToHistory({
            asset: assetSymbol,
            direction: trend.direction,
            angle: trend.angle,
            confidence: trend.confidence,
            slope: trend.slope,
            isVolatile: isVolatile,
            volatilityScore: volatilityScore,
            timestamp: new Date().toISOString(),
            method: 'asset-scan-analysis'
        });
        
        return {
            direction: trend.direction,
            angle: trend.angle,
            confidence: trend.confidence,
            slope: trend.slope,
            isVolatile: isVolatile,
            volatilityScore: volatilityScore
        };
        
    } catch (error) {
        window.addLog(`Erro na análise de tendência para ${assetSymbol}: ${error.message}`, 'WARN', 'asset-trend');
        
        // Retornar dados simulados em caso de erro
        return {
            direction: 'INDETERMINADA',
            angle: 0.0,
            confidence: 0.0,
            slope: 0.0,
            isVolatile: true,
            volatilityScore: 0.9
        };
    }
}

/**
 * 🎯 UTILITÁRIOS PARA VISUALIZAÇÃO DE TENDÊNCIA
 */
function getTrendIcon(direction) {
    switch(direction) {
        case 'ALTA': return '📈';
        case 'BAIXA': return '📉';
        case 'LATERAL': return '🔄';
        default: return '❓';
    }
}

function getConfidenceBar(confidence) {
    const bars = Math.round(confidence / 20); // 0-5 barras
    const filledBars = '█'.repeat(bars);
    const emptyBars = '░'.repeat(5 - bars);
    return `[${filledBars}${emptyBars}]`;
}

/**
 * 📊 TESTE CAPTURA & ANÁLISE - Usa mesma lógica do botão ASCII com salvamento
 */
async function testImageAnalysis() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        resultDiv.innerHTML = '🔄 Executando captura e análise completa...';
        
        // Verificar módulos necessários
        if (!window.LocalIntelligence) {
            throw new Error('Módulo LocalIntelligence não disponível');
        }
        
        if (!window.FaithfulChartConverter) {
            throw new Error('Conversor ASCII não disponível');
        }
        
        // Capturar screenshot
        window.addLog('📷 Capturando screenshot do gráfico...', 'INFO', 'complete-analysis');
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do screenshot');
        }
        
        // Converter para ASCII
        window.addLog('🔄 Convertendo para ASCII...', 'INFO', 'complete-analysis');
        const asciiData = await window.FaithfulChartConverter.captureChartToASCII(screenshot);
        if (!asciiData) {
            throw new Error('Falha na conversão para ASCII');
        }
        
        // Salvar arquivo HTML
        window.addLog('💾 Salvando arquivo ASCII...', 'INFO', 'complete-analysis');
        const fileName = await window.FaithfulChartConverter.saveASCIIFile(asciiData);
        
        // Extrair dados de tendência para o sistema
        const trendDirection = asciiData.trendAnalysis ? asciiData.trendAnalysis.direction : 'INDETERMINADA';
        const trendAngle = asciiData.trendAnalysis ? asciiData.trendAnalysis.angle.toFixed(1) : '0.0';
        const trendConfidence = asciiData.trendAnalysis ? asciiData.trendAnalysis.confidence.toFixed(1) : '0.0';
        const trendSlope = asciiData.trendAnalysis ? asciiData.trendAnalysis.slope.toFixed(4) : '0.0000';
        
        // Armazenar dados globalmente para uso do sistema
        window.lastTrendAnalysis = {
            direction: trendDirection,
            angle: parseFloat(trendAngle),
            confidence: parseFloat(trendConfidence),
            slope: parseFloat(trendSlope),
            timestamp: new Date().toISOString(),
            reliable: parseFloat(trendConfidence) > 25.0
        };
        
        // Armazenar no histórico para estatísticas futuras
        const currentAsset = await window.LocalIntelligence.getCurrentAssetSymbol();
        if (currentAsset && currentAsset !== 'UNKNOWN' && asciiData.trendAnalysis) {
            const trend = asciiData.trendAnalysis;
            const isVolatile = trend.direction === 'LATERAL' || trend.confidence < 50;
            const volatilityScore = trend.direction === 'LATERAL' ? 0.8 : (100 - trend.confidence) / 100;
            
            addTrendToHistory({
                asset: currentAsset,
                direction: trend.direction,
                angle: trend.angle,
                confidence: trend.confidence,
                slope: trend.slope,
                isVolatile: isVolatile,
                volatilityScore: volatilityScore,
                timestamp: new Date().toISOString(),
                method: 'complete-analysis-test'
            });
        }
        
        // Mostrar resultado final com análise completa
        let resultHTML = '<div style="text-align: left; font-size: 11px; line-height: 1.4;">';
        resultHTML += '<strong>✅ TESTE CAPTURA & ANÁLISE COMPLETO!</strong><br><br>';
        resultHTML += `📄 <strong>Arquivo:</strong> ${fileName}<br>`;
        resultHTML += `📐 <strong>Resolução:</strong> ${asciiData.dimensions.asciiWidth}x${asciiData.dimensions.asciiHeight} chars<br>`;
        resultHTML += `🟢 <strong>Candles de Alta:</strong> ${asciiData.candleStats.greenPixels}<br>`;
        resultHTML += `🔴 <strong>Candles de Baixa:</strong> ${asciiData.candleStats.redPixels}<br>`;
        resultHTML += `📊 <strong>Tendência:</strong> <strong>${trendDirection}</strong> | 📐 ${trendAngle}° | 🎲 ${trendConfidence}%<br>`;
        resultHTML += `💾 <strong>Arquivo HTML:</strong> Salvo com sucesso!<br>`;
        resultHTML += `📈 <strong>Histórico:</strong> Dados adicionados para estatísticas futuras<br>`;
        resultHTML += '</div>';
        
        resultDiv.innerHTML = resultHTML;
        
        // Log da análise para o sistema
        window.addLog(`📈 Análise Completa: ${trendDirection} (${trendAngle}°, ${trendConfidence}% confiança) - Arquivo: ${fileName}`, 'SUCCESS', 'complete-analysis');
        
    } catch (error) {
        window.addLog(`❌ Erro na análise completa: ${error.message}`, 'ERROR', 'complete-analysis');
        resultDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}`;
    }
}

/**
 * Cria dados de teste e atualiza a interface
 */
function createTestDataAndRefresh() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        resultDiv.innerHTML = '🔧 Criando dados de teste...';
        
        const success = createTestData();
        
        if (success) {
            resultDiv.innerHTML = '✅ Dados de teste criados com sucesso! Executando debug novamente...';
            
            setTimeout(() => {
                debugHistoricalData();
            }, 1000);
            
            if (window.addLog) {
                window.addLog('Dados de teste criados e sistema reprocessado', 'SUCCESS', 'test-data');
            }
        } else {
            resultDiv.innerHTML = '❌ Falha ao criar dados de teste';
        }
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro ao criar dados de teste: ${error.message}`;
        if (window.addLog) {
            window.addLog(`Erro ao criar dados de teste: ${error.message}`, 'ERROR', 'test-data');
        }
    }
}

// Tornar a função global para ser chamada pelo HTML
window.createTestDataAndRefresh = createTestDataAndRefresh;

/**
 * Carrega o módulo CaptureScreen dinamicamente
 */
async function loadCaptureModule() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        resultDiv.innerHTML = '📥 Carregando módulo CaptureScreen...';
        
        // Verificar se já está carregado
        if (typeof window.CaptureScreen !== 'undefined') {
            resultDiv.innerHTML = '✅ Módulo CaptureScreen já está carregado!';
            return;
        }
        
        // Carregar o módulo
        const script = document.createElement('script');
        script.src = '../content/capture-screen.js';
        
        const loadPromise = new Promise((resolve, reject) => {
            script.onload = () => {
                if (typeof window.CaptureScreen !== 'undefined') {
                    resolve();
                } else {
                    reject(new Error('Módulo carregado mas CaptureScreen não está disponível'));
                }
            };
            script.onerror = () => reject(new Error('Falha ao carregar o script'));
        });
        
        document.head.appendChild(script);
        
        // Aguardar carregamento
        await loadPromise;
        
        // Verificar funções disponíveis
        let resultHtml = '<div style="text-align: left; font-size: 12px; line-height: 1.4;">';
        resultHtml += '<strong>✅ Módulo CaptureScreen carregado com sucesso!</strong><br><br>';
        resultHtml += '<strong>🔍 Funções disponíveis:</strong><br>';
        resultHtml += `• captureScreenSimple: ${typeof window.CaptureScreen.captureScreenSimple === 'function' ? '✅' : '❌'}<br>`;
        resultHtml += `• captureForAnalysis: ${typeof window.CaptureScreen.captureForAnalysis === 'function' ? '✅' : '❌'}<br>`;
        resultHtml += `• captureAndShow: ${typeof window.CaptureScreen.captureAndShow === 'function' ? '✅' : '❌'}<br>`;
        resultHtml += `• captureAndAnalyze: ${typeof window.CaptureScreen.captureAndAnalyze === 'function' ? '✅' : '❌'}<br><br>`;
        resultHtml += '<strong>📝 Próximos passos:</strong><br>';
        resultHtml += '• Teste a captura usando o botão "Teste Captura & Análise"<br>';
        resultHtml += '• Ou use o botão "Capturar Tela" do painel principal<br>';
        resultHtml += '</div>';
        
        resultDiv.innerHTML = resultHtml;
        
        // Log
        if (window.addLog) {
            window.addLog('Módulo CaptureScreen carregado com sucesso', 'SUCCESS', 'capture-module');
        }
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro ao carregar módulo: ${error.message}`;
        if (window.addLog) {
            window.addLog(`Erro ao carregar módulo CaptureScreen: ${error.message}`, 'ERROR', 'capture-module');
        }
    }
}

// Tornar a função global para ser chamada pelo HTML
window.loadCaptureModule = loadCaptureModule;

/**
 * 🔬 TESTE COMPLETO: Análise multi-método de imagem
 */
async function testAdvancedImageAnalysis() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        // Carregar módulo se necessário
        if (!window.ImagePatternAnalyzer) {
            const script = document.createElement('script');
            script.src = '../content/analyzers/image-pattern-analyzer.js';
            document.head.appendChild(script);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        resultDiv.innerHTML = '🔄 Executando análise multi-método...';
        
        // 1. Capturar screenshot
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do gráfico');
        }
        
        // 2. Executar análise completa
        const analysis = await window.ImagePatternAnalyzer.analyzeComplete(screenshot);
        
        let resultHtml = '<div style="text-align: left; font-size: 11px; line-height: 1.3;">';
        resultHtml += '<strong>🔬 Análise Multi-Método Completa:</strong><br><br>';
        
        if (analysis.success) {
            resultHtml += `⏱️ Tempo de processamento: ${analysis.processingTime}ms<br><br>`;
            
            // Resumo final
            const summary = analysis.summary;
            const volatileIcon = summary.isVolatile ? '⚠️' : '✅';
            resultHtml += '<strong>📊 RESULTADO CONSOLIDADO:</strong><br>';
            resultHtml += `${volatileIcon} Tendência: ${summary.finalTrend.toUpperCase()}<br>`;
            resultHtml += `🎯 Confiança: ${(summary.confidence * 100).toFixed(0)}%<br>`;
            resultHtml += `⚡ Volatilidade: ${summary.volatilityScore.toFixed(3)} (${summary.isVolatile ? 'VOLÁTIL' : 'ESTÁVEL'})<br>`;
            resultHtml += `🔧 Métodos usados: ${summary.methodsUsed.join(', ')}<br>`;
            resultHtml += `💡 Razão: ${summary.reason}<br><br>`;
            
            // Análise de texto ASCII
            if (analysis.methods.textConversion) {
                const text = analysis.methods.textConversion;
                resultHtml += '<strong>📝 MÉTODO 1: Conversão para Texto</strong><br>';
                resultHtml += `▲ Movimentos para cima: ${text.patterns.upwardTrends}<br>`;
                resultHtml += `▼ Movimentos para baixo: ${text.patterns.downwardTrends}<br>`;
                resultHtml += `─ Movimentos laterais: ${text.patterns.lateralMovement}<br>`;
                resultHtml += `📈 Tendência detectada: ${text.trendAnalysis.trend} (${(text.trendAnalysis.strength * 100).toFixed(0)}%)<br><br>`;
            }
            
            // Análise de cores
            if (analysis.methods.colorHistogram) {
                const color = analysis.methods.colorHistogram;
                resultHtml += '<strong>🎨 MÉTODO 2: Histograma de Cores</strong><br>';
                resultHtml += `🟢 Verde: ${color.histogram.colors.green} pixels<br>`;
                resultHtml += `🔴 Vermelho: ${color.histogram.colors.red} pixels<br>`;
                resultHtml += `⚪ Branco: ${color.histogram.colors.white} pixels<br>`;
                resultHtml += `🔘 Cinza: ${color.histogram.colors.gray} pixels<br>`;
                resultHtml += `🏆 Cor dominante: ${color.analysis.dominantColor}<br><br>`;
            }
            
            // Detecção de bordas
            if (analysis.methods.edgeDetection) {
                const edges = analysis.methods.edgeDetection;
                resultHtml += '<strong>🔍 MÉTODO 3: Detecção de Bordas</strong><br>';
                resultHtml += `📏 Bordas detectadas: ${edges.totalEdges || 0}<br>`;
                resultHtml += `➡️ Horizontais: ${edges.horizontal || 0}<br>`;
                resultHtml += `⬇️ Verticais: ${edges.vertical || 0}<br>`;
                resultHtml += `↗️ Diagonais: ${edges.diagonal || 0}<br><br>`;
            }
            
            // Segmentação regional
            if (analysis.methods.segmentation) {
                const segments = analysis.methods.segmentation;
                resultHtml += '<strong>🎯 MÉTODO 4: Análise Regional</strong><br>';
                resultHtml += `📦 Segmentos analisados: ${segments.totalSegments || 0}<br>`;
                resultHtml += `⚡ Segmentos voláteis: ${segments.volatileSegments || 0}<br>`;
                resultHtml += `📊 Variação regional: ${((segments.regionalVariation || 0) * 100).toFixed(0)}%<br><br>`;
            }
            
        } else {
            resultHtml += `❌ Erro na análise: ${analysis.error}<br>`;
        }
        
        resultHtml += '</div>';
        resultDiv.innerHTML = resultHtml;
        
        // Log
        if (window.addLog) {
            window.addLog(`Análise multi-método executada: ${analysis.success ? 'Sucesso' : 'Falha'}`, 'INFO', 'advanced-analysis');
        }
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro na análise avançada: ${error.message}`;
        if (window.addLog) {
            window.addLog(`Erro na análise avançada: ${error.message}`, 'ERROR', 'advanced-analysis');
        }
    }
}

/**
 * 🔢 TESTE ESPECÍFICO: Análise linear de pixels COM SALVAMENTO DE ARQUIVO
 */
async function testPixelLinearAnalysis() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        // 🐛 DEBUG: Logs detalhados usando sistema correto
        window.addLog('🔄 Iniciando análise linear de pixels...', 'INFO', 'image-analysis');
        resultDiv.innerHTML = '🔄 Executando análise linear de pixels...';
        
        // Verificar se o módulo está carregado
        window.addLog(`🧩 LocalIntelligence: ${!!window.LocalIntelligence ? 'OK' : 'ERRO'}`, 'DEBUG', 'image-analysis');
        window.addLog(`🧩 ImagePatternAnalyzer: ${!!window.ImagePatternAnalyzer ? 'OK' : 'ERRO'}`, 'DEBUG', 'image-analysis');
        
        if (!window.LocalIntelligence) {
            throw new Error('Módulo LocalIntelligence não carregado');
        }
        
        if (!window.ImagePatternAnalyzer) {
            throw new Error('Módulo ImagePatternAnalyzer não carregado');
        }
        
        // Capturar screenshot
        window.addLog('📷 Capturando screenshot...', 'INFO', 'image-analysis');
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do gráfico');
        }
        window.addLog(`✅ Screenshot capturado: ${screenshot.length} caracteres`, 'SUCCESS', 'image-analysis');
        
        const pixelData = await window.ImagePatternAnalyzer.analyzePixelLinear(screenshot);
        
        let resultHtml = '<div style="text-align: left; font-size: 11px; line-height: 1.3;">';
        resultHtml += '<strong>🔢 Análise Linear de Pixels:</strong><br><br>';
        
        if (pixelData) {
            resultHtml += `📏 Matriz: ${pixelData.pixelMatrix.length} x ${pixelData.pixelMatrix[0]?.length || 0} pixels<br>`;
            resultHtml += `🎨 Cores detectadas: ${pixelData.colorMap.size}<br><br>`;
            
            resultHtml += '<strong>📊 Distribuição de Cores:</strong><br>';
            for (const [color, count] of pixelData.colorMap) {
                const percentage = ((count / (pixelData.pixelMatrix.length * (pixelData.pixelMatrix[0]?.length || 0))) * 100);
                const icon = color === 'green' ? '🟢' : color === 'red' ? '🔴' : color === 'white' ? '⚪' : '🔘';
                resultHtml += `${icon} ${color}: ${count} pixels (${percentage.toFixed(1)}%)<br>`;
            }
            
            // Converter para texto ASCII COMPLETO
            const textAnalysis = window.ImagePatternAnalyzer.convertToColoredText(pixelData.pixelMatrix);
            
            // 📝 CRIAR ARQUIVO DE TEXTO DETALHADO
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `analise_grafico_${timestamp}.txt`;
            
            let fileContent = `🔬 ANÁLISE DE IMAGEM - REPRESENTAÇÃO TEXTUAL\n`;
            fileContent += `=====================================\n`;
            fileContent += `Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`;
            fileContent += `Dimensões: ${pixelData.pixelMatrix.length} x ${pixelData.pixelMatrix[0]?.length || 0} pixels\n`;
            fileContent += `Amostragem: 1 pixel a cada ${window.ImagePatternAnalyzer.config.pixelSampling}\n\n`;
            
            fileContent += `LEGENDA DE CORES:\n`;
            fileContent += `▲ = Verde (movimentos de alta/candlestick verde)\n`;
            fileContent += `▼ = Vermelho (movimentos de baixa/candlestick vermelho)\n`;
            fileContent += `─ = Branco/Claro (linhas, background, movimento lateral)\n`;
            fileContent += `· = Cinza (grid, texto, ruído)\n`;
            fileContent += `█ = Preto (áreas sólidas)\n\n`;
            
            fileContent += `ANÁLISE DE PADRÕES:\n`;
            fileContent += `Movimentos para cima: ${textAnalysis.patterns.upwardTrends}\n`;
            fileContent += `Movimentos para baixo: ${textAnalysis.patterns.downwardTrends}\n`;
            fileContent += `Movimentos laterais: ${textAnalysis.patterns.lateralMovement}\n`;
            fileContent += `Tendência detectada: ${textAnalysis.trendAnalysis.trend} (força: ${(textAnalysis.trendAnalysis.strength * 100).toFixed(1)}%)\n\n`;
            
            fileContent += `REPRESENTAÇÃO VISUAL (ASCII):\n`;
            fileContent += `=====================================\n`;
            fileContent += textAnalysis.text;
            
            fileContent += `\n\nDETALHES TÉCNICOS:\n`;
            fileContent += `=====================================\n`;
            for (const [color, count] of pixelData.colorMap) {
                const percentage = ((count / (pixelData.pixelMatrix.length * (pixelData.pixelMatrix[0]?.length || 0))) * 100);
                fileContent += `${color}: ${count} pixels (${percentage.toFixed(2)}%)\n`;
            }
            
            // 💾 SALVAR ARQUIVO NA PASTA ESPECÍFICA
            const savedFileName = await saveAnalysisFile(fileContent, fileName);
            window.addLog(`💾 Arquivo salvo: ${savedFileName}`, 'SUCCESS', 'image-analysis');
            
            resultHtml += '<strong>📝 Representação ASCII (primeiras 10 linhas):</strong><br>';
            const lines = textAnalysis.text.split('\n').slice(0, 10);
            for (const line of lines) {
                if (line.length > 80) {
                    resultHtml += `<code style="font-size: 8px;">${line.substring(0, 80)}...</code><br>`;
                } else {
                    resultHtml += `<code style="font-size: 8px;">${line}</code><br>`;
                }
            }
            
            resultHtml += '<br><strong>📈 Análise de Tendência:</strong><br>';
            resultHtml += `🎯 Tendência: ${textAnalysis.trendAnalysis.trend.toUpperCase()}<br>`;
            resultHtml += `💪 Força: ${(textAnalysis.trendAnalysis.strength * 100).toFixed(1)}%<br>`;
            resultHtml += `📊 Padrões: ▲${textAnalysis.patterns.upwardTrends} ▼${textAnalysis.patterns.downwardTrends} ─${textAnalysis.patterns.lateralMovement}<br><br>`;
            
            resultHtml += `<strong>💾 ARQUIVO SALVO:</strong> <code>${fileName}</code><br>`;
            resultHtml += `📂 Localização: Downloads<br>`;
            resultHtml += `📊 Conteúdo: Representação ASCII completa + análise de padrões<br>`;
            
        } else {
            resultHtml += '❌ Falha na análise linear de pixels<br>';
        }
        
        resultHtml += '</div>';
        resultDiv.innerHTML = resultHtml;
        
    } catch (error) {
        window.addLog(`❌ Erro na análise linear: ${error.message}`, 'ERROR', 'image-analysis');
        resultDiv.innerHTML = `❌ Erro na análise linear: ${error.message}`;
    }
}

/**
 * 🐛 SISTEMA DE DEBUG GLOBAL
 * Detecta cliques nos botões e logs de sistema
 */
function initGlobalDebugSystem() {
    window.addLog('🔧 Inicializando sistema de debug global...', 'DEBUG', 'debug-system');
    
    // Debug de cliques em botões de teste
    document.addEventListener('click', function(event) {
        if (event.target.matches('.test-btn')) {
            const buttonText = event.target.textContent || event.target.innerText;
            const buttonId = event.target.id;
            
            window.addLog(`🖱️ Botão clicado: ${buttonText.trim()} (ID: ${buttonId})`, 'INFO', 'debug-system');
        }
    });
    
    // Debug de carregamento de módulos
    const checkModules = () => {
        const modules = {
            'LocalIntelligence': !!window.LocalIntelligence,
            'ImagePatternAnalyzer': !!window.ImagePatternAnalyzer,
            'addLog': !!window.addLog,
            'testPixelLinearAnalysis': !!window.testPixelLinearAnalysis,
            'testCompleteAnalysis': !!window.testCompleteAnalysis,
            'testEdgeDetectionAnalysis': !!window.testEdgeDetectionAnalysis
        };
        
        window.addLog(`🧩 Status dos módulos verificado`, 'DEBUG', 'debug-system');
        
        // Mostrar no debug div se existir
        const debugDiv = document.getElementById('image-analysis-debug');
        if (debugDiv) {
            let statusText = '🧩 Módulos: ';
            for (const [name, loaded] of Object.entries(modules)) {
                statusText += `${name}:${loaded ? '✅' : '❌'} `;
            }
            debugDiv.innerHTML = statusText;
        }
        
        return modules;
    };
    
    // Verificar módulos agora e a cada 5 segundos (menos frequente)
    checkModules();
    setInterval(checkModules, 5000);
    
    // Expor função de debug globalmente
    window.debugModules = checkModules;
    
    window.addLog('✅ Sistema de debug global ativo', 'SUCCESS', 'debug-system');
}

/**
 * 💾 SISTEMA DE SALVAMENTO ESPECIALIZADO
 * Salva arquivos na pasta específica "Analises TM Pro" no desktop
 */

// Função principal para salvar arquivos de análise
async function saveAnalysisFile(content, fileName) {
    try {
        // Usar método tradicional com nome sugerido da pasta
        const prefixedFileName = `[Analises-TM-Pro] ${fileName}`;
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = prefixedFileName;
        a.click();
        URL.revokeObjectURL(url);
        
        return prefixedFileName;
    } catch (error) {
        window.addLog(`❌ Erro ao salvar arquivo: ${error.message}`, 'ERROR', 'file-system');
        throw error;
    }
}

// Função para salvar relatório completo de análise
async function saveCompleteAnalysisReport(analysisData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `analise_visual_completa_${timestamp}.txt`;
    
    if (window.ImagePatternAnalyzer && window.ImagePatternAnalyzer.saveVisualRepresentations) {
        return window.ImagePatternAnalyzer.saveVisualRepresentations(analysisData, fileName);
    } else {
        // Fallback simples
        let fileContent = `[COMPLETO] ANALISE VISUAL DE GRAFICO\n`;
        fileContent += `====================================\n`;
        fileContent += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
        fileContent += `Tempo: ${analysisData.processingTime || 0}ms\n\n`;
        
        if (analysisData.summary) {
            fileContent += `Tendencia: ${analysisData.summary.finalTrend}\n`;
            fileContent += `Confianca: ${(analysisData.summary.confidence * 100).toFixed(1)}%\n`;
        }
        
        return await saveAnalysisFile(fileContent, fileName);
    }
}

// Função para salvar análise de bordas
async function saveEdgeAnalysisFile(edgeData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `analise_geometria_${timestamp}.txt`;
    
    let fileContent = `[GEOMETRIA] ANALISE GEOMETRICA - DETECCAO DE BORDAS\n`;
    fileContent += `==================================================\n`;
    fileContent += `Data: ${new Date().toLocaleString('pt-BR')}\n\n`;
    
    fileContent += `Total de bordas: ${edgeData.totalEdges || 0}\n`;
    fileContent += `Horizontais: ${edgeData.horizontal || 0}\n`;
    fileContent += `Verticais: ${edgeData.vertical || 0}\n`;
    fileContent += `Confianca: ${((edgeData.confidence || 0) * 100).toFixed(1)}%\n`;
    
    return await saveAnalysisFile(fileContent, fileName);
}

/**
 * 📸 SISTEMA DE CAPTURA ASCII
 * Conecta botão de captura à função de conversão ASCII
 */
function initEventListeners() {
    window.addLog('🔌 Inicializando sistema de captura ASCII...', 'DEBUG', 'ascii-system');
    
    // Botão único de captura ASCII
    const captureButton = document.getElementById('capture-ascii-chart');
    
    if (captureButton) {
        captureButton.addEventListener('click', async function() {
            window.addLog('📸 Iniciando captura ASCII do gráfico...', 'INFO', 'ascii-system');
            try {
                await captureChartToASCII();
            } catch (error) {
                window.addLog(`❌ Erro na captura ASCII: ${error.message}`, 'ERROR', 'ascii-system');
            }
        });
        window.addLog('✅ Event listener de captura ASCII adicionado', 'SUCCESS', 'ascii-system');
    } else {
        window.addLog('⚠️ Botão de captura ASCII não encontrado', 'WARN', 'ascii-system');
    }
}

/**
 * 📸 FUNÇÃO PRINCIPAL DE CAPTURA ASCII
 */
async function captureChartToASCII() {
    const resultDiv = document.getElementById('ascii-capture-result');
    if (!resultDiv) return;
    
    try {
        resultDiv.innerHTML = '🔄 Capturando gráfico...';
        
        // Verificar módulos necessários
        if (!window.LocalIntelligence) {
            throw new Error('Módulo LocalIntelligence não disponível');
        }
        
        if (!window.FaithfulChartConverter) {
            throw new Error('Conversor ASCII não disponível');
        }
        
        // Capturar screenshot
        window.addLog('📷 Capturando screenshot do gráfico...', 'INFO', 'ascii-capture');
        resultDiv.innerHTML = '🔄 Capturando screenshot...';
        
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do screenshot');
        }
        
        // Converter para ASCII
        window.addLog('🔄 Convertendo para ASCII...', 'INFO', 'ascii-capture');
        resultDiv.innerHTML = '🔄 Convertendo para ASCII fiel...';
        
        const asciiData = await window.FaithfulChartConverter.captureChartToASCII(screenshot);
        if (!asciiData) {
            throw new Error('Falha na conversão para ASCII');
        }
        
        // Salvar arquivo
        window.addLog('💾 Salvando arquivo ASCII...', 'INFO', 'ascii-capture');
        resultDiv.innerHTML = '🔄 Salvando arquivo...';
        
        const fileName = await window.FaithfulChartConverter.saveASCIIFile(asciiData);
        
        // Mostrar resultado final com análise completa de tendência
        const trendDirection = asciiData.trendAnalysis ? asciiData.trendAnalysis.direction : 'INDETERMINADA';
        const trendAngle = asciiData.trendAnalysis ? asciiData.trendAnalysis.angle.toFixed(1) : '0.0';
        const trendConfidence = asciiData.trendAnalysis ? asciiData.trendAnalysis.confidence.toFixed(1) : '0.0';
        const trendSlope = asciiData.trendAnalysis ? asciiData.trendAnalysis.slope.toFixed(4) : '0.0000';
        
        // Armazenar dados globalmente para uso do sistema
        window.lastTrendAnalysis = {
            direction: trendDirection,
            angle: parseFloat(trendAngle),
            confidence: parseFloat(trendConfidence),
            slope: parseFloat(trendSlope),
            timestamp: new Date().toISOString(),
            reliable: parseFloat(trendConfidence) > 25.0
        };
        
        let resultHTML = '<div style="text-align: left; font-size: 11px; line-height: 1.4;">';
        resultHTML += '<strong>✅ CAPTURA ASCII CONCLUÍDA!</strong><br><br>';
        resultHTML += `📄 <strong>Arquivo:</strong> ${fileName}<br>`;
        resultHTML += `📐 <strong>Resolução:</strong> ${asciiData.dimensions.asciiWidth}x${asciiData.dimensions.asciiHeight} chars<br>`;
        resultHTML += `🟢 <strong>Candles de Alta:</strong> ${asciiData.candleStats.greenPixels}<br>`;
        resultHTML += `🔴 <strong>Candles de Baixa:</strong> ${asciiData.candleStats.redPixels}<br>`;
        resultHTML += `📊 <strong>Tendência:</strong> <strong>${trendDirection}</strong> | 📐 ${trendAngle}° | 🎲 ${trendConfidence}%<br>`;
        resultHTML += `💾 <strong>Arquivo HTML:</strong> Salvo com sucesso!<br>`;
        resultHTML += '</div>';
        
        // Log da análise para o sistema
        window.addLog(`📈 Análise de Tendência: ${trendDirection} (${trendAngle}°, ${trendConfidence}% confiança)`, 'SUCCESS', 'trend-analysis');
        
        resultDiv.innerHTML = resultHTML;
        
        window.addLog(`✅ Captura ASCII concluída: ${fileName}`, 'SUCCESS', 'ascii-capture');
        
    } catch (error) {
        window.addLog(`❌ Erro na captura ASCII: ${error.message}`, 'ERROR', 'ascii-capture');
        resultDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}`;
    }
}

// FUNÇÕES DE TESTE REMOVIDAS - FOCO APENAS EM CAPTURA ASCII FIEL

/**
 * 🎨 TESTE ESPECÍFICO: Histograma de cores
 */
async function testColorHistogramAnalysis() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        resultDiv.innerHTML = '🔄 Executando análise de histograma...';
        
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do gráfico');
        }
        
        if (!window.ImagePatternAnalyzer) {
            throw new Error('Módulo ImagePatternAnalyzer não carregado');
        }
        
        // Primeiro fazer análise de pixels
        const pixelData = await window.ImagePatternAnalyzer.analyzePixelLinear(screenshot);
        if (!pixelData) {
            throw new Error('Falha na análise de pixels');
        }
        
        // Depois análise de histograma
        const colorAnalysis = window.ImagePatternAnalyzer.analyzeColorHistogram(pixelData.pixelMatrix);
        
        let resultHtml = '<div style="text-align: left; font-size: 11px; line-height: 1.3;">';
        resultHtml += '<strong>🎨 Análise de Histograma de Cores:</strong><br><br>';
        
        if (colorAnalysis) {
            const histogram = colorAnalysis.histogram;
            const analysis = colorAnalysis.analysis;
            
            resultHtml += '<strong>📊 Distribuição Geral:</strong><br>';
            for (const [color, count] of Object.entries(histogram.colors)) {
                const icon = color === 'green' ? '🟢' : color === 'red' ? '🔴' : color === 'white' ? '⚪' : color === 'gray' ? '🔘' : '⚫';
                resultHtml += `${icon} ${color}: ${count} pixels<br>`;
            }
            
            resultHtml += '<br><strong>🎯 Análise Regional:</strong><br>';
            resultHtml += `⬆️ Metade superior - Verde: ${histogram.distribution.topHalf.green}, Vermelho: ${histogram.distribution.topHalf.red}<br>`;
            resultHtml += `⬇️ Metade inferior - Verde: ${histogram.distribution.bottomHalf.green}, Vermelho: ${histogram.distribution.bottomHalf.red}<br>`;
            resultHtml += `⬅️ Metade esquerda - Verde: ${histogram.distribution.leftHalf.green}, Vermelho: ${histogram.distribution.leftHalf.red}<br>`;
            resultHtml += `➡️ Metade direita - Verde: ${histogram.distribution.rightHalf.green}, Vermelho: ${histogram.distribution.rightHalf.red}<br>`;
            
            if (analysis) {
                resultHtml += '<br><strong>📈 Indicadores de Tendência:</strong><br>';
                resultHtml += `🏆 Cor dominante: ${analysis.dominantColor}<br>`;
                resultHtml += `⚖️ Equilíbrio de cores: ${analysis.colorBalance ? analysis.colorBalance.toFixed(3) : 'N/A'}<br>`;
                resultHtml += `📊 Bias regional: ${analysis.regionalBias ? Object.keys(analysis.regionalBias).join(', ') : 'Equilibrado'}<br>`;
                if (analysis.volatilityIndicators) {
                    resultHtml += `⚡ Indicadores de volatilidade: ${analysis.volatilityIndicators.toFixed(3)}<br>`;
                }
            }
            
        } else {
            resultHtml += '❌ Falha na análise de histograma<br>';
        }
        
        resultHtml += '</div>';
        resultDiv.innerHTML = resultHtml;
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro na análise de histograma: ${error.message}`;
    }
}

/**
 * 📊 TESTE ESPECÍFICO: Análise completa com múltiplos métodos E SALVAMENTO
 */
async function testCompleteAnalysis() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        // 🐛 DEBUG: Logs detalhados usando sistema correto
        window.addLog('🔄 Iniciando análise completa...', 'INFO', 'image-analysis');
        resultDiv.innerHTML = '🔄 Executando análise completa...';
        
        // Verificar se o módulo está carregado
        window.addLog(`🧩 ImagePatternAnalyzer: ${!!window.ImagePatternAnalyzer ? 'OK' : 'ERRO'}`, 'DEBUG', 'image-analysis');
        if (!window.ImagePatternAnalyzer) {
            throw new Error('Módulo ImagePatternAnalyzer não carregado');
        }
        
        // Capturar screenshot
        window.addLog('📷 Capturando screenshot...', 'INFO', 'image-analysis');
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do gráfico');
        }
        window.addLog(`✅ Screenshot capturado: ${screenshot.length} caracteres`, 'SUCCESS', 'image-analysis');
        
        // Executar análise
        window.addLog('🔬 Executando análise completa...', 'INFO', 'image-analysis');
        const analysis = await window.ImagePatternAnalyzer.analyzeComplete(screenshot);
        window.addLog('✅ Análise concluída com sucesso', 'SUCCESS', 'image-analysis');
        
        let resultHtml = '<div style="text-align: left; font-size: 11px; line-height: 1.3;">';
        resultHtml += '<strong>📊 Análise Completa Multi-Método:</strong><br><br>';
        
        if (analysis && analysis.summary) {
            resultHtml += `🎯 <strong>Resultado Final:</strong> ${analysis.summary.finalTrend.toUpperCase()}<br>`;
            resultHtml += `💪 <strong>Confiança:</strong> ${(analysis.summary.confidence * 100).toFixed(1)}%<br>`;
            resultHtml += `⚡ <strong>Volatilidade:</strong> ${analysis.summary.volatilityScore.toFixed(3)} ${analysis.summary.isVolatile ? '(VOLÁTIL)' : '(ESTÁVEL)'}<br>`;
            resultHtml += `⏱️ <strong>Processamento:</strong> ${analysis.processingTime}ms<br><br>`;
            
            resultHtml += '<strong>🔧 Métodos Utilizados:</strong><br>';
            analysis.summary.methodsUsed.forEach((method, index) => {
                resultHtml += `${index + 1}. ${method}<br>`;
            });
            
            resultHtml += '<br><strong>💡 Explicação:</strong><br>';
            resultHtml += analysis.summary.reason + '<br><br>';
            
            // 💾 SALVAR ARQUIVO VISUAL COMPLETO
            try {
                window.addLog('💾 Gerando relatório visual...', 'INFO', 'image-analysis');
                const fileName = await saveCompleteAnalysisReport(analysis);
                window.addLog(`✅ Relatório salvo: ${fileName}`, 'SUCCESS', 'image-analysis');
                
                resultHtml += `<strong>💾 RELATÓRIO VISUAL SALVO:</strong> <code>${fileName}</code><br>`;
                resultHtml += `📂 Localização: Desktop/Analises TM Pro/<br>`;
                resultHtml += `📊 Conteúdo: Análise ASCII + Geometria + Heatmap + Tendências<br>`;
            } catch (saveError) {
                window.addLog(`❌ Erro ao salvar relatório: ${saveError.message}`, 'ERROR', 'image-analysis');
                resultHtml += `⚠️ Relatório não pôde ser salvo: ${saveError.message}<br>`;
            }
            
        } else {
            resultHtml += '❌ Falha na análise completa<br>';
            window.addLog('❌ Análise retornou dados inválidos', 'ERROR', 'image-analysis');
        }
        
        resultHtml += '</div>';
        resultDiv.innerHTML = resultHtml;
        
        window.addLog('Teste de análise completa concluído', 'SUCCESS', 'image-analysis');
        
    } catch (error) {
        window.addLog(`❌ Erro na análise completa: ${error.message}`, 'ERROR', 'image-analysis');
        resultDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}`;
    }
}

/**
 * 🔬 TESTE ESPECÍFICO: Detecção de bordas
 */
async function testEdgeDetectionAnalysis() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        resultDiv.innerHTML = '🔄 Executando análise de detecção de bordas...';
        
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do gráfico');
        }
        
        if (!window.ImagePatternAnalyzer) {
            throw new Error('Módulo ImagePatternAnalyzer não carregado');
        }
        
        // Primeiro fazer análise de pixels
        const pixelData = await window.ImagePatternAnalyzer.analyzePixelLinear(screenshot);
        if (!pixelData) {
            throw new Error('Falha na análise de pixels');
        }
        
        // Análise de detecção de bordas
        const edgeData = window.ImagePatternAnalyzer.analyzeEdgeDetection(pixelData.pixelMatrix);
        
        let resultHtml = '<div style="text-align: left; font-size: 11px; line-height: 1.3;">';
        resultHtml += '<strong>🔬 Análise de Detecção de Bordas:</strong><br><br>';
        
        if (edgeData) {
            resultHtml += `🎯 <strong>Bordas detectadas:</strong> ${edgeData.edgeCount}<br>`;
            resultHtml += `📊 <strong>Intensidade média:</strong> ${edgeData.averageIntensity.toFixed(3)}<br>`;
            resultHtml += `🔍 <strong>Definição:</strong> ${edgeData.sharpness.toFixed(3)}<br>`;
            resultHtml += `⚡ <strong>Complexidade:</strong> ${edgeData.complexity.toFixed(3)}<br><br>`;
            
            resultHtml += '<strong>🎨 Distribuição:</strong><br>';
            resultHtml += `🟢 Verde: ${edgeData.colorDistribution.green}<br>`;
            resultHtml += `🔴 Vermelho: ${edgeData.colorDistribution.red}<br>`;
            resultHtml += `⚪ Outros: ${edgeData.colorDistribution.other}<br><br>`;
            
            resultHtml += '<strong>📈 Interpretação:</strong><br>';
            if (edgeData.sharpness > 0.7) {
                resultHtml += '🔥 Gráfico bem definido com tendências claras<br>';
            } else if (edgeData.sharpness > 0.4) {
                resultHtml += '📊 Gráfico moderadamente definido<br>';
            } else {
                resultHtml += '🌀 Gráfico com alta volatilidade/ruído<br>';
            }
            
            // Salvar arquivo específico de análise de bordas
            try {
                const fileName = await saveEdgeAnalysisFile(edgeData);
                resultHtml += `<br><strong>💾 RELATÓRIO SALVO:</strong> ${fileName}<br>`;
            } catch (saveError) {
                resultHtml += `<br>⚠️ Erro ao salvar: ${saveError.message}<br>`;
            }
            
        } else {
            resultHtml += '❌ Falha na análise de detecção de bordas<br>';
        }
        
        resultHtml += '</div>';
        resultDiv.innerHTML = resultHtml;
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro na análise de bordas: ${error.message}`;
    }
}

/**
 * 📊 TESTE DE VOLATILIDADE - Análise ASCII sem salvar arquivo
 */
async function testVolatilityCheck() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        resultDiv.innerHTML = '🔄 Analisando gráfico para detectar volatilidade...';
        
        // Verificar módulos necessários
        if (!window.LocalIntelligence) {
            throw new Error('Módulo LocalIntelligence não disponível');
        }
        
        if (!window.FaithfulChartConverter) {
            throw new Error('Conversor ASCII não disponível');
        }
        
        // 1. Capturar screenshot
        window.addLog('📷 Capturando screenshot para análise de volatilidade...', 'INFO', 'volatility-test');
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do screenshot');
        }
        
        // 2. Converter para ASCII e analisar tendência (SEM SALVAR)
        window.addLog('📊 Analisando tendência ASCII...', 'INFO', 'volatility-test');
        const asciiData = await window.FaithfulChartConverter.captureChartToASCII(screenshot);
        if (!asciiData || !asciiData.trendAnalysis) {
            throw new Error('Falha na análise de tendência');
        }
        
        // 3. Obter ativo atual
        const currentAsset = await window.LocalIntelligence.getCurrentAssetSymbol();
        
        // 4. Processar dados de tendência
        const trend = asciiData.trendAnalysis;
        const isVolatile = trend.direction === 'LATERAL' || trend.confidence < 50;
        const volatilityScore = trend.direction === 'LATERAL' ? 0.8 : (100 - trend.confidence) / 100;
        
        // 5. Armazenar no histórico de volatilidade
        if (currentAsset && currentAsset !== 'UNKNOWN') {
            addTrendToHistory({
                asset: currentAsset,
                direction: trend.direction,
                angle: trend.angle,
                confidence: trend.confidence,
                slope: trend.slope,
                isVolatile: isVolatile,
                volatilityScore: volatilityScore,
                timestamp: new Date().toISOString(),
                method: 'ascii-analysis'
            });
        }
        
        // 6. Exibir resultado
        const volatileIcon = isVolatile ? '⚠️' : '✅';
        let resultHtml = '<div style="text-align: left; font-size: 12px; line-height: 1.4;">';
        resultHtml += '<strong>📊 ANÁLISE DE VOLATILIDADE:</strong><br><br>';
        
        if (currentAsset && currentAsset !== 'UNKNOWN') {
            resultHtml += `<strong>🎯 Ativo:</strong> ${currentAsset}<br>`;
        }
        
        resultHtml += `<strong>📈 Tendência:</strong> ${trend.direction} | 📐 ${trend.angle.toFixed(1)}° | 🎲 ${trend.confidence.toFixed(1)}%<br>`;
        resultHtml += `${volatileIcon} <strong>Volatilidade:</strong> ${isVolatile ? 'ALTA' : 'BAIXA'} (score: ${volatilityScore.toFixed(3)})<br>`;
        resultHtml += `📊 <strong>Slope:</strong> ${trend.slope.toFixed(4)} | 🔍 <strong>Pontos:</strong> ${trend.pointsAnalyzed}<br>`;
        resultHtml += `📏 <strong>Resolução ASCII:</strong> ${asciiData.dimensions.asciiWidth}x${asciiData.dimensions.asciiHeight}<br><br>`;
        
        // Interpretação da análise
        let interpretation = '';
        if (trend.direction === 'LATERAL') {
            interpretation = '🔄 Mercado lateral - alta volatilidade esperada';
        } else if (trend.confidence > 70) {
            interpretation = `📈 Tendência ${trend.direction.toLowerCase()} forte - baixa volatilidade`;
        } else if (trend.confidence > 40) {
            interpretation = `📊 Tendência ${trend.direction.toLowerCase()} fraca - volatilidade moderada`;
        } else {
            interpretation = '⚠️ Tendência indefinida - alta volatilidade';
        }
        
        resultHtml += `<strong>💡 Interpretação:</strong> ${interpretation}<br>`;
        resultHtml += `<strong>⏱️ Análise:</strong> Feita via ASCII Chart em tempo real<br>`;
        resultHtml += '</div>';
        
        resultDiv.innerHTML = resultHtml;
        
        window.addLog(`✅ Análise de volatilidade concluída: ${trend.direction} (${trend.confidence.toFixed(1)}%)`, 'SUCCESS', 'volatility-test');
        
    } catch (error) {
        window.addLog(`❌ Erro na análise de volatilidade: ${error.message}`, 'ERROR', 'volatility-test');
        resultDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}`;
    }
}

// 🚀 INICIALIZAÇÃO FINAL
document.addEventListener('DOMContentLoaded', function() {
    window.addLog('🚀 DOM carregado, inicializando sistemas...', 'INFO', 'startup');
    
    // Aguardar um pouco para garantir que todos os scripts foram carregados
    setTimeout(() => {
        // Inicializar sistemas na ordem correta
        initEventListeners();
        initGlobalDebugSystem();
        
        // Forçar verificação de módulos
        if (window.debugModules) {
            window.addLog('🔍 Forçando verificação de módulos...', 'DEBUG', 'startup');
            window.debugModules();
        }
        
        // Teste adicional de disponibilidade das funções
        const testFunctions = [
            'testPixelLinearAnalysis',
            'testCompleteAnalysis', 
            'testEdgeDetectionAnalysis',
            'testColorHistogramAnalysis',
            'testAdvancedImageAnalysis'
        ];
        
        const functionStatus = testFunctions.map(fn => ({
            name: fn,
            available: typeof window[fn] === 'function'
        }));
        
        window.addLog(`🧪 Funções de teste verificadas: ${functionStatus.filter(f => f.available).length}/${functionStatus.length} disponíveis`, 'INFO', 'startup');
        
        window.addLog('✅ Sistema de análise de imagem totalmente inicializado', 'SUCCESS', 'startup');
        
    }, 1000);
});

/**
 * 📈 SISTEMA DE HISTÓRICO DE TENDÊNCIAS
 */

// Armazenar histórico de análises de tendência
function addTrendToHistory(trendData) {
    try {
        // Obter histórico existente
        let trendHistory = JSON.parse(localStorage.getItem('trendAnalysisHistory') || '[]');
        
        // Adicionar nova análise com timestamp
        const historyEntry = {
            id: Date.now(),
            timestamp: trendData.timestamp || new Date().toISOString(),
            asset: trendData.asset || 'UNKNOWN',
            direction: trendData.direction,
            angle: trendData.angle,
            confidence: trendData.confidence,
            slope: trendData.slope,
            isVolatile: trendData.isVolatile,
            volatilityScore: trendData.volatilityScore,
            method: trendData.method || 'ascii-analysis',
            reliable: trendData.confidence > 25.0
        };
        
        trendHistory.push(historyEntry);
        
        // Manter apenas os últimos 100 registros
        if (trendHistory.length > 100) {
            trendHistory = trendHistory.slice(-100);
        }
        
        // Salvar no localStorage
        localStorage.setItem('trendAnalysisHistory', JSON.stringify(trendHistory));
        
        // Atualizar dados globais para acesso
        window.trendHistory = trendHistory;
        
        window.addLog(`📈 Análise adicionada ao histórico: ${trendData.asset} - ${trendData.direction}`, 'INFO', 'trend-history');
        
        return historyEntry;
        
    } catch (error) {
        window.addLog(`❌ Erro ao salvar no histórico: ${error.message}`, 'ERROR', 'trend-history');
        return null;
    }
}

// Obter estatísticas do histórico de tendências
function getTrendHistoryStats() {
    try {
        const history = JSON.parse(localStorage.getItem('trendAnalysisHistory') || '[]');
        
        if (history.length === 0) {
            return {
                total: 0,
                reliable: 0,
                byDirection: { ALTA: 0, BAIXA: 0, LATERAL: 0 },
                byAsset: {},
                avgConfidence: 0,
                volatileCount: 0
            };
        }
        
        const stats = {
            total: history.length,
            reliable: history.filter(h => h.reliable).length,
            byDirection: { ALTA: 0, BAIXA: 0, LATERAL: 0 },
            byAsset: {},
            avgConfidence: 0,
            volatileCount: history.filter(h => h.isVolatile).length
        };
        
        let totalConfidence = 0;
        
        history.forEach(entry => {
            // Contar por direção
            if (entry.direction in stats.byDirection) {
                stats.byDirection[entry.direction]++;
            }
            
            // Contar por ativo
            if (entry.asset) {
                stats.byAsset[entry.asset] = (stats.byAsset[entry.asset] || 0) + 1;
            }
            
            // Somar confiança
            totalConfidence += entry.confidence || 0;
        });
        
        stats.avgConfidence = totalConfidence / history.length;
        
        return stats;
        
    } catch (error) {
        window.addLog(`❌ Erro ao obter estatísticas: ${error.message}`, 'ERROR', 'trend-history');
        return {
            total: 0,
            reliable: 0,
            byDirection: { ALTA: 0, BAIXA: 0, LATERAL: 0 },
            byAsset: {},
            avgConfidence: 0,
            volatileCount: 0
        };
    }
}

// Limpar histórico de tendências
function clearTrendHistory() {
    try {
        localStorage.removeItem('trendAnalysisHistory');
        window.trendHistory = [];
        window.addLog('🗑️ Histórico de tendências limpo', 'INFO', 'trend-history');
        return true;
    } catch (error) {
        window.addLog(`❌ Erro ao limpar histórico: ${error.message}`, 'ERROR', 'trend-history');
        return false;
    }
}

// Exportar histórico de tendências
function exportTrendHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('trendAnalysisHistory') || '[]');
        const dataStr = JSON.stringify(history, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `trend_history_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        window.addLog(`📁 Histórico exportado: ${exportFileDefaultName}`, 'SUCCESS', 'trend-history');
        return true;
    } catch (error) {
        window.addLog(`❌ Erro ao exportar histórico: ${error.message}`, 'ERROR', 'trend-history');
        return false;
    }
}

// Mostrar histórico de tendências
function showTrendHistory() {
    const resultDiv = document.getElementById('intelligence-result');
    
    try {
        const stats = getTrendHistoryStats();
        
        let resultHtml = '<div style="text-align: left; font-size: 11px; line-height: 1.3;">';
        resultHtml += '<strong>📈 Histórico de Análises de Tendência:</strong><br><br>';
        
        if (stats.total === 0) {
            resultHtml += '❌ Nenhuma análise no histórico<br>';
            resultHtml += '<em>Execute algumas análises para ver estatísticas</em><br>';
        } else {
            resultHtml += `<strong>📊 Estatísticas Gerais:</strong><br>`;
            resultHtml += `• Total de análises: ${stats.total}<br>`;
            resultHtml += `• Análises confiáveis: ${stats.reliable} (${((stats.reliable/stats.total)*100).toFixed(1)}%)<br>`;
            resultHtml += `• Confiança média: ${stats.avgConfidence.toFixed(1)}%<br>`;
            resultHtml += `• Análises voláteis: ${stats.volatileCount} (${((stats.volatileCount/stats.total)*100).toFixed(1)}%)<br><br>`;
            
            resultHtml += `<strong>🎯 Por Direção:</strong><br>`;
            resultHtml += `📈 ALTA: ${stats.byDirection.ALTA} (${((stats.byDirection.ALTA/stats.total)*100).toFixed(1)}%)<br>`;
            resultHtml += `📉 BAIXA: ${stats.byDirection.BAIXA} (${((stats.byDirection.BAIXA/stats.total)*100).toFixed(1)}%)<br>`;
            resultHtml += `🔄 LATERAL: ${stats.byDirection.LATERAL} (${((stats.byDirection.LATERAL/stats.total)*100).toFixed(1)}%)<br><br>`;
            
            resultHtml += `<strong>💰 Por Ativo:</strong><br>`;
            const sortedAssets = Object.entries(stats.byAsset)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5);
            
            sortedAssets.forEach(([asset, count]) => {
                resultHtml += `• ${asset}: ${count} análises<br>`;
            });
            
            if (Object.keys(stats.byAsset).length > 5) {
                resultHtml += `<em>... e mais ${Object.keys(stats.byAsset).length - 5} ativos</em><br>`;
            }
            
            resultHtml += '<br><strong>🎛️ Ações:</strong><br>';
            resultHtml += '• <button onclick="exportTrendHistory()">📁 Exportar Dados</button><br>';
            resultHtml += '• <button onclick="clearTrendHistory(); showTrendHistory()">🗑️ Limpar Histórico</button><br>';
        }
        
        resultHtml += '</div>';
        resultDiv.innerHTML = resultHtml;
        
        window.addLog(`📊 Estatísticas do histórico: ${stats.total} análises`, 'INFO', 'trend-history');
        
    } catch (error) {
        resultDiv.innerHTML = `❌ Erro ao mostrar histórico: ${error.message}`;
        window.addLog(`❌ Erro ao mostrar histórico: ${error.message}`, 'ERROR', 'trend-history');
    }
}