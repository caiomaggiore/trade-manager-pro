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
 * Gera prompt dinâmico para análise
 */
const generateAnalysisPrompt = (availablePeriods, userTradeTime) => {
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
