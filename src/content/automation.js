const AUTOMATION_LOG_PREFIX = '[AutomationSim]';

// Nova função para enviar logs para o sistema centralizado (via background.js)
function sendToLogSystem(message, level = 'INFO') {
    try {
        chrome.runtime.sendMessage({
            action: 'addLog',
            logMessage: message,
            level: level,
            source: 'automation.js' // Fonte explícita
        });
    } catch (error) {
        // Fallback para console.warn APENAS se o envio da mensagem falhar
        console.warn(`${AUTOMATION_LOG_PREFIX} Falha crítica ao enviar log para o sistema central: "${message}". Erro: ${error.message}`);
    }
}

(function() {
    sendToLogSystem('Módulo de Automação Simulada INICIANDO.', 'DEBUG');

    // Função para enviar status para o campo de status GLOBAL via index.js
    function updateUserVisibleStatus(text, level = 'info', duration = 5000) {
        sendToLogSystem(`Solicitando atualização de status GLOBAL para index.js (via action:updateStatus): "${text}" (${level})`, 'DEBUG');
        chrome.runtime.sendMessage({
            action: 'updateStatus', // Alterado de type: 'REQUEST_INDEX_DIRECT_UPDATE_STATUS'
            message: text,       // Mapeado de text para message
            type: level,         // Mapeado de level para type
            duration: duration
        }, response => {
            if (chrome.runtime.lastError) {
                sendToLogSystem(`Erro ao enviar status (action:updateStatus) para index.js: ${chrome.runtime.lastError.message}`, 'ERROR');
            } else if (response && !response.success) {
                sendToLogSystem(`index.js reportou falha ao processar atualização de status (action:updateStatus).`, 'WARN');
            }
        });
    }

    function handleSimulatedAutomationTest() {
        sendToLogSystem('Botão #test-simulated-automation-btn clicado.', 'INFO');

        const toggleAutoElement = document.getElementById('toggleAuto');
        let message = '';
        let level = 'info';

        if (toggleAutoElement) {
            if (toggleAutoElement.checked) {
                message = 'Simulação: Iniciado sistema automatico...';
                level = 'success';
                sendToLogSystem('Toggle de automação (#toggleAuto) está ATIVADO.', 'INFO');
            } else {
                message = 'Simulação: Modo automatico está desativado!';
                level = 'warn';
                sendToLogSystem('Toggle de automação (#toggleAuto) está DESATIVADO.', 'INFO');
            }
        } else {
            message = 'Simulação: Toggle #toggleAuto não encontrado!';
            level = 'error';
            sendToLogSystem('Toggle de automação (#toggleAuto) NÃO encontrado no DOM.', 'ERROR');
        }
        updateUserVisibleStatus(message, level);
    }

    document.addEventListener('DOMContentLoaded', () => {
        sendToLogSystem('DOMContentLoaded disparado em automation.js (simulado).', 'DEBUG');
        const testButton = document.getElementById('test-simulated-automation-btn');
        if (testButton) {
            sendToLogSystem('Botão #test-simulated-automation-btn encontrado. Adicionando listener.', 'DEBUG');
            testButton.addEventListener('click', handleSimulatedAutomationTest);
        } else {
            sendToLogSystem('Botão #test-simulated-automation-btn NÃO encontrado.', 'WARN');
        }
        // Removido o updateUserVisibleStatus daqui, pois pode ser muito cedo e causar "port closed"
        // se index.js não estiver pronto. O botão de teste será a principal forma de interação inicial.
    });

    sendToLogSystem('Módulo de Automação Simulada carregado.', 'INFO');
})(); 