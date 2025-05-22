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
    minPayout: 80
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
        
        // Log de inicialização
        console.log('[StateManager] Inicializado');
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
}

// Exportar instância única
window.StateManager = new StateManager(); 