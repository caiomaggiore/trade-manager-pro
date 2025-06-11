/**
 * Intelligent Gale System - Sistema Gale Inteligente
 * Integra análise local, cache e limites adaptativos para decisões de Gale mais inteligentes
 */

class IntelligentGale {
    constructor() {
        this.name = 'IntelligentGale';
        this.version = '1.0.0';
        
        // Estado do sistema Gale
        this.state = {
            level: 0,
            originalValue: 10,
            currentValue: 10,
            active: false,
            consecutiveLosses: 0,
            lastAnalysisConfidence: 0,
            adaptiveMultiplier: 1.2,
            riskLevel: 'normal' // low, normal, high, critical
        };
        
        // Configurações inteligentes
        this.config = {
            // Multiplicadores baseados em confiança
            multipliers: {
                highConfidence: 1.15,    // >80% confiança
                normalConfidence: 1.25,  // 60-80% confiança
                lowConfidence: 1.35,     // 40-60% confiança
                veryLowConfidence: 1.5   // <40% confiança
            },
            
            // Limites adaptativos
            limits: {
                maxLevelLowRisk: 5,     // Risco baixo
                maxLevelNormalRisk: 3,  // Risco normal
                maxLevelHighRisk: 2,    // Risco alto
                maxLevelCriticalRisk: 1 // Risco crítico
            },
            
            // Condições de mercado
            marketConditions: {
                stableMultiplier: 1.0,   // Mercado estável
                volatileMultiplier: 1.2, // Mercado volátil
                trendingMultiplier: 0.9  // Mercado com tendência clara
            },
            
            // Cache hit rate influence
            cacheInfluence: {
                highHitRate: 0.9,        // >70% hit rate = reduzir risco
                normalHitRate: 1.0,      // 40-70% hit rate = normal
                lowHitRate: 1.1          // <40% hit rate = aumentar cautelar
            }
        };
        
        // Referências para integração com outros módulos
        this.modules = {
            localDetector: null,
            cacheAnalyzer: null,
            limitsChecker: null,
            classicGale: null
        };
        
        // Dependências dos outros módulos
        this.dependencies = {};
        
        // Lista de listeners para eventos
        this.listeners = [];
        
        this.init();
    }
    
    init() {
        // Log de inicialização removido
        
        // Integrar com outros módulos
        this.integrateWithModules();
        
        // Configurar listeners
        this.setupListeners();
        
        // Log de sucesso removido
    }
    
    /**
     * Integra com Local Pattern Detector, Cache Analyzer e Limits Checker
     */
    integrateWithModules() {
        // Verificar disponibilidade dos módulos
        this.modules = {
            localDetector: window.localPatternDetector || null,
            cacheAnalyzer: window.cacheAnalyzer || null,
            limitsChecker: window.limitsChecker || null,
            classicGale: window.GaleSystem || null
        };
        
        // Log de módulos disponíveis
        Object.keys(this.modules).forEach(module => {
            let available = this.modules[module] !== null;
            if (module in window) {
                available = true;
                this.dependencies[module] = window[module];
            }
            
            // Log de debug removido para performance
        });
    }
    
    /**
     * Configura listeners para eventos dos outros módulos
     */
    setupListeners() {
        // Listener para resultados de análise
        document.addEventListener('analysisResult', (event) => {
            this.handleAnalysisResult(event.detail);
        });
        
        // Listener para operações completadas
        document.addEventListener('operationResult', (event) => {
            this.handleOperationResult(event.detail);
        });
    }
    
    /**
     * Processa resultado da análise para ajustar parâmetros
     */
    handleAnalysisResult(analysisData) {
        if (!analysisData) return;
        
        // Armazenar análise processada
        this.state.lastAnalysisConfidence = analysisData.trust || analysisData.confidence || 0;
        this.updateRiskLevel();
        
        // Log operacional removido para performance
        this.notifyListeners('analysis_processed', { confidence: this.state.lastAnalysisConfidence, risk: this.state.riskLevel });
    }
    
    /**
     * Processa resultado da operação (win/loss)
     */
    handleOperationResult(operationData) {
        if (!operationData) return;
        
        const success = operationData.success;
        
        if (success) {
            // Ganhou - resetar Gale
            this.reset('Operation won');
        } else {
            // Perdeu - aplicar Gale inteligente
            this.applyIntelligentGale(operationData);
        }
    }
    
    /**
     * Atualiza nível de risco baseado em múltiplos fatores
     */
    updateRiskLevel() {
        let riskScore = 0;
        
        // Fator 1: Confiança da análise
        const confidence = this.state.lastAnalysisConfidence;
        if (confidence < 40) riskScore += 3;
        else if (confidence < 60) riskScore += 2;
        else if (confidence < 80) riskScore += 1;
        // >80% não adiciona risco
        
        // Fator 2: Análise local
        if (this.modules.localDetector) {
            const localConf = this.modules.localDetector.getConfidence() || 0;
            if (localConf < 50) riskScore += 2;
            else if (localConf < 70) riskScore += 1;
        }
        
        // Fator 3: Cache hit rate (se disponível)
        if (this.modules.cacheAnalyzer) {
            const stats = this.modules.cacheAnalyzer.getStats();
            const hitRate = stats.hitRate || 0;
            if (hitRate < 40) riskScore += 1;
            else if (hitRate > 70) riskScore -= 1;
        }
        
        // Fator 4: Perdas consecutivas
        if (this.state.consecutiveLosses >= 3) riskScore += 2;
        else if (this.state.consecutiveLosses >= 2) riskScore += 1;
        
        // Determinar nível de risco
        if (riskScore <= 0) this.state.riskLevel = 'low';
        else if (riskScore <= 2) this.state.riskLevel = 'normal';
        else if (riskScore <= 4) this.state.riskLevel = 'high';
        else this.state.riskLevel = 'critical';
        
        // Log detalhado
        // Log de risk score removido para performance
    }
    
    /**
     * Aplica Gale inteligente baseado em contexto
     */
    applyIntelligentGale(operationData) {
        this.state.consecutiveLosses++;
        this.state.level++;
        
        // Verificar se deve continuar com Gale
        if (!this.shouldContinueGale()) {
            this.notifyListeners('gale_stopped', {
                reason: 'Risk too high or limit reached',
                level: this.state.level,
                riskLevel: this.state.riskLevel
            });
            return this.reset('Risk limit reached');
        }
        
        // Calcular multiplicador inteligente
        const intelligentMultiplier = this.calculateIntelligentMultiplier();
        
        // Calcular novo valor
        const newValue = this.calculateNewValue(intelligentMultiplier);
        
        // Atualizar estado
        this.state.currentValue = newValue;
        this.state.active = true;
        this.state.adaptiveMultiplier = intelligentMultiplier;
        
        // Log detalhado
        // Log importante de aplicação Gale
        if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: 'addLog',
                logMessage: `Gale Inteligente aplicado - Nível: ${this.state.level}, Valor: ${this.state.currentValue}, Risco: ${this.state.riskLevel}`,
                logLevel: 'INFO',
                logSource: 'intelligent-gale.js'
            });
        }
        
        // Notificar listeners
        this.notifyListeners('gale_applied', {
            level: this.state.level,
            value: this.state.currentValue,
            multiplier: intelligentMultiplier,
            riskLevel: this.state.riskLevel,
            confidence: this.state.lastAnalysisConfidence
        });
        
        // Integrar com sistema clássico se disponível
        if (this.modules.classicGale) {
            this.modules.classicGale.setIntelligentValue(newValue, intelligentMultiplier);
        }
        
        return {
            success: true,
            level: this.state.level,
            value: newValue,
            multiplier: intelligentMultiplier,
            riskLevel: this.state.riskLevel
        };
    }
    
    /**
     * Verifica se deve continuar com Gale baseado em risco
     */
    shouldContinueGale() {
        const maxLevel = this.config.limits[`maxLevel${this.state.riskLevel.charAt(0).toUpperCase() + this.state.riskLevel.slice(1)}Risk`];
        
        if (this.state.level >= maxLevel) {
            // Log crítico de limite atingido
            if (chrome && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: `Limite Gale atingido para risco ${this.state.riskLevel}: ${this.state.level}/${maxLevel}`,
                    logLevel: 'WARN',
                    logSource: 'intelligent-gale.js'
                });
            }
            return false;
        }
        
        // Verificar com Limits Checker se disponível
        if (this.modules.limitsChecker) {
            const status = this.modules.limitsChecker.getStatus();
            if (!status.isActive || status.shouldStop) {
                // Log crítico removido para performance
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Calcula multiplicador inteligente baseado em contexto
     */
    calculateIntelligentMultiplier() {
        let baseMultiplier = 1.2; // Padrão
        
        // Ajustar por confiança da análise
        const confidence = this.state.lastAnalysisConfidence;
        if (confidence >= 80) {
            baseMultiplier = this.config.multipliers.highConfidence;
        } else if (confidence >= 60) {
            baseMultiplier = this.config.multipliers.normalConfidence;
        } else if (confidence >= 40) {
            baseMultiplier = this.config.multipliers.lowConfidence;
        } else {
            baseMultiplier = this.config.multipliers.veryLowConfidence;
        }
        
        // Ajustar por cache hit rate
        if (this.modules.cacheAnalyzer) {
            const stats = this.modules.cacheAnalyzer.getStats();
            const hitRate = stats.hitRate || 0;
            
            if (hitRate > 70) {
                baseMultiplier *= this.config.cacheInfluence.highHitRate;
            } else if (hitRate < 40) {
                baseMultiplier *= this.config.cacheInfluence.lowHitRate;
            }
        }
        
        // Ajustar por nível de risco
        switch (this.state.riskLevel) {
            case 'critical':
                baseMultiplier *= 1.4; // Mais agressivo em situação crítica
                break;
            case 'high':
                baseMultiplier *= 1.2;
                break;
            case 'low':
                baseMultiplier *= 0.9; // Mais conservador em baixo risco
                break;
        }
        
        // Limitar multiplicador
        return Math.min(Math.max(baseMultiplier, 1.1), 2.0);
    }
    
    /**
     * Calcula novo valor para operação
     */
    calculateNewValue(multiplier) {
        const newValue = this.state.currentValue * multiplier;
        
        // Aplicar limites mínimos e máximos
        const minValue = 10;
        const maxValue = 1000;
        
        return Math.min(Math.max(newValue, minValue), maxValue);
    }
    
    /**
     * Reseta o sistema Gale
     */
    reset(reason = 'Manual reset') {
        // Log de reset removido
        
        this.state.level = 0;
        this.state.currentValue = this.state.originalValue;
        this.state.active = false;
        this.state.consecutiveLosses = 0;
        this.state.riskLevel = 'normal';
        
        this.notifyListeners('gale_reset', {
            reason: reason,
            originalValue: this.state.originalValue
        });
        
        // Integrar com sistema clássico
        if (this.modules.classicGale) {
            this.modules.classicGale.resetIntelligent();
        }
        
        return {
            success: true,
            message: `Gale resetado: ${reason}`,
            value: this.state.originalValue
        };
    }
    
    /**
     * Obtém status atual do sistema
     */
    getStatus() {
        return {
            level: this.state.level,
            currentValue: this.state.currentValue,
            originalValue: this.state.originalValue,
            active: this.state.active,
            consecutiveLosses: this.state.consecutiveLosses,
            lastAnalysisConfidence: this.state.lastAnalysisConfidence,
            adaptiveMultiplier: this.state.adaptiveMultiplier,
            riskLevel: this.state.riskLevel,
            modules: Object.keys(this.modules).reduce((acc, key) => {
                acc[key] = this.modules[key] !== null;
                return acc;
            }, {})
        };
    }
    
    /**
     * Configura novo valor original
     */
    setOriginalValue(value) {
        this.state.originalValue = Math.max(value, 10);
        if (!this.state.active) {
            this.state.currentValue = this.state.originalValue;
        }
        
        // Log debug removido
    }
    
    /**
     * Adiciona listener para eventos
     */
    addListener(callback) {
        this.listeners.add(callback);
    }
    
    /**
     * Remove listener
     */
    removeListener(callback) {
        this.listeners.delete(callback);
    }
    
    /**
     * Notifica todos os listeners
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('[IntelligentGale] Erro no listener:', error);
            }
        });
        
        // Enviar também via chrome.runtime para outros módulos
        try {
            chrome.runtime.sendMessage({
                action: 'INTELLIGENT_GALE_EVENT',
                event: event,
                data: data,
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('[IntelligentGale] Erro ao enviar evento via runtime:', error);
        }
    }
    
    /**
     * Força aplicação de Gale para testes
     */
    forceApply(multiplier = 1.25) {
        // Log de teste removido
        return this.applyGale(multiplier);
    }
    
    /**
     * Obtém recomendação de valor para próxima operação
     */
    getRecommendedValue(analysisData = {}) {
        if (!this.state.active) {
            return this.state.originalValue;
        }
        
        // Atualizar contexto se nova análise disponível
        if (analysisData.trust || analysisData.confidence) {
            this.handleAnalysisResult(analysisData);
        }
        
        return this.state.currentValue;
    }
    
    /**
     * Obtém estatísticas do sistema
     */
    getStats() {
        const cacheStats = this.modules.cacheAnalyzer ? this.modules.cacheAnalyzer.getStats() : {};
        const limitsStatus = this.modules.limitsChecker ? this.modules.limitsChecker.getStatus() : {};
        
        return {
            gale: this.getStatus(),
            cache: cacheStats,
            limits: limitsStatus,
            integration: {
                localDetector: !!this.modules.localDetector,
                cacheAnalyzer: !!this.modules.cacheAnalyzer,
                limitsChecker: !!this.modules.limitsChecker,
                classicGale: !!this.modules.classicGale
            }
        };
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.IntelligentGale = IntelligentGale;
}

// Criar instância global - SEM LOGS de inicialização
window.intelligentGale = new IntelligentGale(); 