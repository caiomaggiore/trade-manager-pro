/**
 * @class DataAnalyzer
 * @description Realiza análises de dados de trading, como cálculo de indicadores e detecção de sinais.
 * A classe é projetada para ser instanciada com uma função de logging para facilitar o debug.
 */
class DataAnalyzer {
    /**
     * @param {function} logFunction - A função a ser usada para logging.
     */
    constructor(logFunction) {
        this.cache = {};
        this.processingQueue = [];
        this.isProcessing = false;
        
        // Armazena a função de log fornecida
        this.log = logFunction || ((message, level) => console.log(`[${level}][DataAnalyzer] ${message}`));

        this.log('Inicializando analisador de dados', 'DEBUG');

        // Expor métodos para a API global, se necessário (pode ser removido no futuro)
        window.TRADE_ANALYZER_API = {
            analyze: this.analyze.bind(this),
            getAnalysisResult: this.getAnalysisResult.bind(this),
            clearCache: this.clearCache.bind(this)
        };

        this.log('API do analisador de dados exposta', 'DEBUG');
    }

    /**
     * Adiciona uma solicitação de análise à fila de processamento.
     * @param {object} data - Os dados a serem analisados (ex: { candles, symbol }).
     * @param {object} options - Opções para a análise (ex: { forceReanalysis }).
     * @returns {Promise<object>} O resultado da análise.
     */
    async analyze(data, options = {}) {
        try {
            if (!data || !Array.isArray(data.candles) || data.candles.length === 0) {
                throw new Error('Dados inválidos para análise');
            }

            const symbol = data.symbol || 'unknown';
            const dataSignature = `${symbol}_${data.candles.length}_${data.candles[0].time}_${data.candles[data.candles.length - 1].time}`;

            if (this.cache[dataSignature] && !options.forceReanalysis) {
                this.log(`Usando resultado em cache para ${symbol}`, 'DEBUG');
                return this.cache[dataSignature];
            }

            return new Promise((resolve, reject) => {
                this.processingQueue.push({
                    data,
                    options,
                    dataSignature,
                    resolve,
                    reject
                });

                if (!this.isProcessing) {
                    this.processQueue();
                }
            });
        } catch (error) {
            this.log(`Erro ao adicionar análise à fila: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Processa a fila de análises de forma sequencial.
     */
    async processQueue() {
        if (this.processingQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const job = this.processingQueue.shift();

        try {
            this.log(`Processando análise para ${job.data.symbol || 'desconhecido'}`, 'DEBUG');
            const result = await this.performAnalysis(job.data, job.options);
            this.cache[job.dataSignature] = result;
            this.manageCacheSize();
            job.resolve(result);
        } catch (error) {
            this.log(`Erro na análise: ${error.message}`, 'ERROR');
            job.reject(error);
        } finally {
            setTimeout(() => this.processQueue(), 10);
        }
    }

    /**
     * Executa os cálculos de análise nos dados fornecidos.
     * @param {object} data - Os dados dos candles.
     * @param {object} options - As opções de análise.
     * @returns {Promise<object>} O objeto com os resultados da análise.
     */
    async performAnalysis(data, options) {
        const { candles, symbol } = data;
        const result = {
            symbol,
            timestamp: Date.now(),
            indicators: {},
            signals: [],
            patterns: []
        };

        try {
            const closePrices = candles.map(c => c.close);
            
            result.indicators.sma20 = this.calculateSMA(closePrices, 20);
            result.indicators.sma50 = this.calculateSMA(closePrices, 50);
            result.indicators.sma200 = this.calculateSMA(closePrices, 200);

            this.detectSignals(result);

            return result;
        } catch (error) {
            this.log(`Erro durante a análise de ${symbol}: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Calcula a Média Móvel Simples (SMA).
     * @param {number[]} prices - Array de preços.
     * @param {number} period - O período para o cálculo da SMA.
     * @returns {number[]|null} Um array com os valores da SMA ou null se for impossível calcular.
     */
    calculateSMA(prices, period) {
        if (prices.length < period) return null;
        
        const result = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) {
                result.push(null);
                continue;
            }
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += prices[i - j];
            }
            result.push(sum / period);
        }
        return result;
    }

    /**
     * Detecta sinais de trading com base nos indicadores calculados.
     * @param {object} result - O objeto de resultado da análise para popular com sinais.
     */
    detectSignals(result) {
        try {
            const { sma20, sma50 } = result.indicators;
            if (!sma20 || !sma50) return;

            const lastIndex = sma20.length - 1;
            const prevIndex = lastIndex - 1;
            if (lastIndex < 1) return;

            if (sma20[prevIndex] < sma50[prevIndex] && sma20[lastIndex] > sma50[lastIndex]) {
                result.signals.push({
                    type: 'CROSS_ABOVE',
                    indicator1: 'SMA20',
                    indicator2: 'SMA50',
                    position: lastIndex,
                    significance: 'MEDIUM'
                });
            } else if (sma20[prevIndex] > sma50[prevIndex] && sma20[lastIndex] < sma50[lastIndex]) {
                result.signals.push({
                    type: 'CROSS_BELOW',
                    indicator1: 'SMA20',
                    indicator2: 'SMA50',
                    position: lastIndex,
                    significance: 'MEDIUM'
                });
            }
        } catch (error) {
            this.log(`Erro ao detectar sinais: ${error.message}`, 'ERROR');
        }
    }

    /**
     * Retorna um resultado de análise do cache.
     * @param {string} symbol - O símbolo do ativo.
     * @param {number} [timestamp] - Timestamp opcional para busca.
     * @returns {object|null} O resultado da análise ou null se não encontrado.
     */
    getAnalysisResult(symbol, timestamp) {
        for (const key in this.cache) {
            const result = this.cache[key];
            if (result.symbol === symbol && (!timestamp || result.timestamp === timestamp)) {
                return result;
            }
        }
        return null;
    }

    /**
     * Limpa todo o cache de análises.
     */
    clearCache() {
        this.cache = {};
        this.log('Cache de análises limpo', 'INFO');
    }
    
    /**
     * Gerencia o tamanho do cache, removendo os itens mais antigos se exceder o limite.
     */
    manageCacheSize() {
        const MAX_CACHE_ITEMS = 50;
        const cacheKeys = Object.keys(this.cache);

        if (cacheKeys.length > MAX_CACHE_ITEMS) {
            const keysToRemove = cacheKeys
                .map(key => ({ key, timestamp: this.cache[key].timestamp }))
                .sort((a, b) => a.timestamp - b.timestamp)
                .slice(0, cacheKeys.length - MAX_CACHE_ITEMS)
                .map(item => item.key);
            
            keysToRemove.forEach(key => delete this.cache[key]);
            
            this.log(`Cache de análises otimizado: ${keysToRemove.length} itens removidos`, 'DEBUG');
        }
    }
} 