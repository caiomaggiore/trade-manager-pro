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
// Funções de Análise
// =============================================

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
 * Seleciona o prompt adequado com base nas configurações
 */
const generateAnalysisPrompt = (availablePeriods, userTradeTime, isTestMode) => {
    if (isTestMode) {
        return generateSimplePrompt(availablePeriods, userTradeTime);
    } else {
        return generateDetailedPrompt(availablePeriods, userTradeTime);
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
 * Processa a análise do gráfico
 */
const processAnalysis = async (imageData, settings) => {
    try {
        graphAddLog('Iniciando análise...', 'INFO');
        
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
                        trust: Math.max(localAnalysis.confidence - 20, 30), // Reduzir confiança
                        expiration: 3,
                        localAnalysis: localAnalysis,
                        source: 'local-detector'
                    };
                }
                
                // Log detalhes da análise local para contexto
                graphAddLog(`Elementos detectados: Candlesticks=${localAnalysis.candlesticks.detected}, Indicadores=${localAnalysis.indicators.detected}`, 'DEBUG');
                
                // Adicionar contexto da análise local para a IA
                settings.localContext = {
                    confidence: localAnalysis.confidence,
                    candlesticksCount: localAnalysis.candlesticks.totalCount,
                    indicatorsCount: localAnalysis.indicators.lineCount,
                    quality: localAnalysis.quality.score
                };
                
            } catch (localError) {
                graphAddLog(`Erro na análise local: ${localError.message}`, 'ERROR');
                // Continuar com análise da IA mesmo se análise local falhar
            }
        } else {
            graphAddLog('Local Pattern Detector não disponível, prosseguindo direto para IA', 'WARN');
        }
        
        // *** NOVO: Verificar cache antes de chamar IA ***
        if (window.cacheAnalyzer) {
            const imageHash = btoa(imageData.substring(0, 100)).substring(0, 16);
            const context = {
                automation: settings.automation || false,
                galeActive: settings.galeActive || false,
                localContext: settings.localContext || null
            };
            
            const cachedResult = window.cacheAnalyzer.getAIAnalysis(imageHash, context);
            if (cachedResult) {
                graphAddLog(`Resultado obtido do cache - economizando tokens da IA`, 'SUCCESS');
                return {
                    ...cachedResult,
                    fromCache: true,
                    cacheStats: window.cacheAnalyzer.getStats()
                };
            } else {
                graphAddLog('Análise não encontrada no cache, enviando para IA...', 'INFO');
            }
        }

        // Montar payload para análise
        const payload = {
            contents: [{
                parts: [
                    { text: "Analise o gráfico e responda com JSON: { \"action\": \"BUY/SELL/WAIT\", \"reason\": \"Explicação técnica\", \"trust\": 75, \"expiration\": 5 }" },
                    { 
                        inline_data: {
                            mime_type: "image/png",
                            data: imageData.split(',')[1]
                        }
                    }
                ]
            }]
        };

        // Log direto para o console e para o sistema de logs
        console.log("%c[ANÁLISE] Iniciando processamento de análise de gráfico", "background: #e74c3c; color: white; padding: 5px; font-weight: bold;");
        
        // Obter URL da API de forma segura
        let apiUrl;
        try {
            // Tentar obter a URL diretamente do contexto atual
            if (window.API_URL) {
                apiUrl = window.API_URL;
            } else {
                // Usar URL fixa como fallback
                apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=AIzaSyDJC5a7hDIrV0P1o6P9qBXKxO3j0nTRmxc';
            }
        } catch (error) {
            // Usar URL fixa como fallback se algo der errado
            apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=AIzaSyDJC5a7hDIrV0P1o6P9qBXKxO3j0nTRmxc';
        }
        
        // Enviar para API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data || !data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
            throw new Error('Resposta da API incompleta ou mal formatada');
        }
        
        const text = data.candidates[0].content.parts[0].text;
        
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
                    localContext: settings.localContext || null
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
 * Processa a análise de uma imagem diretamente
 * @param {string} imageData - A imagem em formato dataUrl
 * @param {Object} settings - Configurações do usuário
 * @returns {Promise<Object>} - Resultado da análise
 */
async function analyzeImage(imageData, settings = {}) {
    try {
        logFromAnalyzer('Iniciando análise direta de imagem', 'INFO');
        
        // Verificar se a imagem é válida
        if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
            throw new Error('Dados de imagem inválidos');
        }
        
        // Obter configurações do sistema
        const systemConfig = await getSystemConfig();
        const userTradeTime = settings.period || 0;
        const isTestMode = settings.testMode || false;
        
        // Gerar prompt adequado ao contexto
        const prompt = generateAnalysisPrompt(
            systemConfig.availablePeriods || ["1", "2", "5", "10", "15"],
            userTradeTime,
            isTestMode
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
        logFromAnalyzer('Enviando solicitação para a API Gemini...', 'INFO');
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

logFromAnalyzer('AnalyzeGraph: Carregamento concluído', 'INFO');
