// Configurações padrão (fallback caso não consiga carregar default.json)
const DEFAULT_CONFIG = {
    gale: {
        active: true,
        level: '1.2x'
    },
    dailyProfit: 150,
    stopLoss: 30,
    automation: false,
    value: 10,
    period: 1,
    minPayout: 80,
    payoutBehavior: 'cancel',
    payoutTimeout: 60,
    // Novas configurações para troca de ativos
    assetSwitching: {
        enabled: true,                    // Se deve trocar ativos automaticamente
        minPayout: 85,                   // Payout mínimo para operações
        preferredCategory: 'crypto',     // Categoria preferida (crypto, currency, commodity, stock)
        checkBeforeAnalysis: true,       // Verificar ativo antes de análise
        checkBeforeTrade: true,          // Verificar ativo antes de operação
        maxRetries: 3                    // Máximo de tentativas de troca
    }
};

class StateManager {
    static instance = null;

    constructor() {
        if (StateManager.instance) {
            return StateManager.instance;
        }
        StateManager.instance = this;
        
        this.state = {
            config: null,
            automation: {
                isRunning: false,
                currentOperation: null
            },
            // Dados de performance para o dashboard
            performance: {
                currentProfit: 0,
                operationsCount: 0,
                successfulOperations: 0,
                currentGaleLevel: 0
            },
            // Estado do sistema
            system: {
                hasError: false,
                errorMessage: ''
            }
        };

        this.listeners = new Set();
        this.loadConfig();
        this.loadPerformanceData();
        
        // Log de inicialização
        console.log('[StateManager] Inicializado com dashboard integrado');
    }

    // Carregar configurações padrão do arquivo
    async loadDefaultConfig() {
        try {
            console.log('[StateManager] Tentando carregar default.json...');
            const response = await fetch('../config/default.json');
            
            if (!response.ok) {
                throw new Error(`Erro ao carregar default.json: ${response.status}`);
            }
            
            const defaultConfig = await response.json();
            console.log('[StateManager] default.json carregado com sucesso:', defaultConfig);
            return defaultConfig;
        } catch (error) {
            console.error('[StateManager] Erro ao carregar default.json:', error);
            console.log('[StateManager] Usando configurações padrão hardcoded');
            return DEFAULT_CONFIG;
        }
    }

    // Carregar configurações
    async loadConfig() {
        try {
            console.log('[StateManager] Carregando configurações do storage...');
            const result = await chrome.storage.sync.get(['userConfig']);
            
            // Se não houver configurações no storage, carregar default.json
            if (!result.userConfig || Object.keys(result.userConfig).length === 0) {
                console.log('[StateManager] Nenhuma configuração encontrada no storage');
                this.state.config = await this.loadDefaultConfig();
                
                // Salvar as configurações padrão no storage para uso futuro
                await chrome.storage.sync.set({ userConfig: this.state.config });
                console.log('[StateManager] Configurações padrão salvas no storage');
            } else {
                console.log('[StateManager] Configurações do usuário carregadas do storage');
                this.state.config = result.userConfig;
                
                // Verificar se o payout mínimo está definido, caso contrário, usar o padrão
                if (typeof this.state.config.minPayout === 'undefined') {
                    console.log('[StateManager] Payout mínimo não encontrado, usando padrão de 80%');
                    this.state.config.minPayout = 80;
                } else {
                    console.log(`[StateManager] Payout mínimo carregado: ${this.state.config.minPayout}%`);
                }
            }
            
            this.notifyListeners('config');
            return this.state.config;
        } catch (error) {
            console.error('[StateManager] Erro ao carregar configurações:', error);
            // Em caso de erro, usar configurações padrão
            this.state.config = DEFAULT_CONFIG;
            return DEFAULT_CONFIG;
        }
    }

    // Salvar configurações
    async saveConfig(newConfig) {
        try {
            console.log('[StateManager] Salvando configurações:', newConfig);
            
            // Verificar se o payout mínimo está definido
            if (typeof newConfig.minPayout === 'undefined') {
                console.log('[StateManager] Payout mínimo não encontrado no novo config, usando padrão de 80%');
                newConfig.minPayout = 80;
            } else {
                console.log(`[StateManager] Payout mínimo sendo salvo: ${newConfig.minPayout}%`);
            }
            
            await chrome.storage.sync.set({ userConfig: newConfig });
            this.state.config = newConfig;
            this.notifyListeners('config');
            console.log('[StateManager] Configurações salvas com sucesso');
            return true;
        } catch (error) {
            console.error('[StateManager] Erro ao salvar configurações:', error);
            return false;
        }
    }

    // Atualizar estado da automação
    updateAutomationState(isRunning, operation = null) {
        this.state.automation = {
            isRunning,
            currentOperation: operation
        };
        this.notifyListeners('automation');
    }

    // Obter configuração atual
    getConfig() {
        return this.state.config || DEFAULT_CONFIG;
    }

    // Obter estado da automação
    getAutomationState() {
        return this.state.automation;
    }

    // Obter configurações de troca de ativos
    getAssetSwitchingConfig() {
        const config = this.getConfig();
        return config.assetSwitching || DEFAULT_CONFIG.assetSwitching;
    }

    // Atualizar configurações de troca de ativos
    async updateAssetSwitchingConfig(newAssetConfig) {
        try {
            const currentConfig = this.getConfig();
            const updatedConfig = {
                ...currentConfig,
                assetSwitching: {
                    ...currentConfig.assetSwitching,
                    ...newAssetConfig
                }
            };
            
            await this.saveConfig(updatedConfig);
            console.log('[StateManager] Configurações de troca de ativos atualizadas:', newAssetConfig);
            return true;
        } catch (error) {
            console.error('[StateManager] Erro ao atualizar configurações de troca de ativos:', error);
            return false;
        }
    }

    // Verificar se a troca de ativos está habilitada
    isAssetSwitchingEnabled() {
        const assetConfig = this.getAssetSwitchingConfig();
        return assetConfig.enabled === true;
    }

    // Obter payout mínimo configurado para troca de ativos
    getMinPayoutForAssets() {
        const assetConfig = this.getAssetSwitchingConfig();
        return assetConfig.minPayout || 85;
    }

    // Obter categoria preferida para ativos
    getPreferredAssetCategory() {
        const assetConfig = this.getAssetSwitchingConfig();
        return assetConfig.preferredCategory || 'crypto';
    }

    // Adicionar listener
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // Notificar listeners
    notifyListeners(type) {
        console.log(`[StateManager] Notificando ${this.listeners.size} listeners sobre atualização de '${type}'`);
        
        // Adicionar timestamp para garantir que os listeners reconheçam como uma atualização nova
        const notification = {
            state: this.state,
            type: type,
            timestamp: Date.now() // Adiciona um timestamp único
        };
        
        // Chamar todos os listeners de forma síncrona para garantir resposta imediata
        this.listeners.forEach(callback => {
            try {
                callback(notification);
            } catch (error) {
                console.error(`[StateManager] Erro ao notificar listener: ${error.message}`);
            }
        });
        
        console.log(`[StateManager] Notificação completada para tipo: ${type}`);
    }

    // Carregar dados de performance do storage
    async loadPerformanceData() {
        try {
            const result = await chrome.storage.local.get(['tradeHistory', 'currentProfit', 'operationsCount', 'successfulOperations', 'currentGaleLevel']);
            
            if (result.tradeHistory) {
                this.state.performance.operationsCount = result.tradeHistory.length;
                this.state.performance.successfulOperations = result.tradeHistory.filter(op => 
                    op.resultado === 'venceu' || op.lucro > 0
                ).length;
            }
            
            if (result.currentProfit !== undefined) {
                this.state.performance.currentProfit = result.currentProfit;
            }
            
            if (result.operationsCount !== undefined) {
                this.state.performance.operationsCount = result.operationsCount;
            }
            
            if (result.successfulOperations !== undefined) {
                this.state.performance.successfulOperations = result.successfulOperations;
            }
            
            if (result.currentGaleLevel !== undefined) {
                this.state.performance.currentGaleLevel = result.currentGaleLevel;
            }
            
            console.log('[StateManager] Dados de performance carregados:', this.state.performance);
            this.notifyListeners('performance');
        } catch (error) {
            console.error('[StateManager] Erro ao carregar dados de performance:', error);
        }
    }

    // Salvar dados de performance no storage
    async savePerformanceData() {
        try {
            await chrome.storage.local.set({
                currentProfit: this.state.performance.currentProfit,
                operationsCount: this.state.performance.operationsCount,
                successfulOperations: this.state.performance.successfulOperations,
                currentGaleLevel: this.state.performance.currentGaleLevel
            });
            console.log('[StateManager] Dados de performance salvos');
        } catch (error) {
            console.error('[StateManager] Erro ao salvar dados de performance:', error);
        }
    }

    // Atualizar dados de operação
    updateOperationData(operationData) {
        if (operationData.profit !== undefined) {
            this.state.performance.currentProfit += operationData.profit;
        }
        
        if (operationData.isNewOperation) {
            this.state.performance.operationsCount++;
            if (operationData.isSuccessful) {
                this.state.performance.successfulOperations++;
            }
        }
        
        if (operationData.galeLevel !== undefined) {
            this.state.performance.currentGaleLevel = operationData.galeLevel;
        }
        
        this.savePerformanceData();
        this.notifyListeners('performance');
        this.updateDashboard();
    }

    // Resetar dados de performance
    resetPerformanceData() {
        this.state.performance = {
            currentProfit: 0,
            operationsCount: 0,
            successfulOperations: 0,
            currentGaleLevel: 0
        };
        
        this.savePerformanceData();
        this.notifyListeners('performance');
        this.updateDashboard();
        console.log('[StateManager] Dados de performance resetados');
    }

    // Simular operação (para testes)
    simulateOperation(profit, isSuccessful = true, galeLevel = 0) {
        this.updateOperationData({
            profit: profit,
            isNewOperation: true,
            isSuccessful: isSuccessful,
            galeLevel: galeLevel
        });
        
        console.log('[StateManager] Operação simulada:', { profit, isSuccessful, galeLevel });
    }

    // Definir erro do sistema
    setSystemError(hasError, errorMessage = 'Sistema com Erro') {
        this.state.system.hasError = hasError;
        this.state.system.errorMessage = errorMessage;
        this.notifyListeners('system');
        this.updateDashboard();
    }

    // Obter dados de performance
    getPerformanceData() {
        return this.state.performance;
    }

    // Obter estado do sistema
    getSystemState() {
        return this.state.system;
    }

    // Atualizar dashboard completo
    updateDashboard() {
        this.updateSystemStatus();
        this.updateConfigurationDisplay();
        this.updatePerformanceDisplay();
        this.updateAutomationStatus();
        this.updateGaleStatus();
    }

    // Atualizar status do sistema
    updateSystemStatus() {
        const systemDot = document.getElementById('system-dot');
        const systemText = document.getElementById('system-status-text');
        
        if (systemDot && systemText) {
            const isRunning = this.state.automation?.isRunning || false;
            
            console.log('[StateManager] Atualizando status do sistema:', { isRunning, hasError: this.state.system.hasError });
            
            // Verificar se há algum erro no sistema
            if (this.state.system.hasError) {
                systemDot.className = 'indicator-dot danger';
                systemText.textContent = this.state.system.errorMessage || 'Sistema com Erro';
            } else if (isRunning) {
                // Amarelo quando automação está trabalhando
                systemDot.className = 'indicator-dot warning';
                systemText.textContent = 'Sistema Trabalhando';
            } else {
                // Verde quando pronto mas parado
                systemDot.className = 'indicator-dot';
                systemText.textContent = 'Sistema Pronto';
            }
        }
    }

    // Atualizar display de configurações
    updateConfigurationDisplay() {
        if (!this.state.config) return;

        // Atualizar valores de configuração
        this.updateElement('current-value-display', `R$ ${this.state.config.value || 0}`);
        this.updateElement('current-time-display', `${this.state.config.period || 0}m`);
        this.updateElement('current-profit-display', `R$ ${this.state.config.dailyProfit || 0}`);
        this.updateElement('current-stop-display', `R$ ${this.state.config.stopLoss || 0}`);

        // Atualizar elementos ocultos para compatibilidade
        this.updateElement('current-value', `Valor de entrada: R$ ${this.state.config.value || 0}`);
        this.updateElement('current-time', `Período: ${this.state.config.period || 0}m`);
        this.updateElement('current-profit', `Lucro Diário: R$ ${this.state.config.dailyProfit || 0}`);
        this.updateElement('current-stop', `Stop Loss: R$ ${this.state.config.stopLoss || 0}`);
    }

    // Atualizar display de performance
    updatePerformanceDisplay() {
        const performance = this.state.performance;
        
        // Atualizar lucro atual
        const profitElement = document.getElementById('current-profit-value');
        if (profitElement) {
            profitElement.textContent = `R$ ${performance.currentProfit.toFixed(2)}`;
            
            // Aplicar classe baseada no valor
            profitElement.className = 'config-value';
            if (performance.currentProfit > 0) {
                profitElement.classList.add('profit-positive');
            } else if (performance.currentProfit < 0) {
                profitElement.classList.add('profit-negative');
            } else {
                profitElement.classList.add('profit-neutral');
            }
        }

        // Atualizar contagem de operações
        this.updateElement('operations-count', performance.operationsCount.toString());

        // Calcular e atualizar taxa de acerto
        const successRate = performance.operationsCount > 0 
            ? ((performance.successfulOperations / performance.operationsCount) * 100).toFixed(1)
            : '0';
        this.updateElement('success-rate', `${successRate}%`);

        // Atualizar elemento de lucro para compatibilidade
        const profitCurrentElement = document.getElementById('profitCurrent');
        if (profitCurrentElement) {
            profitCurrentElement.textContent = `R$ ${performance.currentProfit.toFixed(2)}`;
        }
    }

    // Atualizar status da automação
    updateAutomationStatus() {
        const isRunning = this.state.automation?.isRunning || false;
        
        console.log('[StateManager] Atualizando status da automação:', { isRunning });

        // Atualizar indicador compacto
        const automationDot = document.getElementById('automation-dot');
        const automationText = document.getElementById('automation-status-compact');
        
        if (automationDot && automationText) {
            if (isRunning) {
                automationDot.className = 'indicator-dot';
                automationText.textContent = 'Automação Ativa';
            } else {
                automationDot.className = 'indicator-dot inactive';
                automationText.textContent = 'Automação Inativa';
            }
        }

        // Atualizar elemento oculto para compatibilidade
        const automationStatus = document.getElementById('automation-status');
        if (automationStatus) {
            automationStatus.className = `status-item automation-status ${isRunning ? 'active' : 'inactive'}`;
            const span = automationStatus.querySelector('span');
            if (span) {
                span.textContent = `Automação: ${isRunning ? 'Ativa' : 'Inativa'}`;
            }
        }
    }

    // Atualizar status do Gale
    updateGaleStatus() {
        console.log('[StateManager] Atualizando status do Gale');
        
        if (!this.state.config) {
            console.log('[StateManager] Config não disponível ainda');
            return;
        }
        
        const galeActive = this.state.config?.gale?.active || false;

        // Atualizar indicador compacto
        const galeDot = document.getElementById('gale-dot');
        const galeText = document.getElementById('gale-status-compact');
        
        if (galeDot && galeText) {
            if (galeActive) {
                galeDot.className = 'indicator-dot';
                const galeLevel = this.state.config?.gale?.level || '1.2x';
                galeText.textContent = `Gale Ativo (${galeLevel})`;
                console.log('[StateManager] Gale ativo com nível:', galeLevel);
            } else {
                galeDot.className = 'indicator-dot inactive';
                galeText.textContent = 'Gale Desativado';
                console.log('[StateManager] Gale desativado');
            }
        }

        // Atualizar nível do Gale
        this.updateElement('gale-level-display', `Nível ${this.state.performance.currentGaleLevel}`);

        // Atualizar elementos ocultos para compatibilidade
        const currentGale = document.getElementById('current-gale');
        if (currentGale) {
            currentGale.className = `status-item gale-status ${galeActive ? 'active' : 'inactive'}`;
            const span = currentGale.querySelector('span');
            if (span) {
                span.textContent = `Gale: ${galeActive ? 'Ativado' : 'Desativado'}`;
            }
        }
    }

    // Método utilitário para atualizar elementos
    updateElement(elementId, content) {
        const element = document.getElementById(elementId);
        if (element) {
            if (element.tagName === 'SPAN' || element.tagName === 'DIV') {
                element.textContent = content;
            } else {
                element.innerHTML = content;
            }
        }
    }
}

// Inicializar StateManager
const stateManagerInstance = new StateManager();

// Expor StateManager via window para compatibilidade com módulos existentes
window.StateManager = stateManagerInstance;

// Sistema de comunicação via chrome.runtime
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'STATE_MANAGER_REQUEST') {
        const { method, params } = message;
        
        try {
            switch (method) {
                case 'getConfig':
                    sendResponse({ success: true, data: stateManagerInstance.getConfig() });
                    break;
                    
                case 'saveConfig':
                    stateManagerInstance.saveConfig(params.config)
                        .then(success => sendResponse({ success, data: success }))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true; // resposta assíncrona
                    
                case 'loadConfig':
                    stateManagerInstance.loadConfig()
                        .then(config => sendResponse({ success: true, data: config }))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true; // resposta assíncrona
                    
                case 'getAutomationState':
                    sendResponse({ success: true, data: stateManagerInstance.getAutomationState() });
                    break;
                    
                case 'updateAutomationState':
                    stateManagerInstance.updateAutomationState(params.isRunning, params.operation);
                    sendResponse({ success: true });
                    break;
                    
                case 'subscribe':
                    // Para subscription, vamos usar um sistema diferente
                    stateManagerInstance.listeners.add((notification) => {
                        chrome.runtime.sendMessage({
                            action: 'STATE_MANAGER_NOTIFICATION',
                            notification: notification
                        });
                    });
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Método não reconhecido' });
            }
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }
    
    return false; // resposta síncrona por padrão
});

console.log('[StateManager] Sistema de comunicação via chrome.runtime inicializado'); 