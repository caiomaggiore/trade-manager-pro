/**
 * ====================================================================
 * CACHE ANALYZER - Sistema de Cache Inteligente para Análises
 * ====================================================================
 * 
 * Gerencia cache de análises para evitar:
 * - Análises repetitivas da IA (economia de tokens)
 * - Reprocessamento desnecessário
 * - Perda de dados de análises anteriores
 * - Sobrecarga do sistema
 */

class CacheAnalyzer {
    constructor() {
        this.caches = {
            // Cache de análises da IA (mais valioso)
            aiAnalysis: new Map(),
            
            // Cache de análises locais (detecção de padrões)
            localAnalysis: new Map(),
            
            // Cache de configurações utilizadas
            configs: new Map(),
            
            // Cache de resultados de operações
            operations: new Map()
        };
        
        // Configurações do cache
        this.config = {
            maxEntries: {
                aiAnalysis: 20,      // Máximo 20 análises da IA
                localAnalysis: 50,   // Máximo 50 análises locais
                configs: 10,         // Máximo 10 configurações
                operations: 100      // Máximo 100 operações
            },
            ttl: {
                aiAnalysis: 5 * 60 * 1000,     // 5 minutos para IA
                localAnalysis: 2 * 60 * 1000,  // 2 minutos para local
                configs: 30 * 60 * 1000,       // 30 minutos para configs
                operations: 60 * 60 * 1000     // 1 hora para operações
            },
            similarityThreshold: 0.85  // 85% de similaridade para considerar igual
        };
        
        this.stats = {
            hits: 0,
            misses: 0,
            totalSaved: 0,
            tokensSaved: 0
        };
        
        this.initializeStats();
        this.initializeCleanupScheduler();
        
        this.loadCache();
        
        // Log de inicialização removido para performance
        this.scheduleAutomaticCleanup();
    }

    /**
     * ANÁLISES DA IA - Cache Principal
     */
    
    /**
     * Busca análise da IA no cache
     * @param {string} imageHash - Hash da imagem
     * @param {Object} context - Contexto da análise (configurações, etc.)
     * @returns {Object|null} Análise em cache ou null
     */
    getAIAnalysis(imageHash, context = {}) {
        const cacheKey = this.generateAIAnalysisKey(imageHash, context);
        const cached = this.caches.aiAnalysis.get(cacheKey);
        
        if (cached && this.isValid(cached, 'aiAnalysis')) {
            this.stats.hits++;
            this.stats.tokensSaved += this.estimateTokensSaved(cached);
            
            // Log importante de cache hit - versão simplificada
            if (chrome && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: `Cache HIT - Tokens salvos: ${this.estimateTokensSaved(cached)}`,
                    logLevel: 'DEBUG',
                    logSource: 'cache-analyzer.js'
                });
            }
            
            return cached.data;
        }
        
        this.stats.misses++;
        return null;
    }

    /**
     * Armazena análise da IA no cache
     * @param {string} imageHash - Hash da imagem
     * @param {Object} context - Contexto da análise
     * @param {Object} analysis - Resultado da análise da IA
     * @param {number} tokensUsed - Tokens utilizados na análise
     */
    setAIAnalysis(imageHash, context, analysis, tokensUsed = 0) {
        const cacheKey = this.generateAIAnalysisKey(imageHash, context);
        
        const cacheEntry = {
            key: cacheKey,
            data: analysis,
            timestamp: Date.now(),
            imageHash,
            context: this.sanitizeContext(context),
            tokensUsed,
            hits: 0
        };
        
        this.caches.aiAnalysis.set(cacheKey, cacheEntry);
        this.manageCacheSize('aiAnalysis');
    }

    /**
     * ANÁLISES LOCAIS - Cache Secundário
     */
    
    /**
     * Busca análise local no cache
     */
    getLocalAnalysis(imageHash) {
        const cached = this.caches.localAnalysis.get(imageHash);
        
        if (cached && this.isValid(cached, 'localAnalysis')) {
            this.stats.hits++;
            cached.hits++;
            return cached.data;
        }
        
        this.stats.misses++;
        return null;
    }

    /**
     * Armazena análise local no cache
     */
    setLocalAnalysis(imageHash, analysis) {
        const cacheEntry = {
            key: imageHash,
            data: analysis,
            timestamp: Date.now(),
            hits: 0
        };
        
        this.caches.localAnalysis.set(imageHash, cacheEntry);
        this.manageCacheSize('localAnalysis');
    }

    /**
     * CACHE DE CONFIGURAÇÕES
     */
    
    /**
     * Busca configuração no cache
     */
    getConfigCache(configHash) {
        const cached = this.caches.configs.get(configHash);
        
        if (cached && this.isValid(cached, 'configs')) {
            return cached.data;
        }
        
        return null;
    }

    /**
     * Armazena configuração no cache
     */
    setConfigCache(configHash, config) {
        const cacheEntry = {
            key: configHash,
            data: config,
            timestamp: Date.now()
        };
        
        this.caches.configs.set(configHash, cacheEntry);
        this.manageCacheSize('configs');
    }

    /**
     * CACHE DE OPERAÇÕES
     */
    
    /**
     * Armazena resultado de operação
     */
    storeOperationResult(operationId, result) {
        const cacheEntry = {
            key: operationId,
            data: result,
            timestamp: Date.now()
        };
        
        this.caches.operations.set(operationId, cacheEntry);
        this.manageCacheSize('operations');
    }

    /**
     * Busca resultados de operações similares
     */
    findSimilarOperations(criteria) {
        const results = [];
        
        for (const entry of this.caches.operations.values()) {
            if (this.isValid(entry, 'operations')) {
                const similarity = this.calculateOperationSimilarity(criteria, entry.data);
                if (similarity >= this.config.similarityThreshold) {
                    results.push({
                        operation: entry.data,
                        similarity,
                        age: Date.now() - entry.timestamp
                    });
                }
            }
        }
        
        return results.sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * UTILITÁRIOS DE CACHE
     */
    
    /**
     * Gera chave única para análise da IA
     */
    generateAIAnalysisKey(imageHash, context) {
        const contextStr = JSON.stringify({
            automation: context.automation || false,
            galeActive: context.galeActive || false,
            marketCondition: context.marketCondition || 'normal',
            strategy: context.strategy || 'default'
        });
        
        return `ai_${imageHash}_${this.hashString(contextStr)}`;
    }

    /**
     * Sanitiza contexto para armazenamento
     */
    sanitizeContext(context) {
        return {
            automation: context.automation || false,
            galeActive: context.galeActive || false,
            marketCondition: context.marketCondition || 'normal',
            strategy: context.strategy || 'default',
            timestamp: Date.now()
        };
    }

    /**
     * Verifica se entrada do cache ainda é válida
     */
    isValid(cacheEntry, cacheType) {
        const age = Date.now() - cacheEntry.timestamp;
        const ttl = this.config.ttl[cacheType];
        
        return age < ttl;
    }

    /**
     * Gerencia tamanho do cache removendo entradas antigas
     */
    manageCacheSize(cacheType) {
        const cache = this.caches[cacheType];
        const maxEntries = this.config.maxEntries[cacheType];
        
        if (cache.size > maxEntries) {
            // Remover entradas mais antigas
            const entries = Array.from(cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const toRemove = entries.slice(0, cache.size - maxEntries);
            toRemove.forEach(([key]) => cache.delete(key));
            
            // Log de limpeza removido
        }
    }

    /**
     * Estima tokens salvos por usar cache
     */
    estimateTokensSaved(cacheEntry) {
        // Estimativa baseada no tipo e complexidade da análise
        const baseTokens = 500; // Prompt base
        const imageTokens = 1000; // Processamento de imagem
        const contextTokens = cacheEntry.context ? 200 : 0;
        
        return baseTokens + imageTokens + contextTokens;
    }

    /**
     * Calcula similaridade entre operações
     */
    calculateOperationSimilarity(criteria, operation) {
        let score = 0;
        let factors = 0;
        
        // Comparar fatores relevantes
        if (criteria.symbol === operation.symbol) {
            score += 0.3;
        }
        factors += 0.3;
        
        if (criteria.timeframe === operation.timeframe) {
            score += 0.2;
        }
        factors += 0.2;
        
        if (Math.abs(criteria.amount - operation.amount) < 5) {
            score += 0.2;
        }
        factors += 0.2;
        
        // Proximidade temporal (operações recentes são mais relevantes)
        const timeDiff = Math.abs(criteria.timestamp - operation.timestamp);
        const timeScore = Math.max(0, 1 - (timeDiff / (60 * 60 * 1000))); // 1 hora = score 0
        score += timeScore * 0.3;
        factors += 0.3;
        
        return factors > 0 ? score / factors : 0;
    }

    /**
     * MÉTODOS DE LIMPEZA E MANUTENÇÃO
     */
    
    /**
     * Inicializa agendador de limpeza automática
     */
    initializeCleanupScheduler() {
        // Limpeza a cada 10 minutos
        setInterval(() => {
            this.cleanupExpiredEntries();
        }, 10 * 60 * 1000);
        
        // Limpeza inicial após 1 minuto
        setTimeout(() => {
            this.cleanupExpiredEntries();
        }, 60 * 1000);
    }

    /**
     * Remove entradas expiradas de todos os caches
     */
    cleanupExpiredEntries() {
        let totalCleaned = 0;
        
        for (const [cacheType, cache] of Object.entries(this.caches)) {
            const sizeBefore = cache.size;
            
            for (const [key, entry] of cache.entries()) {
                if (!this.isValid(entry, cacheType)) {
                    cache.delete(key);
                }
            }
            
            const sizeAfter = cache.size;
            const cleaned = sizeBefore - sizeAfter;
            totalCleaned += cleaned;
            
            if (cleaned > 0) {
                // Log de limpeza removido
            }
        }
        
        // Log total de limpeza removido
    }

    /**
     * Limpa completamente todos os caches
     */
    clearAllCaches() {
        for (const cache of Object.values(this.caches)) {
            cache.clear();
        }
        
        this.stats = {
            hits: 0,
            misses: 0,
            totalSaved: 0,
            tokensSaved: 0
        };
        
        // Log de limpeza removido
    }

    /**
     * Limpa cache específico
     */
    clearCache(cacheType) {
        if (this.caches[cacheType]) {
            this.caches[cacheType].clear();
            // Log específico removido
        }
    }

    /**
     * MÉTODOS DE ESTATÍSTICAS E MONITORAMENTO
     */
    
    /**
     * Retorna estatísticas do cache
     */
    getStats() {
        const totalEntries = Object.values(this.caches).reduce((sum, cache) => sum + cache.size, 0);
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
            : 0;
        
        return {
            totalEntries,
            hitRate: `${hitRate}%`,
            hits: this.stats.hits,
            misses: this.stats.misses,
            tokensSaved: this.stats.tokensSaved,
            cacheDetails: Object.fromEntries(
                Object.entries(this.caches).map(([type, cache]) => [type, cache.size])
            )
        };
    }

    /**
     * Exporta dados do cache para backup
     */
    exportCache() {
        const exportData = {};
        
        for (const [cacheType, cache] of Object.entries(this.caches)) {
            exportData[cacheType] = Array.from(cache.entries());
        }
        
        return {
            version: '1.0',
            timestamp: Date.now(),
            data: exportData,
            stats: this.stats
        };
    }

    /**
     * Importa dados do cache de backup
     */
    importCache(backupData) {
        try {
            if (backupData.version !== '1.0') {
                throw new Error('Versão do backup incompatível');
            }
            
            for (const [cacheType, entries] of Object.entries(backupData.data)) {
                if (this.caches[cacheType]) {
                    this.caches[cacheType] = new Map(entries);
                }
            }
            
            if (backupData.stats) {
                this.stats = { ...this.stats, ...backupData.stats };
            }
            
            // Log de importação removido
            return true;
            
        } catch (error) {
            // Log de erro mantido por ser crítico
            if (chrome && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: `Erro ao importar cache: ${error.message}`,
                    logLevel: 'ERROR',
                    logSource: 'cache-analyzer.js'
                });
            }
            return false;
        }
    }

    /**
     * UTILITÁRIOS GERAIS
     */
    
    /**
     * Gera hash simples de uma string
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converter para 32bit
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Log de status do cache
     */
    logStatus() {
        // Log de status removido para performance
        return this.getStats();
    }

    /**
     * Carrega cache do storage local
     */
    loadCache() {
        // Método implementado para compatibilidade
        try {
            // Cache será inicializado em memória
            // Implementação futura: carregar do chrome.storage se necessário
            console.log('[CacheAnalyzer] Cache inicializado em memória');
        } catch (error) {
            console.error('[CacheAnalyzer] Erro ao carregar cache:', error);
        }
    }
    
    /**
     * Salva cache no storage local
     */
    saveCache(cacheType) {
        // Método implementado para compatibilidade
        try {
            // Implementação futura: salvar no chrome.storage se necessário
        } catch (error) {
            console.error('[CacheAnalyzer] Erro ao salvar cache:', error);
        }
    }
    
    /**
     * Salva todos os caches
     */
    saveAllCaches() {
        Object.keys(this.caches).forEach(cacheType => {
            this.saveCache(cacheType);
        });
    }

    /**
     * Inicializa estatísticas do cache
     */
    initializeStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            tokensSaved: 0,
            hitRate: 0
        };
    }

    /**
     * Agenda limpeza automática do cache
     */
    scheduleAutomaticCleanup() {
        // Limpeza automática a cada 5 minutos
        setInterval(() => {
            this.cleanupExpiredEntries();
        }, 5 * 60 * 1000);
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.CacheAnalyzer = CacheAnalyzer;
}

// Instância global - SEM LOGS de inicialização
window.cacheAnalyzer = new CacheAnalyzer(); 