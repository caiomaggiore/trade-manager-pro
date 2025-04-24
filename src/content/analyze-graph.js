// =============================================
// Configurações Globais
// =============================================
console.log('AnalyzeGraph: Iniciando carregamento...');

// Removendo as constantes duplicadas e usando as do index.js

// =============================================
// Funções de Log
// =============================================
const sendLog = (message) => {
    try {
        chrome.runtime.sendMessage({ 
            action: 'ADD_LOG', 
            log: `[ANALISE] ${message}` 
        });
    } catch (error) {
        console.error('Erro ao enviar log:', error);
    }
};

const sendStatus = (message, type = 'info', duration = 3000) => {
    chrome.runtime.sendMessage({ 
        action: 'UPDATE_STATUS',
        message,
        type,
        duration
    });
};

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

Responda STRICT JSON:
{
  "action": "BUY/SELL/WAIT",
  "reason": "Explicação simples.",
  "trust": "Número de 0-100 indicando confiança",
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
        sendLog('Iniciando análise...');
        
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
        
        sendLog(`Análise concluída: ${result.action} (${result.trust}% de confiança)`, 'success');
        
        return {
            success: true,
            result
        };

    } catch (error) {
        console.error('Erro na análise:', error);
        sendLog(`Erro na análise: ${error.message}`);
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
        console.error('Erro ao obter configurações:', error);
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
                console.error('Erro no processamento:', error);
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
            console.log('AnalyzeGraph: processImage chamado');
            sendLog('Processando imagem para análise...');
            
            // Obter configurações do sistema
            const config = await getSystemConfig();
            const userTradeTime = config.period || 0;
            const isTestMode = config.testMode || false;
            
            if (isTestMode) {
                sendLog('Modo teste de análise ativado - usando prompt simplificado');
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

            console.log('AnalyzeGraph: Enviando para API...');
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
            
            sendLog(`Análise concluída: ${result.action} (${result.trust}% de confiança)`);
            
            return {
                success: true,
                results: result
            };

        } catch (error) {
            console.error('AnalyzeGraph: Erro na análise:', error);
            sendLog(`Erro na análise: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

console.log('AnalyzeGraph: Carregamento concluído');
