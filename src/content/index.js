// Verificar se o sistema de logs está disponível
logToSystem('Inicializando index.js', 'INFO', 'index.js');

// Tentar criar um teste de log se o sistema estiver disponível
if (typeof window.logToSystem === 'function') {
    window.logToSystem('Teste de sistema de logs a partir do index.js', 'DEBUG', 'index.js');
} else {
    logToSystem('Sistema de logs não detectado, tentando carregar via script...', 'WARN', 'index.js');
    
    // Função para tentar carregar o sistema de logs
    const loadLogSystem = () => {
        const script = document.createElement('script');
        script.src = '../content/log-sys.js';
        script.onload = () => {
            logToSystem('Sistema de logs carregado dinamicamente', 'INFO', 'index.js');
        };
        script.onerror = (err) => {
            logToSystem('Erro ao carregar sistema de logs: ' + err, 'ERROR', 'index.js');
        };
        document.head.appendChild(script);
    };
    
    // Tentar carregar o sistema de logs
    loadLogSystem();
}

// ================== VERIFICAÇÃO DE ELEMENTOS ==================
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

// ================== VARIÁVEIS GLOBAIS ==================
let isAutomationRunning = false;
let automationTimeout = null;

// Expor as constantes globalmente
window.API_KEY = 'AIzaSyDeYcYUxAN52DNrgZeFNcEfceVMoWJDjWk';
window.API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.API_KEY}`;

// ================== FUNÇÕES DE ANÁLISE ==================
/**
 * Executa a análise do gráfico
 */
const runAnalysis = async () => {
    try {
        updateStatus('Iniciando análise...', 'info');
        indexAddLog('Iniciando análise do gráfico...');
        
        // Verificar se o AnalyzeGraph está disponível
        if (!window.TradeManager?.AnalyzeGraph) {
            throw new Error('Módulo de análise não está disponível');
        }

        // Captura a tela
        const response = await chrome.runtime.sendMessage({ 
            action: 'initiateCapture',
            actionType: 'analyze',
            requireProcessing: true,
            iframeWidth: 480
        });

        if (response.error) {
            throw new Error(response.error);
        }

        indexAddLog('Captura de tela concluída, processando imagem...');

        // Processa a imagem e analisa
        const result = await window.TradeManager.AnalyzeGraph.processImage(response.dataUrl);
        
        if (!result.success) {
            throw new Error(result.error);
        }

        // Atualiza a interface com os resultados
        updateStatus(`Análise concluída: ${result.results.action}`, 'success');
        indexAddLog(`Análise: ${result.results.action} - Confiança: ${result.results.trust}%`);
        
        // Mostra o modal com os resultados
        showAnalysisModal(result.results);
        
        return result;
    } catch (error) {
        logToSystem(`Erro na análise: ${error.message}`, 'ERROR', 'index.js');
        updateStatus('Erro ao realizar análise', 'error');
        indexAddLog(`Erro na análise: ${error.message}`);
        throw error;
    }
};

// Função para mostrar o modal de resultados
function showAnalysisModal(result) {
    const modal = document.getElementById('analysis-modal');
    const actionElement = document.getElementById('result-action');
    const confidenceElement = document.getElementById('result-confidence');
    const reasonElement = document.getElementById('result-reason');
    const periodElement = document.getElementById('result-period');
    const valueElement = document.getElementById('result-value');
    const countdownElement = document.getElementById('countdown');
    const closeButton = document.getElementById('close-modal');
    const infoIcon = document.getElementById('info-icon');

    // Atualiza o conteúdo do modal
    actionElement.textContent = result.action;
    actionElement.className = `result-action ${result.action.toLowerCase()}`;
    confidenceElement.textContent = `${result.trust}%`;
    reasonElement.textContent = result.reason;
    periodElement.textContent = result.period || 'Não especificado';
    valueElement.textContent = result.entry || 'Não especificado';

    // Mostra o modal
    modal.style.display = 'block';

    // Configura o countdown
    let countdown = 15;
    let countdownInterval = null;

    const updateCountdown = () => {
        countdownElement.textContent = `Janela fecha em ${countdown}s`;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            modal.style.display = 'none';
        }
        countdown--;
    };

    countdownInterval = setInterval(updateCountdown, 1000);

    // Evento para fechar o modal
    closeButton.onclick = () => {
        clearInterval(countdownInterval);
        modal.style.display = 'none';
    };

    // Evento para cancelar o fechamento automático
    countdownElement.ondblclick = () => {
        clearInterval(countdownInterval);
        countdownElement.textContent = 'Cancelado';
        countdownElement.classList.add('cancelled');
    };

    // Fecha o modal ao clicar fora
    window.onclick = (event) => {
        if (event.target === modal) {
            clearInterval(countdownInterval);
            modal.style.display = 'none';
        }
    };
}

// ================== FUNÇÕES DE LOG ==================
// Função de log para index.js
const indexAddLog = (message, level = 'INFO', source = 'index.js') => {
    // Normalizar nível de log para maiúsculas
    const normalizedLevel = (level && typeof level === 'string') ? level.toUpperCase() : 'INFO';
    
    // Usar preferentemente o sistema global de logs
    if (typeof window.logToSystem === 'function') {
        window.logToSystem(message, normalizedLevel, source);
        return;
    }
    
    // Fallback para o sistema direto sysAddLog, se disponível
    if (typeof sysAddLog === 'function') {
        sysAddLog(message, normalizedLevel, source).catch(error => {
            logToSystem(`Erro ao usar sysAddLog: ${error}`, 'ERROR', source);
        });
        return;
    }
    
    // Último recurso: enviar via mensagem Chrome
    try {
        chrome.runtime.sendMessage({
            action: 'logMessage',
            message: message,
            level: normalizedLevel,
            source: source
        });
    } catch (error) {
        logToSystem(`Erro ao enviar log: ${error}`, 'ERROR', source);
    }
};

// =======================================================================================
// ================== FUNCOES - STATUS DE INTERFACE ==================
// =======================================================================================

// Função para atualizar o status do processo
// Variável para controlar o número de tentativas de atualização de status
let statusUpdateAttempts = 0;
const MAX_STATUS_UPDATE_ATTEMPTS = 3;

const updateStatus = (message, type = 'info', duration = 3000) => {
    // Verificar se o elemento existe
    const statusElement = document.querySelector('#status-processo');
    if (!statusElement) {
        // Incrementar contador de tentativas
        statusUpdateAttempts++;
        
        // Se excedeu o número máximo de tentativas, apenas registrar o erro e parar
        if (statusUpdateAttempts >= MAX_STATUS_UPDATE_ATTEMPTS) {
            logToSystem(`Elemento status-processo não encontrado após ${MAX_STATUS_UPDATE_ATTEMPTS} tentativas. Mensagem: ${message}`, 'ERROR', 'index.js');
            // Resetar contador para futuras chamadas
            statusUpdateAttempts = 0;
            return;
        }
        
        logToSystem(`Elemento status-processo não encontrado, tentativa ${statusUpdateAttempts}/${MAX_STATUS_UPDATE_ATTEMPTS}...`, 'WARN', 'index.js');
        // Tentar novamente após 1 segundo, mas com limite de tentativas
        setTimeout(() => updateStatus(message, type, duration), 3000);
        return;
    }
    
    // Se chegou aqui, encontrou o elemento, então resetar contador
    statusUpdateAttempts = 0;
    
    // Adicionar a classe visible para garantir que o elemento seja visível
    statusElement.classList.add('visible');
    
    // Atualizar o conteúdo e a classe
    statusElement.textContent = message;
    statusElement.className = `status-processo ${type} visible`;
    
    // Registrar o status como log
    indexAddLog(`Status atualizado: ${message}`, type.toUpperCase());
    
    // Se duration for 0, manter a mensagem permanentemente
    if (duration > 0) {
        setTimeout(() => {
            if (statusElement) {
                statusElement.textContent = 'Status: Sistema operando normalmente';
                statusElement.className = 'status-processo info visible';
                
                // Adicionar log quando o sistema volta ao estado "operando normalmente"
                indexAddLog('Status: Sistema operando normalmente', 'INFO');
            }
        }, duration);
    }
};

// Exemplo de uso - ao iniciar sistema!
updateStatus('Sistema iniciado com sucesso!', 'success');
// use 'success' para mensagem verde.
// use 'info' para mensagem azul.
// use 'error' para mensagem vermelho.

// =======================================================================================
// ================== FUNCOES INTERFACE UI.X ==================
// =======================================================================================

// Carregar versão do manifest
const manifest = chrome.runtime.getManifest();
if (indexUI.version) {
    indexUI.version.textContent = manifest.version;
}

// Controle do painel de configurações
const toggleSettings = (show) => {
    if (show) {
        indexUI.settingsPanel.classList.add('active');
        indexUI.backBtn.classList.remove('hidden');
        indexUI.settingsBtn.classList.add('hidden');
    } else {
        indexUI.settingsPanel.classList.remove('active');
        indexUI.backBtn.classList.add('hidden');
        indexUI.settingsBtn.classList.remove('hidden');
    }
};

// Função para atualizar a exibição do Gale
const updateGaleDisplay = (enabled, level) => {
    if (indexUI.currentGale) {
        indexUI.currentGale.textContent = enabled ? `Gale: ${level}` : "Gale: Desativado";
    }
    if (indexUI.galeSelect) {
        indexUI.galeSelect.disabled = !enabled;
    }
};  

// Atualizar configurações atuais na página principal
// ================== GERENCIAMENTO DE ESTADO ==================
const updateCurrentSettings = (settings) => {
    if (indexUI.currentGale) {
        const galeEnabled = settings.galeEnabled ?? true;
        updateGaleDisplay(galeEnabled, settings.galeLevel || '1x');
    }
    if (indexUI.currentProfit) {
        indexUI.currentProfit.textContent = `Lucro Diário: R$ ${settings.dailyProfit || '0'}`;
    }
    if (indexUI.currentStop) {
        indexUI.currentStop.textContent = `Stop Loss: R$ ${settings.stopLoss || '0'}`;
    }
    if (indexUI.currentValue) {
        indexUI.currentValue.textContent = `Valor de entrada: R$ ${settings.tradeValue || '0'}`;
    }
    if (indexUI.currentTime) {
        indexUI.currentTime.textContent = `Periodo: ${settings.tradeTime || '0'}`;
    }
    if (indexUI.automationStatus) {
        isAutomationRunning = settings.autoActive ? true: false;
        indexUI.automationStatus.value = settings.autoActive ? true : false;
        indexUI.automationStatus.textContent = `Automação: ${settings.autoActive ? 'Ativa' : 'Inativa'}`;
        indexUI.automationStatus.className = `automation-status ${settings.autoActive ? 'active' : 'inactive'}`;
    }
};

// Carregar configurações salvas
chrome.storage.sync.get(
    ['galeEnabled', 'galeLevel', 'dailyProfit', 'stopLoss', 'autoActive'], 
    (settings) => {
        if (indexUI.toggleGale) indexUI.toggleGale.checked = settings.galeEnabled ?? true;
        if (indexUI.galeSelect) indexUI.galeSelect.value = settings.galeLevel || '1x';
        if (document.getElementById('daily-profit')) {
            document.getElementById('daily-profit').value = settings.dailyProfit || '';
        }
        if (document.getElementById('stop-loss')) {
            document.getElementById('stop-loss').value = settings.stopLoss || '';
        }
        if (document.getElementById('trade-value')) {
            document.getElementById('trade-value').value = settings.tradeValue || '';
        }
        if (document.getElementById('trade-time')) {
            document.getElementById('trade-time').value = settings.tradeTime || '';
        }
        if (indexUI.toggleAuto) indexUI.toggleAuto.checked = settings.autoActive || false;
        updateCurrentSettings(settings);
    }
);

// =======================================================================================
// ================== FUNÇÕES DE LOG ==================
// =======================================================================================

// Recebe o log que vem pelo background de qualquer lugar.
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'ADD_LOG') {
        indexAddLog(request.log);
    }
    // Novo handler para status
    if (request.action === 'UPDATE_STATUS') {
        updateStatus(
            request.message,
            request.type || 'info',
            request.duration || 5000
        );
    }
});

// Recebe mensagens de outras janelas (como da página de configurações)
window.addEventListener('message', (event) => {
    const { action, settings } = event.data;

    // Recebeu notificação explícita de que as configurações foram atualizadas
    if (action === 'configUpdated' && settings) {
        indexAddLog('Recebida notificação de que as configurações foram atualizadas', 'INFO');
        
        // Atualizar a UI com as novas configurações imediatamente
        updateCurrentSettings({
            galeEnabled: settings.gale.active,
            galeLevel: settings.gale.level,
            dailyProfit: settings.dailyProfit,
            stopLoss: settings.stopLoss,
            tradeValue: settings.value,
            tradeTime: settings.period,
            autoActive: settings.automation
        });
        
        // Forçar uma atualização completa puxando as configurações do storage
        loadConfig()
            .then(() => {
                indexAddLog('Configurações recarregadas com sucesso após notificação', 'SUCCESS');
                updateStatus('Configurações atualizadas', 'success', 2000);
            })
            .catch(error => {
                indexAddLog(`Erro ao recarregar configurações: ${error.message}`, 'ERROR');
            });
    }

    // Atualizar configurações quando solicitado pela página de configurações
    if (action === 'requestSaveSettings' && settings) {
        indexAddLog('Recebida solicitação para salvar configurações', 'INFO');
        
        // Usar StateManager se disponível
        if (window.StateManager) {
            window.StateManager.saveConfig(settings)
                .then(success => {
                    if (success) {
                        indexAddLog('Configurações salvas com sucesso via StateManager', 'SUCCESS');
                        // Atualizar a UI com as novas configurações
                        updateCurrentSettings({
                            galeEnabled: settings.gale.active,
                            galeLevel: settings.gale.level,
                            dailyProfit: settings.dailyProfit,
                            stopLoss: settings.stopLoss,
                            tradeValue: settings.value,
                            tradeTime: settings.period,
                            autoActive: settings.automation
                        });
                    } else {
                        indexAddLog('Falha ao salvar configurações via StateManager', 'ERROR');
                    }
                })
                .catch(error => {
                    indexAddLog(`Erro ao salvar configurações: ${error.message}`, 'ERROR');
                });
        } else {
            // Fallback para o método antigo
            chrome.storage.sync.set({ userConfig: settings }, () => {
                indexAddLog('Configurações salvas com sucesso via método legacy', 'SUCCESS');
                // Atualizar a UI com as novas configurações
                updateCurrentSettings({
                    galeEnabled: settings.gale.active,
                    galeLevel: settings.gale.level,
                    dailyProfit: settings.dailyProfit,
                    stopLoss: settings.stopLoss,
                    tradeValue: settings.value,
                    tradeTime: settings.period,
                    autoActive: settings.automation
                });
            });
        }
    }

    // Se a página de configurações solicitar as configurações atuais
    if (action === 'requestSettings') {
        indexAddLog('Recebida solicitação para enviar configurações', 'INFO');
        
        // Obter configurações atuais
        const currentConfig = window.StateManager 
            ? window.StateManager.getConfig() 
            : indexDefaultConfig;
        
        // Enviar de volta para a origem da mensagem
        event.source.postMessage({ 
            action: 'loadSettings', 
            settings: currentConfig 
        }, '*');
        
        indexAddLog('Configurações enviadas para a página solicitante', 'SUCCESS');
    }
});

// ================== NOVAS FUNÇÕES PARA AUTOMAÇÃO ==================
const updateAutomationStatus = (isActive) => {
    isAutomationRunning = isActive ? true: false;
    indexUI.automationStatus.value = isActive ? true : false;
    indexUI.automationStatus.textContent = `Automação: ${isActive ? 'Ativa' : 'Inativa'}`;
    indexUI.automationStatus.className = `automation-status ${isActive ? 'active' : 'inactive'}`;
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

// Função para monitorar as operações
function startTradeMonitoring() {
    if (isAutomationRunning) {
        updateStatus('Automação já está em execução', 'error');
        return;
    }

    isAutomationRunning = true;
    updateAutomationStatus(true);

    // Função para obter o tipo de operação
    const getTradeType = (title) => {
        if (title.includes('CALL')) return 'CALL';
        if (title.includes('PUT')) return 'PUT';
        return null;
    };

    // Função para obter o último valor
    const funcLastAmout = () => {
        const lastAmount = document.querySelector('.last-amount');
        return lastAmount ? parseFloat(lastAmount.textContent.replace('R$ ', '')) : 0;
    };

    // Função para executar a análise
    const runAnalysis = async () => {
        try {
            const tab = await getActiveTab();
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'ANALYZE_GRAPH' });
            if (response && response.success) {
                updateStatus('Análise concluída com sucesso', 'success');
            } else {
                updateStatus('Erro ao analisar o gráfico', 'error');
            }
        } catch (error) {
            logToSystem(`Erro ao executar análise: ${error.message}`, 'ERROR', 'index.js');
            updateStatus('Erro ao executar análise', 'error');
        }
    };

    // Inicializar a automação
    const initAutomation = () => {
        if (!isAutomationRunning) return;

        // Executar a análise
        runAnalysis();

        // Agendar a próxima execução
        automationTimeout = setTimeout(initAutomation, tradeTime * 60 * 1000);
    };

    // Normalizar o texto
    const normalizeText = (text) => {
        return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    // Iniciar a automação
    initAutomation();
}

// Função para testar a conexão com a API
async function testGeminiConnection() {
    try {
        updateStatus('Testando conexão com Gemini...', 'info');
        indexAddLog('Iniciando teste de conexão...');
        
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
            indexAddLog('Conexão com Gemini estabelecida com sucesso');
            return true;
        } else {
            throw new Error('Resposta inesperada da API');
        }
    } catch (error) {
        updateStatus(`Erro: ${error.message}`, 'error');
        indexAddLog(`Erro no teste de conexão: ${error.message}`);
        return false;
    }
}

// Função para atualizar o contador
const updateCountdown = () => {
    const countdown = document.querySelector('#countdown');
    if (countdown) {
        countdown.textContent = `${tradeTime} minutos`;
    }
};

// Função para iniciar o contador
const startCountdown = () => {
    if (isAutomationRunning) {
        updateStatus('Automação já está em execução', 'error');
        return;
    }

    isAutomationRunning = true;
    updateAutomationStatus(true);
    updateCountdown();

    const interval = setInterval(() => {
        tradeTime--;
        updateCountdown();

        if (tradeTime <= 0) {
            clearInterval(interval);
            isAutomationRunning = false;
            updateAutomationStatus(false);
            updateStatus('Automação concluída', 'success');
        }
    }, 1000);
};

// Função para cancelar o fechamento automático
const cancelAutoClose = () => {
    if (automationTimeout) {
        clearTimeout(automationTimeout);
        automationTimeout = null;
    }
    isAutomationRunning = false;
    updateAutomationStatus(false);
    updateStatus('Automação cancelada', 'info');
};

// Função para capturar e analisar
async function captureAndAnalyze() {
    try {
        const tab = await getActiveTab();
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'CAPTURE_SCREENSHOT' });
        if (response && response.success) {
            updateStatus('Captura realizada com sucesso', 'success');
            await runAnalysis();
        } else {
            updateStatus('Erro ao capturar a tela', 'error');
        }
    } catch (error) {
        logToSystem(`Erro ao capturar e analisar: ${error.message}`, 'ERROR', 'index.js');
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
        settingsBtn: document.querySelector('#settings-btn')
    };

    if (elements.startOperation) {
        elements.startOperation.addEventListener('click', startTradeMonitoring);
    }
    if (elements.cancelOperation) {
        elements.cancelOperation.addEventListener('click', cancelAutoClose);
    }
    if (elements.captureScreen) {
        elements.captureScreen.addEventListener('click', () => {
            logToSystem('Botão de captura clicado no index', 'INFO', 'index.js');
            // Envia mensagem para o content.js
            window.parent.postMessage({
                action: 'captureScreen',
                actionType: 'capture',
                requireProcessing: true,
                iframeWidth: 480
            }, '*');
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
                logToSystem('Navigation não está disponível', 'ERROR', 'index.js');
            }
        });
    }
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => {
            if (window.Navigation) {
                window.Navigation.openPage('settings');
            } else {
                logToSystem('Navigation não está disponível', 'ERROR', 'index.js');
            }
        });
    }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    try {
        const manifestInfo = chrome.runtime.getManifest();
        indexAddLog(`Sistema Trade Manager Pro v${manifestInfo.version} inicializado`, 'INFO');
        indexAddLog(`Ambiente: ${manifestInfo.name} / ${navigator.userAgent}`, 'DEBUG');
    } catch (e) {
        indexAddLog('Sistema Trade Manager Pro inicializado (versão desconhecida)', 'INFO');
    }
    
    addEventListeners();
    indexAddLog('Event listeners configurados com sucesso', 'DEBUG');
    
    // Inicializar o listener do StateManager para atualizações de configurações
    initStateManagerListener();
    
    updateStatus('Sistema iniciado com sucesso!', 'success');
    indexAddLog('Interface principal carregada e pronta', 'SUCCESS');
    
    // Tentar testar a conexão com a API Gemini
    testGeminiConnection()
        .then(connected => {
            if (connected) {
                indexAddLog('API Gemini conectada com sucesso', 'SUCCESS');
            } else {
                indexAddLog('Não foi possível conectar à API Gemini', 'WARN');
            }
        })
        .catch(err => {
            indexAddLog(`Erro ao testar conexão com API: ${err.message}`, 'ERROR');
        });
    
    // Carregar configurações
    loadConfig()
        .then(config => {
            indexAddLog('Configurações carregadas com sucesso', 'SUCCESS');
        })
        .catch(error => {
            indexAddLog(`Erro ao carregar configurações: ${error.message}`, 'ERROR');
            updateStatus('Erro ao carregar configurações', 'error');
        });
});

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
            indexAddLog('Configurações antigas removidas do storage.');
            resolve();
        });
    });
}

// Função para carregar configurações
function loadConfig() {
    return new Promise((resolve) => {
        indexAddLog('Iniciando carregamento das configurações...', 'INFO');
        updateStatus('Carregando configurações...', 'info');

        // Utilizar o StateManager para carregar as configurações
        if (window.StateManager) {
            indexAddLog('Utilizando StateManager para carregar configurações', 'INFO');
            window.StateManager.loadConfig()
                .then(config => {
                    indexAddLog('Configurações carregadas via StateManager', 'SUCCESS');
                    
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
                    
                    updateStatus('Configurações carregadas com sucesso', 'success');
                    resolve(config);
                })
                .catch(error => {
                    indexAddLog(`Erro ao carregar configurações via StateManager: ${error.message}`, 'ERROR');
                    updateStatus('Erro ao carregar configurações', 'error');
                    
                    // Em caso de erro, tentar usar a abordagem antiga como fallback
                    loadConfigLegacy()
                        .then(config => resolve(config))
                        .catch(err => {
                            indexAddLog(`Erro também no fallback: ${err.message}`, 'ERROR');
                            // Usar configurações padrão em último caso
                            resolve(indexDefaultConfig);
                        });
                });
        } else {
            // Fallback para o método antigo se o StateManager não estiver disponível
            indexAddLog('StateManager não encontrado, usando método legacy', 'WARN');
            loadConfigLegacy()
                .then(config => resolve(config))
                .catch(error => {
                    indexAddLog(`Erro ao carregar configurações: ${error.message}`, 'ERROR');
                    updateStatus('Erro ao carregar configurações', 'error');
                    resolve(indexDefaultConfig);
                });
        }
    });
}

// Método legacy para carregar configurações (para compatibilidade)
function loadConfigLegacy() {
    return new Promise((resolve, reject) => {
        indexAddLog('Utilizando método legacy para carregar configurações', 'INFO');
        
        chrome.storage.sync.get(['userConfig'], (result) => {
            indexAddLog(`Resultado do storage: ${JSON.stringify(result)}`, 'DEBUG');
            
            if (!result.userConfig || Object.keys(result.userConfig).length === 0) {
                indexAddLog('Configuração do usuário não encontrada ou vazia. Usando configuração padrão.', 'INFO');
                updateStatus('Usando configurações padrão...', 'info');
                
                // Se não houver configuração do usuário, usa a padrão
                chrome.storage.sync.set({ userConfig: indexDefaultConfig }, () => {
                    indexAddLog('Configurações padrão salvas no storage.', 'INFO');
                    updateStatus('Configurações padrão salvas', 'success');
                    
                    // Atualizar campos da página principal
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
                // Garantir que o período seja um número inteiro
                if (typeof result.userConfig.period === 'string') {
                    result.userConfig.period = parseInt(result.userConfig.period.replace(/[^0-9]/g, '')) || 1;
                }
                
                indexAddLog('Configuração do usuário encontrada e carregada.', 'INFO');
                updateStatus('Configurações do usuário carregadas', 'success');
                
                // Atualizar campos da página principal
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

// Inicialização do StateManager listener
function initStateManagerListener() {
    if (window.StateManager) {
        indexAddLog('Registrando listener para StateManager', 'INFO');
        
        // Registrar listener para atualizações de estado
        window.StateManager.subscribe((notification) => {
            // Formato de notificação atualizado: {state, type, timestamp}
            const { state, type, timestamp } = notification;
            
            if (type === 'config') {
                indexAddLog(`Recebida atualização de configurações do StateManager (${new Date(timestamp).toLocaleTimeString()})`, 'INFO');
                
                const config = state.config;
                if (config) {
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
                    
                    updateStatus('Configurações atualizadas', 'success', 2000);
                }
            }
        });
        
        indexAddLog('Listener registrado com sucesso', 'SUCCESS');
    } else {
        indexAddLog('StateManager não disponível para registro de listener', 'WARN');
    }
}

// ================== INICIALIZAÇÃO ==================
// Inicializar o sistema de logs
// O sistema de logs será carregado apenas se a página for a página de logs
// Usar a variável global IS_LOG_PAGE que já foi definida no início do arquivo
// const isLogPage = () => window.location.pathname.includes('/logs.html');

// Se for página de logs, configurar a UI
if (window.IS_LOG_PAGE) {
    // Variável que armazena elementos da UI relacionados aos logs
    const sysUI = {
        logContainer: null,
        clearButton: null,
        exportButton: null,
        levelFilter: null
    };
    
    // Expor a UI no escopo global para acesso por outros scripts
    window.sysUI = sysUI;
    
    // Função para inicializar a UI de logs
    const initLogUI = () => {
        try {
            // Obter elementos do DOM
            sysUI.logContainer = document.getElementById('log-container');
            sysUI.clearButton = document.getElementById('clear-logs-btn');
            sysUI.exportButton = document.getElementById('export-logs-btn');
            sysUI.levelFilter = document.getElementById('log-level-filter');
            
            // Verificar se obtivemos todos os elementos necessários
            if (!sysUI.logContainer || !sysUI.clearButton || !sysUI.exportButton || !sysUI.levelFilter) {
                throw new Error('Elementos da UI de logs não encontrados');
            }
            
            // Configurar eventos
            sysUI.clearButton.addEventListener('click', sysClearLogs);
            sysUI.exportButton.addEventListener('click', sysExportLogs);
            sysUI.levelFilter.addEventListener('change', () => {
                // Filtrar logs pelo nível selecionado
                const selectedLevel = sysUI.levelFilter.value;
                
                // Todas as entradas de log no container
                const logEntries = sysUI.logContainer.querySelectorAll('.log-entry');
                
                // Iterar sobre cada entrada
                logEntries.forEach(entry => {
                    const entryLevel = entry.getAttribute('data-level');
                    
                    // Se selectedLevel for 'ALL', mostrar todos
                    // Caso contrário, verificar se o nível corresponde
                    if (selectedLevel === 'ALL' || entryLevel === selectedLevel) {
                        entry.style.display = 'block';
                    } else {
                        entry.style.display = 'none';
                    }
                });
            });
            
            // Criar conexão com o background script
            if (chrome.runtime && chrome.runtime.connect) {
                window.logConnection = chrome.runtime.connect({ name: 'log_channel' });
                window.logConnection.onMessage.addListener(message => {
                    if (message.action === 'newLog') {
                        sysAddLog(message.data.message, message.data.level, message.data.source);
                    }
                });
                
                // Adicionar log para indicar que o canal foi estabelecido
                setTimeout(() => {
                    logToSystem('Sistema de logs inicializado', 'INFO', 'log-sys.js');
                }, 500);
            }
            
            // Carregar logs existentes
            sysLoadLogs();
            
            return true;
        } catch (error) {
            logToSystem('Erro ao inicializar UI de logs: ' + error.message, 'ERROR', 'log-sys.js');
            return false;
        }
    };
    
    // Chamar a inicialização quando o DOM estiver pronto
    document.addEventListener('DOMContentLoaded', initLogUI);
}

// ================== ANALISADOR DE DADOS ==================
class DataAnalyzer {
    constructor() {
        this.cache = {};
        this.processingQueue = [];
        this.isProcessing = false;
        
        // Inicializar
        logToSystem('Inicializando analisador de dados', 'DEBUG', 'analysis.js');
        
        // Expor métodos para a API global
        window.TRADE_ANALYZER_API = {
            analyze: this.analyze.bind(this),
            getAnalysisResult: this.getAnalysisResult.bind(this),
            clearCache: this.clearCache.bind(this)
        };
        
        logToSystem('API do analisador de dados exposta', 'DEBUG', 'analysis.js');
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
                logToSystem(`Usando resultado em cache para ${symbol}`, 'DEBUG', 'analysis.js');
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
            logToSystem(`Erro ao analisar dados: ${error.message}`, 'ERROR', 'analysis.js');
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
            logToSystem(`Processando análise para ${job.data.symbol || 'desconhecido'}`, 'DEBUG', 'analysis.js');
            
            // Realizar análise
            const result = await this.performAnalysis(job.data, job.options);
            
            // Armazenar no cache
            this.cache[job.dataSignature] = result;
            
            // Limitar tamanho do cache
            this.manageCacheSize();
            
            // Resolver promessa
            job.resolve(result);
        } catch (error) {
            logToSystem(`Erro na análise: ${error.message}`, 'ERROR', 'analysis.js');
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
            logToSystem(`Erro durante a análise de ${symbol}: ${error.message}`, 'ERROR', 'analysis.js');
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
            logToSystem(`Erro ao detectar sinais: ${error.message}`, 'ERROR', 'analysis.js');
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
        logToSystem('Cache de análises limpo', 'INFO', 'analysis.js');
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
            
            logToSystem(`Cache de análises otimizado: ${keysToRemove.length} itens removidos`, 'DEBUG', 'analysis.js');
        }
    }
}

// Inicializar analisador de dados em todas as páginas
const analyzer = new DataAnalyzer();

// ================== LISTENERS ==================
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se estamos na página de análise
    if (window.location.pathname.includes('/analysis.html')) {
        logToSystem('Inicializando página de análise', 'INFO', 'index.js');
        
        // Configurar área de exibição de gráficos
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer) {
            logToSystem('Container de gráfico encontrado, configurando...', 'DEBUG', 'index.js');
            
            // Configuração de botões e controles
            const symbolInput = document.getElementById('symbol-input');
            const timeframeSelect = document.getElementById('timeframe-select');
            const loadDataBtn = document.getElementById('load-data-btn');
            
            if (symbolInput && timeframeSelect && loadDataBtn) {
                loadDataBtn.addEventListener('click', () => {
                    const symbol = symbolInput.value.trim().toUpperCase();
                    const timeframe = timeframeSelect.value;
                    
                    if (!symbol) {
                        logToSystem('Símbolo não informado', 'WARN', 'index.js');
                        return;
                    }
                    
                    logToSystem(`Carregando dados para ${symbol} (${timeframe})`, 'INFO', 'index.js');
                    
                    // Simulação de carregamento de dados
                    setTimeout(() => {
                        try {
                            // Dados simulados para teste
                            const simulatedData = generateMockData(symbol, timeframe);
                            
                            // Analisar dados
                            analyzer.analyze(simulatedData)
                                .then(result => {
                                    logToSystem(`Análise concluída para ${symbol}`, 'SUCCESS', 'index.js');
                                    renderAnalysisResults(result);
                                })
                                .catch(error => {
                                    logToSystem(`Falha na análise: ${error.message}`, 'ERROR', 'index.js');
                                });
                        } catch (error) {
                            logToSystem(`Erro ao processar dados: ${error.message}`, 'ERROR', 'index.js');
                        }
                    }, 1000);
                });
            } else {
                logToSystem('Elementos de controle não encontrados', 'ERROR', 'index.js');
            }
        } else {
            logToSystem('Container de gráfico não encontrado', 'ERROR', 'index.js');
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
    
    logToSystem(`Gerados ${candles.length} candles simulados para ${symbol}`, 'DEBUG', 'index.js');
    
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
        
        logToSystem('Resultados da análise renderizados', 'SUCCESS', 'index.js');
    } catch (error) {
        logToSystem(`Erro ao renderizar resultados: ${error.message}`, 'ERROR', 'index.js');
    }
}