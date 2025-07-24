// Sistema de logs otimizado (novo padrão)
// logToSystem removido - usando window.logToSystem global

// Sistema de status otimizado (novo padrão)
// updateStatus removido - usando window.updateStatus global

// Configurações padrão (fallback caso não consiga carregar default.json)
const DEFAULT_CONFIG = {
    gale: {
        active: true,
        level: '20%'  // Corrigido para usar porcentagem ao invés de multiplicador
    },
    dailyProfit: 150,
    stopLoss: 30,
    automation: false,
    value: 10,
    period: 1,
    minPayout: 80,
    payoutBehavior: 'wait',
    payoutTimeout: 5,  // Corrigido para 5 segundos como padrão
    // Modos de desenvolvimento e teste
    testMode: false,
    devMode: false, // Voltando para false (padrão)
    // Configurações para troca de ativos
    assetSwitching: {
        enabled: false,                   // Desabilitado por padrão
        minPayout: 85,                   // Payout mínimo para operações
        preferredCategory: 'crypto',     // Categoria preferida (crypto, currency, commodity, stock)
        checkBeforeAnalysis: true,       // Verificar ativo antes de análise
        checkBeforeTrade: true,          // Verificar ativo antes de operação
        maxRetries: 3                    // Máximo de tentativas de troca
    }
};

// Função para normalizar configurações vindas de diferentes fontes
const normalizeConfig = (config) => {
    if (!config) return DEFAULT_CONFIG;
    
    // Garantir estrutura consistente
    const normalized = {
        ...DEFAULT_CONFIG,
        ...config,
        gale: {
            active: config.gale?.active ?? DEFAULT_CONFIG.gale.active,
            level: config.gale?.level ?? DEFAULT_CONFIG.gale.level
        },
        assetSwitching: {
            ...DEFAULT_CONFIG.assetSwitching,
            ...(config.assetSwitching || {})
        }
    };
    
    return normalized;
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
        
        // *** CORRIGIDO: Inicializar módulos analisadores de forma LAZY ***
        // Aumentar delay para permitir carregamento completo dos módulos
        setTimeout(() => this.initializeAnalyzersLazy(), 8000); // 8 segundos após carregamento para garantir inicialização
        
        this.tradingActive = false;
        this.analyzersInitialized = false; // *** NOVO: Controle de inicialização lazy ***
        
        // StateManager inicializado
    }

    // *** REMOVIDO: Não carregamos mais default.json ***
    // Todas as configurações padrão agora são definidas pelo usuário

    // Carregar configurações
    async loadConfig() {
        try {
            const result = await chrome.storage.sync.get(['userConfig']);
            
            // Se não houver configurações no storage, usar DEFAULT_CONFIG (não carregar JSON)
            if (!result.userConfig || Object.keys(result.userConfig).length === 0) {
                // Usar configurações padrão em memória, sem salvar automaticamente
                this.state.config = normalizeConfig(DEFAULT_CONFIG);
                
                // *** NOVO: Salvar configurações padrão apenas na primeira vez ***
                // Isso garante que o usuário tenha um ponto de partida, mas não sobrescreve configurações existentes
                await chrome.storage.sync.set({ userConfig: this.state.config });
            } else {
                // Normalizar configurações do storage
                this.state.config = normalizeConfig(result.userConfig);
                
                // Se houve normalização, salvar de volta
                if (JSON.stringify(this.state.config) !== JSON.stringify(result.userConfig)) {
                    await chrome.storage.sync.set({ userConfig: this.state.config });
                }
            }
            
            this.notifyListeners('config');
            return this.state.config;
        } catch (error) {
            // Em caso de erro, usar configurações padrão normalizadas
            this.state.config = normalizeConfig(DEFAULT_CONFIG);
            return this.state.config;
        }
    }

    // Salvar configurações
    async saveConfig(newConfig) {
        try {
            // Normalizar configurações antes de salvar
            const normalizedConfig = normalizeConfig(newConfig);
            
            await chrome.storage.sync.set({ userConfig: normalizedConfig });
            this.state.config = normalizedConfig;
            this.notifyListeners('config');
            logToSystem('Configurações salvas com sucesso', 'SUCCESS');
            return true;
        } catch (error) {
            logToSystem(`Erro ao salvar configurações: ${error.message}`, 'ERROR');
            return false;
        }
    }

    // *** NOVO: Salvar configurações atuais como padrão do usuário ***
    async saveAsUserDefault() {
        try {
            const currentConfig = this.getConfig();
            
            // Salvar configurações atuais como padrão do usuário
            await chrome.storage.sync.set({ userDefaultConfig: currentConfig });
            
            logToSystem('Configurações salvas como padrão do usuário', 'SUCCESS');
            updateStatus('Configurações salvas como padrão', 'success', 3000);
            return true;
        } catch (error) {
            logToSystem(`Erro ao salvar configurações como padrão: ${error.message}`, 'ERROR');
            return false;
        }
    }

    // *** NOVO: Carregar configurações padrão definidas pelo usuário ***
    async loadUserDefault() {
        try {
            const result = await chrome.storage.sync.get(['userDefaultConfig']);
            
            if (result.userDefaultConfig && Object.keys(result.userDefaultConfig).length > 0) {
                // Normalizar e aplicar configurações padrão do usuário
                const normalizedConfig = normalizeConfig(result.userDefaultConfig);
                
                await chrome.storage.sync.set({ userConfig: normalizedConfig });
                this.state.config = normalizedConfig;
                this.notifyListeners('config');
                
                logToSystem('Configurações padrão do usuário carregadas', 'SUCCESS');
                updateStatus('Configurações padrão carregadas', 'success', 3000);
                return true;
            } else {
                // Se não há configurações padrão do usuário, usar DEFAULT_CONFIG
                const defaultConfig = normalizeConfig(DEFAULT_CONFIG);
                
                await chrome.storage.sync.set({ userConfig: defaultConfig });
                this.state.config = defaultConfig;
                this.notifyListeners('config');
                
                logToSystem('Configurações padrão do sistema carregadas', 'INFO');
                updateStatus('Configurações padrão carregadas', 'info', 3000);
                return true;
            }
        } catch (error) {
            logToSystem(`Erro ao carregar configurações padrão: ${error.message}`, 'ERROR');
            return false;
        }
    }

    // *** NOVO: Verificar se existem configurações padrão do usuário ***
    async hasUserDefault() {
        try {
            const result = await chrome.storage.sync.get(['userDefaultConfig']);
            return result.userDefaultConfig && Object.keys(result.userDefaultConfig).length > 0;
        } catch (error) {
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
        
        if (isRunning) {
            logToSystem('Automação iniciada', 'INFO');
            updateStatus('Automação iniciada', 'success', 3000);
        } else {
            logToSystem('Automação parada', 'INFO');
            updateStatus('Automação parada', 'info', 3000);
        }
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
            return true;
        } catch (error) {
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
                // Erro silencioso
            }
        });
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
            
            logToSystem('Status operacional e estado de automação resetados (página recarregada)', 'INFO');
            
            // Salvar o status resetado
            this.saveOperationalStatus();
        } catch (error) {
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
        } catch (error) {
            // Erro silencioso
        }
    }

    // Novo método para atualizar status operacional
    updateOperationalStatus(newStatus, errorDetails = null) {
        const validStatuses = ['Pronto', 'Operando...', 'Parado Erro'];
        
        if (!validStatuses.includes(newStatus)) {
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
        
        // Log da mudança de status
        if (newStatus !== previousStatus) {
            logToSystem(`Status operacional alterado: ${previousStatus} → ${newStatus}`, 'INFO');
            
            // ✅ REABILITADO COM PROTEÇÃO ANTI-LOOP
            // Só enviar status se realmente mudou e não é uma chamada interna
            if (typeof window.updateStatus === 'function') {
                try {
                    // Verificar se não estamos em um ciclo de atualizações (máximo 1 por segundo)
                    const now = Date.now();
                    const lastUpdate = this.operationalStatus.lastStatusUpdate || 0;
                    
                    if ((now - lastUpdate) > 1000) { // Cooldown de 1 segundo
                        this.operationalStatus.lastStatusUpdate = now;
                        
                        // Enviar status de forma não-bloqueante
                        setTimeout(() => {
                            window.updateStatus(`Status: ${newStatus}`, 'info', 3000);
                        }, 50); // Delay mínimo para evitar sobreposição
                        
                        console.log(`[STATE-MANAGER] ✅ updateStatus() enviado com segurança - Status: ${newStatus}`);
                    } else {
                        console.log(`[STATE-MANAGER] 🚫 updateStatus() bloqueado por cooldown - Status: ${newStatus}`);
                    }
                } catch (error) {
                    console.log(`[STATE-MANAGER] ⚠️ Erro ao enviar updateStatus: ${error.message}`);
                }
            } else {
                console.log(`[STATE-MANAGER] ⚠️ window.updateStatus não disponível - Status: ${newStatus}`);
            }
        }
        
        // Status atualizado
        return true;
    }

    // Novo método para obter status operacional
    getOperationalStatus() {
        return { ...this.operationalStatus };
    }

    // Novo método para registrar erro e alterar status
    reportError(errorMessage, errorDetails = null) {
        const errorInfo = {
            message: errorMessage,
            details: errorDetails,
            timestamp: Date.now(),
            stack: new Error().stack
        };
        
        this.updateOperationalStatus('Parado Erro', errorInfo);
        
        // Log do erro
        logToSystem(`Erro reportado: ${errorMessage}`, 'ERROR');
        updateStatus(`Erro: ${errorMessage}`, 'error', 5000);
        
        // Notificar via chrome.runtime para outros módulos
        try {
            chrome.runtime.sendMessage({
                action: 'SYSTEM_ERROR_REPORTED',
                error: errorInfo
            });
        } catch (e) {
            // Erro silencioso
        }
        
        return errorInfo;
    }

    // Novo método para iniciar operação
    startOperation(operationType = 'analysis') {
        this.updateOperationalStatus('Operando...');
        
        logToSystem(`Operação iniciada: ${operationType}`, 'INFO');
        updateStatus(`Iniciando ${operationType}...`, 'info', 3000);
        
        // ✅ CORREÇÃO: Não alterar estado de automação se não estiver configurada como ativa
        const config = this.getConfig();
        const isAutomationConfigured = config.automation === true;
        
        if (isAutomationConfigured) {
            // Apenas atualizar estado se automação estiver configurada como ativa
            this.updateAutomationState(true, {
                id: Date.now(),
                type: operationType,
                startTime: new Date().toISOString(),
                status: 'running'
            });
        }
        // Se automação não estiver ativa, não alterar o estado
        
        // Operação iniciada
    }

    // ✅ CORREÇÃO: Finalizar operação baseado no contexto
    stopOperation(reason = 'completed') {
        const wasInError = this.operationalStatus.status === 'Parado Erro';
        const config = this.getConfig();
        const isAutomationActive = config.automation === true;
        
        // ✅ CORREÇÃO: Só resetar status se for cancelamento ou erro
        // Para operações executadas (manual ou automático), manter "Operando..." até ordem fechar
        if (reason === 'cancelled' || reason === 'error' || wasInError) {
            // Cancelamento ou erro: resetar imediatamente
            if (!wasInError) {
                this.updateOperationalStatus('Pronto');
            }
        } else if (reason === 'completed' && isAutomationActive) {
            // Automação ativa: pode resetar status (controlado pela automação)
            this.updateOperationalStatus('Pronto');
        }
        // ✅ MODO MANUAL com 'completed': NÃO resetar status - manter "Operando..." até ordem fechar
        
        // Limpar estado de automação apenas se necessário
        if (reason === 'cancelled' || reason === 'error') {
            this.updateAutomationState(isAutomationActive, null);
        }
        
        // Log da ação
        if (reason === 'completed' && !isAutomationActive) {
            // Modo manual: operação executada mas status mantido
        } else {
            // Outros casos: operação finalizada
        }
    }

    // Novo método para reset manual do status de erro
    resetErrorStatus() {
        if (this.operationalStatus.status === 'Parado Erro') {
            this.updateOperationalStatus('Pronto');
            logToSystem('Status de erro resetado manualmente', 'INFO');
            updateStatus('Status de erro resetado', 'success', 3000);
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
        
        // Inicializando módulos de forma lazy
        
        let foundModules = 0;
        
        // Verificar módulos disponíveis SEM logs excessivos
        if (window.localPatternDetector) foundModules++;
        if (window.cacheAnalyzer) foundModules++;
        if (window.limitsChecker) foundModules++;
        if (window.intelligentGale) foundModules++;
        
        // Módulos detectados
        
        // Se não encontrou todos, tentar novamente em 5 segundos (aumentado para evitar spam)
        if (foundModules < 4) {
            this.analyzersInitialized = false;
            // Reduzir frequência de logs para evitar spam
            if (!this.loggedAnalyzerAttempt) {
                logToSystem(`Módulos analisadores aguardando carregamento (${foundModules}/4), tentando novamente em 5s`, 'INFO');
                this.loggedAnalyzerAttempt = true;
                // Resetar log após 30 segundos para evitar spam infinito
                setTimeout(() => { this.loggedAnalyzerAttempt = false; }, 30000);
            }
            setTimeout(() => this.initializeAnalyzersLazy(), 5000);
        } else {
            // Configurar listeners críticos quando módulos estiverem carregados
            logToSystem('Todos os módulos analisadores carregados com sucesso', 'SUCCESS');
            this.setupCriticalListeners();
        }
    }
    
    // *** MÉTODO ORIGINAL para quando realmente precisar ***
    initializeAnalyzersWhenNeeded() {
        if (this.analyzersInitialized) {
            return;
        }
        
        // Inicializando módulos sob demanda
        
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
                    
                    // Resetar status para "Pronto" após parada crítica
                    setTimeout(() => {
                        this.updateOperationalStatus('Pronto');
                        // Status resetado após evento crítico
                    }, 1000); // 1 segundo de delay
                }
            });
        }
        
        // Listener para document events
        document.addEventListener('automation_stopped', () => {
            setTimeout(() => {
                this.updateOperationalStatus('Pronto');
                // Status resetado após parada de automação
            }, 500);
        });
        
        document.addEventListener('operation_cancelled', () => {
            setTimeout(() => {
                this.updateOperationalStatus('Pronto');
                // Status resetado após cancelamento
            }, 500);
        });
    }

    // *** NOVO: Método para parar completamente a automação ***
    stopAutomation() {
        // Resetar status operacional para "Pronto"
        this.updateOperationalStatus('Pronto');
        
        // Limpar estado de automação
        this.updateAutomationState(false, null);
        
        // Notificar listeners sobre a parada
        this.notifyListeners('automationStopped');
        
        logToSystem('Automação parada completamente', 'INFO');
        updateStatus('Automação parada', 'info', 3000);
        
        return true;
    }
}

// Criar instância global do StateManager
window.StateManager = new StateManager(); 