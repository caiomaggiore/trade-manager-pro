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
    saveLogBtn:     document.querySelector('#save-log-btn'),
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
        addLog('Iniciando análise do gráfico...');
        
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

        addLog('Captura de tela concluída, processando imagem...');

        // Processa a imagem e analisa
        const result = await window.TradeManager.AnalyzeGraph.processImage(response.dataUrl);
        
        if (!result.success) {
            throw new Error(result.error);
        }

        // Atualiza a interface com os resultados
        updateStatus(`Análise concluída: ${result.results.action}`, 'success');
        addLog(`Análise: ${result.results.action} - Confiança: ${result.results.trust}%`);
        
        // Mostra o modal com os resultados
        showAnalysisModal(result.results);
        
        return result;
    } catch (error) {
        console.error('Erro na análise:', error);
        updateStatus('Erro ao realizar análise', 'error');
        addLog(`Erro na análise: ${error.message}`);
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
                actionType: 'capture',
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
        elements.saveBtn.addEventListener('click', async () => {
            try {
                const config = {
                    gale: {
                        active: UI.toggleGale.checked,
                        level: UI.galeSelect.value
                    },
                    dailyProfit: parseInt(document.getElementById('daily-profit').value),
                    stopLoss: parseInt(document.getElementById('stop-loss').value),
                    automation: UI.toggleAuto.checked,
                    value: parseInt(document.getElementById('trade-value').value),
                    period: parseInt(document.getElementById('trade-time').value)
                };

                await saveConfig(config);
                toggleSettings(false); // Fechar painel de configurações
            } catch (error) {
                console.error('Erro ao salvar configurações:', error);
                addLog(`Erro ao salvar configurações: ${error.message}`);
                updateStatus('Erro ao salvar configurações', 'error');
            }
        });
    }
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    addEventListeners();
    updateStatus('Sistema iniciado com sucesso!', 'info');
});

// Configurações padrão
const DEFAULT_CONFIG = {
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
        addLog('Iniciando carregamento das configurações...');
        updateStatus('Carregando configurações...', 'info');

        chrome.storage.sync.get(['userConfig'], (result) => {
            addLog(`Resultado do storage: ${JSON.stringify(result)}`);
            
            if (!result.userConfig || Object.keys(result.userConfig).length === 0) {
                addLog('Configuração do usuário não encontrada ou vazia. Usando configuração padrão.');
                updateStatus('Usando configurações padrão...', 'info');
                
                // Se não houver configuração do usuário, usa a padrão
                chrome.storage.sync.set({ userConfig: DEFAULT_CONFIG }, () => {
                    addLog('Configurações padrão salvas no storage.');
                    updateStatus('Configurações padrão salvas', 'success');
                    
                    // Atualizar campos da página principal
                    updateCurrentSettings({
                        galeEnabled: DEFAULT_CONFIG.gale.active,
                        galeLevel: DEFAULT_CONFIG.gale.level,
                        dailyProfit: DEFAULT_CONFIG.dailyProfit,
                        stopLoss: DEFAULT_CONFIG.stopLoss,
                        tradeValue: DEFAULT_CONFIG.value,
                        tradeTime: DEFAULT_CONFIG.period,
                        autoActive: DEFAULT_CONFIG.automation
                    });
                    
                    resolve(DEFAULT_CONFIG);
                });
            } else {
                // Garantir que o período seja um número inteiro
                if (typeof result.userConfig.period === 'string') {
                    result.userConfig.period = parseInt(result.userConfig.period.replace(/[^0-9]/g, '')) || 1;
                }
                
                addLog('Configuração do usuário encontrada e carregada.');
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

// Função para salvar configurações (LOGS AGORA COM addLog)
function saveConfig(config) {
    addLog('[saveConfig][DEBUG] Iniciada com config: ' + JSON.stringify(config)); // Log DEBUG com addLog
    return new Promise((resolve, reject) => {
        addLog('Iniciando salvamento das configurações...');
        updateStatus('Salvando configurações...', 'info');

        // Salvar no storage
        addLog('[saveConfig][DEBUG] Chamando chrome.storage.sync.set...'); // Log DEBUG com addLog
        chrome.storage.sync.set({ userConfig: config }, () => {
            if (chrome.runtime.lastError) {
                console.error('[saveConfig] Erro ao salvar no storage:', chrome.runtime.lastError); // Manter console.error para erros
                addLog('[saveConfig][ERROR] Erro ao salvar no storage: ' + chrome.runtime.lastError.message);
                updateStatus('Erro ao salvar configurações', 'error');
                return reject(chrome.runtime.lastError);
            }
            
            addLog('[saveConfig][DEBUG] Salvo no storage com sucesso.'); // Log DEBUG com addLog
            
            // Atualizar campos do HTML (se existirem no index.html)
            addLog('[saveConfig][DEBUG] Chamando fillHTMLFields...'); // Log DEBUG com addLog
            fillHTMLFields(config);
            addLog('[saveConfig][DEBUG] fillHTMLFields concluído.'); // Log DEBUG com addLog

            // Atualizar campos da página principal
            addLog('[saveConfig][DEBUG] Chamando updateCurrentSettings...'); // Log DEBUG com addLog
            updateCurrentSettings({
                galeEnabled: config.gale?.active,
                galeLevel: config.gale?.level,
                dailyProfit: config.dailyProfit,
                stopLoss: config.stopLoss,
                tradeValue: config.value,
                tradeTime: config.period,
                autoActive: config.automation
            });
            addLog('[saveConfig][DEBUG] updateCurrentSettings concluído.'); // Log DEBUG com addLog

            addLog('Configurações salvas no storage e UI atualizada.'); // Mensagem combinada
            updateStatus('Configurações salvas com sucesso', 'success');
            resolve();
        });
    });
}

// Função para preencher campos do HTML
function fillHTMLFields(config) {
    addLog('Iniciando preenchimento dos campos HTML...');
    updateStatus('Preenchendo campos...', 'info');

    // Mapeamento dos campos HTML para as configurações usando a variável UI
    const fieldMappings = {
        'galeActive': {
            element: UI.toggleGale,
            value: config.gale.active,
            type: 'checkbox'
        },
        'galeLevel': {
            element: UI.galeSelect,
            value: config.gale.level,
            type: 'text'
        },
        'dailyProfit': {
            element: document.getElementById('daily-profit'),
            value: config.dailyProfit,
            type: 'number'
        },
        'stopLoss': {
            element: document.getElementById('stop-loss'),
            value: config.stopLoss,
            type: 'number'
        },
        'automation': {
            element: UI.toggleAuto,
            value: config.automation,
            type: 'checkbox'
        },
        'value': {
            element: document.getElementById('trade-value'),
            value: config.value,
            type: 'number'
        },
        'period': {
            element: document.getElementById('trade-time'),
            value: config.period,
            type: 'number'
        }
    };

    // Preencher cada campo
    Object.entries(fieldMappings).forEach(([fieldName, field]) => {
        if (field.element) {
            if (field.type === 'checkbox') {
                field.element.checked = field.value;
            } else {
                field.element.value = field.value;
            }
            addLog(`${fieldName}: ${field.value}`);
        } else {
            addLog(`Campo ${fieldName} não encontrado no HTML`, 'error');
        }
    });

    addLog('Preenchimento dos campos HTML concluído.');
    updateStatus('Campos preenchidos com sucesso', 'success');
}

// Carregar configurações e preencher campos do HTML quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    try {
        addLog('DOM carregado, iniciando carregamento de configurações...');
        updateStatus('Iniciando sistema...', 'info');
        
        // Primeiro, limpar configurações antigas
        await clearOldConfig();
        
        // Depois, carregar novas configurações
        const config = await loadConfig();
        addLog(`Configurações carregadas: ${JSON.stringify(config)}`);
        
        fillHTMLFields(config);
        updateStatus('Sistema inicializado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        addLog(`Erro ao carregar configurações: ${error.message}`);
        updateStatus('Erro ao carregar configurações', 'error');
    }
});

console.log('[index.js] Adicionando listener de mensagens...');

window.addEventListener('message', (event) => {
    console.log(`[index.js] ---> Listener de mensagem disparado! Action=${event.data?.action}`);
    console.log(`[index.js] Mensagem recebida: Origem=${event.origin}, Action=${event.data?.action}`);

    // !! REMOVIDO TEMPORARIAMENTE: Verificação de origem 

    // Listener APENAS para solicitar salvamento
    if (event.data.action === 'requestSaveSettings') { 
        addLog('[index.js][DEBUG] Entrou no bloco requestSaveSettings (sem verificar origem).');
        const config = event.data.settings;
        addLog('[index.js][DEBUG] Config recebida para salvar: ' + JSON.stringify(config));

        saveConfig(config)
            .then(() => {
                addLog('[index.js][DEBUG] saveConfig chamado via mensagem concluído com sucesso.');
            })
            .catch(error => {
                console.error('[index.js] Erro ao executar saveConfig chamado via mensagem:', error);
                addLog('[index.js][ERROR] Erro ao executar saveConfig via mensagem: ' + error.message);
            });

    // REMOVIDO: Bloco else if (event.data.action === 'closePage') {...}
    // A lógica de fechar a página agora é tratada diretamente pelo NavigationManager
    }
}); 