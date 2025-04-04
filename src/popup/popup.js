// ================== VARIÁVEIS GLOBAIS ==================
let settings = {
    tradeValue: 10,
    tradeTime: 0,
    galeEnabled: true,
    galeLevel: '1x'
};

// ================== FUNÇÕES AUXILIARES ==================
/**
 * Atualiza o status na interface
 * @param {string} message - Mensagem de status
 * @param {string} type - Tipo de status (success, error, info)
 */
const updateStatus = (message, type = 'info') => {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
};

/**
 * Carrega as configurações salvas
 */
const loadSettings = () => {
    chrome.storage.sync.get(settings, (result) => {
        settings = { ...settings, ...result };
        document.getElementById('tradeValue').value = settings.tradeValue;
        document.getElementById('tradeTime').value = settings.tradeTime;
        document.getElementById('galeEnabled').value = settings.galeEnabled.toString();
        document.getElementById('galeLevel').value = settings.galeLevel;
    });
};

/**
 * Salva as configurações
 */
const saveSettings = () => {
    settings = {
        tradeValue: parseInt(document.getElementById('tradeValue').value),
        tradeTime: parseInt(document.getElementById('tradeTime').value),
        galeEnabled: document.getElementById('galeEnabled').value === 'true',
        galeLevel: document.getElementById('galeLevel').value
    };
    chrome.storage.sync.set(settings);
};

// ================== EVENT LISTENERS ==================
document.addEventListener('DOMContentLoaded', () => {
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            console.log('Botão de captura clicado');
            // Envia mensagem para o background iniciar a captura
            chrome.runtime.sendMessage({
                action: 'initiateCapture',
                actionType: 'analyze',
                requireProcessing: true,
                iframeWidth: 480,
                openWindow: true // Abrir janela ao capturar do popup
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Erro ao capturar:', chrome.runtime.lastError);
                    return;
                }
                console.log('Captura realizada com sucesso');
                // Fechar o popup após a captura
                window.close();
            });
        });
    } else {
        console.error('Botão de captura não encontrado');
    }
}); 