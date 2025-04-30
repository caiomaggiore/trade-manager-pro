// src/content/gale-system.js
// Sistema de aplicação de Gale para o Trade Manager Pro

(function() {
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
            if (message.action === 'APPLY_GALE') {
                const result = applyGale(message.data);
                sendResponse({ success: true, result: result });
                return true; // Manter canal de comunicação aberto para resposta assíncrona
            }
            
            if (message.action === 'RESET_GALE') {
                const result = resetGale();
                sendResponse({ success: true, result: result });
                return true;
            }
            
            if (message.action === 'GET_GALE_STATUS') {
                sendResponse({
                    success: true,
                    data: getStatus()
                });
                return true;
            }
        });
    }
    
    // Aplicar gale após perda
    function applyGale(data = {}) {
        try {
            // Verificar se o gale está ativo nas configurações
            if (!isActive) {
                log('Gale não está ativado. Nenhuma ação será tomada.', 'WARN');
                return { success: false, message: 'Gale desativado' };
            }
            
            // Incrementar contador de gale
            galeCount++;
            log(`Aplicando Gale nível ${galeCount}`, 'INFO');
            
            // Se for a primeira aplicação do gale, garantir que temos o valor original
            if (galeCount === 1 && window.StateManager) {
                originalValue = window.StateManager.getConfig().value || 10;
                log(`Valor original salvo: ${originalValue}`, 'DEBUG');
            }
            
            // Calcular novo valor
            const currentValue = originalValue;
            let newValue = currentValue;
            
            // Aplicar o multiplicador conforme o nível do gale
            for (let i = 0; i < galeCount; i++) {
                newValue += currentValue * galeMultiplier;
            }
            
            // Arredondar para duas casas decimais
            newValue = parseFloat(newValue.toFixed(2));
            
            log(`Novo valor calculado: ${newValue} (Original: ${originalValue}, Soma com ${galeCount} níveis de ${originalValue} × ${galeMultiplier})`, 'INFO');
            
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
                    })
                    .catch(error => {
                        log(`Erro ao salvar novo valor: ${error.message}`, 'ERROR');
                    });
            } else {
                log('StateManager não disponível. Não foi possível atualizar o valor.', 'ERROR');
                return { success: false, message: 'StateManager não disponível' };
            }
            
            // Notificar sobre o valor atualizado
            notify('GALE_UPDATED', {
                level: galeCount,
                newValue: newValue,
                originalValue: originalValue,
                multiplier: galeMultiplier
            });
            
            return { 
                success: true, 
                level: galeCount, 
                newValue: newValue,
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
                    })
                    .catch(error => {
                        log(`Erro ao restaurar valor original: ${error.message}`, 'ERROR');
                    });
            } else {
                log('StateManager não disponível ou valor original inválido', 'ERROR');
                return { success: false, message: 'Não foi possível restaurar o valor original' };
            }
            
            // Notificar sobre o reset
            notify('GALE_RESET', {
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
        // Calcular o próximo valor usando a mesma fórmula da função applyGale
        let currentValue = originalValue;
        let nextValue = currentValue;
        
        // Se já estiver em um nível de gale, calcular o valor atual
        for (let i = 0; i < galeCount; i++) {
            nextValue += currentValue * galeMultiplier;
        }
        
        // Calcular o próximo valor (valor atual + valor base * multiplicador)
        let nextGaleValue = nextValue + (currentValue * galeMultiplier);
        
        return {
            active: isActive,
            level: galeCount,
            originalValue: originalValue,
            currentMultiplier: galeMultiplier,
            nextValue: galeCount > 0 ? 
                nextGaleValue.toFixed(2) : 
                originalValue
        };
    }
    
    // Função para enviar logs para o sistema de logs
    function log(message, level = 'INFO') {
        if (typeof window.logToSystem === 'function') {
            window.logToSystem(message, level, 'gale-system.js');
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
    
    // Simular aplicação de gale (para testes)
    function simulateGale() {
        log('Simulando aplicação de gale...', 'INFO');
        return applyGale({ success: false });
    }
    
    // Simular reset de gale (para testes)
    function simulateReset() {
        log('Simulando reset de gale...', 'INFO');
        return resetGale();
    }
    
    // Funções públicas para acesso externo
    window.GaleSystem = {
        applyGale: applyGale,
        resetGale: resetGale,
        getStatus: getStatus,
        simulateGale: simulateGale,
        simulateReset: simulateReset
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