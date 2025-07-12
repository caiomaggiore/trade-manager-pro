// ================== TESTE DE CAPTURA DO CANVAS ==================
// Este arquivo contém funções de teste para verificar a captura do canvas
// Pode ser executado no console do navegador para debug

// Função de teste para capturar informações do canvas
function testCanvasCapture() {
    console.log('🧪 Iniciando teste de captura do canvas...');
    
    // Seletores para encontrar o canvas do gráfico
    const canvasSelectors = [
        '#chart-1 > canvas',
        '#chart-1 canvas',
        'canvas.layer.plot',
        'canvas[class*="plot"]',
        'canvas[class*="chart"]',
        'canvas[width][height]'
    ];
    
    console.log('🔍 Testando seletores específicos...');
    
    let canvasElement = null;
    let foundSelector = '';
    
    // Tentar encontrar o canvas usando os seletores
    for (const selector of canvasSelectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`🔎 Seletor "${selector}": ${elements.length} elementos encontrados`);
        
        if (elements.length > 0) {
            // Verificar se é realmente um canvas de gráfico
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                const width = element.width || element.offsetWidth;
                const height = element.height || element.offsetHeight;
                
                console.log(`  Elemento ${i+1}: ${width}x${height} - Classes: ${element.className}`);
                
                // Canvas de gráfico geralmente tem dimensões significativas
                if (width > 100 && height > 100) {
                    canvasElement = element;
                    foundSelector = selector;
                    console.log(`✅ Canvas encontrado com seletor: ${selector} (${i+1}º elemento)`);
                    break;
                }
            }
            
            if (canvasElement) break;
        }
    }
    
    // Se não encontrou com seletores específicos, fazer busca ampla
    if (!canvasElement) {
        console.log('🔍 Seletores específicos não funcionaram, fazendo busca ampla...');
        
        // Busca ampla por todos os canvas
        const allCanvas = document.querySelectorAll('canvas');
        console.log(`🔍 Encontrados ${allCanvas.length} canvas na página`);
        
        for (let i = 0; i < allCanvas.length; i++) {
            const canvas = allCanvas[i];
            const width = canvas.width || canvas.offsetWidth;
            const height = canvas.height || canvas.offsetHeight;
            const style = getComputedStyle(canvas);
            
            console.log(`  Canvas ${i+1}: ${width}x${height} - Classes: ${canvas.className} - Position: ${style.position}`);
            
            // Verificar se é um canvas de gráfico (dimensões significativas e posicionamento absoluto)
            if (width > 100 && height > 100 && 
                (style.position === 'absolute' || canvas.classList.contains('plot') || canvas.classList.contains('chart'))) {
                canvasElement = canvas;
                foundSelector = 'busca-ampla';
                console.log(`🎯 Canvas encontrado em busca ampla: ${width}x${height}`);
                break;
            }
        }
    }
    
    // Preparar resultado
    if (canvasElement) {
        const rect = canvasElement.getBoundingClientRect();
        const width = canvasElement.width || canvasElement.offsetWidth;
        const height = canvasElement.height || canvasElement.offsetHeight;
        
        const result = {
            success: true,
            data: {
                width: width,
                height: height,
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                selector: foundSelector,
                className: canvasElement.className,
                id: canvasElement.id,
                style: {
                    position: getComputedStyle(canvasElement).position,
                    display: getComputedStyle(canvasElement).display,
                    visibility: getComputedStyle(canvasElement).visibility
                }
            },
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ Informações do canvas capturadas com sucesso:', result);
        return result;
    } else {
        console.log('❌ Canvas do gráfico não encontrado na página');
        return {
            success: false,
            error: 'Canvas do gráfico não encontrado na página'
        };
    }
}

// Função para testar a comunicação com a extensão
function testExtensionCommunication() {
    console.log('🧪 Testando comunicação com a extensão...');
    
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        console.log('✅ Extensão detectada, enviando mensagem...');
        
        chrome.runtime.sendMessage({ action: 'GET_CANVAS_INFO' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('❌ Erro na comunicação:', chrome.runtime.lastError.message);
                return;
            }
            
            if (response && response.success) {
                console.log('✅ Resposta da extensão:', response);
            } else {
                console.log('❌ Erro na resposta:', response);
            }
        });
    } else {
        console.log('❌ Extensão não detectada');
    }
}

// Função para listar todos os canvas na página
function listAllCanvas() {
    console.log('📋 Listando todos os canvas na página...');
    
    const allCanvas = document.querySelectorAll('canvas');
    console.log(`Encontrados ${allCanvas.length} canvas:`);
    
    allCanvas.forEach((canvas, index) => {
        const width = canvas.width || canvas.offsetWidth;
        const height = canvas.height || canvas.offsetHeight;
        const style = getComputedStyle(canvas);
        
        console.log(`  ${index + 1}. ${width}x${height} - Classes: "${canvas.className}" - ID: "${canvas.id}" - Position: ${style.position}`);
        
        // Mostrar hierarquia do DOM
        let parent = canvas.parentElement;
        let hierarchy = canvas.tagName;
        let level = 0;
        
        while (parent && level < 5) {
            hierarchy = `${parent.tagName} > ${hierarchy}`;
            parent = parent.parentElement;
            level++;
        }
        
        console.log(`     Hierarquia: ${hierarchy}`);
    });
}

// Função para testar seletores específicos
function testSpecificSelectors() {
    console.log('🎯 Testando seletores específicos...');
    
    const selectors = [
        '#chart-1 > canvas',
        '#chart-1 canvas',
        'canvas.layer.plot',
        'canvas[class*="plot"]',
        'canvas[class*="chart"]',
        'canvas[width][height]',
        'canvas[width="998"]',
        'canvas[height="851"]'
    ];
    
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`"${selector}": ${elements.length} elementos`);
        
        elements.forEach((element, index) => {
            const width = element.width || element.offsetWidth;
            const height = element.height || element.offsetHeight;
            console.log(`  ${index + 1}. ${width}x${height} - Classes: "${element.className}"`);
        });
    });
}

// Executar testes automaticamente
console.log('🚀 Iniciando testes de captura do canvas...');
console.log('📝 Use as funções: testCanvasCapture(), testExtensionCommunication(), listAllCanvas(), testSpecificSelectors()');

// Executar teste básico
testCanvasCapture(); 