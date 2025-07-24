// Settings Module - Trade Manager Pro
// ================== SISTEMA DE LOGS PADRÃO ==================
// Usar o sistema global de logs declarado em log-sys.js
// window.logToSystem e window.updateStatus estão disponíveis globalmente

// Log de inicialização do módulo settings
logToSystem('Módulo de configurações inicializado', 'INFO');

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

// Verificar se os elementos críticos foram encontrados
const checkCriticalElements = () => {
    const criticalElements = [
        { name: 'payoutBehavior', element: settingsUI.payoutBehavior },
        { name: 'payoutTimeoutContainer', element: settingsUI.payoutTimeoutContainer },
        { name: 'assetSwitchingContainer', element: settingsUI.assetSwitchingContainer }
    ];
    
    let allFound = true;
    criticalElements.forEach(({ name, element }) => {
        if (!element) {
            // Elemento crítico não encontrado
            allFound = false;
        }
    });
    
    return allFound;
};

// ================== GERENCIAMENTO DE ESTADO ==================
// Carregar configurações nos campos
const loadSettingsToUI = (config) => {
    logToSystem('Carregando configurações para a UI', 'INFO');
    
    if (!config) {
        logToSystem('Nenhuma configuração encontrada, carregando padrões do default.json', 'WARN');
        
        // Tentar carregar default.json se existir
        fetch('../config/default.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro ao carregar default.json: ${response.status}`);
                }
                return response.json();
            })
            .then(defaultConfig => {
                logToSystem('Configurações padrão carregadas com sucesso de default.json', 'SUCCESS');
                applySettingsToUI(defaultConfig);
            })
            .catch(error => {
                logToSystem('Erro ao carregar default.json: ' + error.message, 'ERROR');
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
    updateStatus('Aplicando configurações...', 'info', 2000);
    
    // Mapeamento para a UI usando a estrutura do StateManager
    settingsUI.toggleGale.checked = config.gale?.active ?? true;
    settingsUI.galeSelect.value = config.gale?.level || '20%';
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
        
        // Payout mínimo configurado
    }

    // Configurar comportamento de payout insuficiente
    if (settingsUI.payoutBehavior) {
        settingsUI.payoutBehavior.value = config.payoutBehavior || 'wait';
    }

    // Configurar intervalo de verificação de payout
    if (settingsUI.payoutTimeout) {
        settingsUI.payoutTimeout.value = config.payoutTimeout || 5;
    }

    // Configurar troca de ativos
    if (config.assetSwitching && settingsUI.assetPreferredCategory) {
        settingsUI.assetPreferredCategory.value = config.assetSwitching.preferredCategory || 'crypto';
    }

    // Atualiza o estado do select de gale
    settingsUI.galeSelect.disabled = !settingsUI.toggleGale.checked;
    
    // Mostrar/ocultar campos baseado no comportamento selecionado (com delay para garantir que os elementos estejam prontos)
    setTimeout(() => {
        updatePayoutBehaviorVisibility();
    }, 100);
    
    // Chamada adicional com delay maior para garantir que funcione
    setTimeout(() => {
        updatePayoutBehaviorVisibility();
    }, 500);
    
    updateStatus('Configurações aplicadas com sucesso', 'success', 3000);
    logToSystem('UI atualizada com as configurações', 'SUCCESS');
};

// Função para atualizar a visibilidade dos campos baseado no comportamento selecionado
const updatePayoutBehaviorVisibility = () => {
    // Verificar se todos os elementos necessários existem
    const payoutBehaviorExists = settingsUI.payoutBehavior && settingsUI.payoutBehavior.value !== undefined;
    const timeoutContainerExists = settingsUI.payoutTimeoutContainer;
    const assetContainerExists = settingsUI.assetSwitchingContainer;
    
    if (!payoutBehaviorExists) {
        logToSystem('Elemento payoutBehavior não encontrado', 'ERROR');
        return;
    }
    
    if (!timeoutContainerExists) {
        logToSystem('Elemento payoutTimeoutContainer não encontrado', 'ERROR');
        return;
    }
    
    if (!assetContainerExists) {
        logToSystem('Elemento assetSwitchingContainer não encontrado', 'ERROR');
        return;
    }
    
    const behavior = settingsUI.payoutBehavior.value;
    
    // REMOVER estilos inline que podem estar interferindo
    settingsUI.payoutTimeoutContainer.removeAttribute('style');
    settingsUI.assetSwitchingContainer.removeAttribute('style');
    
    // SEMPRE resetar a visibilidade primeiro - FORÇAR display none
    settingsUI.payoutTimeoutContainer.style.display = 'none';
    settingsUI.assetSwitchingContainer.style.display = 'none';
    
    // Mostrar campos baseado no comportamento
    switch (behavior) {
        case 'wait':
            settingsUI.payoutTimeoutContainer.style.display = 'block';
            settingsUI.payoutTimeoutContainer.style.visibility = 'visible';
            break;
            
        case 'switch':
            settingsUI.assetSwitchingContainer.style.display = 'block';
            settingsUI.assetSwitchingContainer.style.visibility = 'visible';
            break;
            
        case 'cancel':
        default:
            // Todos os campos condicionais mantidos ocultos
            break;
    }
    
    // Verificação adicional - forçar refresh do DOM
    setTimeout(() => {
        const finalTimeoutDisplay = settingsUI.payoutTimeoutContainer.style.display;
        const finalAssetDisplay = settingsUI.assetSwitchingContainer.style.display;
        
        // Se ainda não estiver correto, forçar novamente
        if ((behavior === 'wait' && finalTimeoutDisplay !== 'block') || 
            (behavior === 'switch' && finalAssetDisplay !== 'block') ||
            (behavior === 'cancel' && (finalTimeoutDisplay !== 'none' || finalAssetDisplay !== 'none'))) {
            
            // Forçar correção
            settingsUI.payoutTimeoutContainer.style.display = 'none';
            settingsUI.assetSwitchingContainer.style.display = 'none';
            
            if (behavior === 'wait') {
                settingsUI.payoutTimeoutContainer.style.display = 'block';
            } else if (behavior === 'switch') {
                settingsUI.assetSwitchingContainer.style.display = 'block';
            }
        }
    }, 100);
};

// Coletar configurações da UI
const getSettingsFromUI = () => {
    const config = {
        gale: {
            active: settingsUI.toggleGale.checked,
            level: settingsUI.galeSelect.value
        },
        dailyProfit: parseFloat(settingsUI.dailyProfit.value) || 0,
        stopLoss: parseFloat(settingsUI.stopLoss.value) || 0,
        automation: settingsUI.toggleAuto.checked,
        value: parseFloat(settingsUI.tradeValue.value) || 0,
        period: parseInt(settingsUI.tradeTime.value) || 0,
        testMode: settingsUI.toggleTestMode.checked,
        devMode: settingsUI.toggleDevMode.checked,
        minPayout: parseInt(settingsUI.minPayout.value) || 80,
                    payoutBehavior: settingsUI.payoutBehavior ? settingsUI.payoutBehavior.value || 'wait' : 'wait',
        payoutTimeout: parseInt(settingsUI.payoutTimeout.value) || 5,
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
    logToSystem(`Payout mínimo configurado: ${config.minPayout}%`, 'INFO');
    logToSystem(`Comportamento de payout: ${config.payoutBehavior}`, 'INFO');
    logToSystem(`Intervalo de verificação de payout: ${config.payoutTimeout}s`, 'INFO');
    logToSystem(`Troca de ativos habilitada: ${config.assetSwitching.enabled}`, 'INFO');
    if (config.assetSwitching.enabled) {
        logToSystem(`Categoria preferida: ${config.assetSwitching.preferredCategory}`, 'INFO');
        logToSystem(`Payout mínimo para troca: ${config.assetSwitching.minPayout}% (mesmo valor do payout mínimo principal)`, 'INFO');
    }
    // Configurações coletadas da UI
    return config;
};

// ================== HANDLERS ==================
// Salvar configurações
const saveSettings = async () => {
    try {
        // Atualizar botão para mostrar que está salvando
        if (settingsUI.saveBtn) {
            settingsUI.saveBtn.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <div class="button-content">
                  <span>Salvando...</span>
                  <small>Aguarde um momento</small>
                </div>
            `;
            settingsUI.saveBtn.disabled = true;
        }
        
        // Usar a estrutura que o state-manager.js espera
        const config = {
            gale: {
                active: settingsUI.toggleGale.checked,
                level: settingsUI.galeSelect.value
            },
            dailyProfit: parseFloat(settingsUI.dailyProfit.value) || 0,
            stopLoss: parseFloat(settingsUI.stopLoss.value) || 0,
            automation: settingsUI.toggleAuto.checked,
            value: parseFloat(settingsUI.tradeValue.value) || 0,
            period: parseInt(settingsUI.tradeTime.value) || 0,
            testMode: settingsUI.toggleTestMode.checked,
            devMode: settingsUI.toggleDevMode.checked,
            minPayout: parseInt(settingsUI.minPayout.value) || 80,
            payoutBehavior: settingsUI.payoutBehavior.value || 'wait',
            payoutTimeout: parseInt(settingsUI.payoutTimeout.value) || 5,
            // Configurações de troca de ativos
            assetSwitching: {
                enabled: settingsUI.payoutBehavior.value === 'switch',
                minPayout: parseInt(settingsUI.minPayout.value) || 80,
                preferredCategory: settingsUI.assetPreferredCategory ? settingsUI.assetPreferredCategory.value || 'crypto' : 'crypto',
                checkBeforeAnalysis: true,
                checkBeforeTrade: true,
                maxRetries: 3
            }
        };

        updateStatus('Salvando configurações...', 'info', 0);
        logToSystem('Salvando configurações', 'INFO');
        
        // Usar StateManager se disponível, senão usar chrome.storage diretamente
        if (window.StateManager && typeof window.StateManager.saveConfig === 'function') {
            const success = await window.StateManager.saveConfig(config);
            if (success) {
                logToSystem('Configurações salvas via StateManager', 'SUCCESS');
            } else {
                throw new Error('StateManager retornou false');
            }
        } else {
            logToSystem('StateManager não disponível, usando chrome.storage', 'WARN');
            // Fallback para chrome.storage diretamente
            await new Promise((resolve, reject) => {
                chrome.storage.sync.set({ userConfig: config }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });
            logToSystem('Configurações salvas via chrome.storage', 'SUCCESS');
        }
        
        // Notificar a página principal sobre as mudanças
        const notificationSent = notifyMainPage(config);
        if (notificationSent) {
            logToSystem('Página principal notificada', 'SUCCESS');
        } else {
            logToSystem('Falha ao notificar página principal', 'WARN');
        }
        
        // Notificar outras partes do sistema sobre mudança de configuração
        try {
            chrome.runtime.sendMessage({
                action: 'configUpdated',
                config: config
            }, (response) => {
                // Callback para evitar erro de listener assíncrono
                if (chrome.runtime.lastError) {
                    // Erro silencioso
                }
            });
        } catch (runtimeError) {
            // Erro silencioso
        }

        updateStatus('Configurações salvas com sucesso!', 'success', 3000);
        
        // Mostrar feedback de sucesso no botão
        if (settingsUI.saveBtn) {
            settingsUI.saveBtn.innerHTML = `
                <i class="fas fa-check"></i>
                <div class="button-content">
                  <span>SALVO!</span>
                  <small>Configurações aplicadas</small>
                </div>
            `;
            settingsUI.saveBtn.style.backgroundColor = '#4CAF50';
            settingsUI.saveBtn.disabled = false;
        }

        // Fechar página de configurações
        setTimeout(() => {
            try {
                if (window.parent !== window) {
                    window.parent.postMessage({ action: 'closePage' }, '*');
                } else {
                    window.close();
                }
            } catch (error) {
                logToSystem('Erro ao fechar página: ' + error.message, 'WARN');
            }
        }, 1000);

    } catch (error) {
        updateStatus('Erro ao salvar configurações', 'error', 5000);
        logToSystem('Erro ao salvar configurações: ' + error.message, 'ERROR');
        alert('Erro ao salvar configurações: ' + error.message);
        
        // Restaurar botão em caso de erro
        if (settingsUI.saveBtn) {
            settingsUI.saveBtn.innerHTML = `
                <i class="fas fa-save"></i>
                <div class="button-content">
                  <span>Salvar Configurações</span>
                  <small>Aplica as alterações feitas</small>
                </div>
            `;
            settingsUI.saveBtn.disabled = false;
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
    logToSystem('Inicializando página de configurações', 'INFO');
    
    // Verificar se todos os elementos críticos foram encontrados
    const elementsFound = checkCriticalElements();
    if (!elementsFound) {
        logToSystem('❌ Alguns elementos críticos não foram encontrados. Funcionalidade pode estar comprometida.', 'ERROR');
    }
    
    // Desabilitar o select de gale se o toggle estiver desativado
    if (settingsUI.toggleGale && settingsUI.galeSelect) {
        settingsUI.toggleGale.addEventListener('change', () => {
            settingsUI.galeSelect.disabled = !settingsUI.toggleGale.checked;
        });
    }
    
    // Listener para mudança no comportamento de payout
    if (settingsUI.payoutBehavior) {
        settingsUI.payoutBehavior.addEventListener('change', () => {
            // Aguardar um pouco para garantir que o valor foi atualizado
            setTimeout(() => {
                updatePayoutBehaviorVisibility();
            }, 50);
        });
        
        // IMPORTANTE: Configurar estado inicial após carregar configurações
        // Aguardar um pouco para garantir que as configurações foram carregadas
        setTimeout(() => {
            updatePayoutBehaviorVisibility();
        }, 200);
        
    } else {
        logToSystem('❌ Elemento payoutBehavior não encontrado durante a inicialização', 'ERROR');
    }
    
    // Evento de salvar
    if (settingsUI.saveBtn) {
        settingsUI.saveBtn.addEventListener('click', saveSettings);
    }
    
    // Evento de fechar
    if (settingsUI.closeBtn) {
        settingsUI.closeBtn.addEventListener('click', closeSettings);
    }
    
    // Aguardar StateManager estar disponível antes de carregar configurações
    const waitForStateManager = () => {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 10;
            
            const checkStateManager = () => {
                attempts++;
                
                if (window.StateManager && typeof window.StateManager.getConfig === 'function') {
                    logToSystem('StateManager encontrado e disponível', 'SUCCESS');
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    logToSystem('StateManager não encontrado após múltiplas tentativas, usando chrome.storage diretamente', 'WARN');
                    resolve(false);
                } else {
                    logToSystem(`Aguardando StateManager... tentativa ${attempts}/${maxAttempts}`, 'DEBUG');
                    setTimeout(checkStateManager, 200);
                }
            };
            
            checkStateManager();
        });
    };
    
    // Carregar configurações
    try {
        logToSystem('Carregando configurações...', 'INFO');
        
        const stateManagerAvailable = await waitForStateManager();
        let config = {};
        
        if (stateManagerAvailable) {
            // Usar StateManager se disponível
            config = window.StateManager.getConfig() || {};
            logToSystem('Configurações carregadas via StateManager', 'SUCCESS');
            logToSystem(`Configurações StateManager: ${JSON.stringify(config)}`, 'DEBUG');
        } else {
            // Fallback para chrome.storage diretamente
            const result = await new Promise((resolve) => {
                chrome.storage.sync.get(['userConfig'], (data) => {
                    resolve(data.userConfig || {});
                });
            });
            config = result;
            logToSystem('Configurações carregadas via chrome.storage', 'INFO');
            logToSystem(`Configurações chrome.storage: ${JSON.stringify(config)}`, 'DEBUG');
        }
        
        loadSettingsToUI(config);
        
    } catch (error) {
        logToSystem('Erro ao carregar configurações: ' + error.message, 'ERROR');
        // Carregar configurações padrão em caso de erro
        loadSettingsToUI({});
    }
    
    // Verificação final para garantir que a visibilidade seja aplicada
    setTimeout(() => {
        if (settingsUI.payoutBehavior && settingsUI.payoutBehavior.value) {
            updatePayoutBehaviorVisibility();
        }
        
        // *** NOVO: Adicionar botões de configurações padrão ***
        addDefaultButtons();
    }, 1000);
});

// Função para notificar a página principal sobre as mudanças de configuração
const notifyMainPage = (config) => {
    logToSystem('Notificando página principal sobre alterações', 'INFO');
    
    let notified = false;
    
    // Método 1: Usar postMessage
    try {
        window.parent.postMessage({ 
            action: 'configUpdated', 
            settings: config,
            timestamp: Date.now()
        }, '*');
        notified = true;
    } catch (err) {
        logToSystem(`Falha ao notificar via postMessage: ${err.message}`, 'WARN');
    }
    
    // Método 2: Tentar acessar diretamente o StateManager da página pai, se disponível
    try {
        if (window.parent && window.parent.StateManager) {
            window.parent.StateManager.saveConfig(config);
            notified = true;
        }
    } catch (err) {
        logToSystem(`Falha ao notificar via StateManager pai: ${err.message}`, 'WARN');
    }
    
    // Método 3: Enviar via mensagem do Chrome runtime para outras partes da extensão
    try {
        chrome.runtime.sendMessage({
            action: 'configUpdated',
            settings: config,
            timestamp: Date.now()
        }, (response) => {
            // Callback para tratar resposta e evitar erro de listener assíncrono
            if (chrome.runtime.lastError) {
                // Erro silencioso - não precisa fazer nada
            }
        });
        notified = true;
    } catch (err) {
        // Erro silencioso
    }
    
    if (notified) {
        logToSystem('Página principal notificada com sucesso', 'SUCCESS');
    } else {
        logToSystem('Falha ao notificar página principal', 'ERROR');
    }
    
    return notified;
};



// *** NOVO: Funções para gerenciar configurações padrão do usuário ***

// Salvar configurações atuais como padrão do usuário
const saveAsUserDefault = async () => {
    try {
        logToSystem('Salvando configurações da UI como padrão...', 'INFO');
        
        // *** CORREÇÃO: Primeiro pegar configurações da UI ***
        const uiConfig = getSettingsFromUI();
        // Configurações da UI coletadas
        
        if (window.StateManager && typeof window.StateManager.saveConfig === 'function') {
            // Primeiro salvar as configurações normalmente
            const saveSuccess = await window.StateManager.saveConfig(uiConfig);
            if (!saveSuccess) {
                throw new Error('Falha ao salvar configurações normalmente');
            }
            
            // Depois salvar como padrão
            if (typeof window.StateManager.saveAsUserDefault === 'function') {
                const defaultSuccess = await window.StateManager.saveAsUserDefault();
                if (defaultSuccess) {
                    logToSystem('Configurações salvas como padrão com sucesso!', 'SUCCESS');
                    updateStatus('Configurações salvas como padrão', 'success');
                    
                    // Notificar a página principal sobre as mudanças
                    notifyMainPage(uiConfig);
                    
                    // Atualizar visibilidade dos botões
                    updateDefaultButtonsVisibility();
                    return true;
                } else {
                    throw new Error('StateManager.saveAsUserDefault retornou false');
                }
            } else {
                throw new Error('Função saveAsUserDefault não disponível');
            }
        } else {
            throw new Error('StateManager ou saveConfig não disponível');
        }
    } catch (error) {
        logToSystem('Erro ao salvar como padrão: ' + error.message, 'ERROR');
        updateStatus('Erro ao salvar como padrão', 'error');
        return false;
    }
};

// Carregar configurações padrão do usuário
const loadUserDefault = async () => {
    try {
        logToSystem('Carregando configurações padrão do usuário...', 'INFO');
        
        if (window.StateManager && typeof window.StateManager.loadUserDefault === 'function') {
            const success = await window.StateManager.loadUserDefault();
            if (success) {
                logToSystem('Configurações padrão carregadas com sucesso!', 'SUCCESS');
                
                // Recarregar UI com as configurações padrão
                const config = window.StateManager.getConfig();
                // Configurações padrão carregadas
                loadSettingsToUI(config);
                
                // Notificar a página principal sobre as mudanças
                notifyMainPage(config);
                
                updateStatus('Configurações padrão carregadas', 'success');
                return true;
            } else {
                throw new Error('StateManager retornou false');
            }
        } else {
            throw new Error('StateManager não disponível');
        }
    } catch (error) {
        logToSystem('Erro ao carregar configurações padrão: ' + error.message, 'ERROR');
        updateStatus('Erro ao carregar configurações padrão', 'error');
        return false;
    }
};

// Atualizar visibilidade dos botões de configurações padrão
const updateDefaultButtonsVisibility = async () => {
    try {
        if (window.StateManager && typeof window.StateManager.hasUserDefault === 'function') {
            const hasDefault = await window.StateManager.hasUserDefault();
            const loadBtn = document.getElementById('load-default-btn');
            
            if (loadBtn) {
                if (hasDefault) {
                    loadBtn.style.display = 'block';
                    loadBtn.disabled = false;
                } else {
                    loadBtn.style.display = 'none';
                }
            } else {
                logToSystem('Botão "Carregar Padrão" não encontrado', 'WARN');
            }
        } else {
            logToSystem('StateManager não disponível', 'ERROR');
        }
    } catch (error) {
        logToSystem('Erro ao atualizar visibilidade dos botões: ' + error.message, 'ERROR');
        console.error('Erro ao atualizar visibilidade:', error);
    }
};

// Adicionar botões de configurações padrão do usuário
const addDefaultButtons = () => {
    try {
        // Verificar se já existem os botões
        if (document.getElementById('save-default-btn') || document.getElementById('load-default-btn')) {
            return; // Botões já existem
        }
        
        // Encontrar um local adequado para adicionar os botões (próximo ao botão salvar)
        const saveBtn = document.getElementById('save-settings');
        if (!saveBtn) {
            logToSystem('Botão salvar não encontrado', 'WARN');
            return;
        }
        
        // Criar container para os botões de configurações padrão
        const defaultContainer = document.createElement('div');
        defaultContainer.className = 'default-buttons-container';
        defaultContainer.style.cssText = `
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        `;
        
        // Botão para salvar como padrão
        const saveDefaultBtn = document.createElement('button');
        saveDefaultBtn.id = 'save-default-btn';
        saveDefaultBtn.className = 'btn secondary';
        saveDefaultBtn.style.cssText = 'min-width: 200px;';
        saveDefaultBtn.innerHTML = `
            <i class="fas fa-bookmark"></i>
            <div class="button-content">
                <span>Salvar como Padrão</span>
                <small>Define estas configurações como padrão</small>
            </div>
        `;
        
        // Event listener para salvar como padrão
        saveDefaultBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            logToSystem('Botão "Salvar como Padrão" clicado', 'INFO');
            
            // Alterar botão para mostrar que está processando
            saveDefaultBtn.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <div class="button-content">
                    <span>Salvando...</span>
                    <small>Aguarde</small>
                </div>
            `;
            saveDefaultBtn.disabled = true;
            
            const success = await saveAsUserDefault();
            
            // Restaurar botão
            if (success) {
                saveDefaultBtn.innerHTML = `
                    <i class="fas fa-check"></i>
                    <div class="button-content">
                        <span>Salvo!</span>
                        <small>Configurações definidas como padrão</small>
                    </div>
                `;
                saveDefaultBtn.style.backgroundColor = '#4CAF50';
                
                setTimeout(() => {
                    saveDefaultBtn.innerHTML = `
                        <i class="fas fa-bookmark"></i>
                        <div class="button-content">
                            <span>Salvar como Padrão</span>
                            <small>Define estas configurações como padrão</small>
                        </div>
                    `;
                    saveDefaultBtn.style.backgroundColor = '';
                    saveDefaultBtn.disabled = false;
                }, 2000);
            } else {
                saveDefaultBtn.innerHTML = `
                    <i class="fas fa-times"></i>
                    <div class="button-content">
                        <span>Erro!</span>
                        <small>Falha ao salvar</small>
                    </div>
                `;
                saveDefaultBtn.style.backgroundColor = '#f44336';
                
                setTimeout(() => {
                    saveDefaultBtn.innerHTML = `
                        <i class="fas fa-bookmark"></i>
                        <div class="button-content">
                            <span>Salvar como Padrão</span>
                            <small>Define estas configurações como padrão</small>
                        </div>
                    `;
                    saveDefaultBtn.style.backgroundColor = '';
                    saveDefaultBtn.disabled = false;
                }, 2000);
            }
        });
        
        // Botão para carregar padrão
        const loadDefaultBtn = document.createElement('button');
        loadDefaultBtn.id = 'load-default-btn';
        loadDefaultBtn.className = 'btn secondary';
        loadDefaultBtn.style.cssText = 'min-width: 200px; display: none;'; // Inicialmente oculto
        loadDefaultBtn.innerHTML = `
            <i class="fas fa-download"></i>
            <div class="button-content">
                <span>Carregar Padrão</span>
                <small>Carrega suas configurações padrão</small>
            </div>
        `;
        
        // Event listener para carregar padrão
        loadDefaultBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            logToSystem('Botão "Carregar Padrão" clicado', 'INFO');
            
            // Alterar botão para mostrar que está processando
            loadDefaultBtn.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <div class="button-content">
                    <span>Carregando...</span>
                    <small>Aguarde</small>
                </div>
            `;
            loadDefaultBtn.disabled = true;
            
            const success = await loadUserDefault();
            
            // Restaurar botão
            if (success) {
                loadDefaultBtn.innerHTML = `
                    <i class="fas fa-check"></i>
                    <div class="button-content">
                        <span>Carregado!</span>
                        <small>Configurações padrão aplicadas</small>
                    </div>
                `;
                loadDefaultBtn.style.backgroundColor = '#4CAF50';
                
                setTimeout(() => {
                    loadDefaultBtn.innerHTML = `
                        <i class="fas fa-download"></i>
                        <div class="button-content">
                            <span>Carregar Padrão</span>
                            <small>Carrega suas configurações padrão</small>
                        </div>
                    `;
                    loadDefaultBtn.style.backgroundColor = '';
                    loadDefaultBtn.disabled = false;
                }, 2000);
            } else {
                loadDefaultBtn.innerHTML = `
                    <i class="fas fa-times"></i>
                    <div class="button-content">
                        <span>Erro!</span>
                        <small>Falha ao carregar</small>
                    </div>
                `;
                loadDefaultBtn.style.backgroundColor = '#f44336';
                
                setTimeout(() => {
                    loadDefaultBtn.innerHTML = `
                        <i class="fas fa-download"></i>
                        <div class="button-content">
                            <span>Carregar Padrão</span>
                            <small>Carrega suas configurações padrão</small>
                        </div>
                    `;
                    loadDefaultBtn.style.backgroundColor = '';
                    loadDefaultBtn.disabled = false;
                }, 2000);
            }
        });
        
        // Adicionar botões ao container
        defaultContainer.appendChild(saveDefaultBtn);
        defaultContainer.appendChild(loadDefaultBtn);
        
        // Inserir container após o botão salvar
        saveBtn.parentNode.insertBefore(defaultContainer, saveBtn.nextSibling);
        
        logToSystem('Botões de configurações padrão criados e adicionados ao DOM', 'SUCCESS');
        
        // Atualizar visibilidade inicial após um pequeno delay
        setTimeout(() => {
            updateDefaultButtonsVisibility();
        }, 100);
        
        logToSystem('Botões de configurações padrão adicionados com sucesso', 'SUCCESS');
    } catch (error) {
        logToSystem('Erro ao adicionar botões de configurações padrão: ' + error.message, 'ERROR');
        console.error('Erro ao adicionar botões:', error);
    }
};

// Exportar funções para uso em outros scripts
window.settingsModule = {
    loadSettingsToUI,
    getSettingsFromUI,
    saveSettings,
    saveAsUserDefault,
    loadUserDefault
}; 
