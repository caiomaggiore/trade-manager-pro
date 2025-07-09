/**
 * ====================================================================
 * LOCAL INTELLIGENCE - Sistema de Inteligência Local
 * ====================================================================
 * 
 * ECONOMIA DE TOKENS: Faz decisões inteligentes ANTES de chamar a IA
 * USA HISTÓRICO EXISTENTE: Aproveita dados do trade-history.js
 * HISTÓRICO MENTAL: 5 análises preliminares para criar base interna
 * ANÁLISE DE VOLATILIDADE: Teste local antes de gastar tokens
 * CONFIGURAÇÕES UNIFICADAS: Usa payoutBehavior para todos cenários
 */

class LocalIntelligence {
    constructor() {
        this.name = 'LocalIntelligence';
        this.version = '2.0.0';
        
        // Base de dados local (usando localStorage existente)
        this.database = {
            operations: [],
            patterns: new Map(),
            performance: new Map(),
            assets: new Map(),
            mentalHistory: [], // NOVO: Histórico "mental" das primeiras análises
            volatilityCache: new Map() // NOVO: Cache de volatilidade por ativo
        };
        
        // Configurações de filtros
        this.filters = {
            minimumDataPoints: 5,        // Mínimo de operações para decisão
            confidenceThreshold: 0.6,    // 60% de confiança mínima
            recentOperationsWindow: 20,  // Últimas 20 operações
            assetPerformanceWindow: 10,  // Últimas 10 operações por ativo
            mentalHistorySize: 5,        // NOVO: Tamanho do histórico mental
            volatilityThreshold: 0.7     // NOVO: Threshold de volatilidade (0-1)
        };
        
        // Contadores para análises preliminares
        this.preliminaryAnalyses = {
            count: 0,
            maxCount: 5,
            isInPreliminaryMode: true
        };
        
        // Métricas de economia de tokens
        this.tokenSavings = {
            callsAvoided: 0,
            tokensEstimatedSaved: 0,
            decisionsLocal: 0,
            volatilityChecks: 0,
            mentalAnalyses: 0
        };
        
        this.init();
    }
    
    init() {
        this.loadExistingData();
        this.setupEventListeners();
        this.log('Sistema de Inteligência Local v2.0 inicializado', 'SUCCESS');
    }
    
    // =================== MÉTODOS DE BASE DE DADOS ===================
    
    /**
     * Carrega dados existentes do localStorage
     */
    loadExistingData() {
        try {
            // Carregar operações do trade-history.js
            const savedOperations = localStorage.getItem('tradeOperations');
            if (savedOperations) {
                const rawOperations = JSON.parse(savedOperations);
                this.log(`Encontradas ${rawOperations.length} operações brutas no localStorage`, 'INFO');
                
                // Processar e validar operações
                this.database.operations = rawOperations.filter(op => {
                    // Validar campos obrigatórios
                    if (!op.symbol || !op.timestamp || op.status === undefined) {
                        this.log(`Operação inválida ignorada: ${JSON.stringify(op)}`, 'DEBUG');
                        return false;
                    }
                    return true;
                });
                
                this.log(`${this.database.operations.length} operações válidas carregadas`, 'INFO');
                this.processHistoricalData();
            } else {
                this.log('Nenhuma operação encontrada no localStorage', 'INFO');
            }
            
            // Carregar padrões salvos
            const savedPatterns = localStorage.getItem('localIntelligencePatterns');
            if (savedPatterns) {
                const patterns = JSON.parse(savedPatterns);
                this.database.patterns = new Map(patterns);
                this.log(`Carregados ${this.database.patterns.size} padrões identificados`, 'INFO');
            }
            
            // NOVO: Carregar histórico mental
            const savedMentalHistory = localStorage.getItem('mentalHistory');
            if (savedMentalHistory) {
                this.database.mentalHistory = JSON.parse(savedMentalHistory);
                this.log(`Carregado histórico mental com ${this.database.mentalHistory.length} análises`, 'INFO');
            }
            
            // NOVO: Carregar cache de volatilidade
            const savedVolatilityCache = localStorage.getItem('volatilityCache');
            if (savedVolatilityCache) {
                const volatilityData = JSON.parse(savedVolatilityCache);
                this.database.volatilityCache = new Map(volatilityData);
                this.log(`Carregado cache de volatilidade com ${this.database.volatilityCache.size} ativos`, 'INFO');
            }
            
            // Verificar se ainda está em modo preliminar
            this.preliminaryAnalyses.count = this.database.mentalHistory.length;
            this.preliminaryAnalyses.isInPreliminaryMode = this.preliminaryAnalyses.count < this.preliminaryAnalyses.maxCount;
            
        } catch (error) {
            this.log(`Erro ao carregar dados: ${error.message}`, 'ERROR');
        }
    }
    
    /**
     * Processa dados históricos para extrair padrões
     */
    processHistoricalData() {
        this.log(`Processando ${this.database.operations.length} operações históricas`, 'INFO');
        
        if (this.database.operations.length === 0) {
            this.log('Nenhuma operação encontrada para processar', 'WARN');
            return;
        }
        
        // Analisar performance por ativo (sempre executar, mesmo com poucos dados)
        this.analyzeAssetPerformance();
        
        // Analisar padrões temporais
        this.analyzeTemporalPatterns();
        
        // Analisar sequências de win/loss
        this.analyzeWinLossPatterns();
        
        // NOVO: Analisar volatilidade por ativo
        this.analyzeAssetVolatility();
        
        this.log(`Processamento concluído: ${this.database.assets.size} ativos, ${this.database.volatilityCache.size} com volatilidade`, 'SUCCESS');
    }
    
    analyzeAssetPerformance() {
        const assetStats = new Map();
        
        this.log(`Analisando ${this.database.operations.length} operações para extrair performance por ativo`, 'DEBUG');
        
        this.database.operations
            .filter(op => op.symbol || op.asset) // Aceitar qualquer operação com símbolo
            .forEach(operation => {
                const symbol = operation.symbol || operation.asset;
                
                // Pular operações com status "Open" - são apenas ordens abertas
                if (operation.status === 'Open' || operation.status === 'OPEN') {
                    return;
                }
                
                if (!assetStats.has(symbol)) {
                    assetStats.set(symbol, {
                        total: 0,
                        wins: 0,
                        losses: 0,
                        avgProfit: 0,
                        lastSeen: 0,
                        profitSum: 0,
                        volatilityScore: 0 // NOVO: Score de volatilidade
                    });
                }
                
                const stats = assetStats.get(symbol);
                stats.total++;
                
                // Verificar diferentes campos para determinar sucesso
                const isSuccess = operation.success || 
                                operation.status === 'GANHOU' || 
                                operation.status === 'win' || 
                                operation.status === 'WIN' || 
                                operation.result === 'win' ||
                                operation.result === 'WIN' ||
                                operation.outcome === 'win' ||
                                operation.outcome === 1;
                
                const isLoss = operation.status === 'PERDEU' || 
                              operation.status === 'loss' || 
                              operation.status === 'LOSS' || 
                              operation.result === 'loss' ||
                              operation.result === 'LOSS' ||
                              operation.outcome === 'loss' ||
                              operation.outcome === 0;
                
                if (isSuccess) {
                    stats.wins++;
                    stats.profitSum += parseFloat(operation.profit || operation.amount || 0);
                } else if (isLoss) {
                    stats.losses++;
                }
                
                stats.lastSeen = Math.max(stats.lastSeen, operation.timestamp || Date.now());
                stats.winRate = stats.wins / stats.total;
                stats.avgProfit = stats.profitSum / stats.wins || 0;
                
                this.log(`Ativo ${symbol}: ${stats.total} ops, ${(stats.winRate * 100).toFixed(1)}% win rate (${stats.wins}W/${stats.losses}L)`, 'DEBUG');
            });
        
        this.database.assets = assetStats;
        this.log(`Analisados ${assetStats.size} ativos diferentes`, 'INFO');
    }
    
    analyzeTemporalPatterns() {
        const hourlyStats = new Map();
        
        this.database.operations
            .filter(op => op.timestamp) // Aceitar qualquer operação com timestamp
            .forEach(operation => {
                const hour = new Date(operation.timestamp).getHours();
                if (!hourlyStats.has(hour)) {
                    hourlyStats.set(hour, { total: 0, wins: 0 });
                }
                
                const stats = hourlyStats.get(hour);
                stats.total++;
                
                // Verificar diferentes campos para determinar sucesso
                const isSuccess = operation.success || 
                                operation.status === 'win' || 
                                operation.status === 'WIN' || 
                                operation.result === 'win' ||
                                operation.result === 'WIN' ||
                                operation.outcome === 'win' ||
                                operation.outcome === 1;
                
                if (isSuccess) stats.wins++;
                stats.winRate = stats.wins / stats.total;
            });
        
        this.database.patterns.set('hourlyPerformance', Array.from(hourlyStats.entries()));
    }
    
    analyzeWinLossPatterns() {
        if (this.database.operations.length < 5) return; // Reduzir requisito mínimo
        
        const recentOps = this.database.operations
            .filter(op => op.timestamp) // Aceitar qualquer operação com timestamp
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20);
        
        // Analisar streaks
        let currentStreak = 0;
        let lastResult = null;
        let maxWinStreak = 0;
        let maxLossStreak = 0;
        
        recentOps.reverse().forEach(op => {
            // Verificar diferentes campos para determinar sucesso
            const isSuccess = op.success || 
                            op.status === 'win' || 
                            op.status === 'WIN' || 
                            op.result === 'win' ||
                            op.result === 'WIN' ||
                            op.outcome === 'win' ||
                            op.outcome === 1;
            
            if (lastResult === null) {
                currentStreak = 1;
                lastResult = isSuccess;
            } else if (lastResult === isSuccess) {
                currentStreak++;
            } else {
                if (lastResult) {
                    maxWinStreak = Math.max(maxWinStreak, currentStreak);
                } else {
                    maxLossStreak = Math.max(maxLossStreak, currentStreak);
                }
                currentStreak = 1;
                lastResult = isSuccess;
            }
        });
        
        this.database.patterns.set('recentStreaks', {
            maxWinStreak,
            maxLossStreak,
            currentStreak,
            lastResult,
            totalRecent: recentOps.length,
            recentWinRate: recentOps.filter(op => {
                return op.success || 
                       op.status === 'win' || 
                       op.status === 'WIN' || 
                       op.result === 'win' ||
                       op.result === 'WIN' ||
                       op.outcome === 'win' ||
                       op.outcome === 1;
            }).length / recentOps.length
        });
    }
    
    // =================== NOVO: ANÁLISE DE VOLATILIDADE ===================
    
    /**
     * Analisa volatilidade dos ativos baseado no histórico
     */
    analyzeAssetVolatility() {
        const volatilityData = new Map();
        
        // Agrupar operações por ativo
        const assetOps = new Map();
        this.database.operations
            .filter(op => op.symbol || op.asset) // Aceitar qualquer operação com símbolo
            .forEach(op => {
                const symbol = op.symbol || op.asset;
                if (!assetOps.has(symbol)) {
                    assetOps.set(symbol, []);
                }
                assetOps.get(symbol).push(op);
            });
        
        // Calcular volatilidade para cada ativo
        assetOps.forEach((operations, symbol) => {
            if (operations.length < 3) return;
            
            // Calcular variação de win rate em janelas de tempo
            const winRates = [];
            const windowSize = Math.min(5, operations.length);
            
            for (let i = 0; i <= operations.length - windowSize; i++) {
                const window = operations.slice(i, i + windowSize);
                const winRate = window.filter(op => {
                    return op.success || 
                           op.status === 'win' || 
                           op.status === 'WIN' || 
                           op.result === 'win' ||
                           op.result === 'WIN' ||
                           op.outcome === 'win' ||
                           op.outcome === 1;
                }).length / window.length;
                winRates.push(winRate);
            }
            
            // Calcular desvio padrão das win rates
            const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
            const variance = winRates.reduce((sum, rate) => sum + Math.pow(rate - avgWinRate, 2), 0) / winRates.length;
            const volatility = Math.sqrt(variance);
            
            volatilityData.set(symbol, {
                volatilityScore: volatility,
                avgWinRate: avgWinRate,
                isVolatile: volatility > this.filters.volatilityThreshold,
                lastUpdated: Date.now(),
                sampleSize: operations.length
            });
        });
        
        this.database.volatilityCache = volatilityData;
        this.log(`Analisada volatilidade de ${volatilityData.size} ativos`, 'INFO');
    }
    
    /**
     * Verifica volatilidade de um ativo específico
     */
    checkAssetVolatility(assetSymbol) {
        const volatilityData = this.database.volatilityCache.get(assetSymbol);
        
        if (!volatilityData) {
            return {
                isVolatile: false,
                volatilityScore: 0,
                confidence: 0.1,
                reason: 'Sem dados de volatilidade para este ativo'
            };
        }
        
        const isVolatile = volatilityData.isVolatile;
        const confidence = Math.min(volatilityData.sampleSize / 10, 1); // Confiança baseada no tamanho da amostra
        
        return {
            isVolatile,
            volatilityScore: volatilityData.volatilityScore,
            confidence,
            reason: isVolatile ? 
                `Ativo volátil: score ${volatilityData.volatilityScore.toFixed(2)}` : 
                `Ativo estável: score ${volatilityData.volatilityScore.toFixed(2)}`
        };
    }
    
    /**
     * NOVO: Análise de volatilidade em tempo real do gráfico atual
     */
    async analyzeCurrentChartVolatility() {
        try {
            this.log('Iniciando análise de volatilidade do gráfico atual', 'INFO');
            
            // 1. Capturar screenshot do gráfico atual
            const screenshot = await this.captureCurrentChart();
            if (!screenshot) {
                throw new Error('Não foi possível capturar o gráfico');
            }
            
            // 2. Analisar volatilidade através da imagem
            const volatilityAnalysis = await this.analyzeChartImageVolatility(screenshot);
            
            // 3. Obter ativo atual
            const currentAsset = await this.getCurrentAssetSymbol();
            
            // 4. Atualizar cache com dados em tempo real
            if (currentAsset && volatilityAnalysis.success) {
                this.database.volatilityCache.set(currentAsset, {
                    volatilityScore: volatilityAnalysis.volatilityScore,
                    avgWinRate: 0.5, // Valor neutro para análise em tempo real
                    isVolatile: volatilityAnalysis.isVolatile,
                    lastUpdated: Date.now(),
                    sampleSize: 1, // Análise em tempo real
                    source: 'realtime'
                });
                
                this.saveMentalHistory();
            }
            
            return {
                success: true,
                asset: currentAsset,
                ...volatilityAnalysis
            };
            
        } catch (error) {
            this.log(`Erro na análise de volatilidade em tempo real: ${error.message}`, 'ERROR');
            return {
                success: false,
                error: error.message,
                volatilityScore: 0,
                isVolatile: false
            };
        }
    }
    
    /**
     * Captura screenshot do gráfico atual usando múltiplas estratégias
     */
    async captureCurrentChart() {
        try {
            this.log('Iniciando captura de tela do gráfico', 'INFO');
            
            // Estratégia 1: Usar o módulo CaptureScreen existente
            const captureScreenResult = await this.tryCaptureScreenModule();
            if (captureScreenResult) {
                this.log('Captura bem-sucedida via módulo CaptureScreen', 'SUCCESS');
                return captureScreenResult;
            }
            
            // Estratégia 2: Usar lastCapturedImage se disponível
            const lastCaptureResult = await this.tryLastCapturedImage();
            if (lastCaptureResult) {
                this.log('Usando última imagem capturada disponível', 'SUCCESS');
                return lastCaptureResult;
            }
            
            // Estratégia 3: Disparar captura manual e aguardar
            const manualCaptureResult = await this.tryManualCaptureWait();
            if (manualCaptureResult) {
                this.log('Captura bem-sucedida após disparo manual', 'SUCCESS');
                return manualCaptureResult;
            }
            
            // Estratégia 4: Usar background script direto
            const bgCaptureResult = await this.tryBackgroundCapture();
            if (bgCaptureResult) {
                this.log('Captura bem-sucedida via background script', 'SUCCESS');
                return bgCaptureResult;
            }
            
            this.log('Todas as estratégias de captura falharam', 'WARN');
            return null;
            
        } catch (error) {
            this.log(`Erro na captura de tela: ${error.message}`, 'ERROR');
            return null;
        }
    }
    
    /**
     * Tenta captura usando o módulo CaptureScreen existente
     */
    async tryCaptureScreenModule() {
        try {
            this.log('Tentando usar módulo CaptureScreen', 'DEBUG');
            
                    // Verificar se o módulo CaptureScreen está disponível
        if (typeof window.CaptureScreen === 'undefined') {
            this.log('Módulo CaptureScreen não está disponível, tentando carregar', 'DEBUG');
            
            // Tentar carregar o módulo CaptureScreen dinamicamente
            try {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('src/content/capture-screen.js');
                script.onload = () => {
                    this.log('Módulo CaptureScreen carregado dinamicamente', 'DEBUG');
                };
                document.head.appendChild(script);
                
                // Aguardar um pouco para o módulo carregar
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Verificar se carregou
                if (typeof window.CaptureScreen === 'undefined') {
                    this.log('Falha ao carregar módulo CaptureScreen dinamicamente', 'DEBUG');
                    return null;
                }
            } catch (loadError) {
                this.log(`Erro ao carregar módulo CaptureScreen: ${loadError.message}`, 'DEBUG');
                return null;
            }
        }
            
            // Tentar função captureForAnalysis primeiro
            if (typeof window.CaptureScreen.captureForAnalysis === 'function') {
                this.log('Usando CaptureScreen.captureForAnalysis', 'DEBUG');
                const result = await window.CaptureScreen.captureForAnalysis();
                if (result && typeof result === 'string') {
                    // Salvar timestamp da captura
                    localStorage.setItem('lastCaptureTimestamp', Date.now().toString());
                    return result;
                }
            }
            
            // Tentar função captureScreenSimple como fallback
            if (typeof window.CaptureScreen.captureScreenSimple === 'function') {
                this.log('Usando CaptureScreen.captureScreenSimple', 'DEBUG');
                const result = await window.CaptureScreen.captureScreenSimple();
                if (result && typeof result === 'string') {
                    // Salvar timestamp da captura
                    localStorage.setItem('lastCaptureTimestamp', Date.now().toString());
                    return result;
                }
            }
            
            this.log('Nenhuma função de captura disponível no CaptureScreen', 'DEBUG');
            return null;
            
        } catch (error) {
            this.log(`Erro no módulo CaptureScreen: ${error.message}`, 'DEBUG');
            return null;
        }
    }
    
    /**
     * Tenta usar a última imagem capturada
     */
    async tryLastCapturedImage() {
        try {
            if (window.lastCapturedImage && typeof window.lastCapturedImage === 'string') {
                this.log('Encontrada última imagem capturada no cache', 'DEBUG');
                
                // Verificar se a imagem não é muito antiga (máximo 5 minutos)
                const imageTimestamp = localStorage.getItem('lastCaptureTimestamp');
                if (imageTimestamp) {
                    const ageMinutes = (Date.now() - parseInt(imageTimestamp)) / (1000 * 60);
                    if (ageMinutes <= 5) {
                        return window.lastCapturedImage;
                    } else {
                        this.log(`Imagem cache muito antiga (${ageMinutes.toFixed(1)} min), ignorando`, 'DEBUG');
                    }
                } else {
                    // Se não há timestamp, usar mesmo assim
                    return window.lastCapturedImage;
                }
            }
            return null;
        } catch (error) {
            this.log(`Erro ao acessar cache de imagem: ${error.message}`, 'DEBUG');
            return null;
        }
    }
    
    /**
     * Dispara captura manual e aguarda resultado
     */
    async tryManualCaptureWait() {
        try {
            this.log('Disparando captura manual via background', 'DEBUG');
            
            // Disparar captura via background
            return new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'initiateCapture',
                    actionType: 'capture',
                    requireProcessing: true,
                    source: 'local-intelligence'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        this.log(`Erro na captura manual: ${chrome.runtime.lastError.message}`, 'DEBUG');
                        resolve(null);
                        return;
                    }
                    
                    if (response && response.dataUrl) {
                        this.log('Captura manual bem-sucedida', 'DEBUG');
                        resolve(response.dataUrl);
                    } else {
                        this.log('Captura manual falhou - sem dados', 'DEBUG');
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            this.log(`Erro na captura manual: ${error.message}`, 'DEBUG');
            return null;
        }
    }
    
    /**
     * Tenta captura via background script
     */
    async tryBackgroundCapture() {
        try {
            this.log('Tentando captura via background script', 'DEBUG');
            
            return new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'CAPTURE_VISIBLE_TAB'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        this.log(`Erro background capture: ${chrome.runtime.lastError.message}`, 'DEBUG');
                        resolve(null);
                        return;
                    }
                    
                    if (response && response.success && response.imageData) {
                        resolve(response.imageData);
                    } else {
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            this.log(`Erro na captura background: ${error.message}`, 'DEBUG');
            return null;
        }
    }
    
    /**
     * Analisa volatilidade através da imagem do gráfico
     */
    async analyzeChartImageVolatility(imageData) {
        try {
            this.log('Iniciando análise de volatilidade da imagem do gráfico', 'INFO');
            
            // Converter base64 para canvas para análise
            const analysisResult = await this.processImageForVolatility(imageData);
            
            if (!analysisResult.success) {
                throw new Error(analysisResult.error || 'Falha no processamento da imagem');
            }
            
            // Análise dos padrões visuais detectados
            const volatilityAnalysis = this.calculateVolatilityFromPatterns(analysisResult.patterns);
            
            this.log(`Análise visual concluída: Score ${volatilityAnalysis.volatilityScore.toFixed(3)}, Volátil: ${volatilityAnalysis.isVolatile}`, 'INFO');
            this.log(`Detalhes: ${volatilityAnalysis.reason}`, 'DEBUG');
            
            return {
                success: true,
                ...volatilityAnalysis,
                imageAnalysis: analysisResult.patterns
            };
            
        } catch (error) {
            this.log(`Erro na análise visual: ${error.message}`, 'ERROR');
            return {
                success: false,
                volatilityScore: 0,
                isVolatile: false,
                reason: 'Erro na análise visual: ' + error.message
            };
        }
    }
    
    /**
     * Processa imagem para extrair padrões de volatilidade
     */
    async processImageForVolatility(imageData) {
        try {
            this.log('Processando imagem para detectar padrões de volatilidade', 'DEBUG');
            
            // Criar canvas para análise
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Carregar imagem
            const image = new Image();
            const imageLoadPromise = new Promise((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = () => reject(new Error('Falha ao carregar imagem'));
            });
            
            image.src = imageData;
            await imageLoadPromise;
            
            // Configurar canvas
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
            
            // Analisar dados da imagem
            const imageAnalysis = this.analyzeImageData(ctx, canvas.width, canvas.height);
            
            return {
                success: true,
                patterns: imageAnalysis
            };
            
        } catch (error) {
            this.log(`Erro no processamento da imagem: ${error.message}`, 'ERROR');
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Analisa dados da imagem para detectar padrões
     */
    analyzeImageData(ctx, width, height) {
        try {
            this.log(`Analisando imagem ${width}x${height} pixels`, 'DEBUG');
            
            // Obter dados dos pixels
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Análise de padrões
            const patterns = {
                colorVariation: this.calculateColorVariation(data),
                edgeIntensity: this.calculateEdgeIntensity(data, width, height),
                brightnessVariation: this.calculateBrightnessVariation(data),
                linePatterns: this.detectLinePatterns(data, width, height),
                candlestickPatterns: this.detectCandlestickPatterns(data, width, height)
            };
            
            this.log(`Padrões detectados: Variação de cor: ${patterns.colorVariation.toFixed(3)}, Intensidade das bordas: ${patterns.edgeIntensity.toFixed(3)}`, 'DEBUG');
            
            return patterns;
            
        } catch (error) {
            this.log(`Erro na análise de dados da imagem: ${error.message}`, 'ERROR');
            return {
                colorVariation: 0,
                edgeIntensity: 0,
                brightnessVariation: 0,
                linePatterns: 0,
                candlestickPatterns: 0
            };
        }
    }
    
    /**
     * Calcula variação de cor na imagem
     */
    calculateColorVariation(data) {
        let totalVariation = 0;
        let pixelCount = 0;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calcular variação RGB
            const variation = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
            totalVariation += variation;
            pixelCount++;
        }
        
        return totalVariation / pixelCount / 255; // Normalizar para 0-1
    }
    
    /**
     * Calcula intensidade das bordas (detecta linhas do gráfico)
     */
    calculateEdgeIntensity(data, width, height) {
        let edgeIntensity = 0;
        let edgeCount = 0;
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                // Detectar bordas usando gradiente
                const current = data[idx];
                const right = data[idx + 4];
                const bottom = data[idx + width * 4];
                
                const gradientX = Math.abs(current - right);
                const gradientY = Math.abs(current - bottom);
                const gradient = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
                
                if (gradient > 30) { // Threshold para detectar bordas
                    edgeIntensity += gradient;
                    edgeCount++;
                }
            }
        }
        
        return edgeCount > 0 ? edgeIntensity / edgeCount / 255 : 0;
    }
    
    /**
     * Calcula variação de brilho
     */
    calculateBrightnessVariation(data) {
        const brightnesses = [];
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calcular brilho usando fórmula luminância
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            brightnesses.push(brightness);
        }
        
        // Calcular desvio padrão
        const mean = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
        const variance = brightnesses.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / brightnesses.length;
        
        return Math.sqrt(variance) / 255; // Normalizar para 0-1
    }
    
    /**
     * Detecta padrões de linhas (tendências)
     */
    detectLinePatterns(data, width, height) {
        // Simplificado: detectar linhas predominantemente horizontais vs verticais
        let horizontalLines = 0;
        let verticalLines = 0;
        
        for (let y = 0; y < height; y += 10) {
            for (let x = 0; x < width - 10; x += 10) {
                const idx = (y * width + x) * 4;
                const rightIdx = (y * width + x + 10) * 4;
                
                if (Math.abs(data[idx] - data[rightIdx]) < 20) {
                    horizontalLines++;
                }
            }
        }
        
        for (let x = 0; x < width; x += 10) {
            for (let y = 0; y < height - 10; y += 10) {
                const idx = (y * width + x) * 4;
                const bottomIdx = ((y + 10) * width + x) * 4;
                
                if (Math.abs(data[idx] - data[bottomIdx]) < 20) {
                    verticalLines++;
                }
            }
        }
        
        return horizontalLines > verticalLines ? 0.3 : 0.7; // Mais linhas verticais = mais volatilidade
    }
    
    /**
     * Detecta padrões de candlesticks
     */
    detectCandlestickPatterns(data, width, height) {
        // Simplificado: detectar variação de cores (verde/vermelho típico de candlesticks)
        let greenPixels = 0;
        let redPixels = 0;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (g > r && g > b && g > 100) {
                greenPixels++;
            } else if (r > g && r > b && r > 100) {
                redPixels++;
            }
        }
        
        const colorBalance = Math.abs(greenPixels - redPixels) / Math.max(greenPixels + redPixels, 1);
        return colorBalance; // Mais equilibrio = mais volatilidade
    }
    
    /**
     * Calcula volatilidade baseada nos padrões detectados
     */
    calculateVolatilityFromPatterns(patterns) {
        try {
            // Pesos para cada padrão
            const weights = {
                colorVariation: 0.2,
                edgeIntensity: 0.3,
                brightnessVariation: 0.2,
                linePatterns: 0.15,
                candlestickPatterns: 0.15
            };
            
            // Calcular score ponderado
            const volatilityScore = 
                (patterns.colorVariation * weights.colorVariation) +
                (patterns.edgeIntensity * weights.edgeIntensity) +
                (patterns.brightnessVariation * weights.brightnessVariation) +
                (patterns.linePatterns * weights.linePatterns) +
                (patterns.candlestickPatterns * weights.candlestickPatterns);
            
            const isVolatile = volatilityScore > this.filters.volatilityThreshold;
            
            // Determinar confiança baseada na consistência dos padrões
            const patternValues = Object.values(patterns);
            const avgPattern = patternValues.reduce((a, b) => a + b, 0) / patternValues.length;
            const patternVariance = patternValues.reduce((sum, val) => sum + Math.pow(val - avgPattern, 2), 0) / patternValues.length;
            const confidence = Math.max(0.1, 1 - patternVariance); // Menos variância = mais confiança
            
            // Gerar razão detalhada
            const reason = `Análise visual: Variação de cor ${patterns.colorVariation.toFixed(3)}, ` +
                         `Bordas ${patterns.edgeIntensity.toFixed(3)}, ` +
                         `Brilho ${patterns.brightnessVariation.toFixed(3)}, ` +
                         `Linhas ${patterns.linePatterns.toFixed(3)}, ` +
                         `Candlesticks ${patterns.candlestickPatterns.toFixed(3)}`;
            
            return {
                volatilityScore,
                isVolatile,
                confidence,
                reason
            };
            
        } catch (error) {
            this.log(`Erro no cálculo de volatilidade: ${error.message}`, 'ERROR');
            return {
                volatilityScore: 0,
                isVolatile: false,
                confidence: 0.1,
                reason: 'Erro no cálculo de volatilidade'
            };
        }
    }
    
    /**
     * Obter símbolo do ativo atual - CORRIGIDO: Usar EXATAMENTE o código do STATUS DO MODAL
     */
    async getCurrentAssetSymbol() {
        try {
            // ✅ USAR EXATAMENTE O MESMO CÓDIGO QUE FUNCIONA NO STATUS DO MODAL
            // Verificar elementos do modal (igual ao checkModalStatus)
            const currentAsset = document.querySelector('.current-symbol, .currencies-block .current-symbol_cropped');
            
            if (currentAsset) {
                const assetName = currentAsset.textContent.trim();
                if (assetName && assetName !== 'Não detectado' && assetName !== '') {
                    this.log(`✅ Ativo atual detectado: ${assetName}`, 'SUCCESS');
                    return assetName;
                }
            }
            
            // ✅ USAR EXATAMENTE O CÓDIGO DO STATUS DO MODAL como backup
            return new Promise((resolve) => {
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    if (!tabs || !tabs.length) {
                        this.log('⚠️ Aba ativa não encontrada', 'WARN');
                        resolve('UNKNOWN');
                        return;
                    }
                    
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        func: () => {
                            // EXATAMENTE o mesmo código do STATUS DO MODAL
                            const currentAsset = document.querySelector('.current-symbol, .currencies-block .current-symbol_cropped');
                            return currentAsset ? currentAsset.textContent.trim() : 'Não detectado';
                        }
                    }, (results) => {
                        if (chrome.runtime.lastError) {
                            this.log(`Erro ao executar script: ${chrome.runtime.lastError.message}`, 'WARN');
                            resolve('UNKNOWN');
                            return;
                        }
                        
                        if (results && results[0] && results[0].result) {
                            const assetName = results[0].result;
                            if (assetName && assetName !== 'Não detectado' && assetName !== '') {
                                this.log(`✅ Ativo atual detectado via script: ${assetName}`, 'SUCCESS');
                                resolve(assetName);
                            } else {
                                this.log('⚠️ Ativo não detectado via script', 'WARN');
                                resolve('UNKNOWN');
                            }
                        } else {
                            this.log('⚠️ Nenhum resultado retornado do script', 'WARN');
                            resolve('UNKNOWN');
                        }
                    });
                });
            });
            
        } catch (error) {
            this.log(`Erro ao obter ativo atual: ${error.message}`, 'WARN');
            return 'UNKNOWN';
        }
    }
    
    // =================== NOVO: HISTÓRICO MENTAL ===================
    
    /**
     * Adiciona análise ao histórico mental
     */
    addToMentalHistory(analysis) {
        this.database.mentalHistory.push({
            timestamp: Date.now(),
            asset: analysis.asset,
            volatility: analysis.volatility,
            decision: analysis.decision,
            confidence: analysis.confidence,
            isPreliminary: this.preliminaryAnalyses.isInPreliminaryMode
        });
        
        // Manter apenas as últimas análises
        if (this.database.mentalHistory.length > this.filters.mentalHistorySize * 2) {
            this.database.mentalHistory = this.database.mentalHistory.slice(-this.filters.mentalHistorySize * 2);
        }
        
        // Atualizar contador de análises preliminares
        if (this.preliminaryAnalyses.isInPreliminaryMode) {
            this.preliminaryAnalyses.count++;
            if (this.preliminaryAnalyses.count >= this.preliminaryAnalyses.maxCount) {
                this.preliminaryAnalyses.isInPreliminaryMode = false;
                this.log('🎓 Modo preliminar concluído - Sistema pronto para análises conclusivas', 'SUCCESS');
            }
        }
        
        this.saveMentalHistory();
    }
    
    /**
     * Salva histórico mental no localStorage
     */
    saveMentalHistory() {
        try {
            localStorage.setItem('mentalHistory', JSON.stringify(this.database.mentalHistory));
            localStorage.setItem('volatilityCache', JSON.stringify(Array.from(this.database.volatilityCache.entries())));
        } catch (error) {
            this.log(`Erro ao salvar histórico mental: ${error.message}`, 'ERROR');
        }
    }
    
    // =================== NOVO: CONFIGURAÇÕES UNIFICADAS ===================
    
    /**
     * Obter comportamento configurado pelo usuário
     */
    getUserBehaviorConfig() {
        const config = this.getCurrentConfig();
        return {
            payoutBehavior: config.payoutBehavior || 'wait', // 'wait' ou 'switch'
            preferredCategory: config.assetSwitching?.preferredCategory || 'crypto',
            minPayout: parseFloat(config.minPayout) || 80,
            payoutTimeout: parseInt(config.payoutTimeout) || 5
        };
    }
    
    /**
     * Aplica comportamento configurado para qualquer cenário desfavorável
     */
    async applyConfiguredBehavior(scenario, details) {
        const behavior = this.getUserBehaviorConfig();
        
        this.log(`Aplicando comportamento "${behavior.payoutBehavior}" para cenário: ${scenario}`, 'INFO');
        
        switch (behavior.payoutBehavior) {
            case 'wait':
                return await this.handleWaitBehavior(scenario, details, behavior);
            case 'switch':
                return await this.handleSwitchBehavior(scenario, details, behavior);
            default:
                this.log(`Comportamento desconhecido: ${behavior.payoutBehavior}`, 'WARN');
                return await this.handleWaitBehavior(scenario, details, behavior);
        }
    }
    
    /**
     * Comportamento de espera
     */
    async handleWaitBehavior(scenario, details, behavior) {
        const waitTime = behavior.payoutTimeout;
        
        this.recordTokenSaving(`wait_${scenario}`);
        
        return {
            action: 'WAIT',
            confidence: 0.8,
            reason: `Configuração: aguardar melhoria (${scenario})`,
            waitTime: waitTime,
            details: details
        };
    }
    
    /**
     * Comportamento de troca de ativo
     */
    async handleSwitchBehavior(scenario, details, behavior) {
        this.recordTokenSaving(`switch_${scenario}`);
        
        // Solicitar troca de ativo
        try {
            const switchResult = await this.requestAssetSwitch(behavior.preferredCategory, behavior.minPayout);
            
            return {
                action: 'SWITCH_ASSET',
                confidence: 0.9,
                reason: `Configuração: trocar ativo (${scenario})`,
                switchResult: switchResult,
                details: details
            };
        } catch (error) {
            this.log(`Erro ao trocar ativo: ${error.message}`, 'ERROR');
            return await this.handleWaitBehavior(scenario, details, behavior);
        }
    }
    
    /**
     * Solicita troca de ativo
     */
    async requestAssetSwitch(preferredCategory, minPayout) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'ENSURE_BEST_ASSET',
                minPayout: minPayout,
                preferredCategory: preferredCategory,
                source: 'local-intelligence'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response?.error || 'Falha na troca de ativo'));
                }
            });
        });
    }
    
    // =================== INTELIGÊNCIA PRÉ-ANÁLISE (MODIFICADO) ===================
    
    /**
     * DECISÃO PRINCIPAL: Determina se deve chamar IA ou tomar decisão local
     */
    async shouldCallAI(currentPayout, currentAsset) {
        // NOVO: Verificar se estamos em modo preliminar
        if (this.preliminaryAnalyses.isInPreliminaryMode) {
            return await this.handlePreliminaryAnalysis(currentPayout, currentAsset);
        }
        
        const preAnalysis = await this.preAnalyze(currentPayout, currentAsset);
        
        // Se confiança local é alta, não precisamos da IA
        if (preAnalysis.confidence >= 0.8) {
            this.recordTokenSaving('high_confidence_local');
            return {
                shouldCall: false,
                localDecision: preAnalysis,
                reason: 'Decisão local com alta confiança'
            };
        }
        
        // NOVO: Se detectou volatilidade alta, aplicar comportamento configurado
        if (preAnalysis.volatilityIssue) {
            const behaviorResult = await this.applyConfiguredBehavior('volatilidade_alta', preAnalysis.volatilityDetails);
            return {
                shouldCall: false,
                localDecision: behaviorResult,
                reason: 'Volatilidade alta detectada'
            };
        }
        
        // Se é situação claramente desfavorável, aplicar comportamento configurado
        if (preAnalysis.action === 'WAIT' && preAnalysis.confidence >= 0.7) {
            const behaviorResult = await this.applyConfiguredBehavior('situacao_desfavoravel', preAnalysis);
            return {
                shouldCall: false,
                localDecision: behaviorResult,
                reason: 'Situação claramente desfavorável'
            };
        }
        
        // Se o ativo tem performance muito ruim, aplicar comportamento configurado
        if (preAnalysis.assetRecommendation === 'SWITCH') {
            const behaviorResult = await this.applyConfiguredBehavior('performance_ruim', preAnalysis.assetDetails);
            return {
                shouldCall: false,
                localDecision: behaviorResult,
                reason: 'Ativo com performance inadequada'
            };
        }
        
        return {
            shouldCall: true,
            preAnalysis: preAnalysis,
            reason: 'Situação requer análise detalhada da IA'
        };
    }
    
    /**
     * NOVO: Manipula análises preliminares
     */
    async handlePreliminaryAnalysis(currentPayout, currentAsset) {
        this.tokenSavings.mentalAnalyses++;
        
        // Fazer análise preliminar de volatilidade
        const volatilityCheck = this.checkAssetVolatility(currentAsset);
        
        const preliminaryResult = {
            action: 'PRELIMINARY_ANALYSIS',
            confidence: 0.6,
            reason: `Análise preliminar ${this.preliminaryAnalyses.count + 1}/${this.preliminaryAnalyses.maxCount}`,
            volatility: volatilityCheck,
            asset: currentAsset,
            payout: currentPayout,
            isPreliminary: true
        };
        
        // Adicionar ao histórico mental
        this.addToMentalHistory(preliminaryResult);
        
        this.log(`📚 Análise preliminar ${this.preliminaryAnalyses.count}/${this.preliminaryAnalyses.maxCount} - ${currentAsset}`, 'INFO');
        
        return {
            shouldCall: false,
            localDecision: preliminaryResult,
            reason: 'Análise preliminar para construção de base de conhecimento'
        };
    }
    
    /**
     * Pré-análise local usando dados históricos (MODIFICADO)
     */
    async preAnalyze(currentPayout, currentAsset) {
        const analysis = {
            action: 'ANALYZE', // ANALYZE significa que precisa da IA
            confidence: 0,
            reasons: [],
            assetRecommendation: 'KEEP',
            payoutRecommendation: 'PROCEED',
            volatilityIssue: false, // NOVO
            volatilityDetails: null, // NOVO
            assetDetails: null
        };
        
        // 1. FILTRO DE PAYOUT
        const payoutCheck = this.analyzePayoutSituation(currentPayout);
        if (payoutCheck.shouldWait) {
            analysis.action = 'WAIT';
            analysis.confidence = payoutCheck.confidence;
            analysis.reasons.push(payoutCheck.reason);
            analysis.payoutRecommendation = 'WAIT_OR_SWITCH';
            return analysis;
        }
        
        // 2. NOVO: FILTRO DE VOLATILIDADE
        const volatilityCheck = this.checkAssetVolatility(currentAsset);
        this.tokenSavings.volatilityChecks++;
        
        if (volatilityCheck.isVolatile && volatilityCheck.confidence > 0.6) {
            analysis.volatilityIssue = true;
            analysis.volatilityDetails = volatilityCheck;
            analysis.confidence = Math.max(analysis.confidence, volatilityCheck.confidence);
            analysis.reasons.push(volatilityCheck.reason);
        }
        
        // 3. FILTRO DE ATIVO
        const assetCheck = this.analyzeAssetPerformance(currentAsset);
        if (assetCheck.shouldSwitch) {
            analysis.assetRecommendation = 'SWITCH';
            analysis.assetDetails = assetCheck;
            analysis.confidence = Math.max(analysis.confidence, assetCheck.confidence);
            analysis.reasons.push(assetCheck.reason);
        }
        
        // 4. FILTRO DE STREAK
        const streakCheck = this.analyzeCurrentStreak();
        if (streakCheck.shouldPause) {
            analysis.action = 'WAIT';
            analysis.confidence = Math.max(analysis.confidence, streakCheck.confidence);
            analysis.reasons.push(streakCheck.reason);
        }
        
        // 5. FILTRO TEMPORAL
        const timeCheck = this.analyzeCurrentTime();
        analysis.confidence = Math.max(analysis.confidence, timeCheck.baseConfidence);
        analysis.reasons.push(timeCheck.reason);
        
        return analysis;
    }
    
    analyzePayoutSituation(currentPayout) {
        const config = this.getCurrentConfig();
        const minPayout = parseFloat(config?.minPayout || 80);
        
        if (currentPayout < minPayout - 5) {
            return {
                shouldWait: true,
                confidence: 0.9,
                reason: `Payout muito baixo: ${currentPayout}% < ${minPayout}%`
            };
        }
        
        if (currentPayout < minPayout) {
            return {
                shouldWait: true,
                confidence: 0.7,
                reason: `Payout abaixo do mínimo: ${currentPayout}% < ${minPayout}%`
            };
        }
        
        return { shouldWait: false, confidence: 0.1, reason: 'Payout adequado' };
    }
    
    analyzeAssetPerformance(currentAsset) {
        if (!this.database.assets.has(currentAsset)) {
            return { shouldSwitch: false, confidence: 0, reason: 'Ativo sem histórico' };
        }
        
        const stats = this.database.assets.get(currentAsset);
        
        // Se o ativo tem menos de 60% de win rate nas últimas operações
        if (stats.total >= 5 && stats.winRate < 0.6) {
            return {
                shouldSwitch: true,
                confidence: 0.8,
                reason: `Ativo com baixa performance: ${(stats.winRate * 100).toFixed(1)}% win rate`,
                winRate: stats.winRate,
                totalOps: stats.total
            };
        }
        
        return { shouldSwitch: false, confidence: 0, reason: 'Performance do ativo adequada' };
    }
    
    analyzeCurrentStreak() {
        const streaks = this.database.patterns.get('recentStreaks');
        if (!streaks) {
            return { shouldPause: false, confidence: 0, reason: 'Sem dados de streak' };
        }
        
        // Se está em streak de 3+ perdas
        if (!streaks.lastResult && streaks.currentStreak >= 3) {
            return {
                shouldPause: true,
                confidence: 0.75,
                reason: `Streak de ${streaks.currentStreak} perdas consecutivas`
            };
        }
        
        // Se win rate recente é muito baixo
        if (streaks.recentWinRate < 0.4) {
            return {
                shouldPause: true,
                confidence: 0.7,
                reason: `Win rate recente baixo: ${(streaks.recentWinRate * 100).toFixed(1)}%`
            };
        }
        
        return { shouldPause: false, confidence: 0, reason: 'Streak normal' };
    }
    
    analyzeCurrentTime() {
        const hour = new Date().getHours();
        const hourlyPerf = this.database.patterns.get('hourlyPerformance');
        
        if (!hourlyPerf) {
            return { baseConfidence: 0.3, reason: 'Horário sem dados históricos' };
        }
        
        const hourData = hourlyPerf.find(([h, stats]) => h === hour);
        if (!hourData) {
            return { baseConfidence: 0.3, reason: 'Primeiro trade neste horário' };
        }
        
        const [, stats] = hourData;
        const winRate = stats.winRate;
        
        if (winRate > 0.7) {
            return { baseConfidence: 0.6, reason: `Horário favorável: ${(winRate * 100).toFixed(1)}% win rate` };
        } else if (winRate < 0.4) {
            return { baseConfidence: 0.2, reason: `Horário desfavorável: ${(winRate * 100).toFixed(1)}% win rate` };
        }
        
        return { baseConfidence: 0.4, reason: `Horário neutro: ${(winRate * 100).toFixed(1)}% win rate` };
    }
    
    // =================== OTIMIZAÇÃO DE TOKENS ===================
    
    recordTokenSaving(type) {
        this.tokenSavings.callsAvoided++;
        this.tokenSavings.decisionsLocal++;
        
        // Estimar tokens economizados (prompt + imagem ≈ 1500 tokens)
        this.tokenSavings.tokensEstimatedSaved += 1500;
        
        this.log(`Token economizado: ${type} - Total economizado: ${this.tokenSavings.tokensEstimatedSaved}`, 'SUCCESS');
    }
    
    // =================== EVENTOS E ATUALIZAÇÃO ===================
    
    setupEventListeners() {
        // Escutar novos resultados de operações
        document.addEventListener('operationResult', (event) => {
            this.updateWithNewOperation(event.detail);
        });
    }
    
    updateWithNewOperation(operation) {
        // Atualizar base de dados com nova operação
        this.database.operations.unshift(operation);
        
        // Manter apenas últimas 100 operações
        if (this.database.operations.length > 100) {
            this.database.operations = this.database.operations.slice(0, 100);
        }
        
        // Reprocessar dados
        this.processHistoricalData();
        
        // Salvar atualizações
        this.savePatterns();
        this.saveMentalHistory();
    }
    
    savePatterns() {
        try {
            const patternsArray = Array.from(this.database.patterns.entries());
            localStorage.setItem('localIntelligencePatterns', JSON.stringify(patternsArray));
        } catch (error) {
            this.log(`Erro ao salvar padrões: ${error.message}`, 'ERROR');
        }
    }
    
    // =================== UTILITÁRIOS ===================
    
    getCurrentConfig() {
        if (window.StateManager) {
            return window.StateManager.getConfig();
        }
        return {};
    }
    
    log(message, level = 'INFO') {
        try {
            if (chrome && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: `[LocalIntelligence] ${message}`,
                    level: level,
                    source: 'local-intelligence.js'
                });
            }
        } catch (error) {
            // Erro silencioso
        }
    }
    
    // =================== API PÚBLICA ===================
    
    getStats() {
        return {
            operations: this.database.operations.length,
            patterns: this.database.patterns.size,
            assets: this.database.assets.size,
            mentalHistory: this.database.mentalHistory.length,
            volatilityCache: this.database.volatilityCache.size,
            preliminaryMode: this.preliminaryAnalyses.isInPreliminaryMode,
            preliminaryCount: this.preliminaryAnalyses.count,
            tokenSavings: this.tokenSavings
        };
    }
    
    async makeIntelligentDecision(currentPayout, currentAsset) {
        const decision = await this.shouldCallAI(currentPayout, currentAsset);
        
        if (this.preliminaryAnalyses.isInPreliminaryMode) {
            this.log(`📚 Análise preliminar ${this.preliminaryAnalyses.count}/${this.preliminaryAnalyses.maxCount}: ${decision.reason}`, 'INFO');
        } else {
            this.log(`Decisão: ${decision.shouldCall ? 'CHAMAR_IA' : 'LOCAL'} - ${decision.reason}`, 'INFO');
        }
        
        return decision;
    }
    
    // NOVO: Forçar saída do modo preliminar (para testes)
    exitPreliminaryMode() {
        this.preliminaryAnalyses.isInPreliminaryMode = false;
        this.preliminaryAnalyses.count = this.preliminaryAnalyses.maxCount;
        this.log('🚀 Modo preliminar encerrado manualmente', 'INFO');
    }
    
    // NOVO: Resetar sistema para modo preliminar
    resetToPreliminaryMode() {
        this.preliminaryAnalyses.isInPreliminaryMode = true;
        this.preliminaryAnalyses.count = 0;
        this.database.mentalHistory = [];
        this.database.volatilityCache.clear();
        this.saveMentalHistory();
        this.log('🔄 Sistema resetado para modo preliminar', 'INFO');
    }
    
    /**
     * ✅ CORRIGIDO: Análise de volatilidade UNIFICADA - Detecta tendência no gráfico
     */
    async analyzeVolatilityWithAI(assetSymbol) {
        try {
            this.log(`📊 ANÁLISE LOCAL: Iniciando análise de volatilidade para ${assetSymbol}`, 'INFO');
            
            // Verificar se já temos dados de volatilidade recentes (últimos 2 minutos)
            const cached = this.database.volatilityCache.get(assetSymbol);
            if (cached && (Date.now() - cached.timestamp) < 120000) { // 2 minutos
                this.log(`📊 Usando dados em cache para ${assetSymbol}: ${cached.score}`, 'INFO');
                return {
                    score: cached.score,
                    isVolatile: cached.isVolatile,
                    confidence: cached.confidence,
                    reason: cached.reason + ' (cache)',
                    timestamp: cached.timestamp
                };
            }
            
            // ✅ ANÁLISE UNIFICADA: Detectar tendência no gráfico
            this.log('🔍 MÉTODO: Análise local de tendência (sem IA)', 'INFO');
            
            // 1. Capturar screenshot do gráfico
            const screenshot = await this.captureCurrentChart();
            if (!screenshot) {
                this.log('❌ Falha na captura do gráfico para análise', 'ERROR');
                return {
                    score: 0.8, // SEM DADOS = VOLÁTIL
                    isVolatile: true,
                    confidence: 0.5,
                    reason: 'ANÁLISE LOCAL: Falha na captura - assumindo volatilidade alta',
                    timestamp: Date.now()
                };
            }
            
            // 2. Analisar TENDÊNCIA através da análise visual
            const analysis = await this.analyzeTrendFromChart(screenshot);
            
            // 3. CRITÉRIO UNIFICADO: Sem tendência clara = VOLÁTIL
            const trendStrength = analysis.trendStrength || 0;
            const hasStrongTrend = trendStrength > 0.6; // Tendência forte > 60%
            
            const result = {
                score: 1 - trendStrength, // Inverso da tendência = volatilidade
                isVolatile: !hasStrongTrend, // Sem tendência forte = volátil
                confidence: analysis.confidence || 0.8,
                reason: `ANÁLISE LOCAL: ${hasStrongTrend ? 'Tendência clara' : 'Sem tendência'} (força: ${(trendStrength * 100).toFixed(0)}%)`,
                timestamp: Date.now(),
                trendDetails: {
                    direction: analysis.trendDirection || 'lateral',
                    strength: trendStrength,
                    volatilityFactors: analysis.volatilityFactors || {}
                }
            };
            
            // 4. Salvar no cache
            this.database.volatilityCache.set(assetSymbol, result);
            this.saveMentalHistory();
            
            this.log(`✅ Análise de volatilidade concluída: ${result.isVolatile ? 'VOLÁTIL' : 'ESTÁVEL'} (score: ${result.score.toFixed(3)})`, 'SUCCESS');
            return result;
            
        } catch (error) {
            this.log(`Erro na análise de volatilidade: ${error.message}`, 'ERROR');
            return {
                score: 0.8, // ERRO = ASSUMIR VOLÁTIL
                isVolatile: true,
                confidence: 0.3,
                reason: `ANÁLISE LOCAL: Erro - assumindo volatilidade alta`,
                timestamp: Date.now()
            };
        }
    }

    /**
     * ✅ NOVO: Análise de tendência unificada - base para volatilidade
     */
    async analyzeTrendFromChart(imageData) {
        try {
            // Usar a mesma lógica de análise visual existente
            const analysis = await this.analyzeChartImageVolatility(imageData);
            
            if (!analysis || !analysis.success) {
                return {
                    trendStrength: 0.2, // Baixa confiança
                    trendDirection: 'uncertain',
                    confidence: 0.3,
                    volatilityFactors: {}
                };
            }
            
            // ✅ LÓGICA UNIFICADA: Calcular força da tendência
            const patterns = analysis.imageAnalysis || {};
            const colorVar = patterns.colorVariation || 0;
            const edgeIntensity = patterns.edgeIntensity || 0;
            const linePatterns = patterns.linePatterns || 0;
            const candlestickVar = patterns.candlestickPatterns || 0;
            
            // Tendência forte = linhas direcionais + baixa variação de cor
            const trendStrength = Math.max(0, Math.min(1, 
                (linePatterns * 0.4) + 
                ((1 - colorVar) * 0.3) + 
                (edgeIntensity * 0.2) + 
                ((1 - candlestickVar) * 0.1)
            ));
            
            // Determinar direção da tendência
            let trendDirection = 'lateral';
            if (trendStrength > 0.6) {
                // Análise básica de direção baseada em padrões
                if (linePatterns > 0.5) {
                    trendDirection = edgeIntensity > 0.5 ? 'alta' : 'baixa';
                }
            }
            
            return {
                trendStrength: trendStrength,
                trendDirection: trendDirection,
                confidence: analysis.confidence || 0.8,
                volatilityFactors: {
                    colorVariation: colorVar,
                    edgeIntensity: edgeIntensity,
                    linePatterns: linePatterns,
                    candlestickVariation: candlestickVar
                }
            };
            
        } catch (error) {
            this.log(`Erro na análise de tendência: ${error.message}`, 'ERROR');
            return {
                trendStrength: 0.2,
                trendDirection: 'uncertain',
                confidence: 0.3,
                volatilityFactors: {}
            };
        }
    }
}

// Inicializar globalmente
window.LocalIntelligence = new LocalIntelligence(); 