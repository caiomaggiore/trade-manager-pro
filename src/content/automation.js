(function() {
    const AUTOMATION_LOG_PREFIX = '[AutomationSim]';

    // Apenas console.log para depuração interna deste módulo.
    // A comunicação de status visível ao usuário será via mensagem para index.js.
    function log(message, level = 'INFO') {
        console.log(`[${level}]${AUTOMATION_LOG_PREFIX} ${message}`);
        // REMOVIDO: window.logToSystem
    }

    log('Módulo de Automação Simulada INICIANDO.', 'DEBUG');

    // Função para enviar status para o campo de status GLOBAL via index.js
    function updateUserVisibleStatus(text, level = 'info', duration = 5000) {
        log(`Solicitando atualização de status GLOBAL para index.js: "${text}" (${level})`, 'DEBUG');
        chrome.runtime.sendMessage({
            type: 'REQUEST_INDEX_DIRECT_UPDATE_STATUS', // Usando o tipo que index.js já trata
            text: text,
            level: level,
            duration: duration
        }, response => {
            if (chrome.runtime.lastError) {
                log(`Erro ao enviar status para index.js: ${chrome.runtime.lastError.message}`, 'ERROR');
            } else if (response && !response.success) {
                log(`index.js reportou falha ao processar atualização de status global.`, 'WARN');
            }
        });
    }

    function handleSimulatedAutomationTest() {
        log('Botão #test-simulated-automation-btn clicado.', 'INFO');

        const toggleAutoElement = document.getElementById('toggleAuto');
        let message = '';
        let level = 'info';

        if (toggleAutoElement) {
            if (toggleAutoElement.checked) {
                message = 'Simulação: Iniciado sistema automatico...';
                level = 'success';
                log('Toggle de automação (#toggleAuto) está ATIVADO.', 'INFO');
            } else {
                message = 'Simulação: Modo automatico está desativado!';
                level = 'warn';
                log('Toggle de automação (#toggleAuto) está DESATIVADO.', 'INFO');
            }
        } else {
            message = 'Simulação: Toggle #toggleAuto não encontrado!';
            level = 'error';
            log('Toggle de automação (#toggleAuto) NÃO encontrado no DOM.', 'ERROR');
        }
        updateUserVisibleStatus(message, level);
    }

    document.addEventListener('DOMContentLoaded', () => {
        log('DOMContentLoaded disparado em automation.js (simulado).', 'DEBUG');
        const testButton = document.getElementById('test-simulated-automation-btn');
        if (testButton) {
            log('Botão #test-simulated-automation-btn encontrado. Adicionando listener.', 'DEBUG');
            testButton.addEventListener('click', handleSimulatedAutomationTest);
        } else {
            log('Botão #test-simulated-automation-btn NÃO encontrado.', 'WARN');
        }
        updateUserVisibleStatus('Automação Simulada Pronta (teste). Status global.', 'info', 3000); // Status inicial
    });

    log('Módulo de Automação Simulada carregado.', 'INFO');
})(); 