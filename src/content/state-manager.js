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
            }
        };

        // Novo sistema de status operacional
        this.operationalStatus = {
            status: 'Pronto', // 'Pronto', 'Operando...', 'Parado Erro'
            lastUpdate: Date.now(),
            errorDetails: null,
            operationStartTime: null
        };
        
        this.listeners = new Set();
        this.loadConfig();
        this.loadOperationalStatus();
        
        // *** NOVO: Inicializar módulos analisadores de forma LAZY ***
        // Só inicializa quando necessário, não imediatamente
        setTimeout(() => this.initializeAnalyzersLazy(), 5000); // 5 segundos após carregamento
        
        this.tradingActive = false;
        this.analyzersInitialized = false; // *** NOVO: Controle de inicialização lazy ***
        
        // Log de inicialização simples - SEM usar logToSystem
        console.log('[StateManager] Inicializado (logs lazy ativados)');
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

    // Novo método para carregar status operacional
    async loadOperationalStatus() {
        try {
            const result = await new Promise((resolve) => {
                chrome.storage.sync.get(['operationalStatus'], resolve);
            });
            
            // *** CORREÇÃO: Sempre iniciar como "Pronto" ao recarregar a página ***
            // O status operacional só deve ser "Operando..." durante operações ativas
            // Ao recarregar, não há operação em andamento, então resetar para "Pronto"
            this.operationalStatus.status = 'Pronto';
            this.operationalStatus.lastUpdate = Date.now();
            this.operationalStatus.operationStartTime = null;
            this.operationalStatus.errorDetails = null;
            
            // *** CORREÇÃO: Também resetar estado de automação ***
            // A automação pode estar configurada como ativa, mas não há operação em andamento
            const config = this.getConfig();
            this.updateAutomationState(config.automation || false, null);
            
            console.log('Status operacional e estado de automação resetados (página recarregada)');
            
            // Salvar o status resetado
            this.saveOperationalStatus();
        } catch (error) {
            console.error('Erro ao carregar status operacional:', error);
            this.operationalStatus.status = 'Pronto';
            this.operationalStatus.lastUpdate = Date.now();
        }
    }

    // Novo método para salvar status operacional
    async saveOperationalStatus() {
        try {
            await new Promise((resolve, reject) => {
                chrome.storage.sync.set({ 
                    operationalStatus: this.operationalStatus 
                }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
            console.log('Status operacional salvo:', this.operationalStatus);
        } catch (error) {
            console.error('Erro ao salvar status operacional:', error);
        }
    }

    // Novo método para atualizar status operacional
    updateOperationalStatus(newStatus, errorDetails = null) {
        const validStatuses = ['Pronto', 'Operando...', 'Parado Erro'];
        
        if (!validStatuses.includes(newStatus)) {
            console.error('Status inválido:', newStatus);
            return false;
        }

        const previousStatus = this.operationalStatus.status;
        
        this.operationalStatus.status = newStatus;
        this.operationalStatus.lastUpdate = Date.now();
        
        if (newStatus === 'Parado Erro' && errorDetails) {
            this.operationalStatus.errorDetails = errorDetails;
        } else if (newStatus !== 'Parado Erro') {
            this.operationalStatus.errorDetails = null;
        }
        
        if (newStatus === 'Operando...') {
            this.operationalStatus.operationStartTime = Date.now();
        } else {
            this.operationalStatus.operationStartTime = null;
        }

        // Salvar mudança
        this.saveOperationalStatus();
        
        // Notificar listeners
        this.notifyListeners('operationalStatus');
        
        console.log(`Status operacional atualizado: ${previousStatus} → ${newStatus}`);
        
        return true;
    }

    // Novo método para obter status operacional
    getOperationalStatus() {
        return { ...this.operationalStatus };
    }

    // Novo método para registrar erro e alterar status
    reportError(errorMessage, errorDetails = null) {
        console.error('Erro reportado ao StateManager:', errorMessage);
        
        const errorInfo = {
            message: errorMessage,
            details: errorDetails,
            timestamp: Date.now(),
            stack: new Error().stack
        };
        
        this.updateOperationalStatus('Parado Erro', errorInfo);
        
        // Notificar via chrome.runtime para outros módulos
        try {
            chrome.runtime.sendMessage({
                action: 'SYSTEM_ERROR_REPORTED',
                error: errorInfo
            });
        } catch (e) {
            console.warn('Não foi possível notificar erro via runtime:', e.message);
        }
        
        return errorInfo;
    }

    // Novo método para iniciar operação
    startOperation(operationType = 'analysis') {
        this.updateOperationalStatus('Operando...');
        
        // Atualizar estado de automação também
        this.updateAutomationState(true, {
            id: Date.now(),
            type: operationType,
            startTime: new Date().toISOString(),
            status: 'running'
        });
        
        console.log(`Operação ${operationType} iniciada`);
    }

    // Novo método para finalizar operação
    stopOperation(reason = 'completed') {
        const wasInError = this.operationalStatus.status === 'Parado Erro';
        
        if (!wasInError) {
            this.updateOperationalStatus('Pronto');
        }
        
        // Limpar estado de automação
        const config = this.getConfig();
        this.updateAutomationState(config.automation || false, null);
        
        console.log(`Operação finalizada: ${reason}`);
    }

    // Novo método para reset manual do status de erro
    resetErrorStatus() {
        if (this.operationalStatus.status === 'Parado Erro') {
            this.updateOperationalStatus('Pronto');
            console.log('Status de erro resetado manualmente');
            return true;
        }
        return false;
    }

    // *** NOVO: Inicialização LAZY dos módulos ***
    initializeAnalyzersLazy() {
        // Verificar se já foram inicializados
        if (this.analyzersInitialized) {
            return;
        }
        
        // Marcar como inicializados
        this.analyzersInitialized = true;
        
        console.log('[StateManager] Inicializando módulos de forma lazy...');
        
        let foundModules = 0;
        
        // Verificar módulos disponíveis SEM logs excessivos
        if (window.localPatternDetector) foundModules++;
        if (window.cacheAnalyzer) foundModules++;
        if (window.limitsChecker) foundModules++;
        if (window.intelligentGale) foundModules++;
        
        // Log simples do resultado
        console.log(`[StateManager] Módulos encontrados: ${foundModules}/4`);
        
        // Se não encontrou todos, tentar novamente em 3 segundos
        if (foundModules < 4) {
            this.analyzersInitialized = false;
            setTimeout(() => this.initializeAnalyzersLazy(), 3000);
        } else {
            // Configurar listeners críticos quando módulos estiverem carregados
            this.setupCriticalListeners();
        }
    }
    
    // *** MÉTODO ORIGINAL para quando realmente precisar ***
    initializeAnalyzersWhenNeeded() {
        if (this.analyzersInitialized) {
            return;
        }
        
        console.log('[StateManager] Inicializando módulos sob demanda...');
        
        // *** NOVO: Adicionar listeners para eventos críticos ***
        this.setupCriticalListeners();
    }

    /**
     * Configura listeners para eventos críticos dos módulos
     */
    setupCriticalListeners() {
        // Listener para paradas automáticas do LimitsChecker
        if (chrome && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'CRITICAL_STOP' || 
                    request.action === 'EMERGENCY_STOP' || 
                    request.action === 'TARGET_REACHED' ||
                    request.action === 'LIMITS_VIOLATION') {
                    
                    // Resetar status para PRONTO após parada crítica
                    setTimeout(() => {
                        this.updateOperationalStatus('Pronto');
                        console.log('[StateManager] Status resetado para PRONTO após evento crítico:', request.action);
                    }, 1000); // 1 segundo de delay
                }
            });
        }
        
        // Listener para document events
        document.addEventListener('automation_stopped', () => {
            setTimeout(() => {
                this.updateOperationalStatus('Pronto');
                console.log('[StateManager] Status resetado para PRONTO após parada de automação');
            }, 500);
        });
        
        document.addEventListener('operation_cancelled', () => {
            setTimeout(() => {
                this.updateOperationalStatus('Pronto');
                console.log('[StateManager] Status resetado para PRONTO após cancelamento');
            }, 500);
        });
    }

    // *** NOVO: Método para parar completamente a automação ***
    stopAutomation() {
        console.log('Parando automação completamente...');
        
        // Resetar status operacional para "Pronto"
        this.updateOperationalStatus('Pronto');
        
        // Limpar estado de automação
        this.updateAutomationState(false, null);
        
        // Notificar listeners sobre a parada
        this.notifyListeners('automationStopped');
        
        console.log('Automação parada e status resetado para "Pronto"');
        
        return true;
    }
}

// Criar instância global do StateManager
window.StateManager = new StateManager(); 