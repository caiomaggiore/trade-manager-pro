// Verificar se o sistema de logs está disponível
console.log('Inicializando index.js');
console.log('logToSystem está disponível?', typeof window.logToSystem === 'function');

// Tentar criar um teste de log se o sistema estiver disponível
if (typeof window.logToSystem === 'function') {
    window.logToSystem('Teste de sistema de logs a partir do index.js', 'DEBUG', 'index.js');
} else {
    console.warn('Sistema de logs não detectado, tentando carregar via script...');
    
    // Função para tentar carregar o sistema de logs
    const loadLogSystem = () => {
        const script = document.createElement('script');
        script.src = '../content/log-sys.js';
        script.onload = () => {
            console.log('Sistema de logs carregado dinamicamente!');
            window.logToSystem && window.logToSystem('Sistema de logs carregado dinamicamente', 'INFO', 'index.js');
        };
        script.onerror = (err) => {
            console.error('Erro ao carregar sistema de logs:', err);
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
        console.error('Erro na análise:', error);
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
    
    console.log(`[${normalizedLevel}][${source}] ${message}`);
    
    // Usar preferentemente o sistema global de logs
    if (typeof window.logToSystem === 'function') {
        window.logToSystem(message, normalizedLevel, source);
        return;
    }
    
    // Fallback para o sistema direto sysAddLog, se disponível
    if (typeof sysAddLog === 'function') {
        sysAddLog(message, normalizedLevel, source).catch(error => {
            console.error(`[${source}] Erro ao usar sysAddLog:`, error);
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
        console.error(`[${source}] Erro ao enviar log:`, error);
    }
};

// =======================================================================================
// ================== FUNCOES - STATUS DE INTERFACE ==================
// =======================================================================================

// Função para atualizar o status do processo
const updateStatus = (message, type = 'info', duration = 3000) => {
    // Verificar se o elemento existe
    const statusElement = document.querySelector('#status-processo');
    if (!statusElement) {
        console.log('Elemento status-processo não encontrado, tentando novamente em 1 segundo...');
        // Tentar novamente após 1 segundo
        setTimeout(() => updateStatus(message, type, duration), 1000);
        return;
    }
    
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
            console.error('Erro ao executar análise:', error);
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
        console.error('Erro ao capturar e analisar:', error);
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
            console.log('Botão de captura clicado no index');
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
                console.error('Navigation não está disponível');
            }
        });
    }
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => {
            if (window.Navigation) {
                window.Navigation.openPage('settings');
            } else {
                console.error('Navigation não está disponível');
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
        indexAddLog('Iniciando carregamento das configurações...');
        updateStatus('Carregando configurações...', 'info');

        chrome.storage.sync.get(['userConfig'], (result) => {
            indexAddLog(`Resultado do storage: ${JSON.stringify(result)}`);
            
            if (!result.userConfig || Object.keys(result.userConfig).length === 0) {
                indexAddLog('Configuração do usuário não encontrada ou vazia. Usando configuração padrão.');
                updateStatus('Usando configurações padrão...', 'info');
                
                // Se não houver configuração do usuário, usa a padrão
                chrome.storage.sync.set({ userConfig: indexDefaultConfig }, () => {
                    indexAddLog('Configurações padrão salvas no storage.');
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
                
                indexAddLog('Configuração do usuário encontrada e carregada.');
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