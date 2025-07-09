/**
 * Trade Manager Pro - Conversor HTML Colorido Fiel
 * Sistema linear que captura cores reais dos pixels usando apenas = colorido
 */

class FaithfulChartConverter {
    constructor() {
        this.isInitialized = true;
        if (window.addLog) {
            window.addLog('🎨 FaithfulChartConverter ALTA DENSIDADE - Foco na área do gráfico', 'INFO', 'ascii-converter');
            window.addLog('🚀 Resolução 180x90 + Detecção automática da área + Cores CSS fiéis', 'INFO', 'ascii-converter');
        }
    }

    /**
     * Captura e converte para HTML colorido fiel às cores reais
     */
    async captureChartToASCII(imageData) {
        try {
            window.addLog('🎨 Iniciando captura LINEAR com cores FIÉIS aos pixels', 'INFO', 'ascii-converter');
            
            const canvas = await this.imageToCanvas(imageData);
            const colorfulHTML = this.createColorfulHTMLFromPixels(canvas);
            
            return {
                htmlContent: colorfulHTML.html,
                candleStats: colorfulHTML.stats,
                trendAnalysis: colorfulHTML.trendAnalysis,
                dimensions: {
                    width: canvas.width,
                    height: canvas.height,
                    asciiWidth: colorfulHTML.width,
                    asciiHeight: colorfulHTML.height
                },
                processingTime: Date.now()
            };
        } catch (error) {
            window.addLog(`❌ Erro na captura colorida: ${error.message}`, 'ERROR', 'ascii-converter');
            return null;
        }
    }

    /**
     * Cria HTML colorido capturando cores reais dos pixels
     */
    createColorfulHTMLFromPixels(canvas) {
        window.addLog('🎨 Criando HTML com densidade MÁXIMA e área otimizada...', 'INFO', 'ascii-converter');
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Detectar área do gráfico com margens específicas para menus
        const chartArea = this.detectChartAreaPrecise(pixels, canvas.width, canvas.height);
        window.addLog(`📊 Área otimizada detectada: X=${chartArea.left}-${chartArea.right}, Y=${chartArea.top}-${chartArea.bottom}`, 'INFO', 'ascii-converter');
        
        // DENSIDADE REDUZIDA - 15% menor que original (240x120)
        const densityReduction = 0.15;
        const originalWidth = 240;
        const originalHeight = 120;
        const asciiWidth = Math.floor(originalWidth * (1 - densityReduction));   // 204 chars
        const asciiHeight = Math.floor(originalHeight * (1 - densityReduction)); // 102 chars
        
        window.addLog(`📏 Densidade reduzida: ${originalWidth}x${originalHeight} → ${asciiWidth}x${asciiHeight} (-${(densityReduction * 100)}%)`, 'INFO', 'ascii-converter');
        
        // Calcular steps baseado na área do gráfico detectada
        const chartWidth = chartArea.right - chartArea.left;
        const chartHeight = chartArea.bottom - chartArea.top;
        const stepX = Math.max(1, Math.floor(chartWidth / asciiWidth));
        const stepY = Math.max(1, Math.floor(chartHeight / asciiHeight));
        
        let htmlMatrix = [];
        let stats = {
            greenPixels: 0,
            redPixels: 0,
            otherPixels: 0,
            totalPixels: 0
        };
        
        // Array para armazenar coordenadas dos candles APENAS da matriz ASCII final
        let asciiCandleCoordinates = {
            green: [],
            red: [],
            all: []
        };
        
        // Capturar apenas a área do gráfico com densidade máxima
        for (let y = 0; y < asciiHeight; y++) {
            let row = [];
            
            for (let x = 0; x < asciiWidth; x++) {
                // Calcular posição na área do gráfico
                const canvasX = chartArea.left + Math.floor(x * stepX);
                const canvasY = chartArea.top + Math.floor(y * stepY);
                
                // Verificar se está dentro dos limites
                if (canvasX >= canvas.width || canvasY >= canvas.height) {
                    row.push({
                        char: '#',
                        color: 'rgba(15, 15, 15, 1)', // Cor muito escura para área fora
                        rgb: { r: 15, g: 15, b: 15 }
                    });
                    stats.otherPixels++;
                    stats.totalPixels++;
                    continue;
                }
                
                // Obter cor do pixel na área do gráfico
                const pixelIndex = (canvasY * canvas.width + canvasX) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                const a = pixels[pixelIndex + 3];
                
                // Criar cor CSS
                const cssColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                
                // Estatísticas e coordenadas APENAS da matriz ASCII (coordenadas x,y da matriz)
                if (this.isGreenishPixel(r, g, b)) {
                    stats.greenPixels++;
                    asciiCandleCoordinates.green.push({ x, y }); // Coordenadas da matriz ASCII
                    asciiCandleCoordinates.all.push({ x, y, type: 'green' });
                } else if (this.isRedishPixel(r, g, b)) {
                    stats.redPixels++;
                    asciiCandleCoordinates.red.push({ x, y }); // Coordenadas da matriz ASCII
                    asciiCandleCoordinates.all.push({ x, y, type: 'red' });
                } else {
                    stats.otherPixels++;
                }
                stats.totalPixels++;
                
                // Adicionar pixel colorido à matriz - USANDO #
                row.push({
                    char: '#',
                    color: cssColor,
                    rgb: { r, g, b }
                });
            }
            
            htmlMatrix.push(row);
        }
        
        // Calcular linha de tendência baseada APENAS nas coordenadas da matriz ASCII
        const trendAnalysis = this.calculateTrendLineFromASCII(asciiCandleCoordinates, asciiWidth, asciiHeight);
        window.addLog(`📈 Linha calculada da matriz ASCII: ${trendAnalysis.direction} (slope: ${trendAnalysis.slope.toFixed(4)})`, 'INFO', 'ascii-converter');
        
        // Gerar HTML com linha de tendência correta
        const html = this.generateUltraHighDensityHTML(htmlMatrix, stats, canvas, chartArea, trendAnalysis);
        
        window.addLog(`🚀 HTML gerado: ${asciiWidth}x${asciiHeight} chars - Linha baseada APENAS na matriz ASCII`, 'SUCCESS', 'ascii-converter');
        
        return {
            html: html,
            stats: stats,
            width: asciiWidth,
            height: asciiHeight,
            trendAnalysis: trendAnalysis
        };
    }

    /**
     * Detecta área do gráfico com precisão, ignorando menus específicos
     */
    detectChartAreaPrecise(pixels, width, height) {
        window.addLog('🎯 Detectando área PRECISA do gráfico (ignorando menus)...', 'INFO', 'ascii-converter');
        
        // Margens típicas dos menus baseadas na observação do usuário
        const topMenuMargin = Math.floor(height * 0.08);      // ~6 linhas = 8% da altura
        const leftMenuMargin = Math.floor(width * 0.05);      // ~6 colunas = 5% da largura  
        const rightMenuMargin = Math.floor(width * 0.12);     // ~29 colunas = 12% da largura
        const bottomMargin = Math.floor(height * 0.05);       // Margem inferior pequena
        
        window.addLog(`📏 Margens aplicadas: Top=${topMenuMargin}px, Left=${leftMenuMargin}px, Right=${rightMenuMargin}px, Bottom=${bottomMargin}px`, 'INFO', 'ascii-converter');
        
        // Área inicial sem margens de menu
        let chartLeft = leftMenuMargin;
        let chartRight = width - rightMenuMargin;
        let chartTop = topMenuMargin;
        let chartBottom = height - bottomMargin;
        
        // Refinamento: procurar candles dentro dessa área pré-definida
        let minX = chartRight, maxX = chartLeft;
        let minY = chartBottom, maxY = chartTop;
        let candlePixelsFound = 0;
        
        // Buscar candles apenas na área sem menus
        for (let y = chartTop; y < chartBottom; y += 4) { // Amostragem mais densa
            for (let x = chartLeft; x < chartRight; x += 4) {
                const index = (y * width + x) * 4;
                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                
                // Se encontrar pixel verde ou vermelho (candles)
                if (this.isGreenishPixel(r, g, b) || this.isRedishPixel(r, g, b)) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                    candlePixelsFound++;
                }
            }
        }
        
        // Se encontrou candles, usar área refinada com pequena margem
        if (candlePixelsFound > 30) {
            const refinedMarginX = Math.floor((maxX - minX) * 0.05); // 5% de margem
            const refinedMarginY = Math.floor((maxY - minY) * 0.05); // 5% de margem
            
            const refinedArea = {
                left: Math.max(chartLeft, minX - refinedMarginX),
                right: Math.min(chartRight, maxX + refinedMarginX),
                top: Math.max(chartTop, minY - refinedMarginY),
                bottom: Math.min(chartBottom, maxY + refinedMarginY)
            };
            
            window.addLog(`✅ Área refinada com ${candlePixelsFound} pixels de candles detectados`, 'SUCCESS', 'ascii-converter');
            return refinedArea;
        }
        
        // Fallback: usar área sem margens de menu
        window.addLog(`⚠️ Poucos candles detectados (${candlePixelsFound}), usando área sem margens de menu`, 'WARN', 'ascii-converter');
        return {
            left: chartLeft,
            right: chartRight, 
            top: chartTop,
            bottom: chartBottom
        };
    }

    /**
     * Detecta pixel esverdeado (mais tolerante)
     */
    isGreenishPixel(r, g, b) {
        return g > r + 10 && g > b + 5 && g > 60;
    }

    /**
     * Detecta pixel avermelhado (mais tolerante)
     */
    isRedishPixel(r, g, b) {
        return r > g + 10 && r > b + 5 && r > 60;
    }

    /**
     * Gera HTML otimizado e compacto
     */
    generateUltraHighDensityHTML(matrix, stats, canvas, chartArea, trendAnalysis) {
        const now = new Date();
        
        // Dimensões base da matriz ASCII (densidade reduzida)
        const asciiWidth = matrix[0].length;  // 204 chars
        const asciiHeight = matrix.length;    // 102 chars
        
        // Área limpa real (sem menus)
        const cleanAreaWidth = chartArea.right - chartArea.left;   // 1196px
        const cleanAreaHeight = chartArea.bottom - chartArea.top;  // 794px
        
        // DIMENSÕES FIXAS OTIMIZADAS
        const fixedWidth = 600;   // Compacto
        const fixedHeight = 400;  // Proporção ajustada
        
        // Escala de caracteres otimizada
        const charScaleX = fixedWidth / asciiWidth;   // px por char no eixo X
        const charScaleY = fixedHeight / asciiHeight; // px por char no eixo Y
        
        let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>TM Pro - Otimizado</title>
<style>
body{background:#000;color:#fff;font-family:monospace;margin:0;padding:8px;overflow:auto}
.container{background:#0a0a0a;padding:8px;border-radius:4px;border:1px solid #222}
.header{color:#00ffff;margin-bottom:8px;font-size:11px;padding:6px;background:rgba(0,255,255,0.1);border:1px solid #00ffff;border-radius:2px}
.chart-wrapper{position:relative;display:inline-block;width:${fixedWidth}px;height:${fixedHeight}px;background:#000;border:1px solid #333;margin:8px 0}
.grid{position:absolute;width:100%;height:100%;z-index:1}
.grid-line{position:absolute;background:#333;opacity:0.3}
.grid-v{width:1px;height:100%}
.grid-h{height:1px;width:100%}
.coord{position:absolute;font-size:7px;color:#555;background:rgba(0,0,0,0.8);padding:1px 2px;border-radius:1px}
.ascii{position:absolute;width:100%;height:100%;z-index:2;overflow:hidden}
.char{position:absolute;font-size:6px;line-height:${charScaleY.toFixed(1)}px;font-weight:bold;font-family:monospace;width:${charScaleX.toFixed(1)}px;height:${charScaleY.toFixed(1)}px;text-align:center}
.trend{position:absolute;width:100%;height:100%;z-index:3;pointer-events:none}
.trend-line{position:absolute;opacity:0.9;border-top:2px solid;z-index:10}
.trend-alta{border-color:#00ff00;box-shadow:0 0 6px #00ff00}
.trend-baixa{border-color:#ff3333;box-shadow:0 0 6px #ff3333}
.trend-lateral{border-color:#ffaa00;box-shadow:0 0 6px #ffaa00}
.trend-point{position:absolute;width:6px;height:6px;border-radius:50%;z-index:11}
.point-start{background:#00ffff;box-shadow:0 0 6px #00ffff}
.point-end{background:#ff00ff;box-shadow:0 0 6px #ff00ff}
.analysis{position:absolute;top:8px;left:8px;color:#d1d5db;font-size:9px;background:rgba(15,15,15,0.95);padding:4px 6px;border-radius:2px;border:1px solid #6b7280;z-index:4;max-width:300px}
.stats{color:#ffa500;margin-top:8px;font-size:10px;padding:6px;background:rgba(255,165,0,0.1);border:1px solid #ffa500;border-radius:2px}
</style>
</head>
<body>
<div class="container">
<div class="header">
🚀 TRADE MANAGER PRO<br>
📊 ${now.toLocaleString('pt-BR')}<br>
📐 Original: ${canvas.width}x${canvas.height}px<br>
🎯 Área Limpa: ${cleanAreaWidth}x${cleanAreaHeight}px<br>
📏 ASCII: ${asciiWidth}x${asciiHeight} chars<br>
🔧 Fixo: ${fixedWidth}x${fixedHeight}px
</div>
<div class="chart-wrapper">
<div class="grid">`;

        // Grade simplificada (menos elementos)
        const gridSteps = 8;
        const gridStepX = fixedWidth / gridSteps;
        const gridStepY = fixedHeight / gridSteps;
        
        for (let i = 0; i <= gridSteps; i++) {
            const x = i * gridStepX;
            const y = i * gridStepY;
            if (i <= gridSteps) {
                html += `<div class="grid-line grid-v" style="left:${x}px"></div>`;
                html += `<div class="grid-line grid-h" style="top:${y}px"></div>`;
            }
            if (i % 2 === 0) {
                const asciiX = (i / gridSteps) * asciiWidth;
                const asciiY = (i / gridSteps) * asciiHeight;
                html += `<div class="coord" style="left:${x + 2}px;top:2px">X:${asciiX.toFixed(0)}</div>`;
                html += `<div class="coord" style="left:2px;top:${y + 2}px">Y:${asciiY.toFixed(0)}</div>`;
            }
        }
        
        html += `</div><div class="ascii">`;

        // ASCII otimizado (menos elementos HTML)
        let asciiContent = '';
        for (let y = 0; y < Math.min(matrix.length, asciiHeight); y++) {
            for (let x = 0; x < Math.min(matrix[y].length, asciiWidth); x++) {
                const pixel = matrix[y][x];
                const posX = (x / asciiWidth) * fixedWidth;
                const posY = (y / asciiHeight) * fixedHeight;
                asciiContent += `<div class="char" style="left:${posX}px;top:${posY}px;color:${pixel.color}">${pixel.char}</div>`;
            }
        }
        html += asciiContent;

        html += `</div><div class="trend">`;

        // Linha de tendência otimizada
        if (trendAnalysis.direction !== 'INSUFICIENTE' && trendAnalysis.direction !== 'POUCOS_DADOS') {
            const lineClass = `trend-${trendAnalysis.direction.toLowerCase()}`;
            
            const startX = (trendAnalysis.startPoint.x / asciiWidth) * fixedWidth;
            const startY = (trendAnalysis.startPoint.y / asciiHeight) * fixedHeight;
            const endX = (trendAnalysis.endPoint.x / asciiWidth) * fixedWidth;
            const endY = (trendAnalysis.endPoint.y / asciiHeight) * fixedHeight;
            
            const lineLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            const lineAngle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
            
            html += `<div class="trend-line ${lineClass}" style="left:${startX}px;top:${startY}px;width:${lineLength}px;transform:rotate(${lineAngle}deg);transform-origin:0 0"></div>`;
            html += `<div class="trend-point point-start" style="left:${startX - 3}px;top:${startY - 3}px"></div>`;
            html += `<div class="trend-point point-end" style="left:${endX - 3}px;top:${endY - 3}px"></div>`;
            html += `<div class="analysis">📈 ANÁLISE DE TENDÊNCIA:<br>🎯 Direção: <strong>${trendAnalysis.direction}</strong> | 📐 ${trendAnalysis.angle.toFixed(1)}° | 🎲 ${trendAnalysis.confidence.toFixed(1)}%<br>📊 Slope: ${trendAnalysis.slope.toFixed(4)} | 🔍 ${trendAnalysis.pointsAnalyzed}pts | 📈 R²: ${(trendAnalysis.rSquared * 100).toFixed(1)}%</div>`;
        } else {
            html += `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff6600;font-size:11px;text-align:center">⚠️ DADOS INSUFICIENTES</div>`;
        }

        html += `</div></div>`;

        // Estatísticas compactas
        const greenPercent = ((stats.greenPixels / stats.totalPixels) * 100).toFixed(1);
        const redPercent = ((stats.redPixels / stats.totalPixels) * 100).toFixed(1);
        const otherPercent = ((stats.otherPixels / stats.totalPixels) * 100).toFixed(1);
        
        let combinedAnalysis = 'LATERAL';
        if (trendAnalysis.direction === 'ALTA' && stats.greenPixels > stats.redPixels) {
            combinedAnalysis = 'ALTA CONFIRMADA';
        } else if (trendAnalysis.direction === 'BAIXA' && stats.redPixels > stats.greenPixels) {
            combinedAnalysis = 'BAIXA CONFIRMADA';
        } else if (trendAnalysis.direction !== 'LATERAL') {
            combinedAnalysis = `${trendAnalysis.direction}`;
        } else if (stats.greenPixels > stats.redPixels * 1.2) {
            combinedAnalysis = 'ALTA (cores)';
        } else if (stats.redPixels > stats.greenPixels * 1.2) {
            combinedAnalysis = 'BAIXA (cores)';
        }

        html += `<div class="stats">
📊 ESTATÍSTICAS:<br>
🟢 Verdes: ${stats.greenPixels} (${greenPercent}%) | 🔴 Vermelhos: ${stats.redPixels} (${redPercent}%) | ⚫ Outros: ${stats.otherPixels} (${otherPercent}%)<br>
📈 Tendência: <strong>${combinedAnalysis}</strong><br>
🎯 Área: ${cleanAreaWidth}x${cleanAreaHeight}px → ${fixedWidth}x${fixedHeight}px | 📏 ASCII: ${asciiWidth}x${asciiHeight} chars<br>
🔧 Escala: ${charScaleX.toFixed(2)}px/char × ${charScaleY.toFixed(2)}px/char | 📍 (0,0) → (${asciiWidth},${asciiHeight})<br>
✅ OTIMIZADO: -15% densidade, HTML compacto, painel escuro otimizado, chars 6px
</div>
</div>
</body>
</html>`;

        return html;
    }

    /**
     * Calcula linha de tendência baseada APENAS nas coordenadas da matriz ASCII
     */
    calculateTrendLineFromASCII(asciiCandleCoordinates, asciiWidth, asciiHeight) {
        window.addLog('📊 Calculando linha APENAS da matriz ASCII (sem elementos externos)...', 'INFO', 'ascii-converter');
        
        if (asciiCandleCoordinates.all.length < 10) {
            return {
                direction: 'INSUFICIENTE',
                slope: 0,
                startPoint: { x: 0, y: asciiHeight/2 },
                endPoint: { x: asciiWidth, y: asciiHeight/2 },
                angle: 0,
                confidence: 0,
                firstCandleX: 0,
                lastCandleX: asciiWidth,
                candleAreaWidth: asciiWidth
            };
        }
        
        // Encontrar coordenadas reais dos candles NA MATRIZ ASCII
        const allCandles = asciiCandleCoordinates.all.sort((a, b) => a.x - b.x);
        const firstCandleX = allCandles[0].x;
        const lastCandleX = allCandles[allCandles.length - 1].x;
        
        window.addLog(`🎯 Candles na matriz ASCII: Primeiro X=${firstCandleX}, Último X=${lastCandleX}`, 'INFO', 'ascii-converter');
        
        // Separar coordenadas por tempo (x) para análise temporal
        let timePoints = [];
        
        // Agrupar pontos por coluna da matriz ASCII
        for (let x = firstCandleX; x <= lastCandleX; x += 3) {
            let columnPoints = asciiCandleCoordinates.all.filter(point => 
                point.x >= x && point.x < x + 3
            );
            
            if (columnPoints.length > 0) {
                // Calcular média Y das coordenadas da matriz ASCII
                let avgY = columnPoints.reduce((sum, p) => sum + p.y, 0) / columnPoints.length;
                
                // Contar tipos para dar peso à tendência
                let greenCount = columnPoints.filter(p => p.type === 'green').length;
                let redCount = columnPoints.filter(p => p.type === 'red').length;
                let dominantType = greenCount > redCount ? 'green' : 'red';
                
                timePoints.push({
                    x: x + 1.5, // Centro do grupo na matriz ASCII
                    y: avgY, // Coordenadas Y da matriz ASCII
                    weight: columnPoints.length,
                    type: dominantType,
                    greenRatio: greenCount / (greenCount + redCount)
                });
            }
        }
        
        if (timePoints.length < 3) {
            return {
                direction: 'POUCOS_DADOS',
                slope: 0,
                startPoint: { x: firstCandleX, y: asciiHeight/2 },
                endPoint: { x: lastCandleX, y: asciiHeight/2 },
                angle: 0,
                confidence: 0,
                firstCandleX,
                lastCandleX,
                candleAreaWidth: lastCandleX - firstCandleX
            };
        }
        
        // Regressão linear ponderada nas coordenadas da matriz ASCII
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumWeight = 0;
        
        timePoints.forEach(point => {
            const weight = point.weight;
            sumX += point.x * weight;
            sumY += point.y * weight;
            sumXY += point.x * point.y * weight;
            sumX2 += point.x * point.x * weight;
            sumWeight += weight;
        });
        
        const avgX = sumX / sumWeight;
        const avgY = sumY / sumWeight;
        
        // Calcular slope e intercepto
        const slope = (sumXY - sumWeight * avgX * avgY) / (sumX2 - sumWeight * avgX * avgX);
        const intercept = avgY - slope * avgX;
        
        // Pontos da linha de tendência na matriz ASCII
        const startPoint = { x: firstCandleX, y: slope * firstCandleX + intercept };
        const endPoint = { x: lastCandleX, y: slope * lastCandleX + intercept };
        
        // Garantir que os pontos estão dentro da matriz ASCII
        startPoint.y = Math.max(0, Math.min(asciiHeight, startPoint.y));
        endPoint.y = Math.max(0, Math.min(asciiHeight, endPoint.y));
        
        // Calcular ângulo em graus
        const angle = Math.atan(slope) * (180 / Math.PI);
        
        // Determinar direção (Y=0 é topo, então slope negativo = ALTA)
        let direction = 'LATERAL';
        let confidence = Math.abs(slope) * 100;
        
        if (slope < -0.1) {
            direction = 'ALTA'; // Slope negativo = linha desce = preço sobe
        } else if (slope > 0.1) {
            direction = 'BAIXA'; // Slope positivo = linha sobe = preço desce
        }
        
        // Calcular R² para confiança estatística
        let ssTotal = 0, ssRes = 0;
        timePoints.forEach(point => {
            const predicted = slope * point.x + intercept;
            ssRes += Math.pow(point.y - predicted, 2) * point.weight;
            ssTotal += Math.pow(point.y - avgY, 2) * point.weight;
        });
        
        const rSquared = ssTotal > 0 ? 1 - (ssRes / ssTotal) : 0;
        confidence = Math.min(95, Math.abs(rSquared) * 100);
        
        const candleAreaWidth = lastCandleX - firstCandleX;
        
        window.addLog(`📈 Linha da matriz ASCII: ${direction} | Slope: ${slope.toFixed(4)} | Pontos: ${timePoints.length}`, 'INFO', 'ascii-converter');
        
        return {
            direction,
            slope,
            startPoint,
            endPoint,
            angle,
            confidence,
            rSquared,
            pointsAnalyzed: timePoints.length,
            firstCandleX,
            lastCandleX,
            candleAreaWidth
        };
    }

    /**
     * Converte imageData para canvas
     */
    async imageToCanvas(imageData) {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas);
                };
                img.onerror = reject;
                img.src = imageData;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Salva arquivo HTML de alta densidade focado no gráfico
     */
    async saveASCIIFile(asciiData) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const htmlFileName = `[Analises-TM-Pro] grafico_alta_densidade_${timestamp}.html`;
        
        // Salvar apenas arquivo HTML
        const blob = new Blob([asciiData.htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = htmlFileName;
        a.click();
        URL.revokeObjectURL(url);
        
        window.addLog(`💾 Arquivo HTML de alta densidade salvo: ${htmlFileName}`, 'SUCCESS', 'ascii-converter');
        return htmlFileName;
    }

    /**
     * Obtém dados de tendência para integração com outros sistemas
     */
    static getTrendData() {
        return window.lastTrendAnalysis || {
            direction: 'INDETERMINADA',
            angle: 0,
            confidence: 0,
            slope: 0,
            timestamp: null,
            reliable: false
        };
    }

    /**
     * Verifica se a análise de tendência atual é confiável
     */
    static isTrendReliable(minConfidence = 25.0) {
        const trend = this.getTrendData();
        return trend.confidence >= minConfidence && trend.direction !== 'INDETERMINADA';
    }

    /**
     * Obtém recomendação de trading baseada na tendência atual
     */
    static getTradingRecommendation() {
        const trend = this.getTrendData();
        
        if (!this.isTrendReliable()) {
            return {
                action: 'AGUARDAR',
                reason: 'Tendência não confiável ou dados insuficientes',
                confidence: trend.confidence
            };
        }

        let action = 'AGUARDAR';
        let reason = '';

        switch (trend.direction) {
            case 'ALTA':
                action = 'COMPRA';
                reason = `Tendência de alta detectada (${trend.angle.toFixed(1)}°)`;
                break;
            case 'BAIXA':
                action = 'VENDA';
                reason = `Tendência de baixa detectada (${trend.angle.toFixed(1)}°)`;
                break;
            case 'LATERAL':
                action = 'AGUARDAR';
                reason = `Mercado lateral (${trend.angle.toFixed(1)}°)`;
                break;
        }

        return {
            action,
            reason,
            confidence: trend.confidence,
            angle: trend.angle,
            direction: trend.direction
        };
    }
}

// Instância global
window.FaithfulChartConverter = new FaithfulChartConverter();

// Remover instância antiga
if (window.ImagePatternAnalyzer) {
    delete window.ImagePatternAnalyzer;
} 