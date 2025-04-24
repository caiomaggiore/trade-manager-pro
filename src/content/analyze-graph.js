// =============================================
// Configurações Globais
// =============================================
// Definir a função para log primeiro para evitar problemas de referência circular
function logFromAnalyzer(message, level = 'INFO') {
    // Não elevar mais o nível para manter a consistência com o nível original
    
    // Verificar se a função global de log está disponível
    if (typeof window.logToSystem === 'function') {
        try {
            window.logToSystem(message, level, 'analyze-graph.js');
            return;
        } catch (err) {
            // Fallback para console se logToSystem falhar
            console.log(`%c[${level}][analyze-graph.js] ${message}`, 'background: #3498db; color: white; padding: 3px; border-radius: 3px;');
        }
    } else {
        // Fallback: método original quando logToSystem não está disponível
        console.log(`%c[${level}][analyze-graph.js] ${message}`, 'background: #3498db; color: white; padding: 3px; border-radius: 3px;');
    }
    
    // Enviar para o sistema centralizado via mensagem
    try {
        // Verificar se o contexto da extensão ainda é válido
        if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: 'logMessage',
                message: message,
                level: level,
                source: 'analyze-graph.js'
            }, response => {
                // Silenciar erros do callback
                if (chrome.runtime.lastError) {
                    // Apenas logar no console e continuar
                    console.log(`Erro ao enviar log (ignorando): ${chrome.runtime.lastError.message}`);
                }
            });
        }
    } catch (error) {
        // Apenas logar e continuar - não queremos que falhas de log interrompam a análise
        console.log('Não foi possível enviar log para o background. Continuando execução...');
    }
}

// Agora podemos usar a função de log
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
    // Não elevar mais o nível para manter a consistência com o nível original
    
    // Não forçar mais a fonte a incluir "analysis" para permitir logs naturais
    
    // Verificar se temos a função global do sistema de logs
    if (typeof window.logToSystem === 'function') {
        try {
            window.logToSystem(message, level, source);
            return;
        } catch (error) {
            // Se logToSystem falhar, use o fallback
            console.log(`%c[${level}][${source}] ${message}`, 'background: #3498db; color: white; padding: 3px; border-radius: 3px;');
        }
    }
    
    // Método alternativo (fallback) caso a função global não esteja disponível
    try {
        logFromAnalyzer(`[${level}][${source}] ${message}`, level);
    } catch (error) {
        // Último recurso - apenas logar no console e continuar
        console.log(`%c[${level}][${source}] ${message}`, 'background: #3498db; color: white; padding: 3px; border-radius: 3px;');
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
        // Verificar se o contexto da extensão ainda é válido
        if (chrome && chrome.runtime && chrome.runtime.id) {
            // Enviar para o background para atualizar a UI
            chrome.runtime.sendMessage({ 
                action: 'UPDATE_STATUS',
                message,
                type,
                duration
            }, response => {
                // Silenciar erros do callback
                if (chrome.runtime.lastError) {
                    console.log(`Erro ao atualizar status (ignorando): ${chrome.runtime.lastError.message}`);
                    
                    // Tentativa de atualizar diretamente o DOM como fallback
                    try {
                        const statusElement = document.getElementById('status-processo');
                        if (statusElement) {
                            statusElement.textContent = message;
                            statusElement.className = `status-${type}`;
                        }
                    } catch (domError) {
                        // Silenciar erros de manipulação do DOM
                    }
                }
            });
        } else {
            // Tentar atualizar diretamente o DOM como fallback
            const statusElement = document.getElementById('status-processo');
            if (statusElement) {
                statusElement.textContent = message;
                statusElement.className = `status-${type}`;
            }
        }
    } catch (error) {
        console.log(`Não foi possível atualizar status. Continuando execução...`);
        
        // Tentar atualizar diretamente o DOM como último recurso
        try {
            const statusElement = document.getElementById('status-processo');
            if (statusElement) {
                statusElement.textContent = message;
                statusElement.className = `status-${type}`;
            }
        } catch (domError) {
            // Silenciar erros de manipulação do DOM
        }
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
// Listener Principal
// =============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Verificar se a mensagem é para processamento de análise
    if (request && request.action === 'PROCESS_ANALYSIS') {
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
                    sendResponse(result);
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

// Expor o objeto AnalyzeGraph globalmente
window.TradeManager = window.TradeManager || {};
window.TradeManager.AnalyzeGraph = {
    processImage: async (imageData) => {
        try {
            logFromAnalyzer('AnalyzeGraph: processImage chamado', 'SUCCESS');
            graphAddLog('Processando imagem para análise...', 'SUCCESS');
            
            // Obter configurações do sistema
            const config = await getSystemConfig();
            const userTradeTime = config.period || 0;
            const isTestMode = config.testMode || false;
            
            if (isTestMode) {
                graphAddLog('Modo teste de análise ativado - usando prompt simplificado', 'SUCCESS');
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

            logFromAnalyzer('AnalyzeGraph: Enviando para API...', 'SUCCESS');
            // Enviar para API usando a URL do index.js
            const response = await fetch(window.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            logFromAnalyzer('Recebida resposta da API, processando resultado...', 'SUCCESS');
            
            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            
            // Processar resposta
            const result = validateAndProcessResponse(text);
            
            // Adicionar flag de modo teste ao resultado
            result.isTestMode = isTestMode;
            
            graphAddLog(`Análise concluída: ${result.action} (${result.trust}% de confiança)`, 'SUCCESS');
            logFromAnalyzer(`Resultado da análise: ${result.action} - Confiança: ${result.trust}% - Explicação: ${result.reason.substring(0, 50)}...`, 'SUCCESS');
            
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
