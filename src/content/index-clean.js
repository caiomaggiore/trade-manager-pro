/**
 * Trade Manager Pro - Sistema de Captura ASCII
 * Sistema simplificado focado apenas na captura fiel de gráficos em ASCII
 */

// ================== SISTEMA DE CAPTURA ASCII ==================

/**
 * 📸 SISTEMA DE CAPTURA ASCII
 * Conecta botão de captura à função de conversão ASCII
 */
function initEventListeners() {
    window.addLog('🔌 Inicializando sistema de captura ASCII...', 'DEBUG', 'ascii-system');
    
    // Botão único de captura ASCII
    const captureButton = document.getElementById('capture-ascii-chart');
    
    if (captureButton) {
        captureButton.addEventListener('click', async function() {
            window.addLog('📸 Iniciando captura ASCII do gráfico...', 'INFO', 'ascii-system');
            try {
                await captureChartToASCII();
            } catch (error) {
                window.addLog(`❌ Erro na captura ASCII: ${error.message}`, 'ERROR', 'ascii-system');
            }
        });
        window.addLog('✅ Event listener de captura ASCII adicionado', 'SUCCESS', 'ascii-system');
    } else {
        window.addLog('⚠️ Botão de captura ASCII não encontrado', 'WARN', 'ascii-system');
    }
}

/**
 * 📸 FUNÇÃO PRINCIPAL DE CAPTURA ASCII
 */
async function captureChartToASCII() {
    const resultDiv = document.getElementById('ascii-capture-result');
    if (!resultDiv) return;
    
    try {
        resultDiv.innerHTML = '🔄 Capturando gráfico...';
        
        // Verificar módulos necessários
        if (!window.LocalIntelligence) {
            throw new Error('Módulo LocalIntelligence não disponível');
        }
        
        if (!window.FaithfulChartConverter) {
            throw new Error('Conversor ASCII não disponível');
        }
        
        // Capturar screenshot
        window.addLog('📷 Capturando screenshot do gráfico...', 'INFO', 'ascii-capture');
        resultDiv.innerHTML = '🔄 Capturando screenshot...';
        
        const screenshot = await window.LocalIntelligence.captureCurrentChart();
        if (!screenshot) {
            throw new Error('Falha na captura do screenshot');
        }
        
        // Converter para ASCII
        window.addLog('🔄 Convertendo para ASCII...', 'INFO', 'ascii-capture');
        resultDiv.innerHTML = '🔄 Convertendo para ASCII fiel...';
        
        const asciiData = await window.FaithfulChartConverter.captureChartToASCII(screenshot);
        if (!asciiData) {
            throw new Error('Falha na conversão para ASCII');
        }
        
        // Salvar arquivo
        window.addLog('💾 Salvando arquivo ASCII...', 'INFO', 'ascii-capture');
        resultDiv.innerHTML = '🔄 Salvando arquivo...';
        
        const fileName = await window.FaithfulChartConverter.saveASCIIFile(asciiData);
        
        // Mostrar resultado final com análise completa de tendência
        const trendDirection = asciiData.trendAnalysis ? asciiData.trendAnalysis.direction : 'INDETERMINADA';
        const trendAngle = asciiData.trendAnalysis ? asciiData.trendAnalysis.angle.toFixed(1) : '0.0';
        const trendConfidence = asciiData.trendAnalysis ? asciiData.trendAnalysis.confidence.toFixed(1) : '0.0';
        const trendSlope = asciiData.trendAnalysis ? asciiData.trendAnalysis.slope.toFixed(4) : '0.0000';
        
        // Armazenar dados globalmente para uso do sistema
        window.lastTrendAnalysis = {
            direction: trendDirection,
            angle: parseFloat(trendAngle),
            confidence: parseFloat(trendConfidence),
            slope: parseFloat(trendSlope),
            timestamp: new Date().toISOString(),
            reliable: parseFloat(trendConfidence) > 25.0
        };
        
        let resultHTML = '<div style="text-align: left; font-size: 11px; line-height: 1.4;">';
        resultHTML += '<strong>✅ CAPTURA ASCII CONCLUÍDA!</strong><br><br>';
        resultHTML += `📄 <strong>Arquivo:</strong> ${fileName}<br>`;
        resultHTML += `📐 <strong>Resolução:</strong> ${asciiData.dimensions.asciiWidth}x${asciiData.dimensions.asciiHeight} chars<br>`;
        resultHTML += `🟢 <strong>Candles de Alta:</strong> ${asciiData.candleStats.greenPixels}<br>`;
        resultHTML += `🔴 <strong>Candles de Baixa:</strong> ${asciiData.candleStats.redPixels}<br>`;
        resultHTML += `📊 <strong>Tendência:</strong> <strong>${trendDirection}</strong> | 📐 ${trendAngle}° | 🎲 ${trendConfidence}%<br>`;
        resultHTML += `💾 <strong>Arquivo HTML:</strong> Salvo com sucesso!<br>`;
        resultHTML += '</div>';
        
        // Log da análise para o sistema
        window.addLog(`📈 Análise de Tendência: ${trendDirection} (${trendAngle}°, ${trendConfidence}% confiança)`, 'SUCCESS', 'trend-analysis');
        
        resultDiv.innerHTML = resultHTML;
        
        window.addLog(`✅ Captura ASCII concluída: ${fileName}`, 'SUCCESS', 'ascii-capture');
        
    } catch (error) {
        window.addLog(`❌ Erro na captura ASCII: ${error.message}`, 'ERROR', 'ascii-capture');
        resultDiv.innerHTML = `❌ <strong>Erro:</strong> ${error.message}`;
    }
}

// ================== SISTEMA DE DEBUG SIMPLIFICADO ==================

/**
 * 🐛 SISTEMA DE DEBUG SIMPLIFICADO
 * Verificação básica dos módulos necessários
 */
function initDebugSystem() {
    window.addLog('🔧 Inicializando sistema de debug...', 'DEBUG', 'debug-system');
    
    // Verificação dos módulos essenciais
    const checkModules = () => {
        const modules = {
            'LocalIntelligence': !!window.LocalIntelligence,
            'FaithfulChartConverter': !!window.FaithfulChartConverter,
            'addLog': !!window.addLog
        };
        
        window.addLog(`🧩 Status dos módulos verificado`, 'DEBUG', 'debug-system');
        
        // Mostrar no debug div se existir
        const debugDiv = document.getElementById('ascii-capture-result');
        if (debugDiv && debugDiv.innerHTML.includes('Status dos módulos')) {
            let statusText = '🧩 Módulos: ';
            for (const [name, loaded] of Object.entries(modules)) {
                statusText += `${name}:${loaded ? '✅' : '❌'} `;
            }
            debugDiv.innerHTML = statusText;
        }
        
        return modules;
    };
    
    // Verificar módulos agora e a cada 10 segundos
    checkModules();
    setInterval(checkModules, 10000);
    
    window.addLog('✅ Sistema de debug ativo', 'SUCCESS', 'debug-system');
}

// ================== INICIALIZAÇÃO ==================

/**
 * 🚀 INICIALIZAÇÃO DO SISTEMA ASCII
 */
document.addEventListener('DOMContentLoaded', function() {
    window.addLog('🚀 DOM carregado, inicializando sistema ASCII...', 'INFO', 'startup');
    
    // Aguardar carregamento dos módulos
    setTimeout(() => {
        // Inicializar sistemas
        initEventListeners();
        initDebugSystem();
        
        window.addLog('✅ Sistema de captura ASCII totalmente inicializado', 'SUCCESS', 'startup');
        
    }, 1000);
});

// ================== EXPORTAÇÕES GLOBAIS ==================

// Expor função principal globalmente para testes manuais
window.captureChartToASCII = captureChartToASCII; 