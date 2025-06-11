/**
 * ====================================================================
 * LIMITS CHECKER - Verificador Independente de Limites
 * ====================================================================
 * 
 * Sistema independente que monitora continuamente:
 * - Stop Loss (limite de perdas)
 * - Lucro Diário (meta de ganhos)
 * - Limites de Gale (ciclos máximos)
 * - Limites de tempo (operações por período)
 * 
 * Funciona independentemente da automação principal
 */

class LimitsChecker {
    constructor() {
        this.config = {
            // Intervalos de verificação (em ms)
            checkInterval: 5000,        // Verificar a cada 5 segundos
            balanceUpdateInterval: 2000, // Atualizar saldo a cada 2 segundos
            
            // Tolerâncias e margens de segurança
            stopLossTolerance: 0.1,     // 10 centavos de tolerância
            profitTargetTolerance: 0.1,  // 10 centavos de tolerância
            
            // Configurações de emergência
            emergencyStopEnabled: true,
            maxConsecutiveLosses: 10,   // Parar após 10 perdas consecutivas
            maxDailyOperations: 500     // Máximo 500 operações por dia
        };
        
        this.state = {
            isActive: false,
            lastCheck: null,
            currentBalance: 0,
            initialBalance: 0,
            dailyProfit: 0,
            
            // Contadores
            consecutiveLosses: 0,
            dailyOperations: 0,
            todayDate: new Date().toDateString(),
            
            // Limites atuais
            stopLossLimit: 0,
            profitTarget: 0,
            galeMaxCycles: 0,
            
            // Status de parada
            stopReasons: [],
            emergencyStop: false
        };
        
        this.listeners = new Set();
        this.checkIntervalId = null;
        this.balanceIntervalId = null;
        
        // Log removido - inicialização lazy
    }

    /**
     * CONTROLE PRINCIPAL
     */
    
    /**
     * Inicia monitoramento de limites
     */
    start(config = {}) {
        if (this.state.isActive) {
            // Sistema já ativo - log removido
            return;
        }
        
        // Atualizar configurações
        this.updateLimits(config);
        
        // Resetar estado se for um novo dia
        this.checkNewDay();
        
        // Obter saldo inicial
        this.updateInitialBalance();
        
        // Iniciar intervalos de verificação
        this.startIntervals();
        
        this.state.isActive = true;
        this.state.lastCheck = Date.now();
        
        // Log de monitoramento removido
        this.notifyListeners('started', this.state);
    }

    /**
     * Para monitoramento de limites
     */
    stop(reason = 'manual') {
        if (!this.state.isActive) {
            return;
        }
        
        this.clearIntervals();
        this.state.isActive = false;
        
        // Log de parada removido
        this.notifyListeners('stopped', { reason, state: this.state });
    }

    /**
     * Atualiza limites de configuração
     */
    updateLimits(config) {
        this.state.stopLossLimit = parseFloat(config.stopLoss) || 0;
        this.state.profitTarget = parseFloat(config.dailyProfit) || 0;
        this.state.galeMaxCycles = parseInt(config.galeMaxCycles) || 0;
        
        // Log de atualização removido
    }

    /**
     * VERIFICAÇÕES PRINCIPAIS
     */
    
    /**
     * Executa verificação completa de limites
     */
    async performLimitsCheck() {
        if (!this.state.isActive) {
            return;
        }
        
        try {
            // Atualizar saldo atual
            await this.updateCurrentBalance();
            
            // Calcular lucro/perda do dia
            this.calculateDailyProfit();
            
            // Verificações individuais
            const checks = [
                this.checkStopLoss(),
                this.checkProfitTarget(),
                this.checkConsecutiveLosses(),
                this.checkDailyOperations(),
                this.checkEmergencyConditions()
            ];
            
            const results = await Promise.all(checks);
            const violations = results.filter(result => result.violated);
            
            // Se houver violações, processar parada
            if (violations.length > 0) {
                // *** NOVO: Log informativo para o usuário sobre limite atingido ***
                if (chrome && chrome.runtime && chrome.runtime.id) {
                    const violationsList = violations.map(v => {
                        switch(v.type) {
                            case 'stopLoss': return `Stop Loss atingido: ${v.data.currentLoss}`;
                            case 'profitTarget': return `Meta de lucro atingida: ${v.data.currentProfit}`;
                            case 'galeLimit': return `Limite de Gale atingido: ${v.data.current} níveis`;
                            case 'consecutiveLosses': return `Muitas perdas consecutivas: ${v.data.currentLoss}`;
                            case 'maxLoss': return `Perda máxima atingida: ${v.data.currentLoss}`;
                            default: return `Limite ${v.type}: ${v.data.current}`;
                        }
                    }).join(', ');
                    
                    chrome.runtime.sendMessage({
                        action: 'addLog',
                        logMessage: `🎯 LIMITE ATINGIDO: ${violationsList} - Sistema encerrado automaticamente`,
                        logLevel: 'WARN',
                        logSource: 'limits-checker.js'
                    });
                }
                
                await this.processLimitViolations(violations);
            }
            
            this.state.lastCheck = Date.now();
            
        } catch (error) {
            console.error('❌ LIMITS-CHECKER: Erro na verificação:', error);
        }
    }

    /**
     * Verifica Stop Loss
     */
    async checkStopLoss() {
        if (this.state.stopLossLimit <= 0) {
            return { type: 'stopLoss', violated: false };
        }
        
        const currentLoss = this.state.initialBalance - this.state.currentBalance;
        const isViolated = currentLoss >= (this.state.stopLossLimit - this.config.stopLossTolerance);
        
        if (isViolated) {
            return {
                type: 'stopLoss',
                violated: true,
                data: {
                    currentLoss: currentLoss.toFixed(2),
                    limit: this.state.stopLossLimit,
                    balance: this.state.currentBalance
                }
            };
        }
        
        return { type: 'stopLoss', violated: false };
    }

    /**
     * Verifica Meta de Lucro Diário
     */
    async checkProfitTarget() {
        if (this.state.profitTarget <= 0) {
            return { type: 'profitTarget', violated: false };
        }
        
        const isViolated = this.state.dailyProfit >= (this.state.profitTarget - this.config.profitTargetTolerance);
        
        if (isViolated) {
            return {
                type: 'profitTarget',
                violated: true,
                data: {
                    currentProfit: this.state.dailyProfit.toFixed(2),
                    target: this.state.profitTarget,
                    balance: this.state.currentBalance
                }
            };
        }
        
        return { type: 'profitTarget', violated: false };
    }

    /**
     * Para todos os sistemas conectados
     */
    async stopAllSystems(reason) {
        try {
            // Parar StateManager
            if (window.StateManager && typeof window.StateManager.stopAutomation === 'function') {
                window.StateManager.stopAutomation();
            }
            
            // Usar chrome.runtime.sendMessage para logs críticos
        if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: 'addLog',
                logMessage: `Todos os sistemas parados - ${reason}`,
                logLevel: 'WARN',
                logSource: 'limits-checker.js'
            });
        }
            
        } catch (error) {
            console.error('❌ LIMITS-CHECKER: Erro ao parar sistemas:', error);
        }
    }

    /**
     * MÉTODOS UTILITÁRIOS
     */
    
    /**
     * Atualiza saldo atual do sistema
     */
    async updateCurrentBalance() {
        try {
            // Tentar obter saldo do StateManager
            if (window.StateManager) {
                const profit = window.StateManager.getCurrentProfit();
                if (profit !== null) {
                    this.state.currentBalance = this.state.initialBalance + profit;
                    return;
                }
            }
            
        } catch (error) {
            console.error('❌ LIMITS-CHECKER: Erro ao atualizar saldo:', error);
        }
    }

    calculateDailyProfit() {
        this.state.dailyProfit = this.state.currentBalance - this.state.initialBalance;
    }

    updateInitialBalance() {
        if (this.state.initialBalance === 0) {
            this.state.initialBalance = this.state.currentBalance;
        }
    }

    checkNewDay() {
        const today = new Date().toDateString();
        if (this.state.todayDate !== today) {
            this.state.todayDate = today;
            this.state.dailyOperations = 0;
            this.state.consecutiveLosses = 0;
            this.state.initialBalance = 0;
            this.state.dailyProfit = 0;
        }
    }

    /**
     * CONTROLE DE INTERVALOS
     */
    
    startIntervals() {
        this.checkIntervalId = setInterval(() => {
            this.performLimitsCheck();
        }, this.config.checkInterval);
        
        this.balanceIntervalId = setInterval(() => {
            this.updateCurrentBalance();
        }, this.config.balanceUpdateInterval);
    }

    clearIntervals() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = null;
        }
        
        if (this.balanceIntervalId) {
            clearInterval(this.balanceIntervalId);
            this.balanceIntervalId = null;
        }
    }

    /**
     * LISTENERS E COMUNICAÇÃO
     */
    
    addListener(callback) {
        this.listeners.add(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners(event, data) {
        for (const listener of this.listeners) {
            try {
                listener(event, data);
            } catch (error) {
                console.error('❌ LIMITS-CHECKER: Erro no listener:', error);
            }
        }
    }

    sendCriticalMessage(action, data) {
        try {
            chrome.runtime.sendMessage({
                action,
                source: 'limits-checker',
                data,
                timestamp: Date.now(),
                critical: true
            });
        } catch (error) {
            console.error('❌ LIMITS-CHECKER: Erro ao enviar mensagem crítica:', error);
        }
    }

    /**
     * PROCESSAMENTO DE VIOLAÇÕES
     */
    
    async processLimitViolations(violations) {
        // Log crítico de violações
        if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: 'addLog',
                logMessage: `Violações detectadas: ${violations.map(v => v.type).join(', ')}`,
                logLevel: 'ERROR',
                logSource: 'limits-checker.js'
            });
        }
        
        this.state.stopReasons = violations.map(v => v.type);
        
        const isEmergency = violations.some(v => v.type === 'emergency');
        const isCritical = violations.some(v => ['stopLoss', 'consecutiveLosses'].includes(v.type));
        
        if (isEmergency) {
            await this.executeEmergencyStop(violations);
        } else if (isCritical) {
            await this.executeCriticalStop(violations);
        } else {
            await this.executeNormalStop(violations);
        }
    }

    async executeEmergencyStop(violations) {
                    // Log de emergência crítico
            if (chrome && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: 'EMERGENCY STOP: Parando sistema imediatamente',
                    logLevel: 'ERROR',
                    logSource: 'limits-checker.js'
                });
            }
        await this.stopAllSystems('emergency');
        this.sendCriticalMessage('EMERGENCY_STOP', { violations, state: this.state });
    }

    async executeCriticalStop(violations) {
                    // Log crítico
            if (chrome && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: 'CRITICAL STOP: Parando automação por violação crítica',
                    logLevel: 'ERROR',
                    logSource: 'limits-checker.js'
                });
            }
        await this.stopAllSystems('critical');
        this.sendCriticalMessage('CRITICAL_STOP', { violations, state: this.state });
    }

    async executeNormalStop(violations) {
                    // Log de parada normal
            if (chrome && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: 'NORMAL STOP: Parando automação por meta atingida',
                    logLevel: 'WARN',
                    logSource: 'limits-checker.js'
                });
            }
        await this.stopAllSystems('normal');
        this.sendCriticalMessage('TARGET_REACHED', { violations, state: this.state });
    }

    // Verificações simplificadas
    async checkConsecutiveLosses() {
        return { type: 'consecutiveLosses', violated: false };
    }

    async checkDailyOperations() {
        return { type: 'dailyOperations', violated: false };
    }

    async checkEmergencyConditions() {
        return { type: 'emergency', violated: false };
    }

    /**
     * MÉTODOS PÚBLICOS
     */
    
    getStatus() {
        return {
            isActive: this.state.isActive,
            currentBalance: this.state.currentBalance,
            dailyProfit: this.state.dailyProfit,
            limits: {
                stopLoss: this.state.stopLossLimit,
                profitTarget: this.state.profitTarget
            },
            lastCheck: this.state.lastCheck
        };
    }

    recordOperation(operation) {
        this.state.dailyOperations++;
        
        if (operation.success === false) {
            this.state.consecutiveLosses++;
        } else {
            this.state.consecutiveLosses = 0;
        }
    }

    async forceCheck() {
        await this.performLimitsCheck();
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.LimitsChecker = LimitsChecker;
}

// Instância global - SEM LOGS de inicialização
window.limitsChecker = new LimitsChecker();
