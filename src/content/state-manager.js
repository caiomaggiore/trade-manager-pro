// Configurações padrão
const DEFAULT_CONFIG = {
    gale: {
        active: true,
        level: '1.2x'
    },
    dailyProfit: 150,
    stopLoss: 30,
    automation: false,
    value: 10,
    period: 1
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
    }

    // Carregar configurações
    async loadConfig() {
        try {
            const result = await chrome.storage.sync.get(['userConfig']);
            this.state.config = result.userConfig || DEFAULT_CONFIG;
            this.notifyListeners('config');
            return this.state.config;
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            return DEFAULT_CONFIG;
        }
    }

    // Salvar configurações
    async saveConfig(newConfig) {
        try {
            await chrome.storage.sync.set({ userConfig: newConfig });
            this.state.config = newConfig;
            this.notifyListeners('config');
            return true;
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
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

    // Adicionar listener
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // Notificar listeners
    notifyListeners(type) {
        this.listeners.forEach(callback => callback(this.state, type));
    }
}

// Exportar instância única
window.StateManager = new StateManager(); 