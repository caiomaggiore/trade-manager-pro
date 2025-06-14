// Configura├º├Áes padr├úo (fallback caso n├úo consiga carregar default.json)
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
    // Novas configura├º├Áes para troca de ativos
    assetSwitching: {
        enabled: true,                    // Se deve trocar ativos automaticamente
        minPayout: 85,                   // Payout m├¡nimo para opera├º├Áes
        preferredCategory: 'crypto',     // Categoria preferida (crypto, currency, commodity, stock)
        checkBeforeAnalysis: true,       // Verificar ativo antes de an├ílise
        checkBeforeTrade: true,          // Verificar ativo antes de opera├º├úo
        maxRetries: 3                    // M├íximo de tentativas de troca
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
            }
        };

        this.listeners = new Set();
        this.loadConfig();
        
        // Log de inicializa├º├úo
        console.log('[StateManager] Inicializado');
    }

    // Carregar configura├º├Áes padr├úo do arquivo
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
            console.log('[StateManager] Usando configura├º├Áes padr├úo hardcoded');
            return DEFAULT_CONFIG;
        }
    }

    // Carregar configura├º├Áes
    async loadConfig() {
        try {
            console.log('[StateManager] Carregando configura├º├Áes do storage...');
            const result = await chrome.storage.sync.get(['userConfig']);
            
            // Se n├úo houver configura├º├Áes no storage, carregar default.json
            if (!result.userConfig || Object.keys(result.userConfig).length === 0) {
                console.log('[StateManager] Nenhuma configura├º├úo encontrada no storage');
                this.state.config = await this.loadDefaultConfig();
                
                // Salvar as configura├º├Áes padr├úo no storage para uso futuro
                await chrome.storage.sync.set({ userConfig: this.state.config });
                console.log('[StateManager] Configura├º├Áes padr├úo salvas no storage');
            } else {
                console.log('[StateManager] Configura├º├Áes do usu├írio carregadas do storage');
                this.state.config = result.userConfig;
                
                // Verificar se o payout m├¡nimo est├í definido, caso contr├írio, usar o padr├úo
                if (typeof this.state.config.minPayout === 'undefined') {
                    console.log('[StateManager] Payout m├¡nimo n├úo encontrado, usando padr├úo de 80%');
                    this.state.config.minPayout = 80;
                } else {
                    console.log(`[StateManager] Payout m├¡nimo carregado: ${this.state.config.minPayout}%`);
                }
            }
            
            this.notifyListeners('config');
            return this.state.config;
        } catch (error) {
            console.error('[StateManager] Erro ao carregar configura├º├Áes:', error);
            // Em caso de erro, usar configura├º├Áes padr├úo
            this.state.config = DEFAULT_CONFIG;
            return DEFAULT_CONFIG;
        }
    }

    // Salvar configura├º├Áes
    async saveConfig(newConfig) {
        try {
            console.log('[StateManager] Salvando configura├º├Áes:', newConfig);
            
            // Verificar se o payout m├¡nimo est├í definido
            if (typeof newConfig.minPayout === 'undefined') {
                console.log('[StateManager] Payout m├¡nimo n├úo encontrado no novo config, usando padr├úo de 80%');
                newConfig.minPayout = 80;
            } else {
                console.log(`[StateManager] Payout m├¡nimo sendo salvo: ${newConfig.minPayout}%`);
            }
            
            await chrome.storage.sync.set({ userConfig: newConfig });
            this.state.config = newConfig;
            this.notifyListeners('config');
            console.log('[StateManager] Configura├º├Áes salvas com sucesso');
            return true;
        } catch (error) {
            console.error('[StateManager] Erro ao salvar configura├º├Áes:', error);
            return false;
        }
    }

    // Atualizar estado da automa├º├úo
    updateAutomationState(isRunning, operation = null) {
        this.state.automation = {
            isRunning,
            currentOperation: operation
        };
        this.notifyListeners('automation');
    }

    // Obter configura├º├úo atual
    getConfig() {
        return this.state.config || DEFAULT_CONFIG;
    }

    // Obter estado da automa├º├úo
    getAutomationState() {
        return this.state.automation;
    }

    // Obter configura├º├Áes de troca de ativos
    getAssetSwitchingConfig() {
        const config = this.getConfig();
        return config.assetSwitching || DEFAULT_CONFIG.assetSwitching;
    }

    // Atualizar configura├º├Áes de troca de ativos
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
            console.log('[StateManager] Configura├º├Áes de troca de ativos atualizadas:', newAssetConfig);
            return true;
        } catch (error) {
            console.error('[StateManager] Erro ao atualizar configura├º├Áes de troca de ativos:', error);
            return false;
        }
    }

    // Verificar se a troca de ativos est├í habilitada
    isAssetSwitchingEnabled() {
        const assetConfig = this.getAssetSwitchingConfig();
        return assetConfig.enabled === true;
    }

    // Obter payout m├¡nimo configurado para troca de ativos
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
        console.log(`[StateManager] Notificando ${this.listeners.size} listeners sobre atualiza├º├úo de '${type}'`);
        
        // Adicionar timestamp para garantir que os listeners reconhe├ºam como uma atualiza├º├úo nova
        const notification = {
            state: this.state,
            type: type,
            timestamp: Date.now() // Adiciona um timestamp ├║nico
        };
        
        // Chamar todos os listeners de forma s├¡ncrona para garantir resposta imediata
        this.listeners.forEach(callback => {
            try {
                callback(notification);
            } catch (error) {
                console.error(`[StateManager] Erro ao notificar listener: ${error.message}`);
            }
        });
        
        console.log(`[StateManager] Notifica├º├úo completada para tipo: ${type}`);
    }
}

// Exportar inst├óncia ├║nica
window.StateManager = new StateManager(); 
