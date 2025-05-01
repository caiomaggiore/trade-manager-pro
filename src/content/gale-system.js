// src/content/gale-system.js
// Sistema de aplicação de Gale para o Trade Manager Pro

(function() {
    // Constantes para padronizar as ações do sistema
    const GALE_ACTIONS = {
        APPLY: 'APPLY_GALE',
        RESET: 'RESET_GALE',
        STATUS: 'GET_GALE_STATUS',
        UPDATED: 'GALE_UPDATED',
        RESET_DONE: 'GALE_RESET'
    };

    // Variáveis de controle do sistema de gale
    let isActive = false;
    let galeCount = 0;
    let originalValue = 0;
    let galeMultiplier = 1.2;
    
    // Inicializar sistema de gale
    function initialize() {
        console.log('[GaleSystem] Inicializando sistema de gale...');
        
        try {
            // Verificar se o StateManager está disponível
            if (window.StateManager) {
                // Obter configurações atuais
                const config = window.StateManager.getConfig();
                
                // Inicializar variáveis com valores das configurações
                isActive = config.gale?.active || false;
                originalValue = config.value || 10;
                
                // Garantir que o nível de gale sempre começa zerado na inicialização
                galeCount = 0;
                
                // Converter multiplicador de string (ex: "1.2x") para número (1.2)
                if (config.gale?.level) {
                    galeMultiplier = parseFloat(config.gale.level.replace('x', '')) || 1.2;
                }
                
                console.log(`[GaleSystem] Inicializado com: ativo=${isActive}, valor=${originalValue}, multiplicador=${galeMultiplier}`);
                
                // Configurar listener para mudanças nas configurações
                window.StateManager.subscribe((notification) => {
                    if (notification.type === 'config') {
                        handleConfigUpdate(notification.state.config);
                    }
                });
                
                // Adicionar logs para confirmar inicialização
                log('Sistema de Gale inicializado');
                log(`Gale ${isActive ? 'ativado' : 'desativado'}, multiplicador: ${galeMultiplier}x`);
            } else {
                console.error('[GaleSystem] StateManager não encontrado. O sistema de gale não funcionará corretamente.');
                log('Erro: StateManager não encontrado', 'ERROR');
            }
        } catch (error) {
            console.error('[GaleSystem] Erro ao inicializar:', error);
            log(`Erro ao inicializar sistema de gale: ${error.message}`, 'ERROR');
        }
        
        // Configurar listener para mensagens
        setupMessageListener();
    }
    
    // Lidar com atualizações de configuração
    function handleConfigUpdate(config) {
        if (!config) return;
        
        try {
            // Atualizar valores conforme as novas configurações
            isActive = config.gale?.active || false;
            
            // Atualizar multiplicador de gale se alterado
            if (config.gale?.level) {
                galeMultiplier = parseFloat(config.gale.level.replace('x', '')) || 1.2;
            }
            
            // Se não estiver em um ciclo de gale, também atualiza o valor original
            if (galeCount === 0) {
                originalValue = config.value || 10;
            }
            
            console.log(`[GaleSystem] Configurações atualizadas: valor=${originalValue}, ativo=${isActive}, multiplicador=${galeMultiplier}`);
        } catch (error) {
            console.error('[GaleSystem] Erro ao processar atualização de configuração:', error);
        }
    }
    
    // Configurar listener para mensagens
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                // Usar as constantes para verificar as ações
                if (message.action === GALE_ACTIONS.APPLY) {
                    // Usar a mesma função que o botão de simulação
                    const result = applyGale(message.data);
                    
                    // Se aplicou com sucesso, acionar a análise
                    if (result.success) {
                        // Pequeno delay para garantir que o StateManager tenha tempo de atualizar
                        setTimeout(triggerNewAnalysis, 500);
                    }
                    
                    sendResponse({ success: true, result: result });
                    return true; // Manter canal de comunicação aberto para resposta assíncrona
                }
                
                if (message.action === GALE_ACTIONS.RESET) {
                    const result = resetGale();
                    sendResponse({ success: true, result: result });
                    return true;
                }
                
                if (message.action === GALE_ACTIONS.STATUS) {
                    sendResponse({
                        success: true,
                        data: getStatus()
                    });
                    return true;
                }
            } catch (error) {
                console.error('[GaleSystem] Erro ao processar mensagem:', error);
                sendResponse({ success: false, error: error.message });
                return true;
            }
        });
    }
    
    /**
     * Aciona uma nova análise simulando o clique no botão
     */
    function triggerNewAnalysis() {
        try {
            log('Acionando nova análise após aplicação de gale...', 'INFO');
            
            // Primeiro, tentar localizar o botão de análise da interface principal (mais confiável)
            const analyzeBtn = document.querySelector('#analyzeBtn');
            if (analyzeBtn) {
                log('Botão de análise (analyzeBtn) encontrado, simulando clique', 'SUCCESS');
                analyzeBtn.click();
                return true;
            }
            
            // Se não encontrar analyzeBtn, tentar o botão alternativo
            const analyzeButton = document.querySelector('#run-analysis');
            if (analyzeButton) {
                log('Botão alternativo de análise encontrado, simulando clique', 'INFO');
                analyzeButton.click();
                return true;
            }
            
            // Se o botão não existe, procurar pelo elemento TradeManager.AnalyzeGraph
            if (window.TradeManager && window.TradeManager.AnalyzeGraph) {
                // Verificar qual método de análise está disponível
                if (typeof window.TradeManager.AnalyzeGraph.analyze === 'function') {
                    log('Módulo de análise encontrado, chamando função analyze()', 'INFO');
                    window.TradeManager.AnalyzeGraph.analyze();
                    return true;
                } else if (typeof window.TradeManager.AnalyzeGraph.runAnalysis === 'function') {
                    log('Módulo de análise encontrado, chamando função runAnalysis()', 'INFO');
                    window.TradeManager.AnalyzeGraph.runAnalysis();
                    return true;
                } else {
                    // Logar os métodos disponíveis para debug
                    const methods = Object.keys(window.TradeManager.AnalyzeGraph);
                    log(`Módulo AnalyzeGraph encontrado, mas métodos disponíveis são: ${methods.join(', ')}`, 'WARN');
                }
            } else {
                log('Módulo de análise TradeManager.AnalyzeGraph não encontrado', 'WARN');
            }
            
            // Se nenhum dos métodos anteriores funcionou, tentar chamar a função via mensagem
            log('Tentando método alternativo de análise via mensagem', 'INFO');
            chrome.runtime.sendMessage({
                action: 'START_ANALYSIS',
                source: 'gale-system',
                trigger: 'gale_applied'
            }, response => {
                if (chrome.runtime.lastError) {
                    log(`Erro ao solicitar análise via mensagem: ${chrome.runtime.lastError.message}`, 'ERROR');
                    return;
                }
                
                if (response && response.success) {
                    log('Análise iniciada com sucesso via mensagem', 'SUCCESS');
                } else {
                    log(`Falha ao iniciar análise via mensagem: ${response?.error || 'Sem resposta'}`, 'ERROR');
                }
            });
            
            return true;
        } catch (error) {
            log(`Erro ao acionar nova análise: ${error.message}`, 'ERROR');
            return false;
        }
    }
    
    // Aplicar gale após perda
    function applyGale(data = {}) {
        try {
            // Verificar se o gale está ativo nas configurações
            if (!isActive) {
                log('Gale não está ativado. Nenhuma ação será tomada.', 'WARN');
                return { success: false, message: 'Gale desativado' };
            }
            
            // Log detalhado para ver quem está chamando o gale
            log(`Aplicando gale solicitado por: ${data.source || 'desconhecido'}`, 'INFO');
            
            // Obter o valor atual configurado
            let currentEntryValue = 0;
            if (window.StateManager) {
                currentEntryValue = parseFloat(window.StateManager.getConfig().value || 0);
                log(`Valor atual de entrada: ${currentEntryValue}`, 'DEBUG');
            }
            
            // Se não temos um valor atual, usar o valor original
            if (currentEntryValue <= 0) {
                log(`Valor atual inválido, usando valor original: ${originalValue}`, 'WARN');
                currentEntryValue = originalValue;
            }
            
            // Definir o nível de gale corretamente
            if (galeCount === 0) {
                galeCount = 1; // Primeiro nível de gale
                
                // Se for a primeira aplicação do gale, salvar o valor original
                if (window.StateManager) {
                    originalValue = parseFloat(window.StateManager.getConfig().value || 10);
                    log(`Valor original salvo para primeiro gale: ${originalValue}`, 'DEBUG');
                }
            } else {
                galeCount++; // Incrementar níveis subsequentes
            }
            
            log(`Aplicando Gale nível ${galeCount}`, 'INFO');
            
            // Calcular novo valor usando o valor atual como base
            // Fórmula: valorAtual + (valorAtual * multiplicador)
            const newValue = parseFloat((currentEntryValue + (currentEntryValue * galeMultiplier)).toFixed(2));
            
            log(`Novo valor calculado: ${newValue} (Valor atual: ${currentEntryValue}, Gale nível ${galeCount}, multiplicador: ${galeMultiplier})`, 'INFO');
            log(`Fórmula aplicada: ${currentEntryValue} + (${currentEntryValue} * ${galeMultiplier})`, 'DEBUG');
            
            // Atualizar o valor no StateManager
            if (window.StateManager) {
                const config = window.StateManager.getConfig();
                const updatedConfig = {
                    ...config,
                    value: newValue
                };
                
                window.StateManager.saveConfig(updatedConfig)
                    .then(() => {
                        log(`Valor de entrada atualizado para: ${newValue}`, 'SUCCESS');
                        
                        // Mostrar feedback visual
                        showFeedback(`Gale nível ${galeCount} aplicado`, `Novo valor: $${newValue}`, 'warning');
                    })
                    .catch(error => {
                        log(`Erro ao salvar novo valor: ${error.message}`, 'ERROR');
                    });
            } else {
                log('StateManager não disponível. Não foi possível atualizar o valor.', 'ERROR');
                return { success: false, message: 'StateManager não disponível' };
            }
            
            // Notificar sobre o valor atualizado
            notify(GALE_ACTIONS.UPDATED, {
                level: galeCount,
                newValue: newValue,
                originalValue: originalValue,
                currentValue: currentEntryValue,
                multiplier: galeMultiplier
            });
            
            return { 
                success: true, 
                level: galeCount, 
                newValue: newValue,
                currentValue: currentEntryValue,
                message: `Gale nível ${galeCount} aplicado. Novo valor: ${newValue}`
            };
        } catch (error) {
            log(`Erro ao aplicar gale: ${error.message}`, 'ERROR');
            console.error('[GaleSystem] Erro ao aplicar gale:', error);
            return { success: false, message: `Erro: ${error.message}` };
        }
    }
    
    // Resetar gale para o valor original
    function resetGale() {
        try {
            // Verificar se há algo para resetar
            if (galeCount === 0) {
                log('Não há gale ativo para resetar', 'INFO');
                return { success: false, message: 'Não há gale para resetar' };
            }
            
            // Resetar contador
            const previousLevel = galeCount;
            galeCount = 0;
            
            log(`Resetando gale do nível ${previousLevel}`, 'INFO');
            
            // Restaurar valor original no StateManager
            if (window.StateManager && originalValue > 0) {
                const config = window.StateManager.getConfig();
                const updatedConfig = {
                    ...config,
                    value: originalValue
                };
                
                window.StateManager.saveConfig(updatedConfig)
                    .then(() => {
                        log(`Valor de entrada restaurado para o original: ${originalValue}`, 'SUCCESS');
                        
                        // Mostrar feedback visual
                        showFeedback(`Gale resetado`, `Valor restaurado: $${originalValue}`, 'success');
                    })
                    .catch(error => {
                        log(`Erro ao restaurar valor original: ${error.message}`, 'ERROR');
                    });
            } else {
                log('StateManager não disponível ou valor original inválido', 'ERROR');
                return { success: false, message: 'Não foi possível restaurar o valor original' };
            }
            
            // Notificar sobre o reset
            notify(GALE_ACTIONS.RESET_DONE, {
                previousLevel: previousLevel,
                originalValue: originalValue
            });
            
            return { 
                success: true, 
                message: `Gale resetado. Valor restaurado para ${originalValue}`
            };
        } catch (error) {
            log(`Erro ao resetar gale: ${error.message}`, 'ERROR');
            console.error('[GaleSystem] Erro ao resetar gale:', error);
            return { success: false, message: `Erro: ${error.message}` };
        }
    }
    
    // Obter status atual do sistema de gale
    function getStatus() {
        // Obter o valor atual configurado
        let currentEntryValue = 0;
        if (window.StateManager) {
            currentEntryValue = parseFloat(window.StateManager.getConfig().value || 0);
        }
        
        // Se não temos um valor atual válido, usar o valor original
        if (currentEntryValue <= 0) {
            currentEntryValue = originalValue;
        }
        
        // Calcular o próximo valor para o próximo gale
        // Fórmula: valorAtual + (valorAtual * multiplicador)
        const nextGaleValue = parseFloat((currentEntryValue + (currentEntryValue * galeMultiplier)).toFixed(2));
        
        return {
            active: isActive,
            level: galeCount,
            originalValue: originalValue,
            currentValue: currentEntryValue,
            currentMultiplier: galeMultiplier,
            nextValue: nextGaleValue
        };
    }
    
    // Função para mostrar feedback visual na interface
    function showFeedback(title, message, type = 'info') {
        try {
            // Verificar se estamos em uma página com interface
            if (!document.body) return;
            
            // Criar o elemento de notificação
            const notification = document.createElement('div');
            notification.className = `gale-notification gale-${type}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 10px 15px;
                border-radius: 5px;
                background-color: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#FF9800' : '#2196F3'};
                color: white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                z-index: 9999;
                animation: fadeIn 0.3s, fadeOut 0.5s 2.5s forwards;
                max-width: 300px;
            `;
            
            notification.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
                <div style="font-size: 0.9em;">${message}</div>
            `;
            
            // Adicionar ao DOM
            document.body.appendChild(notification);
            
            // Remover após 3 segundos
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
            
            // Adicionar estilos de animação se não existirem
            if (!document.getElementById('gale-notification-styles')) {
                const style = document.createElement('style');
                style.id = 'gale-notification-styles';
                style.textContent = `
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes fadeOut {
                        from { opacity: 1; transform: translateY(0); }
                        to { opacity: 0; transform: translateY(-10px); }
                    }
                `;
                document.head.appendChild(style);
            }
        } catch (error) {
            console.error('[GaleSystem] Erro ao mostrar feedback:', error);
        }
    }
    
    // Função para enviar logs para o sistema de logs
    function log(message, level = 'INFO') {
        if (typeof window.logToSystem === 'function') {
            try {
                window.logToSystem(message, level, 'gale-system.js');
            } catch (error) {
                // Fallback para console em caso de erro
                console.error('[GaleSystem] Erro ao usar logToSystem:', error);
                const prefix = level === 'ERROR' ? '❌' : 
                            level === 'WARN' ? '⚠️' : 
                            level === 'SUCCESS' ? '✅' : 'ℹ️';
                console.log(`${prefix} [GaleSystem] ${message}`);
            }
        } else {
            const prefix = level === 'ERROR' ? '❌' : 
                          level === 'WARN' ? '⚠️' : 
                          level === 'SUCCESS' ? '✅' : 'ℹ️';
            console.log(`${prefix} [GaleSystem] ${message}`);
        }
    }
    
    // Função para notificar outros componentes sobre eventos do sistema de gale
    function notify(action, data) {
        try {
            chrome.runtime.sendMessage({
                action: action,
                data: data
            });
        } catch (error) {
            console.error('[GaleSystem] Erro ao enviar notificação:', error);
        }
    }
    
    // Simular aplicação de gale (para compatibilidade com código existente)
    function simulateGale() {
        log('Simulando aplicação de gale via botão...', 'INFO');
        
        try {
            // Verificar o status atual antes da aplicação para depuração
            const beforeStatus = getStatus();
            log(`Status antes da simulação: nível ${beforeStatus.level}, valor original ${beforeStatus.originalValue}`, 'DEBUG');
            
            // Usar a mesma função principal com mais contexto
            const result = applyGale({ 
                source: 'button',
                timestamp: Date.now(),
                action: 'Simulate Loss',
                symbol: 'MANUAL'
            });
            
            // Se aplicou com sucesso, acionar a análise após um pequeno delay
            if (result.success) {
                log('Gale aplicado com sucesso via simulação, agendando nova análise...', 'INFO');
                setTimeout(triggerNewAnalysis, 500);
            } else {
                log(`Não foi possível aplicar gale via simulação: ${result.message}`, 'WARN');
            }
            
            return result;
        } catch (error) {
            log(`Erro ao simular gale: ${error.message}`, 'ERROR');
            return { success: false, message: `Erro: ${error.message}` };
        }
    }
    
    // Simular reset de gale (para compatibilidade com código existente)
    function simulateReset() {
        log('Simulando reset de gale via botão...', 'INFO');
        
        try {
            // Verificar o status atual antes do reset para depuração
            const beforeStatus = getStatus();
            log(`Status antes do reset: nível ${beforeStatus.level}, valor original ${beforeStatus.originalValue}`, 'DEBUG');
            
            // Usar a mesma função principal
            return resetGale();
        } catch (error) {
            log(`Erro ao simular reset: ${error.message}`, 'ERROR');
            return { success: false, message: `Erro: ${error.message}` };
        }
    }
    
    // Funções públicas para acesso externo
    window.GaleSystem = {
        applyGale: applyGale,    // Usa a mesma função para sistema automático e controles manuais
        resetGale: resetGale,    // Usa a mesma função para sistema automático e controles manuais
        getStatus: getStatus,
        triggerAnalysis: triggerNewAnalysis,  // Expõe a função para testes manuais
        simulateGale: simulateGale,          // Para compatibilidade com código existente
        simulateReset: simulateReset         // Para compatibilidade com código existente
    };
    
    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

// Log para confirmar carregamento do arquivo
console.log('[GaleSystem] Módulo de sistema de gale carregado'); 