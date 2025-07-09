// =============================================
// Configurações Globais
// =============================================
// Definir a função para log primeiro para evitar problemas de referência circular
function logFromAnalyzer(message, level = 'INFO') {
    // console.log(`%c[${level}][analyze-graph.js] ${message}`, 'background: #3498db; color: white; padding: 3px; border-radius: 3px;'); // Manter para depuração local se desejar
    
    // Enviar para o sistema centralizado de logs (log-sys.js ou background)
    try {
        if (chrome && chrome.runtime && chrome.runtime.id) { // Verificar se o contexto da extensão é válido
            chrome.runtime.sendMessage({
                action: 'addLog', // PADRONIZADO para addLog
                logMessage: message, // MODIFICADO: Remover prefixo
                level: level,
                source: 'analyze-graph.js' // Redundante se já prefixado, mas bom para o receptor
            }); // Callback removido
        }
    } catch (error) {
        console.warn('[analyze-graph.js] Exceção ao tentar enviar log via runtime:', error);
    }
}

// Agora podemos usar a função de log corrigida
logFromAnalyzer('AnalyzeGraph: Iniciando carregamento...', 'INFO');

// Removendo as constantes duplicadas e usando as do index.js

// =============================================
// Funções de Log
// =============================================
/**
 * Função centralizada para adicionar logs
 * @param {string} message - Mensagem a ser registrada
 * @param {string} level - Nível do log: 'INFO', 'WARN', 'ERROR', 'SUCCESS' ou 'DEBUG'
 * @param {string} source - Origem do log (padrão: 'analyze-graph.js')
 */
function graphAddLog(message, level = 'INFO', source = 'analyze-graph.js') {
    // Chama a função de log padronizada deste módulo
    // O parâmetro 'source' aqui é mais para compatibilidade se a função era chamada com ele,
    // mas logFromAnalyzer já adiciona um prefixo [analyze-graph.js]
    logFromAnalyzer(message, level); 
}

// Função padronizada para enviar status para o index
function toUpdateStatus(message, type = 'info', duration = 3000) {
    if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
            action: 'updateStatus',
            message: message,
            type: type,
            duration: duration
        });
    }
}

// =============================================
// 🧠 SISTEMA DE INTELIGÊNCIA LOCAL 
// =============================================

/**
 * Verifica se deve usar inteligência local ou chamar IA
 */
const checkLocalIntelligence = async (settings) => {
    try {
        // Verificar se o módulo de inteligência local está disponível
        if (!window.LocalIntelligence) {
            logFromAnalyzer('Módulo LocalIntelligence não disponível - procedendo com IA', 'WARN');
            return { useLocal: false, reason: 'Módulo não carregado' };
        }
        
        // Obter informações atuais
        const currentPayout = await getCurrentPayout();
        const currentAsset = await getCurrentAsset();
        
        logFromAnalyzer(`Verificando inteligência local - Payout: ${currentPayout}%, Ativo: ${currentAsset}`, 'INFO');
        
        // Fazer decisão inteligente
        const decision = await window.LocalIntelligence.makeIntelligentDecision(currentPayout, currentAsset);
        
        if (!decision.shouldCall) {
            logFromAnalyzer(`💡 ECONOMIA DE TOKENS: ${decision.reason}`, 'SUCCESS');
            toUpdateStatus(`💡 Decisão local: ${decision.localDecision.action}`, 'info', 3000);
            return {
                useLocal: true,
                localResult: decision.localDecision,
                reason: decision.reason
            };
        }
        
        return {
            useLocal: false,
            preAnalysis: decision.preAnalysis,
            reason: decision.reason
        };
        
    } catch (error) {
        logFromAnalyzer(`Erro na verificação de inteligência local: ${error.message}`, 'ERROR');
        return { useLocal: false, reason: 'Erro na verificação' };
    }
};

/**
 * Obter payout atual
 */
const getCurrentPayout = async () => {
    try {
        if (window.PayoutController) {
            const result = await window.PayoutController.getCurrentPayout();
            return result.payout;
        } else if (typeof window.capturePayoutFromDOM === 'function') {
            const result = await window.capturePayoutFromDOM();
            return result.payout;
        }
        return 85; // Valor padrão
    } catch (error) {
        logFromAnalyzer(`Erro ao obter payout: ${error.message}`, 'WARN');
        return 85;
    }
};

/**
 * Obter ativo atual
 */
const getCurrentAsset = async () => {
    try {
        // Tentar obter via DOM ou outras fontes
        const assetElement = document.querySelector('[data-asset-name]') || 
                           document.querySelector('.asset-name') ||
                           document.querySelector('.current-asset');
        
        if (assetElement) {
            return assetElement.textContent || assetElement.dataset.assetName || 'UNKNOWN';
        }
        
        return 'UNKNOWN';
    } catch (error) {
        logFromAnalyzer(`Erro ao obter ativo atual: ${error.message}`, 'WARN');
        return 'UNKNOWN';
    }
};

// =============================================
// Funções de Análise (MODIFICADAS)
// =============================================

/**
 * Gera prompt ENRIQUECIDO com inteligência local
 */
const generateIntelligentPrompt = (availablePeriods, userTradeTime, preAnalysis) => {
    const basePrompt = generateDetailedPrompt(availablePeriods, userTradeTime);
    
    if (!preAnalysis) {
        return basePrompt;
    }
    
    // Enriquecer prompt com inteligência local
    const enrichedContext = `
📊 CONTEXTO INTELIGENTE (baseado em histórico local):
- Análise prévia: ${preAnalysis.reasons.join(', ')}
- Recomendação de ativo: ${preAnalysis.assetRecommendation}
- Recomendação de payout: ${preAnalysis.payoutRecommendation}
- Confiança prévia: ${(preAnalysis.confidence * 100).toFixed(1)}%

IMPORTANTE: Use este contexto para uma análise mais precisa e focada.
${preAnalysis.assetRecommendation === 'SWITCH' ? 'CONSIDERE FORTEMENTE recomendar troca de ativo.' : ''}
${preAnalysis.confidence > 0.5 ? 'Os dados históricos sugerem cautela nesta situação.' : ''}
`;
    
    return enrichedContext + basePrompt;
};

/**
 * Gera prompt detalhado para análise normal
 */
const generateDetailedPrompt = (availablePeriods, userTradeTime) => {
    let periodInstruction = '';
    
    if(userTradeTime === 0) {
        periodInstruction = `Opções de período disponíveis: ${availablePeriods.join(', ')}\n` +
        "Selecione o melhor período entre as opções acima.";
    } else {
        periodInstruction = `Use período fixo de ${userTradeTime} minutos.`;
    }

    return `Você é um analista especializado em trading intradiário. Analise o gráfico considerando:
1. Tendência de preço (Médias Móveis 9, 21 e 50 períodos EMA)
2. MACD Fast 5, Slow 15 e Sinal 5
3. Formações de velas (Engulfing, Pin Bar, etc.)
4. RSI em 5 periodos
5. SuperTrend que sinaliza com uma flag Sell ou Buy
6. ${periodInstruction}
7. Se o grafico não apresentar tendencia, sinalise com WAIT. 

Responda STRICT JSON:
{
  "action": "BUY/SELL/WAIT",
  "reason": "Explicação técnica resumida.",
  "trust": "Número de 0-100 indicando confiança",
  "expiration": "Tempo em minutos (1 - 15), se action for = WAIT, então expiration = 1"
}`;
};

/**
 * Gera prompt simplificado para modo de teste
 */
const generateSimplePrompt = (availablePeriods, userTradeTime) => {
    let periodInstruction = '';
    
    if(userTradeTime === 0) {
        periodInstruction = `Período recomendado: 5 minutos.`;
    } else {
        periodInstruction = `Período: ${userTradeTime} minutos.`;
    }

    return `Analise este gráfico de trading de forma simplificada e objetiva. Dê preferência para sinais de entrada (BUY/SELL) em vez de WAIT.
1. Observe a tendência atual e as últimas 3-5 velas
2. Identifique pontos de suporte e resistência
3. ${periodInstruction}
4. Concentre-se em oportunidades imediatas, priorizando sinais de compra ou venda
5. Seja direto e preciso na sua análise

Responda STRICT JSON:
{
  "action": "BUY/SELL/WAIT",
  "reason": "Explicação simples e direta da sua decisão.",
  "trust": "Número de 0-100 indicando confiança",
  "period": 5,
  "entry": "Valor aproximado de entrada",
  "expiration": "Tempo em minutos (1 - 15)"
}`;
};

/**
 * Seleciona o prompt adequado com base nas configurações E inteligência local
 */
const generateAnalysisPrompt = (availablePeriods, userTradeTime, isTestMode, preAnalysis = null) => {
    if (isTestMode) {
        return generateSimplePrompt(availablePeriods, userTradeTime);
    } else {
        return generateIntelligentPrompt(availablePeriods, userTradeTime, preAnalysis);
    }
};

/**
 * Valida e processa a resposta da API
 */
const validateAndProcessResponse = (rawText) => {
    try {
        // Sanitização do JSON
        const jsonMatch = rawText.match(/{[\s\S]*?}/);
        if (!jsonMatch) throw new Error('Nenhum JSON válido encontrado');

        const sanitized = jsonMatch[0]
            .replace(/(\w+):/g, '"$1":')
            .replace(/'/g, '"')
            .replace(/(\d+),(\s*})/g, '$1$2');

        const parsed = JSON.parse(sanitized);
        
        // Validações
        if (!['BUY', 'SELL', 'WAIT'].includes(parsed.action)) {
            throw new Error('Ação inválida');
        }
        
        if (!parsed.reason || typeof parsed.reason !== 'string') {
            throw new Error('Razão inválida');
        }
        
        parsed.trust = Math.min(Math.max(Number(parsed.trust || 75), 0), 100);
        parsed.expiration = Math.min(Math.max(Number(parsed.expiration || 5), 1), 15);

        return parsed;
    } catch (error) {
        throw new Error(`Validação falhou: ${error.message}`);
    }
};

/**
 * Processa a análise do gráfico (MODIFICADO COM INTELIGÊNCIA LOCAL)
 */
const processAnalysis = async (imageData, settings) => {
    try {
        graphAddLog('🧠 Iniciando análise inteligente...', 'INFO');
        
        // *** NOVO: VERIFICAÇÃO DE INTELIGÊNCIA LOCAL ***
        const intelligenceCheck = await checkLocalIntelligence(settings);
        
        if (intelligenceCheck.useLocal) {
            // ✅ DECISÃO LOCAL - ECONOMIZAR TOKENS
            graphAddLog(`💡 Decisão tomada localmente: ${intelligenceCheck.localResult.action}`, 'SUCCESS');
            
            // Formatar como resposta da IA para compatibilidade
            const localResult = {
                action: intelligenceCheck.localResult.action,
                trust: Math.round(intelligenceCheck.localResult.confidence * 100),
                reason: intelligenceCheck.localResult.reasons.join('; '),
                expiration: 5,
                source: 'local-intelligence',
                tokensaved: true
            };
            
            // *** ATUALIZAR INTELIGÊNCIA LOCAL COM RESULTADO ***
            if (window.LocalIntelligence) {
                setTimeout(() => {
                    window.LocalIntelligence.recordTokenSaving('local_decision');
                }, 100);
            }
            
            return {
                success: true,
                result: localResult
            };
        }
        
        // *** CONTINUAR COM IA (com contexto enriquecido) ***
        graphAddLog('🤖 Prosseguindo com análise da IA (contexto enriquecido)', 'INFO');
        
        // Verificar se o imageData é válido
        if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
            throw new Error('Dados de imagem inválidos ou ausentes');
        }
        
        // *** NOVO: Análise prévia com Local Pattern Detector ***
        if (window.localPatternDetector) {
            graphAddLog('Executando análise prévia local da imagem...', 'INFO');
            
            try {
                const localAnalysis = await window.localPatternDetector.analyzeImage(imageData);
                graphAddLog(`Análise local concluída - Confiança: ${localAnalysis.confidence}%`, 'INFO');
                
                // Verificar se a imagem tem qualidade suficiente para IA
                if (!localAnalysis.readyForAI) {
                    const reason = localAnalysis.recommendation.reason;
                    const suggestions = localAnalysis.recommendation.suggestions || [];
                    
                    graphAddLog(`Imagem rejeitada pela análise local: ${reason}`, 'WARN');
                    
                    if (suggestions.length > 0) {
                        graphAddLog(`Sugestões: ${suggestions.join(', ')}`, 'INFO');
                    }
                    
                    // Retornar resultado de espera com base na análise local
                    return {
                        action: 'WAIT',
                        reason: `Análise local: ${reason}. ${suggestions.length > 0 ? suggestions.join('. ') : ''}`,
                        trust: localAnalysis.confidence,
                        expiration: 1,
                        source: 'local-pattern-detector'
                    };
                }
            } catch (localError) {
                graphAddLog(`Erro na análise local: ${localError.message}`, 'WARN');
            }
        }
        
        // Obter configurações
        const userTradeTime = settings.period || 0;
        const isTestMode = settings.testMode || false;
        
        // *** NOVO: Usar prompt inteligente com pré-análise ***
        const prompt = generateAnalysisPrompt(
            ["1", "2", "5", "10", "15"],
            userTradeTime,
            isTestMode,
            intelligenceCheck.preAnalysis
        );
        
        // Preparar payload para API
        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { 
                        inline_data: {
                            mime_type: "image/png",
                            data: imageData.split(',')[1]
                        }
                    }
                ]
            }]
        };
        
        // URL da API
        const apiUrl = window.API_URL || "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDeYcYUxAN52DNrgZeFNcEfceVMoWJDjWk";
        
        // Fazer requisição
        graphAddLog('📡 Enviando para API Gemini com contexto enriquecido...', 'INFO');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
        }
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            throw new Error('Texto de resposta vazio ou ausente');
        }
        
        // Log direto da resposta recebida
        console.log("%c[ANÁLISE] Resposta recebida da API", "background: #2ecc71; color: white; padding: 5px; font-weight: bold;");
        console.log(text.substring(0, 200) + "...");
        
        // Extrair JSON da resposta
        const jsonMatch = text.match(/{[\s\S]*?}/);
        if (!jsonMatch) {
            throw new Error('Resposta inválida da API');
        }

        // Tentar analisar o JSON de várias maneiras para aumentar a robustez
        let result;
        try {
            // Primeiro, tentar analisar o JSON diretamente
            result = JSON.parse(jsonMatch[0]);
        } catch (jsonError) {
            console.log('Erro ao analisar JSON diretamente, tentando sanitizar', jsonError);
            
            // Tentar sanitizar e analisar novamente
            try {
                const sanitized = jsonMatch[0]
                    .replace(/(\w+):/g, '"$1":')
                    .replace(/'/g, '"')
                    .replace(/(\d+),(\s*})/g, '$1$2');
                    
                result = JSON.parse(sanitized);
            } catch (sanitizeError) {
                throw new Error('Impossível analisar a resposta da API');
            }
        }
        
        graphAddLog(`Análise concluída: ${result.action} (${result.trust}% de confiança)`, 'success');
        
        // *** NOVO: Armazenar resultado no cache ***
        if (window.cacheAnalyzer) {
            try {
                const imageHash = btoa(imageData.substring(0, 100)).substring(0, 16);
                const context = {
                    automation: settings.automation || false,
                    galeActive: settings.galeActive || false,
                    localContext: intelligenceCheck.preAnalysis || null
                };
                
                // Estimar tokens utilizados (aproximação)
                const estimatedTokens = 1500; // Base + prompt + imagem
                
                window.cacheAnalyzer.setAIAnalysis(imageHash, context, result, estimatedTokens);
                graphAddLog(`Resultado armazenado no cache (${estimatedTokens} tokens estimados)`, 'DEBUG');
            } catch (cacheError) {
                graphAddLog(`Erro ao armazenar no cache: ${cacheError.message}`, 'WARN');
            }
        }
        
        return {
            success: true,
            result
        };

    } catch (error) {
        console.error('Erro na análise:', error);
        
        try {
            graphAddLog(`Erro na análise: ${error.message}`, 'ERROR');
        } catch (logError) {
            console.error('Também falhou ao registrar o erro:', logError);
        }
        
        return {
            success: false,
            error: error.message || 'Erro desconhecido na análise'
        };
    }
};

// =============================================
// Obter configurações do sistema
// =============================================
async function getSystemConfig() {
    try {
        if (window.StateManager) {
            return await window.StateManager.getConfig();
        } else {
            // Fallback para storage direto
            return new Promise((resolve) => {
                chrome.storage.sync.get(['userConfig'], (result) => {
                    resolve(result.userConfig || {});
                });
            });
        }
    } catch (error) {
        logFromAnalyzer('Erro ao obter configurações:', 'ERROR');
        return {};
    }
}

// =============================================
// Exportação de API Pública
// =============================================

/**
 * Processa a análise de uma imagem diretamente (MODIFICADO)
 * @param {string} imageData - A imagem em formato dataUrl
 * @param {Object} settings - Configurações do usuário
 * @returns {Promise<Object>} - Resultado da análise
 */
async function analyzeImage(imageData, settings = {}) {
    try {
        logFromAnalyzer('🧠 Iniciando análise direta de imagem com inteligência local', 'INFO');
        
        // Verificar se a imagem é válida
        if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
            throw new Error('Dados de imagem inválidos');
        }
        
        // *** VERIFICAÇÃO DE INTELIGÊNCIA LOCAL ***
        const intelligenceCheck = await checkLocalIntelligence(settings);
        
        if (intelligenceCheck.useLocal) {
            logFromAnalyzer(`💡 ECONOMIA DE TOKENS: ${intelligenceCheck.reason}`, 'SUCCESS');
            
            const localResult = {
                action: intelligenceCheck.localResult.action,
                trust: Math.round(intelligenceCheck.localResult.confidence * 100),
                reason: `LOCAL: ${intelligenceCheck.localResult.reasons.join('; ')}`,
                expiration: 5,
                timestamp: new Date().toISOString(),
                source: 'local-intelligence'
            };
            
            return localResult;
        }
        
        // Obter configurações do sistema
        const systemConfig = await getSystemConfig();
        const userTradeTime = settings.period || 0;
        const isTestMode = settings.testMode || false;
        
        // Gerar prompt adequado ao contexto (com pré-análise)
        const prompt = generateAnalysisPrompt(
            systemConfig.availablePeriods || ["1", "2", "5", "10", "15"],
            userTradeTime,
            isTestMode,
            intelligenceCheck.preAnalysis
        );
        
        // Montar payload para a API
        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { 
                        inline_data: {
                            mime_type: "image/png",
                            data: imageData.split(',')[1]
                        }
                    }
                ]
            }]
        };
        
        // Obter URL da API
        const apiUrl = window.API_URL || "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDeYcYUxAN52DNrgZeFNcEfceVMoWJDjWk";
        
        // Enviar para a API
        logFromAnalyzer('📡 Enviando solicitação para a API Gemini com contexto inteligente...', 'INFO');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        // Verificar se a resposta é válida
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
        }
        
        // Processar a resposta
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]?.content?.parts || !data.candidates[0].content.parts[0]?.text) {
            throw new Error('Resposta da API sem conteúdo válido');
        }
        
        // Extrair o texto da resposta
        const rawText = data.candidates[0].content.parts[0].text;
        
        // Validar e processar o resultado
        const result = validateAndProcessResponse(rawText);
        
        // Adicionar timestamp
        result.timestamp = new Date().toISOString();
        
        logFromAnalyzer(`Análise concluída com sucesso: ${result.action}`, 'SUCCESS');
        return result;
    } catch (error) {
        logFromAnalyzer(`Erro na análise: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Exportar API global para uso em outros módulos
window.AnalyzeGraph = {
    analyzeImage: analyzeImage
};

// =============================================
// Listener Principal
// =============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PROCESS_ANALYSIS') {
        console.log('[Análise] Solicitação de análise recebida');
        
        // Executar em um bloco try-catch para garantir que sendResponse seja sempre chamado
        try {
            // Usar um timeout para garantir que alguma resposta seja enviada
            const timeout = setTimeout(() => {
                console.log('[Análise] Timeout atingido, enviando resposta de erro');
                sendResponse({
                    success: false,
                    error: 'Timeout ao processar análise'
                });
            }, 30000); // 30 segundos
            
            // Processar a análise
            processAnalysis(request.imageData, request.settings)
                .then(result => {
                    clearTimeout(timeout);
                    console.log('[Análise] Enviando resposta de análise concluída');
                    sendResponse({
                        success: true,
                        results: result
                    });
                })
                .catch(error => {
                    clearTimeout(timeout);
                    console.error('[Análise] Erro no processamento:', error);
                    sendResponse({
                        success: false,
                        error: error.message || 'Erro desconhecido no processamento'
                    });
                });
        } catch (error) {
            console.error('[Análise] Erro crítico no processamento:', error);
            sendResponse({
                success: false,
                error: 'Erro crítico ao iniciar processamento'
            });
        }
        
        // Importante: retornar true para indicar que a resposta será assíncrona
        return true;
    }
    
    // Para outras mensagens, não vamos manipular
    return false;
});

logFromAnalyzer('AnalyzeGraph: Carregamento concluído com sistema de inteligência local', 'INFO');
