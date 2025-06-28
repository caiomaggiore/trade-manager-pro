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

// Função simplificada para enviar logs ao sistema centralizado
const logFromSettings = (message, level = 'INFO') => {
    try {
        if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: 'addLog',
                logMessage: message,
                level: level,
                source: 'settings.js'
            }, (response) => {
                // Callback para tratar resposta e evitar erro de listener assíncrono
                if (chrome.runtime.lastError) {
                    // Erro silencioso - não precisa fazer nada
                }
            });
        }
    } catch (error) {
        // Erro silencioso
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
        
        logFromSettings(`Payout mínimo configurado na UI: ${settingsUI.minPayout.value}%`, 'DEBUG');
    }

    // Configurar comportamento de payout insuficiente
    if (settingsUI.payoutBehavior) {
        settingsUI.payoutBehavior.value = config.payoutBehavior || 'wait';
        logFromSettings(`Comportamento de payout configurado: ${settingsUI.payoutBehavior.value}`, 'DEBUG');
    }

    // Configurar intervalo de verificação de payout
    if (settingsUI.payoutTimeout) {
        settingsUI.payoutTimeout.value = config.payoutTimeout || 5;
        logFromSettings(`Intervalo de verificação de payout configurado: ${settingsUI.payoutTimeout.value}s`, 'DEBUG');
    }

    // Configurar troca de ativos
    if (config.assetSwitching && settingsUI.assetPreferredCategory) {
        settingsUI.assetPreferredCategory.value = config.assetSwitching.preferredCategory || 'crypto';
        logFromSettings(`Categoria preferida configurada: ${settingsUI.assetPreferredCategory.value}`, 'DEBUG');
    }

    // Atualiza o estado do select de gale
    settingsUI.galeSelect.disabled = !settingsUI.toggleGale.checked;
    
    // Mostrar/ocultar campos baseado no comportamento selecionado (com delay para garantir que os elementos estejam prontos)
    setTimeout(() => {
        updatePayoutBehaviorVisibility();
    }, 100);
    
    // Chamada adicional com delay maior para garantir que funcione
    setTimeout(() => {
        logFromSettings('Executando segunda chamada de updatePayoutBehaviorVisibility para garantir funcionamento', 'DEBUG');
        updatePayoutBehaviorVisibility();
    }, 500);
    
    logFromSettings('UI atualizada com as configurações', 'SUCCESS');
};

// Função para atualizar a visibilidade dos campos baseado no comportamento selecionado
const updatePayoutBehaviorVisibility = () => {
    logFromSettings('🔄 Iniciando atualização de visibilidade dos campos de payout...', 'DEBUG');
    
    // Verificar se todos os elementos necessários existem
    const payoutBehaviorExists = settingsUI.payoutBehavior && settingsUI.payoutBehavior.value !== undefined;
    const timeoutContainerExists = settingsUI.payoutTimeoutContainer;
    const assetContainerExists = settingsUI.assetSwitchingContainer;
    
    logFromSettings(`📋 Elementos encontrados - Behavior: ${!!payoutBehaviorExists}, Timeout: ${!!timeoutContainerExists}, Assets: ${!!assetContainerExists}`, 'DEBUG');
    
    if (!payoutBehaviorExists) {
        logFromSettings('❌ Elemento payoutBehavior não encontrado ou sem valor', 'ERROR');
        return;
    }
    
    if (!timeoutContainerExists) {
        logFromSettings('❌ Elemento payoutTimeoutContainer não encontrado', 'ERROR');
        return;
    }
    
    if (!assetContainerExists) {
        logFromSettings('❌ Elemento assetSwitchingContainer não encontrado', 'ERROR');
        return;
    }
    
    const behavior = settingsUI.payoutBehavior.value;
    logFromSettings(`🎯 Comportamento atual selecionado: "${behavior}"`, 'DEBUG');
    
    // Log do estado atual dos elementos ANTES da mudança
    logFromSettings(`📊 Estado ANTES - Timeout: "${settingsUI.payoutTimeoutContainer.style.display}", Assets: "${settingsUI.assetSwitchingContainer.style.display}"`, 'DEBUG');
    
    // REMOVER estilos inline que podem estar interferindo
    settingsUI.payoutTimeoutContainer.removeAttribute('style');
    settingsUI.assetSwitchingContainer.removeAttribute('style');
    logFromSettings('🧹 Estilos inline removidos dos elementos', 'DEBUG');
    
    // SEMPRE resetar a visibilidade primeiro - FORÇAR display none
    settingsUI.payoutTimeoutContainer.style.display = 'none';
    settingsUI.assetSwitchingContainer.style.display = 'none';
    logFromSettings('🔄 Todos os campos condicionais resetados para oculto', 'DEBUG');
    
    // Log do estado APÓS o reset
    logFromSettings(`📊 Estado APÓS RESET - Timeout: "${settingsUI.payoutTimeoutContainer.style.display}", Assets: "${settingsUI.assetSwitchingContainer.style.display}"`, 'DEBUG');
    
    // Mostrar campos baseado no comportamento
    switch (behavior) {
        case 'wait':
            settingsUI.payoutTimeoutContainer.style.display = 'block';
            settingsUI.payoutTimeoutContainer.style.visibility = 'visible';
            logFromSettings('✅ Campo de intervalo de verificação EXIBIDO', 'INFO');
            break;
            
        case 'switch':
            settingsUI.assetSwitchingContainer.style.display = 'block';
            settingsUI.assetSwitchingContainer.style.visibility = 'visible';
            logFromSettings('✅ Campo de troca de ativos EXIBIDO', 'INFO');
            break;
            
        case 'cancel':
        default:
            logFromSettings('✅ Todos os campos condicionais mantidos ocultos (cancelar operação)', 'INFO');
            break;
    }
    
    // Log do estado FINAL
    logFromSettings(`📊 Estado FINAL - Timeout: "${settingsUI.payoutTimeoutContainer.style.display}", Assets: "${settingsUI.assetSwitchingContainer.style.display}"`, 'DEBUG');
    
    // Verificação adicional - forçar refresh do DOM
    setTimeout(() => {
        const finalTimeoutDisplay = settingsUI.payoutTimeoutContainer.style.display;
        const finalAssetDisplay = settingsUI.assetSwitchingContainer.style.display;
        logFromSettings(`🔍 Verificação pós-timeout - Timeout: "${finalTimeoutDisplay}", Assets: "${finalAssetDisplay}"`, 'DEBUG');
        
        // Se ainda não estiver correto, forçar novamente
        if ((behavior === 'wait' && finalTimeoutDisplay !== 'block') || 
            (behavior === 'switch' && finalAssetDisplay !== 'block') ||
            (behavior === 'cancel' && (finalTimeoutDisplay !== 'none' || finalAssetDisplay !== 'none'))) {
            
            logFromSettings('⚠️ Estado incorreto detectado, forçando correção...', 'WARN');
            
            // Forçar correção
            settingsUI.payoutTimeoutContainer.style.display = 'none';
            settingsUI.assetSwitchingContainer.style.display = 'none';
            
            if (behavior === 'wait') {
                settingsUI.payoutTimeoutContainer.style.display = 'block';
                logFromSettings('🔧 FORÇADO: Campo timeout exibido', 'WARN');
            } else if (behavior === 'switch') {
                settingsUI.assetSwitchingContainer.style.display = 'block';
                logFromSettings('🔧 FORÇADO: Campo assets exibido', 'WARN');
            }
        }
    }, 100);
    
    logFromSettings('✅ Atualização de visibilidade concluída com sucesso', 'SUCCESS');
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

        logFromSettings('Salvando configurações...', 'INFO');
        
        // Usar StateManager se disponível, senão usar chrome.storage diretamente
        if (window.StateManager && typeof window.StateManager.saveConfig === 'function') {
            logFromSettings('Salvando via StateManager...', 'DEBUG');
            const success = await window.StateManager.saveConfig(config);
            if (success) {
                logFromSettings('Configurações salvas com sucesso via StateManager!', 'SUCCESS');
            } else {
                throw new Error('StateManager retornou false');
            }
        } else {
            logFromSettings('StateManager não disponível, usando chrome.storage diretamente...', 'WARN');
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
            logFromSettings('Configurações salvas com sucesso via chrome.storage!', 'SUCCESS');
        }
        
        // Notificar a página principal sobre as mudanças
        const notificationSent = notifyMainPage(config);
        if (notificationSent) {
            logFromSettings('Página principal notificada sobre as mudanças', 'SUCCESS');
        } else {
            logFromSettings('Falha ao notificar página principal', 'WARN');
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
            logFromSettings('Notificação de atualização enviada via chrome.runtime', 'DEBUG');
        } catch (runtimeError) {
            logFromSettings('Erro ao enviar notificação via runtime (ignorado): ' + runtimeError.message, 'DEBUG');
        }

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
                logFromSettings('Erro ao fechar página: ' + error.message, 'WARN');
            }
        }, 1000);

    } catch (error) {
        logFromSettings('Erro ao salvar configurações: ' + error.message, 'ERROR');
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
    logFromSettings('Inicializando página de configurações', 'INFO');
    
    // Verificar se todos os elementos críticos foram encontrados
    const elementsFound = checkCriticalElements();
    if (!elementsFound) {
        logFromSettings('❌ Alguns elementos críticos não foram encontrados. Funcionalidade pode estar comprometida.', 'ERROR');
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
            logFromSettings(`Comportamento de payout alterado para: ${settingsUI.payoutBehavior.value}`, 'INFO');
            
            // Aguardar um pouco para garantir que o valor foi atualizado
            setTimeout(() => {
                updatePayoutBehaviorVisibility();
            }, 50);
        });
        
        // IMPORTANTE: Configurar estado inicial após carregar configurações
        logFromSettings('Configurando estado inicial dos campos de payout...', 'DEBUG');
        
        // Aguardar um pouco para garantir que as configurações foram carregadas
        setTimeout(() => {
            updatePayoutBehaviorVisibility();
        }, 200);
        
    } else {
        logFromSettings('❌ Elemento payoutBehavior não encontrado durante a inicialização', 'ERROR');
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
                    logFromSettings('StateManager encontrado e disponível', 'SUCCESS');
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    logFromSettings('StateManager não encontrado após múltiplas tentativas, usando chrome.storage diretamente', 'WARN');
                    resolve(false);
                } else {
                    logFromSettings(`Aguardando StateManager... tentativa ${attempts}/${maxAttempts}`, 'DEBUG');
                    setTimeout(checkStateManager, 200);
                }
            };
            
            checkStateManager();
        });
    };
    
    // Carregar configurações
    try {
        logFromSettings('Carregando configurações...', 'INFO');
        
        const stateManagerAvailable = await waitForStateManager();
        let config = {};
        
        if (stateManagerAvailable) {
            // Usar StateManager se disponível
            config = window.StateManager.getConfig() || {};
            logFromSettings('Configurações carregadas via StateManager', 'SUCCESS');
            logFromSettings(`Configurações StateManager: ${JSON.stringify(config)}`, 'DEBUG');
        } else {
            // Fallback para chrome.storage diretamente
            const result = await new Promise((resolve) => {
                chrome.storage.sync.get(['userConfig'], (data) => {
                    resolve(data.userConfig || {});
                });
            });
            config = result;
            logFromSettings('Configurações carregadas via chrome.storage', 'INFO');
            logFromSettings(`Configurações chrome.storage: ${JSON.stringify(config)}`, 'DEBUG');
        }
        
        loadSettingsToUI(config);
        
    } catch (error) {
        logFromSettings('Erro ao carregar configurações: ' + error.message, 'ERROR');
        // Carregar configurações padrão em caso de erro
        loadSettingsToUI({});
    }
    
    // Verificação final para garantir que a visibilidade seja aplicada
    setTimeout(() => {
        logFromSettings('Verificação final da visibilidade dos campos de payout...', 'DEBUG');
        if (settingsUI.payoutBehavior && settingsUI.payoutBehavior.value) {
            logFromSettings(`Valor final do comportamento: "${settingsUI.payoutBehavior.value}"`, 'DEBUG');
            updatePayoutBehaviorVisibility();
        } else {
            logFromSettings('Elemento payoutBehavior ainda não está pronto na verificação final', 'WARN');
        }
        
        // *** NOVO: Adicionar botões de configurações padrão ***
        addDefaultButtons();
    }, 1000);
});

// Função para notificar a página principal sobre as mudanças de configuração
const notifyMainPage = (config) => {
    logFromSettings('Tentando notificar a página principal sobre as alterações de configuração...', 'INFO');
    logFromSettings(`Configuração a ser enviada: ${JSON.stringify(config)}`, 'DEBUG');
    
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
    
    // Método 2: Tentar acessar diretamente o StateManager da página pai, se disponível
    try {
        if (window.parent && window.parent.StateManager) {
            window.parent.StateManager.saveConfig(config);
            logFromSettings('Notificação enviada diretamente ao StateManager da página pai', 'SUCCESS');
            notified = true;
        }
    } catch (err) {
        logFromSettings(`Falha ao notificar via StateManager pai: ${err.message}`, 'WARN');
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
        }, (response) => {
            // Callback para tratar resposta e evitar erro de listener assíncrono
            if (chrome.runtime.lastError) {
                // Erro silencioso - não precisa fazer nada
            }
        });
    }
}

// *** NOVO: Funções para gerenciar configurações padrão do usuário ***

// Salvar configurações atuais como padrão do usuário
const saveAsUserDefault = async () => {
    try {
        logFromSettings('Salvando configurações da UI como padrão...', 'INFO');
        
        // *** CORREÇÃO: Primeiro pegar configurações da UI ***
        const uiConfig = getSettingsFromUI();
        logFromSettings(`Configurações da UI coletadas: ${JSON.stringify(uiConfig)}`, 'DEBUG');
        
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
                    logFromSettings('Configurações salvas como padrão com sucesso!', 'SUCCESS');
                    toUpdateStatus('Configurações salvas como padrão', 'success');
                    
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
        logFromSettings('Erro ao salvar como padrão: ' + error.message, 'ERROR');
        toUpdateStatus('Erro ao salvar como padrão', 'error');
        return false;
    }
};

// Carregar configurações padrão do usuário
const loadUserDefault = async () => {
    try {
        logFromSettings('Carregando configurações padrão do usuário...', 'INFO');
        
        if (window.StateManager && typeof window.StateManager.loadUserDefault === 'function') {
            const success = await window.StateManager.loadUserDefault();
            if (success) {
                logFromSettings('Configurações padrão carregadas com sucesso!', 'SUCCESS');
                
                // Recarregar UI com as configurações padrão
                const config = window.StateManager.getConfig();
                logFromSettings(`Configurações padrão carregadas: ${JSON.stringify(config)}`, 'DEBUG');
                loadSettingsToUI(config);
                
                // Notificar a página principal sobre as mudanças
                notifyMainPage(config);
                
                toUpdateStatus('Configurações padrão carregadas', 'success');
                return true;
            } else {
                throw new Error('StateManager retornou false');
            }
        } else {
            throw new Error('StateManager não disponível');
        }
    } catch (error) {
        logFromSettings('Erro ao carregar configurações padrão: ' + error.message, 'ERROR');
        toUpdateStatus('Erro ao carregar configurações padrão', 'error');
        return false;
    }
};

// Atualizar visibilidade dos botões de configurações padrão
const updateDefaultButtonsVisibility = async () => {
    try {
        logFromSettings('Atualizando visibilidade dos botões de configurações padrão...', 'DEBUG');
        
        if (window.StateManager && typeof window.StateManager.hasUserDefault === 'function') {
            const hasDefault = await window.StateManager.hasUserDefault();
            const loadBtn = document.getElementById('load-default-btn');
            
            logFromSettings(`Tem configurações padrão salvas: ${hasDefault}`, 'DEBUG');
            logFromSettings(`Botão carregar encontrado: ${!!loadBtn}`, 'DEBUG');
            
            if (loadBtn) {
                if (hasDefault) {
                    loadBtn.style.display = 'block';
                    loadBtn.disabled = false;
                    logFromSettings('Botão "Carregar Padrão" exibido', 'DEBUG');
                } else {
                    loadBtn.style.display = 'none';
                    logFromSettings('Botão "Carregar Padrão" oculto (sem configurações padrão)', 'DEBUG');
                }
            } else {
                logFromSettings('Botão "Carregar Padrão" não encontrado no DOM', 'WARN');
            }
        } else {
            logFromSettings('StateManager ou função hasUserDefault não disponível', 'ERROR');
        }
    } catch (error) {
        logFromSettings('Erro ao atualizar visibilidade dos botões: ' + error.message, 'ERROR');
        console.error('Erro ao atualizar visibilidade:', error);
    }
};

// Adicionar botões de configurações padrão do usuário
const addDefaultButtons = () => {
    try {
        logFromSettings('Tentando adicionar botões de configurações padrão...', 'DEBUG');
        
        // Verificar se já existem os botões
        if (document.getElementById('save-default-btn') || document.getElementById('load-default-btn')) {
            logFromSettings('Botões de configurações padrão já existem', 'DEBUG');
            return; // Botões já existem
        }
        
        // Encontrar um local adequado para adicionar os botões (próximo ao botão salvar)
        const saveBtn = document.getElementById('save-settings');
        if (!saveBtn) {
            logFromSettings('Botão salvar não encontrado, não é possível adicionar botões de configurações padrão', 'WARN');
            return;
        }
        
        logFromSettings('Botão salvar encontrado, criando botões de configurações padrão...', 'DEBUG');
        
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
            logFromSettings('Botão "Salvar como Padrão" clicado', 'INFO');
            
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
            logFromSettings('Botão "Carregar Padrão" clicado', 'INFO');
            
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
        
        logFromSettings('Botões de configurações padrão criados e adicionados ao DOM', 'SUCCESS');
        
        // Atualizar visibilidade inicial após um pequeno delay
        setTimeout(() => {
            updateDefaultButtonsVisibility();
        }, 100);
        
        logFromSettings('Botões de configurações padrão adicionados com sucesso', 'SUCCESS');
    } catch (error) {
        logFromSettings('Erro ao adicionar botões de configurações padrão: ' + error.message, 'ERROR');
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