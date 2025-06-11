/**
 * ====================================================================
 * LOCAL PATTERN DETECTOR - Análise Prévia de Imagens do Gráfico
 * ====================================================================
 * 
 * Detecta elementos essenciais no gráfico localmente antes do envio para IA:
 * - Candlesticks (verde/vermelho)
 * - Indicadores técnicos (RSI, Moving Averages)
 * - Qualidade da imagem
 * - Elementos de interface necessários
 */

class LocalPatternDetector {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Configurações de detecção
        this.config = {
            // Cores típicas de candlesticks
            bullishColors: [
                { r: 0, g: 255, b: 0, tolerance: 50 },    // Verde
                { r: 0, g: 200, b: 0, tolerance: 50 },    // Verde escuro
                { r: 50, g: 255, b: 50, tolerance: 50 }   // Verde claro
            ],
            bearishColors: [
                { r: 255, g: 0, b: 0, tolerance: 50 },    // Vermelho
                { r: 200, g: 0, b: 0, tolerance: 50 },    // Vermelho escuro
                { r: 255, g: 50, b: 50, tolerance: 50 }   // Vermelho claro
            ],
            // Cores de indicadores
            indicatorColors: [
                { r: 255, g: 255, b: 0, tolerance: 30 },  // Amarelo (MA)
                { r: 0, g: 100, b: 255, tolerance: 30 },  // Azul (MA)
                { r: 255, g: 165, b: 0, tolerance: 30 }   // Laranja (RSI)
            ],
            // Limites de qualidade
            minWidth: 800,
            minHeight: 400,
            minCandlestickDetection: 10,
            minIndicatorLines: 1
        };
        
        this.lastAnalysis = null;
        this.analysisCache = new Map();
    }

    /**
     * Análise principal da imagem
     * @param {string} imageDataUrl - URL da imagem em base64
     * @returns {Promise<Object>} Resultado da análise
     */
    async analyzeImage(imageDataUrl) {
        try {
            const imageHash = this.generateImageHash(imageDataUrl);
            
            // Verificar cache primeiro
            if (this.analysisCache.has(imageHash)) {
                // Log apenas quando necessário, não na inicialização
                if (chrome && chrome.runtime && chrome.runtime.id) {
                    chrome.runtime.sendMessage({
                        action: 'addLog',
                        logMessage: 'Usando análise em cache',
                        logLevel: 'DEBUG',
                        logSource: 'local-pattern-detector.js'
                    });
                }
                return this.analysisCache.get(imageHash);
            }
            
            const img = await this.loadImage(imageDataUrl);
            const analysis = await this.performAnalysis(img);
            
            // Armazenar em cache
            analysis.timestamp = Date.now();
            analysis.imageHash = imageHash;
            this.analysisCache.set(imageHash, analysis);
            
            // Limitar cache (máximo 10 análises)
            if (this.analysisCache.size > 10) {
                const firstKey = this.analysisCache.keys().next().value;
                this.analysisCache.delete(firstKey);
            }
            
            this.lastAnalysis = analysis;
            // Log apenas quando necessário, não na inicialização
            if (chrome && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: `Análise concluída: ${analysis.quality}% qualidade, ${analysis.hasPattern ? 'padrão detectado' : 'sem padrão'}`,
                    logLevel: 'INFO',
                    logSource: 'local-pattern-detector.js'
                });
            }
            
            return analysis;
            
        } catch (error) {
            console.error('❌ LOCAL-DETECTOR: Erro na análise:', error);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * Carrega imagem no canvas
     */
    async loadImage(imageDataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                this.ctx.drawImage(img, 0, 0);
                resolve(img);
            };
            img.onerror = reject;
            img.src = imageDataUrl;
        });
    }

    /**
     * Executa análise completa da imagem
     */
    async performAnalysis(img) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        const analysis = {
            // Informações básicas
            dimensions: {
                width: img.width,
                height: img.height,
                aspectRatio: (img.width / img.height).toFixed(2)
            },
            
            // Detecções principais
            candlesticks: this.detectCandlesticks(imageData),
            indicators: this.detectIndicators(imageData),
            interface: this.detectInterfaceElements(imageData),
            
            // Qualidade da imagem
            quality: this.assessImageQuality(imageData),
            
            // Recomendação final
            recommendation: null,
            confidence: 0,
            readyForAI: false
        };
        
        // Calcular recomendação final
        analysis.recommendation = this.generateRecommendation(analysis);
        
        return analysis;
    }

    /**
     * Detecta candlesticks na imagem
     */
    detectCandlesticks(imageData) {
        const data = imageData.data;
        let bullishCount = 0;
        let bearishCount = 0;
        let totalCandlesticks = 0;
        
        // Sampling por regiões (evitar análise pixel por pixel)
        const sampleSize = Math.floor(data.length / 1000); // Amostra 0.1%
        
        for (let i = 0; i < data.length; i += sampleSize * 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Verificar cores bullish (verde)
            if (this.matchesColorPattern(r, g, b, this.config.bullishColors)) {
                bullishCount++;
            }
            
            // Verificar cores bearish (vermelho)
            if (this.matchesColorPattern(r, g, b, this.config.bearishColors)) {
                bearishCount++;
            }
        }
        
        totalCandlesticks = bullishCount + bearishCount;
        
        return {
            detected: totalCandlesticks >= this.config.minCandlestickDetection,
            bullishCount,
            bearishCount,
            totalCount: totalCandlesticks,
            ratio: totalCandlesticks > 0 ? (bullishCount / totalCandlesticks).toFixed(2) : 0
        };
    }

    /**
     * Detecta indicadores técnicos
     */
    detectIndicators(imageData) {
        const data = imageData.data;
        let indicatorLines = 0;
        
        // Buscar por cores típicas de indicadores
        const sampleSize = Math.floor(data.length / 500);
        
        for (let i = 0; i < data.length; i += sampleSize * 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (this.matchesColorPattern(r, g, b, this.config.indicatorColors)) {
                indicatorLines++;
            }
        }
        
        return {
            detected: indicatorLines >= this.config.minIndicatorLines,
            lineCount: indicatorLines,
            types: this.identifyIndicatorTypes(indicatorLines)
        };
    }

    /**
     * Detecta elementos da interface (timeframe, payout, etc.)
     */
    detectInterfaceElements(imageData) {
        const { width, height } = imageData;
        
        // Análise de regiões específicas onde ficam os elementos
        const regions = {
            topBar: { x: 0, y: 0, w: width, h: height * 0.15 },
            rightPanel: { x: width * 0.8, y: 0, w: width * 0.2, h: height },
            bottomPanel: { x: 0, y: height * 0.85, w: width, h: height * 0.15 }
        };
        
        return {
            hasTimeframe: this.detectTimeframeArea(imageData, regions.topBar),
            hasPayout: this.detectPayoutArea(imageData, regions.rightPanel),
            hasControls: this.detectControlsArea(imageData, regions.bottomPanel)
        };
    }

    /**
     * Avalia qualidade geral da imagem
     */
    assessImageQuality(imageData) {
        const { width, height } = imageData;
        
        const qualityChecks = {
            resolution: width >= this.config.minWidth && height >= this.config.minHeight,
            aspectRatio: (width / height) >= 1.5 && (width / height) <= 3.0,
            brightness: this.checkBrightness(imageData),
            contrast: this.checkContrast(imageData)
        };
        
        const score = Object.values(qualityChecks).filter(Boolean).length / Object.keys(qualityChecks).length;
        
        return {
            score: (score * 100).toFixed(0),
            checks: qualityChecks,
            acceptable: score >= 0.7
        };
    }

    /**
     * Gera recomendação final baseada na análise
     */
    generateRecommendation(analysis) {
        const scores = {
            candlesticks: analysis.candlesticks.detected ? 30 : 0,
            indicators: analysis.indicators.detected ? 25 : 0,
            interface: (analysis.interface.hasTimeframe + analysis.interface.hasPayout + analysis.interface.hasControls) * 10,
            quality: analysis.quality.acceptable ? 25 : 0
        };
        
        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
        analysis.confidence = totalScore;
        
        if (totalScore >= 80) {
            analysis.readyForAI = true;
            return {
                action: 'PROCEED_WITH_AI',
                reason: 'Imagem com qualidade excelente para análise da IA',
                confidence: totalScore
            };
        } else if (totalScore >= 60) {
            analysis.readyForAI = true;
            return {
                action: 'PROCEED_WITH_CAUTION',
                reason: 'Imagem aceitável, mas pode ter limitações na análise',
                confidence: totalScore
            };
        } else {
            analysis.readyForAI = false;
            return {
                action: 'WAIT_BETTER_IMAGE',
                reason: 'Imagem com qualidade insuficiente para análise confiável',
                confidence: totalScore,
                suggestions: this.generateImprovementSuggestions(analysis)
            };
        }
    }

    /**
     * Utilitários
     */
    matchesColorPattern(r, g, b, colorPatterns) {
        return colorPatterns.some(pattern => {
            return Math.abs(r - pattern.r) <= pattern.tolerance &&
                   Math.abs(g - pattern.g) <= pattern.tolerance &&
                   Math.abs(b - pattern.b) <= pattern.tolerance;
        });
    }

    identifyIndicatorTypes(lineCount) {
        const types = [];
        if (lineCount >= 1) types.push('Moving Average');
        if (lineCount >= 2) types.push('RSI');
        if (lineCount >= 3) types.push('MACD');
        return types;
    }

    detectTimeframeArea(imageData, region) {
        // Simplificado - buscar por texto/números típicos de timeframe
        return Math.random() > 0.3; // Placeholder - implementar OCR básico se necessário
    }

    detectPayoutArea(imageData, region) {
        // Simplificado - buscar por padrões de % ou $
        return Math.random() > 0.2; // Placeholder
    }

    detectControlsArea(imageData, region) {
        // Simplificado - buscar por botões/controles
        return Math.random() > 0.4; // Placeholder
    }

    checkBrightness(imageData) {
        let brightness = 0;
        const data = imageData.data;
        const sampleSize = Math.floor(data.length / 1000);
        
        for (let i = 0; i < data.length; i += sampleSize * 4) {
            brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        
        const avgBrightness = brightness / (data.length / sampleSize / 4);
        return avgBrightness > 50 && avgBrightness < 200; // Nem muito escuro nem muito claro
    }

    checkContrast(imageData) {
        // Análise simplificada de contraste
        return true; // Placeholder - implementar se necessário
    }

    generateImprovementSuggestions(analysis) {
        const suggestions = [];
        
        if (!analysis.candlesticks.detected) {
            suggestions.push('Aguardar formação de mais candlesticks');
        }
        if (!analysis.indicators.detected) {
            suggestions.push('Ativar indicadores técnicos no gráfico');
        }
        if (!analysis.quality.acceptable) {
            suggestions.push('Aguardar melhor resolução/qualidade da imagem');
        }
        
        return suggestions;
    }

    generateImageHash(imageDataUrl) {
        // Hash simples baseado no tamanho e primeiros caracteres
        return btoa(imageDataUrl.substring(0, 100)).substring(0, 16);
    }

    getDefaultAnalysis() {
        return {
            dimensions: { width: 0, height: 0, aspectRatio: 0 },
            candlesticks: { detected: false, totalCount: 0 },
            indicators: { detected: false, lineCount: 0 },
            interface: { hasTimeframe: false, hasPayout: false, hasControls: false },
            quality: { score: 0, acceptable: false },
            recommendation: {
                action: 'ERROR',
                reason: 'Erro na análise da imagem',
                confidence: 0
            },
            confidence: 0,
            readyForAI: false
        };
    }

    /**
     * Métodos públicos para integração
     */
    getLastAnalysis() {
        return this.lastAnalysis;
    }

    clearCache() {
        this.analysisCache.clear();
        // Log apenas quando usado, não na inicialização
        if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: 'addLog',
                logMessage: 'Cache limpo',
                logLevel: 'INFO',
                logSource: 'local-pattern-detector.js'
            });
        }
    }

    getStats() {
        return {
            cacheSize: this.analysisCache.size,
            lastAnalysisTime: this.lastAnalysis?.timestamp || null
        };
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.LocalPatternDetector = LocalPatternDetector;
}

// Instância global - SEM LOGS de inicialização
window.localPatternDetector = new LocalPatternDetector(); 