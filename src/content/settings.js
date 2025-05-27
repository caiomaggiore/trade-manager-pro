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
    tradeTime: document.getElementById('trade-time'),
    toggleTestMode: document.getElementById('toggleTestMode'),
    toggleDevMode: document.getElementById('toggleDevMode'),
    minPayout: document.getElementById('min-payout-select'),
    payoutBehavior: document.getElementById('payout-behavior-select'),
    payoutTimeout: document.getElementById('payout-timeout'),
    payoutTimeoutContainer: document.getElementById('payout-timeout-container'),
    // Novos elementos para troca de ativos
    assetSwitchingContainer: document.getElementById('asset-switching-container'),
    assetPreferredCategory: document.getElementById('asset-preferred-category')
};

// Função simplificada para enviar logs ao sistema centralizado
const logFromSettings = (message, level = 'INFO') => {
    try {
        if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: 'addLog',
                logMessage: message,
                level: level,
                source: 'settings.js'
            });
        }
    } catch (error) {
        console.warn('[settings.js] Exceção ao tentar enviar log via runtime:', error);
    }
};

// ================== GERENCIAMENTO DE ESTADO ==================
// Carregar configurações nos campos
const loadSettingsToUI = (config) => {
    logFromSettings('Carregando configurações para a UI: ' + JSON.stringify(config), 'INFO');
    
    if (!config) {
        logFromSettings('Nenhuma configuração encontrada, carregando padrões do default.json', 'WARN');
        
        // Tentar carregar default.json se existir
        fetch('../config/default.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro ao carregar default.json: ${response.status}`);
                }
                return response.json();
            })
            .then(defaultConfig => {
                logFromSettings('Configurações padrão carregadas com sucesso de default.json', 'SUCCESS');
                applySettingsToUI(defaultConfig);
            })
            .catch(error => {
                logFromSettings('Erro ao carregar default.json: ' + error.message, 'ERROR');
                // Se não conseguir carregar o arquivo, usar valores padrão hardcoded
                applySettingsToUI({
                    gale: { active: true, level: '1x' },
                    dailyProfit: 0,
                    stopLoss: 0,
                    automation: false,
                    value: 10,
                    period: 5,
                    minPayout: 80
                });
            });
        return;
    }
    
    applySettingsToUI(config);
};

// Aplicar configurações aos elementos da UI
const applySettingsToUI = (config) => {
    logFromSettings('Aplicando configurações à UI', 'DEBUG');
    
    // Mapeamento para a UI
    settingsUI.toggleGale.checked = config.gale?.active ?? true;
    settingsUI.galeSelect.value = config.gale?.level || '1x';
    settingsUI.dailyProfit.value = config.dailyProfit || '';
    settingsUI.stopLoss.value = config.stopLoss || '';
    settingsUI.toggleAuto.checked = config.automation || false;
    settingsUI.tradeValue.value = config.value || '';
    settingsUI.tradeTime.value = config.period || '';
    settingsUI.toggleTestMode.checked = config.testMode || false;
    settingsUI.toggleDevMode.checked = config.devMode || false;

    // Configurar o payout mínimo (verificando se o elemento existe)
    if (settingsUI.minPayout) {
        // Obter o valor do payout mínimo (com valor padrão 80%)
        const payoutValue = config.minPayout || 80;
        
        // Tentar selecionar o valor exato
        if (Array.from(settingsUI.minPayout.options).some(option => parseInt(option.value) === payoutValue)) {
            settingsUI.minPayout.value = payoutValue.toString();
        } else {
            // Se não encontrar o valor exato, encontrar o mais próximo
            const options = Array.from(settingsUI.minPayout.options);
            const optionValues = options.map(option => parseInt(option.value));
            const closestValue = optionValues.reduce((prev, curr) => {
                return (Math.abs(curr - payoutValue) < Math.abs(prev - payoutValue) ? curr : prev);
            });
            settingsUI.minPayout.value = closestValue.toString();
        }
        
        logFromSettings(`Payout mínimo configurado na UI: ${settingsUI.minPayout.value}%`, 'DEBUG');
    }

    // Configurar comportamento de payout insuficiente
    if (settingsUI.payoutBehavior) {
        settingsUI.payoutBehavior.value = config.payoutBehavior || 'cancel';
        logFromSettings(`Comportamento de payout configurado: ${settingsUI.payoutBehavior.value}`, 'DEBUG');
    }

    // Configurar intervalo de verificação de payout
    if (settingsUI.payoutTimeout) {
        settingsUI.payoutTimeout.value = config.payoutTimeout || 5;
        logFromSettings(`Intervalo de verificação de payout configurado: ${settingsUI.payoutTimeout.value}s`, 'DEBUG');
    }

    // Configurar troca de ativos
    if (config.assetSwitching) {
        if (settingsUI.assetPreferredCategory) {
            settingsUI.assetPreferredCategory.value = config.assetSwitching.preferredCategory || 'crypto';
            logFromSettings(`Categoria preferida configurada: ${settingsUI.assetPreferredCategory.value}`, 'DEBUG');
        }
    }

    // Mostrar/ocultar campos baseado no comportamento selecionado
    updatePayoutBehaviorVisibility();

    // Atualiza o estado do select de gale
    settingsUI.galeSelect.disabled = !settingsUI.toggleGale.checked;
    
    logFromSettings('UI atualizada com as configurações', 'SUCCESS');
};

// Função para atualizar a visibilidade dos campos baseado no comportamento selecionado
const updatePayoutBehaviorVisibility = () => {
    if (settingsUI.payoutBehavior && settingsUI.payoutTimeoutContainer && settingsUI.assetSwitchingContainer) {
        const behavior = settingsUI.payoutBehavior.value;
        
        // Mostrar/ocultar campos baseado no comportamento
        if (behavior === 'wait') {
            settingsUI.payoutTimeoutContainer.style.display = 'block';
            settingsUI.assetSwitchingContainer.style.display = 'none';
            logFromSettings('Campos de intervalo de verificação exibidos, campos de troca de ativos ocultados', 'DEBUG');
        } else if (behavior === 'switch') {
            settingsUI.payoutTimeoutContainer.style.display = 'none';
            settingsUI.assetSwitchingContainer.style.display = 'block';
            logFromSettings('Campos de troca de ativos exibidos, campo de timeout ocultado', 'DEBUG');
        } else {
            settingsUI.payoutTimeoutContainer.style.display = 'none';
            settingsUI.assetSwitchingContainer.style.display = 'none';
            logFromSettings('Todos os campos condicionais ocultados (cancel selecionado)', 'DEBUG');
        }
    }
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
        period: parseInt(settingsUI.tradeTime.value) || 0,
        testMode: settingsUI.toggleTestMode.checked,
        devMode: settingsUI.toggleDevMode.checked,
        minPayout: settingsUI.minPayout ? parseInt(settingsUI.minPayout.value) || 80 : 80,
        payoutBehavior: settingsUI.payoutBehavior ? settingsUI.payoutBehavior.value || 'cancel' : 'cancel',
        payoutTimeout: settingsUI.payoutTimeout ? parseInt(settingsUI.payoutTimeout.value) || 5 : 5,
        // Configurações de troca de ativos
        assetSwitching: {
            enabled: settingsUI.payoutBehavior ? settingsUI.payoutBehavior.value === 'switch' : false,
            minPayout: settingsUI.minPayout ? parseInt(settingsUI.minPayout.value) || 85 : 85, // Usar o mesmo payout mínimo principal
            preferredCategory: settingsUI.assetPreferredCategory ? settingsUI.assetPreferredCategory.value || 'crypto' : 'crypto',
            checkBeforeAnalysis: true,  // Sempre ativo quando troca está habilitada
            checkBeforeTrade: true,     // Sempre ativo quando troca está habilitada
            maxRetries: 3               // Valor fixo
        }
    };
    
    // Log detalhado para depuração
    logFromSettings(`Payout mínimo configurado: ${config.minPayout}%`, 'INFO');
    logFromSettings(`Comportamento de payout: ${config.payoutBehavior}`, 'INFO');
    logFromSettings(`Intervalo de verificação de payout: ${config.payoutTimeout}s`, 'INFO');
    logFromSettings(`Troca de ativos habilitada: ${config.assetSwitching.enabled}`, 'INFO');
    if (config.assetSwitching.enabled) {
        logFromSettings(`Categoria preferida: ${config.assetSwitching.preferredCategory}`, 'INFO');
        logFromSettings(`Payout mínimo para troca: ${config.assetSwitching.minPayout}% (mesmo valor do payout mínimo principal)`, 'INFO');
    }
    logFromSettings('Configurações coletadas da UI: ' + JSON.stringify(config), 'DEBUG');
    return config;
};

// ================== HANDLERS ==================
// Salvar configurações
const saveSettings = async () => {
    logFromSettings('Salvando configurações...', 'INFO');
    const config = getSettingsFromUI();
    
    try {
        // Usar o StateManagerWrapper para salvar configurações
        const success = await StateManagerWrapper.saveConfig(config);
        if (success) {
            logFromSettings('Configurações salvas com sucesso via StateManager', 'SUCCESS');
            
            // Notificar a página pai explicitamente sobre a atualização das configurações
            notifyMainPage(config);
        } else {
            throw new Error('Erro ao salvar configurações via StateManager');
        }
        
        // Feedback visual mais sutil (opcional)
        if (settingsUI.saveBtn) {
            const originalText = settingsUI.saveBtn.innerHTML;
            settingsUI.saveBtn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
            settingsUI.saveBtn.classList.add('success');
            
            // Restaurar o texto original após 1.5 segundos
            setTimeout(() => {
                settingsUI.saveBtn.innerHTML = originalText;
                settingsUI.saveBtn.classList.remove('success');
                
                // Fechar a página após um breve momento
                setTimeout(() => closeSettings(), 300);
            }, 1500);
        } else {
            // Se não conseguir dar feedback visual, apenas fechar
            closeSettings();
        }
    } catch (error) {
        logFromSettings(`Erro ao salvar configurações: ${error.message}`, 'ERROR');
        
        // Fallback para salvar diretamente no storage
        try {
            await chrome.storage.sync.set({ userConfig: config });
            logFromSettings('Configurações salvas diretamente no storage como fallback', 'SUCCESS');
            
            // Também notificar a página pai
            notifyMainPage(config);
            closeSettings();
        } catch (storageError) {
            logFromSettings(`Erro também no fallback: ${storageError.message}`, 'ERROR');
            alert('Erro ao salvar configurações. Tente novamente.');
        }
    }
};

// Fechar página de configurações
const closeSettings = () => {
    try {
        // IMPORTANTE: Não registrar logs ao fechar a página sem salvar
        // Os logs de configurações devem ser registrados apenas quando o botão Salvar for clicado
        
        // Método 1: Tentar acessar diretamente o navigationManager
        if (window.parent && window.parent.navigationManager) {
            window.parent.navigationManager.closePage();
            return;
        }
        
        // Método 2: Usar postMessage como fallback
        window.parent.postMessage({ action: 'closePage' }, '*');
    } catch (error) {
        console.error('[settings.js] Erro ao tentar fechar página:', error);
        // Não registrar erros de fechamento no sistema de logs
    }
};

// ================== LISTENERS ==================
// Adicionar eventos aos elementos da UI
document.addEventListener('DOMContentLoaded', async () => {
    logFromSettings('Inicializando página de configurações', 'INFO');
    
    // Desabilitar o select de gale se o toggle estiver desativado
    settingsUI.toggleGale.addEventListener('change', () => {
        settingsUI.galeSelect.disabled = !settingsUI.toggleGale.checked;
    });
    
    // Listener para mudança no comportamento de payout
    if (settingsUI.payoutBehavior) {
        settingsUI.payoutBehavior.addEventListener('change', () => {
            updatePayoutBehaviorVisibility();
            logFromSettings(`Comportamento de payout alterado para: ${settingsUI.payoutBehavior.value}`, 'INFO');
        });
    }
    
    // Evento de salvar
    if (settingsUI.saveBtn) {
        settingsUI.saveBtn.addEventListener('click', saveSettings);
    }
    
    // Evento de fechar
    if (settingsUI.closeBtn) {
        settingsUI.closeBtn.addEventListener('click', closeSettings);
    }
    
    // Carregar configurações
    try {
        // Verificar se o StateManagerWrapper está disponível
        logFromSettings('Carregando configurações via StateManager...', 'INFO');
        const config = await StateManagerWrapper.loadConfig();
        loadSettingsToUI(config);
    } catch (error) {
        // Fallback para carregar diretamente do storage
        logFromSettings('StateManager não encontrado, carregando do storage...', 'WARN');
        chrome.storage.sync.get(['userConfig'], (result) => {
            loadSettingsToUI(result.userConfig);
        });
    }
});

// Função para notificar a página principal sobre as mudanças de configuração
const notifyMainPage = (config) => {
    logFromSettings('Tentando notificar a página principal sobre as alterações de configuração...', 'INFO');
    
    let notified = false;
    
    // Método 1: Usar postMessage
    try {
        window.parent.postMessage({ 
            action: 'configUpdated', 
            settings: config,
            timestamp: Date.now()
        }, '*');
        logFromSettings('Notificação enviada via postMessage', 'SUCCESS');
        notified = true;
    } catch (err) {
        logFromSettings(`Falha ao notificar via postMessage: ${err.message}`, 'WARN');
    }
    
    // Método 2: Enviar via mensagem do Chrome runtime para outras partes da extensão
    try {
        chrome.runtime.sendMessage({
            action: 'configUpdated',
            settings: config,
            timestamp: Date.now()
        });
        logFromSettings('Notificação enviada via chrome.runtime.sendMessage', 'SUCCESS');
        notified = true;
    } catch (err) {
        logFromSettings(`Falha ao notificar via chrome.runtime: ${err.message}`, 'DEBUG');
    }
    
    if (notified) {
        logFromSettings('Notificação de atualização enviada com sucesso para a página principal', 'SUCCESS');
    } else {
        logFromSettings('Não foi possível notificar a página principal por nenhum método disponível', 'ERROR');
    }
    
    return notified;
};

// Função padronizada para enviar status para o index
function toUpdateStatus(message, type = 'info', duration = 3000) {
    if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
            action: 'updateStatus',
            message: message,
            type: type,
            duration: duration
        });
    }
}

// ================== WRAPPER PARA STATEMANAGER VIA CHROME.RUNTIME ==================
// Wrapper para comunicação com StateManager sem usar window
const StateManagerWrapper = {
    async getConfig() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'STATE_MANAGER_REQUEST',
                method: 'getConfig'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'Erro ao obter configurações'));
                }
            });
        });
    },

    async saveConfig(config) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'STATE_MANAGER_REQUEST',
                method: 'saveConfig',
                params: { config }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'Erro ao salvar configurações'));
                }
            });
        });
    },

    async loadConfig() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'STATE_MANAGER_REQUEST',
                method: 'loadConfig'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'Erro ao carregar configurações'));
                }
            });
        });
    }
};

// ================== CONFIGURAÇÕES PADRÃO ==================

// Exportar funções para uso em outros scripts
window.settingsModule = {
    loadSettingsToUI,
    getSettingsFromUI,
    saveSettings
}; 