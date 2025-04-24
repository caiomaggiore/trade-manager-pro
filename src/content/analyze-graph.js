// =============================================
// Configurações Globais
// =============================================
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
    // Verificar se temos a função global do sistema de logs
    if (typeof window.logToSystem === 'function') {
        window.logToSystem(message, level, source);
        return;
    }
    
    // Método alternativo (fallback) caso a função global não esteja disponível
    try {
        logFromAnalyzer(`[${level}][${source}] ${message}`, level);
    } catch (error) {
        logFromAnalyzer(`Erro ao registrar log: ${error.message}`, 'ERROR');
    }
}

/**
 * Atualiza o status na interface
 * @param {string} message - Mensagem de status
 * @param {string} type - Tipo de status: 'info', 'success', 'warning', 'error'
 * @param {number} duration - Duração em ms (0 para não desaparecer)
 */
function graphUpdateStatus(message, type = 'info', duration = 3000) {
    // Log a mensagem de status
    graphAddLog(message, type.toUpperCase(), 'STATUS');
    
    try {
        // Enviar para o background para atualizar a UI
        chrome.runtime.sendMessage({ 
            action: 'UPDATE_STATUS',
            message,
            type,
            duration
        });
    } catch (error) {
        logFromAnalyzer(`Erro ao atualizar status: ${error.message}`, 'ERROR');
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

        // Enviar para API
        const response = await fetch(chrome.runtime.getURL('scripts/index.js').then(url => {
            const script = document.createElement('script');
            script.src = url;
            document.head.appendChild(script);
            return window.API_URL;
        }), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        
        // Extrair JSON da resposta
        const jsonMatch = text.match(/{[\s\S]*?}/);
        if (!jsonMatch) {
            throw new Error('Resposta inválida da API');
        }

        const result = JSON.parse(jsonMatch[0]);
        
        graphAddLog(`Análise concluída: ${result.action} (${result.trust}% de confiança)`, 'success');
        
        return {
            success: true,
            result
        };

    } catch (error) {
        logFromAnalyzer('Erro na análise:', 'ERROR');
        logFromAnalyzer(`Erro na análise: ${error.message}`, 'ERROR');
        return {
            success: false,
            error: error.message
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
// Listener Principal
// =============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PROCESS_ANALYSIS') {
        processAnalysis(request.imageData, request.settings)
            .then(sendResponse)
            .catch(error => {
                logFromAnalyzer('Erro no processamento:', 'ERROR');
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }
});

// Expor o objeto AnalyzeGraph globalmente
window.TradeManager = window.TradeManager || {};
window.TradeManager.AnalyzeGraph = {
    processImage: async (imageData) => {
        try {
            logFromAnalyzer('AnalyzeGraph: processImage chamado', 'INFO');
            graphAddLog('Processando imagem para análise...', 'INFO');
            
            // Obter configurações do sistema
            const config = await getSystemConfig();
            const userTradeTime = config.period || 0;
            const isTestMode = config.testMode || false;
            
            if (isTestMode) {
                graphAddLog('Modo teste de análise ativado - usando prompt simplificado', 'INFO');
            }
            
            // Montar payload para análise
            const payload = {
                contents: [{
                    parts: [
                        { text: generateAnalysisPrompt([1, 5, 15, 30, 60], userTradeTime, isTestMode) },
                        { 
                            inline_data: {
                                mime_type: "image/png",
                                data: imageData.split(',')[1]
                            }
                        }
                    ]
                }]
            };

            logFromAnalyzer('AnalyzeGraph: Enviando para API...', 'INFO');
            // Enviar para API usando a URL do index.js
            const response = await fetch(window.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            
            // Processar resposta
            const result = validateAndProcessResponse(text);
            
            // Adicionar flag de modo teste ao resultado
            result.isTestMode = isTestMode;
            
            graphAddLog(`Análise concluída: ${result.action} (${result.trust}% de confiança)`, 'success');
            
            return {
                success: true,
                results: result
            };

        } catch (error) {
            logFromAnalyzer('AnalyzeGraph: Erro na análise:', 'ERROR');
            logFromAnalyzer(`Erro na análise: ${error.message}`, 'ERROR');
            return {
                success: false,
                error: error.message
            };
        }
    }
};

logFromAnalyzer('AnalyzeGraph: Carregamento concluído', 'INFO');

// Função para logging unificada com o sistema central
function logFromAnalyzer(message, level = 'INFO') {
    // Verificar se a função global de log está disponível
    if (typeof window.logToSystem === 'function') {
        window.logToSystem(message, level, 'analyze-graph.js');
        return;
    }
    
    // Fallback: método original quando logToSystem não está disponível
    console.log(`[${level}][analyze-graph.js] ${message}`);
    
    // Enviar para o sistema centralizado via mensagem
    try {
        chrome.runtime.sendMessage({
            action: 'logMessage',
            message: message,
            level: level,
            source: 'analyze-graph.js'
        });
    } catch (error) {
        console.error('[analyze-graph.js] Erro ao enviar log:', error);
    }
}
