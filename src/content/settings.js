// ================== ELEMENTOS DA UI ==================
const settingsUI = {
    closeBtn: document.getElementById('close-settings'),
    saveBtn: document.getElementById('save-settings'),
    toggleGale: document.getElementById('toggleGale'),
    galeSelect: document.getElementById('gale-select'),
    dailyProfit: document.getElementById('daily-profit'),
    stopLoss: document.getElementById('stop-loss'),
    toggleAuto: document.getElementById('toggleAuto'),
    tradeValue: document.getElementById('trade-value'),
    tradeTime: document.getElementById('trade-time')
};

// Função simplificada para enviar logs ao sistema centralizado
const logFromSettings = (message, level = 'INFO') => {
    console.log(`[${level}][settings.js] ${message}`); // Log local para debug
    
    // Enviar para o sistema centralizado via mensagem
    try {
        chrome.runtime.sendMessage({
            action: 'logMessage',
            message: message,
            level: level,
            source: 'settings.js'
        });
    } catch (error) {
        console.error('[settings.js] Erro ao enviar log:', error);
    }
};

// ================== GERENCIAMENTO DE ESTADO ==================
// Carregar configurações nos campos
const loadSettingsToUI = (config) => {
    logFromSettings('[DEBUG] Chamando loadSettingsToUI com config:' + JSON.stringify(config), 'DEBUG');
    
    if (!config) {
        logFromSettings('[DEBUG] Nenhuma configuração encontrada em loadSettingsToUI.', 'DEBUG');
        // Aplicar padrões
        config = {
            gale: { active: true, level: '1x' },
            dailyProfit: 0,
            stopLoss: 0,
            automation: false,
            value: 10,
            period: 5
        };
        logFromSettings('[DEBUG] Aplicando configurações padrão.', 'DEBUG');
    }
    
    // Mapeamento para a UI
    settingsUI.toggleGale.checked = config.gale?.active ?? true;
    settingsUI.galeSelect.value = config.gale?.level || '1x';
    settingsUI.dailyProfit.value = config.dailyProfit || '';
    settingsUI.stopLoss.value = config.stopLoss || '';
    settingsUI.toggleAuto.checked = config.automation || false;
    settingsUI.tradeValue.value = config.value || '';
    settingsUI.tradeTime.value = config.period || '';

    // Atualiza o estado do select de gale
    settingsUI.galeSelect.disabled = !settingsUI.toggleGale.checked;
    logFromSettings('[DEBUG] UI atualizada.', 'DEBUG');
};

// Coletar configurações da UI
const getSettingsFromUI = () => {
    const config = {
        gale: {
            active: settingsUI.toggleGale.checked,
            level: settingsUI.galeSelect.value
        },
        dailyProfit: parseInt(settingsUI.dailyProfit.value) || 0,
        stopLoss: parseInt(settingsUI.stopLoss.value) || 0,
        automation: settingsUI.toggleAuto.checked,
        value: parseInt(settingsUI.tradeValue.value) || 0,
        period: parseInt(settingsUI.tradeTime.value) || 0
    };
    logFromSettings('[DEBUG] Configurações coletadas da UI: ' + JSON.stringify(config), 'DEBUG');
    return config;
};

// ================== HANDLERS ==================
// Salvar configurações
const saveSettings = () => {
    logFromSettings('[DEBUG] Iniciando saveSettings...', 'DEBUG');
    const config = getSettingsFromUI();
    
    try {
        // Solicita que a página principal salve as configurações
        window.parent.postMessage({ 
            action: 'requestSaveSettings', 
            settings: config 
        }, '*');
        logFromSettings('[DEBUG] Mensagem requestSaveSettings enviada.', 'DEBUG');

        // Solicita o fechamento da página
        logFromSettings('[DEBUG] Solicitando fechamento da página...', 'DEBUG');
        window.parent.postMessage({ action: 'closePage' }, '*');
    } catch (error) {
        console.error('Erro ao solicitar salvamento:', error);
        logFromSettings('Erro ao solicitar salvamento: ' + error.message, 'ERROR');
    }
};

// Fechar página de configurações
const closeSettings = () => {
    logFromSettings('[DEBUG] Tentando fechar página de configurações...', 'DEBUG');
    
    try {
        // Método 1: Tentar acessar diretamente o navigationManager
        if (window.parent && window.parent.navigationManager) {
            window.parent.navigationManager.closePage();
            return;
        }
        
        // Método 2: Usar postMessage como fallback
        window.parent.postMessage({ action: 'closePage' }, '*');
    } catch (error) {
        console.error('[settings.js] Erro ao tentar fechar página:', error);
        logFromSettings('Erro ao tentar fechar página: ' + error.message, 'ERROR');
    }
};

// ================== LISTENERS ==================
// Adicionar eventos aos elementos da UI
document.addEventListener('DOMContentLoaded', () => {
    logFromSettings('Inicializando página de configurações', 'INFO');
    
    // Desabilitar o select de gale se o toggle estiver desativado
    settingsUI.toggleGale.addEventListener('change', () => {
        settingsUI.galeSelect.disabled = !settingsUI.toggleGale.checked;
    });
    
    // Evento de salvar
    if (settingsUI.saveBtn) {
        settingsUI.saveBtn.addEventListener('click', saveSettings);
    }
    
    // Evento de fechar
    if (settingsUI.closeBtn) {
        settingsUI.closeBtn.addEventListener('click', closeSettings);
    }
    
    // Solicitar configurações à página principal
    try {
        window.parent.postMessage({ action: 'requestSettings' }, '*');
        logFromSettings('Solicitação de configurações enviada', 'INFO');
    } catch (error) {
        console.error('[settings.js] Erro ao solicitar configurações:', error);
        logFromSettings('Erro ao solicitar configurações: ' + error.message, 'ERROR');
    }
});

// Listener para receber mensagens da página principal
window.addEventListener('message', (event) => {
    const { action, settings } = event.data;
    
    if (action === 'loadSettings') {
        logFromSettings('Recebidas configurações para carregar', 'INFO');
        loadSettingsToUI(settings);
    }
});

// Exportar funções para uso em outros scripts
window.settingsModule = {
    loadSettingsToUI,
    getSettingsFromUI,
    saveSettings
}; 