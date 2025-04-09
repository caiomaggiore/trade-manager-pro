// ================== ELEMENTOS DA UI ==================
const UI = {
    closeBtn: document.getElementById('close-settings'),
    saveBtn: document.getElementById('save-settings'),
    saveLogBtn: document.getElementById('save-log-btn'),
    toggleGale: document.getElementById('toggleGale'),
    galeSelect: document.getElementById('gale-select'),
    dailyProfit: document.getElementById('daily-profit'),
    stopLoss: document.getElementById('stop-loss'),
    toggleAuto: document.getElementById('toggleAuto'),
    tradeValue: document.getElementById('trade-value'),
    tradeTime: document.getElementById('trade-time'),
    copyLogBtn: document.getElementById('copy-log-btn'),
    clearLogsBtn: document.getElementById('clear-logs'),
    analysisResults: document.getElementById('analysis-results')
};

// ================== GERENCIAMENTO DE ESTADO ==================
// Carregar configurações nos campos (adaptado para estrutura do userConfig do index.js)
const loadSettingsToUI = (config) => {
    addLog('[DEBUG] Chamando loadSettingsToUI com config:' + JSON.stringify(config)); // Log DEBUG
    if (!config) {
        addLog('[DEBUG] Nenhuma configuração (userConfig) encontrada em loadSettingsToUI.'); // Log DEBUG
        // Aplicar padrões se config for nulo ou vazio
        config = {
            gale: { active: true, level: '1x' },
            dailyProfit: 0,
            stopLoss: 0,
            automation: false,
            value: 10, // Valor padrão razoável
            period: 5   // Valor padrão razoável
        };
        addLog('[DEBUG] Aplicando configurações padrão em loadSettingsToUI.');
    }
    
    // Mapeamento da estrutura userConfig para a UI
    UI.toggleGale.checked = config.gale?.active ?? true; // Usa ?? para lidar com config.gale podendo ser undefined
    UI.galeSelect.value = config.gale?.level || '1x';
    UI.dailyProfit.value = config.dailyProfit || '';
    UI.stopLoss.value = config.stopLoss || '';
    UI.toggleAuto.checked = config.automation || false;
    UI.tradeValue.value = config.value || ''; // Mapeia config.value
    UI.tradeTime.value = config.period || ''; // Mapeia config.period

    // Atualiza o estado do select de gale
    UI.galeSelect.disabled = !UI.toggleGale.checked;
    addLog('[DEBUG] UI atualizada por loadSettingsToUI.'); // Log DEBUG
};

// Coletar configurações da UI (adaptado para estrutura do userConfig do index.js)
const getSettingsFromUI = () => {
    const config = {
        gale: {
            active: UI.toggleGale.checked,
            level: UI.galeSelect.value
        },
        dailyProfit: parseInt(UI.dailyProfit.value) || 0,
        stopLoss: parseInt(UI.stopLoss.value) || 0,
        automation: UI.toggleAuto.checked,
        value: parseInt(UI.tradeValue.value) || 0, // Mapeia para value
        period: parseInt(UI.tradeTime.value) || 0 // Mapeia para period
    };
    addLog('[DEBUG] Coletado da UI (formato userConfig) por getSettingsFromUI:' + JSON.stringify(config)); // Log DEBUG
    return config;
};

// ================== LOGS ==================
// Carregar logs do storage
const loadLogs = async () => {
    try {
        const result = await chrome.storage.local.get('settingsLogs');
        const logs = result.settingsLogs || [];
        
        // Limpa o container de logs
        UI.analysisResults.innerHTML = '';
        
        // Adiciona cada log ao container
        logs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.textContent = log;
            UI.analysisResults.appendChild(logEntry);
        });
        
        // Rola para o último log
        UI.analysisResults.scrollTop = UI.analysisResults.scrollHeight;
    } catch (error) {
        console.error('Erro ao carregar logs:', error);
    }
};

// Salvar logs no storage
const saveLogs = async () => {
    if (!UI.analysisResults) return;
    
    const logs = Array.from(UI.analysisResults.children)
        .map(entry => entry.textContent);
    
    try {
        await chrome.storage.local.set({ settingsLogs: logs });
    } catch (error) {
        console.error('Erro ao salvar logs:', error);
    }
};

// Adicionar novo log
const addLog = async (message) => {
    if (!UI.analysisResults) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    UI.analysisResults.appendChild(logEntry);
    UI.analysisResults.scrollTop = UI.analysisResults.scrollHeight;
    
    // Salva os logs no storage
    await saveLogs();
};

// Obter conteúdo dos logs
const getLogsContent = () => {
    if (!UI.analysisResults) return '';
    
    return Array.from(UI.analysisResults.children)
        .map(entry => entry.textContent)
        .join('\n');
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
        addLog('Logs copiados para a área de transferência!');
    } catch (err) {
        console.error('Erro ao copiar logs:', err);
        addLog('Erro ao copiar logs');
    } finally {
        // Remover o elemento temporário
        document.body.removeChild(textarea);
    }
};

// Salvar logs como arquivo
const saveLogsToFile = () => {
    const logs = getLogsContent();
    if (!logs) {
        addLog('Não há logs para salvar');
        return;
    }
    
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-manager-logs-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    addLog('Logs salvos como arquivo');
};

// Limpar logs
const clearLogs = async () => {
    if (!UI.analysisResults) return;
    UI.analysisResults.innerHTML = '';
    await chrome.storage.local.remove('settingsLogs');
    addLog('Logs limpos');
};

// ================== HANDLERS ==================
// Salvar configurações (agora apenas solicita o salvamento ao index.js)
const saveSettings = async () => { // Mantém async por causa do addLog, mas não é estritamente necessário
    addLog('[DEBUG] Iniciando saveSettings (solicitação)...'); // Log DEBUG
    const config = getSettingsFromUI(); // Obtem no formato userConfig
    
    try {
        addLog('[DEBUG] Configurações coletadas, solicitando salvamento ao parent...');
        
        // Solicita que a página principal salve as configurações
        window.parent.postMessage({ 
            action: 'requestSaveSettings', 
            settings: config 
        }, '*');
        addLog('[DEBUG] Mensagem requestSaveSettings enviada.');

        // Solicita o fechamento da página logo após pedir para salvar
        addLog('[DEBUG] Solicitando fechamento da página após salvar...');
        window.parent.postMessage({ action: 'closePage' }, '*');

    } catch (error) {
        console.error('Erro ao coletar ou solicitar salvamento de configurações:', error);
        addLog('Erro ao solicitar salvamento de configurações: ' + error.message);
    }
};

// Fechar página de configurações
const closeSettings = () => {
    addLog('[DEBUG] Enviando mensagem closePage para parent...'); // Log DEBUG
    window.parent.postMessage({ action: 'closePage' }, '*');
};

// ================== EVENT LISTENERS ==================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Carrega os logs salvos primeiro para poder logar o resto
        await loadLogs(); 
        addLog('[DEBUG] Iniciando DOMContentLoaded...'); // Log DEBUG
        
        addLog('[DEBUG] Carregando userConfig do storage...'); // Log DEBUG
        // Busca o objeto userConfig diretamente
        const result = await chrome.storage.sync.get(['userConfig']);
        addLog('[DEBUG] Resultado recebido do storage (get userConfig):' + JSON.stringify(result)); // Log DEBUG
        
        // Extrai o objeto de configuração ou usa um objeto vazio/padrão se não existir
        const config = result.userConfig || {}; 

        loadSettingsToUI(config); // Passa o objeto userConfig para a função
        addLog('Configurações carregadas e aplicadas na UI com sucesso.'); // Mensagem normal
        
        // Adicionar event listeners
        addLog('[DEBUG] Adicionando event listeners...'); // Log DEBUG
        UI.closeBtn?.addEventListener('click', closeSettings);
        UI.saveBtn?.addEventListener('click', saveSettings);
        UI.saveLogBtn?.addEventListener('click', saveLogsToFile);
        UI.copyLogBtn?.addEventListener('click', copyLogs);
        UI.clearLogsBtn?.addEventListener('click', clearLogs);
        
        // Desabilitar select de gale quando toggle estiver desativado
        UI.toggleGale?.addEventListener('change', (e) => {
            UI.galeSelect.disabled = !e.target.checked;
        });
        addLog('[DEBUG] Inicialização concluída.'); // Log DEBUG
        
    } catch (error) {
        console.error('Erro ao inicializar configurações:', error);
        addLog('Erro CRÍTICO ao inicializar configurações: ' + error.message);
        
        // Carrega valores padrão em caso de erro, já no formato userConfig
        addLog('[DEBUG] Carregando valores padrão (formato userConfig) devido a erro.'); // Log DEBUG
        loadSettingsToUI({ // Passa um objeto no formato userConfig padrão
            gale: { active: true, level: '1x' },
            dailyProfit: 0,
            stopLoss: 0,
            automation: false,
            value: 10,
            period: 5
        }); 
    }
}); 