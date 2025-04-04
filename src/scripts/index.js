// ================== VERIFICAÇÃO DE ELEMENTOS ==================
const UI = {
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
    analysisResults: document.querySelector('#analysis-results'),
    copyLogBtn:     document.querySelector('#copy-log-btn'),
    saveLogBtn:     document.querySelector('#save-log-btn')
};

// ================== VARIÁVEIS GLOBAIS ==================
let isAutomationRunning = false;
let automationTimeout = null;
const API_KEY = 'AIzaSyDeYcYUxAN52DNrgZeFNcEfceVMoWJDjWk';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// ================== FUNÇÕES DE ANÁLISE ==================
/**
 * Executa a análise do gráfico
 */
const runAnalysis = async () => {
    try {
        updateStatus('Iniciando análise...', 'info');
        
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

        // Processa a imagem e analisa
        const result = await window.TradeManager.AnalyzeGraph.processImage(response.dataUrl);
        
        // Atualiza a interface com os resultados
        updateStatus(`Análise concluída: ${result.results.action}`, 'success');
        addLog(`Análise: ${result.results.action} - Confiança: ${result.results.confidence.toFixed(2)}%`);
        
        return result;
    } catch (error) {
        console.error('Erro na análise:', error);
        updateStatus('Erro ao realizar análise', 'error');
        throw error;
    }
};

// =======================================================================================
// ================== FUNCOES INTERFACE UI.X ==================
// =======================================================================================

// Carregar versão do manifest
const manifest = chrome.runtime.getManifest();
if (UI.version) {
    UI.version.textContent = manifest.version;
}

// Controle do painel de configurações
const toggleSettings = (show) => {
    if (show) {
        UI.settingsPanel.classList.add('active');
        UI.backBtn.classList.remove('hidden');
        UI.settingsBtn.classList.add('hidden');
    } else {
        UI.settingsPanel.classList.remove('active');
        UI.backBtn.classList.add('hidden');
        UI.settingsBtn.classList.remove('hidden');
    }
};

// Função para atualizar a exibição do Gale
const updateGaleDisplay = (enabled, level) => {
    if (UI.currentGale) {
        UI.currentGale.textContent = enabled ? `Gale: ${level}` : "Gale: Desativado";
    }
    if (UI.galeSelect) {
        UI.galeSelect.disabled = !enabled;
    }
};  

// Atualizar configurações atuais na página principal
// ================== GERENCIAMENTO DE ESTADO ==================
const updateCurrentSettings = (settings) => {
    if (UI.currentGale) {
        const galeEnabled = settings.galeEnabled ?? true;
        updateGaleDisplay(galeEnabled, settings.galeLevel || '1x');
    }
    if (UI.currentProfit) {
        UI.currentProfit.textContent = `Lucro Diário: R$ ${settings.dailyProfit || '0'}`;
    }
    if (UI.currentStop) {
        UI.currentStop.textContent = `Stop Loss: R$ ${settings.stopLoss || '0'}`;
    }
    if (UI.currentValue) {
        UI.currentValue.textContent = `Valor de entrada: R$ ${settings.tradeValue || '0'}`;
    }
    if (UI.currentTime) {
        UI.currentTime.textContent = `Periodo: ${settings.tradeTime || '0'}`;
    }
    if (UI.automationStatus) {
        isAutomationRunning = settings.autoActive ? true: false;
        UI.automationStatus.value = settings.autoActive ? true : false;
        UI.automationStatus.textContent = `Automação: ${settings.autoActive ? 'Ativa' : 'Inativa'}`;
        UI.automationStatus.className = `automation-status ${settings.autoActive ? 'active' : 'inactive'}`;
    }
};

// Carregar configurações salvas
chrome.storage.sync.get(
    ['galeEnabled', 'galeLevel', 'dailyProfit', 'stopLoss', 'autoActive'], 
    (settings) => {
        if (UI.toggleGale) UI.toggleGale.checked = settings.galeEnabled ?? true;
        if (UI.galeSelect) UI.galeSelect.value = settings.galeLevel || '1x';
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
        if (UI.toggleAuto) UI.toggleAuto.checked = settings.autoActive || false;
        updateCurrentSettings(settings);
    }
);

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
    
    // Se duration for 0, manter a mensagem permanentemente
    if (duration > 0) {
        setTimeout(() => {
            if (statusElement) {
                statusElement.textContent = 'Status: Sistema operando normalmente';
                statusElement.className = 'status-processo info visible';
            }
        }, duration);
    }
};

// Exemplo de uso - ao iniciar sistema!
updateStatus('Sistema iniciado com sucesso!', 'info'); 
// use 'success' para mensagem verde.
// use 'info' para mensagem azul.
// use 'error' para mensagem vermelho.

// ================== FUNÇÕES DE LOG ==================
// Função para adicionar logs
let lastLog = {};

const addLog = (message) => {
    if (!UI.analysisResults) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    UI.analysisResults.appendChild(logEntry);
    UI.analysisResults.scrollTop = UI.analysisResults.scrollHeight;
    
    // Atualizar o status no painel principal
    updateStatus(message, 'info', 0);
};

// Função para copiar logs
const copyLogs = () => {
    if (!UI.analysisResults) return;
    
    const logs = Array.from(UI.analysisResults.children)
        .map(entry => entry.textContent)
        .join('\n');
    
    // Criar um elemento textarea temporário
    const textarea = document.createElement('textarea');
    textarea.value = logs;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    try {
        // Selecionar e copiar o texto
        textarea.select();
        document.execCommand('copy');
        updateStatus('Logs copiados para a área de transferência!', 'success', 3000);
    } catch (err) {
        console.error('Erro ao copiar logs:', err);
        updateStatus('Erro ao copiar logs', 'error', 3000);
    } finally {
        // Remover o elemento temporário
        document.body.removeChild(textarea);
    }
};

// Função para salvar logs
const saveLogs = () => {
    if (!UI.analysisResults) return;
    
    const logs = Array.from(UI.analysisResults.children)
        .map(entry => entry.textContent)
        .join('\n');
    
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-bot-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    updateStatus('Logs salvos com sucesso!', 'success', 3000);
};

// Adicionar listeners para os botões de log
document.getElementById('copy-log-btn')?.addEventListener('click', copyLogs);
document.getElementById('save-log-btn')?.addEventListener('click', saveLogs);

// Recebe o log que vem pelo background de qualquer lugar.
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'ADD_LOG') {
        addLog(request.log);
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
    UI.automationStatus.value = isActive ? true : false;
    UI.automationStatus.textContent = `Automação: ${isActive ? 'Ativa' : 'Inativa'}`;
    UI.automationStatus.className = `automation-status ${isActive ? 'active' : 'inactive'}`;
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
        settingsBtn: document.querySelector('#settings-btn'),
        backBtn: document.querySelector('#back-btn'),
        saveBtn: document.querySelector('#save-settings')
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
                actionType: 'analyze',
                requireProcessing: true,
                iframeWidth: 480
            }, '*');
        });
    }
    if (elements.analyzeBtn) {
        elements.analyzeBtn.addEventListener('click', runAnalysis);
    }
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => toggleSettings(true));
    }
    if (elements.backBtn) {
        elements.backBtn.addEventListener('click', () => toggleSettings(false));
    }
    if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', () => {
            const settings = {
                galeEnabled: document.querySelector('#toggleGale')?.checked ?? true,
                galeLevel: document.querySelector('#gale-select')?.value || '1x',
                dailyProfit: document.querySelector('#daily-profit')?.value || '',
                stopLoss: document.querySelector('#stop-loss')?.value || '',
                tradeValue: document.querySelector('#trade-value')?.value || '',
                tradeTime: document.querySelector('#trade-time')?.value || '',
                autoActive: document.querySelector('#toggleAuto')?.checked || false
            };

            chrome.storage.sync.set(settings, () => {
                updateCurrentSettings(settings);
                toggleSettings(false);
                updateStatus('Configurações salvas com sucesso', 'success');
            });
        });
    }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    addEventListeners();
    updateStatus('Sistema iniciado com sucesso!', 'info');
}); 