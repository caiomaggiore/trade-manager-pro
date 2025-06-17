// ================== PAYOUT CONTROLLER ==================
// Módulo centralizado para controle de payout
// Responsabilidade única: gerenciar todas as operações relacionadas ao payout

class PayoutController {
    constructor() {
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.currentConfig = null;
        
        // Bind dos métodos para preservar contexto
        this.getCurrentPayout = this.getCurrentPayout.bind(this);
        this.checkPayoutBeforeAnalysis = this.checkPayoutBeforeAnalysis.bind(this);
        this.waitForPayoutImprovement = this.waitForPayoutImprovement.bind(this);
        this.cancelPayoutMonitoring = this.cancelPayoutMonitoring.bind(this);
        
        this.log('PayoutController inicializado', 'INFO');
    }
    
    // Método de log centralizado
    log(message, level = 'INFO') {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: `[PayoutController] ${message}`,
                    level: level,
                    source: 'payout-controller.js'
                });
            }
        } catch (error) {
            console.warn('[PayoutController] Erro ao enviar log:', error);
        }
    }
    
    // Método para atualizar status na UI
    updateStatus(message, type = 'info', duration = 5000) {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    action: 'updateStatus',
                    message: message,
                    type: type,
                    duration: duration
                });
            }
        } catch (error) {
            console.warn('[PayoutController] Erro ao atualizar status:', error);
        }
    }
    
    // Obter payout atual da plataforma
    async getCurrentPayout() {
        return new Promise((resolve, reject) => {
            try {
                this.log('🔍 Obtendo payout atual da plataforma...', 'DEBUG');
                
                // Procurar elemento de payout na página
                const payoutSelectors = [
                    '.payout-value',
                    '.payout',
                    '[data-payout]',
                    '.profit-value',
                    '.profit-percent',
                    // Adicionar mais seletores específicos da PocketOption
                    '.asset-payout',
                    '.payout-percent',
                    '[class*="payout"]',
                    '[class*="profit"]'
                ];
                
                let payoutElement = null;
                let payoutValue = 0;
                let foundSelector = '';
                
                // Tentar encontrar o elemento de payout
                for (const selector of payoutSelectors) {
                    const elements = document.querySelectorAll(selector);
                    this.log(`🔎 Testando seletor "${selector}" - encontrados ${elements.length} elementos`, 'DEBUG');
                    
                    if (elements.length > 0) {
                        // Testar cada elemento encontrado
                        for (let i = 0; i < elements.length; i++) {
                            const element = elements[i];
                            const text = element.textContent || element.innerText || '';
                            this.log(`📝 Elemento ${i+1}: "${text}"`, 'DEBUG');
                            
                            // Verificar se contém um valor de payout válido
                            const payoutMatch = text.match(/(\d+(?:\.\d+)?)\s*%?/);
                            if (payoutMatch) {
                                const value = parseFloat(payoutMatch[1]);
                                if (value >= 50 && value <= 200) { // Payout válido entre 50% e 200%
                                    payoutElement = element;
                                    foundSelector = selector;
                                    this.log(`✅ Elemento de payout encontrado com seletor: ${selector} (${i+1}º elemento)`, 'SUCCESS');
                                    break;
                                }
                            }
                        }
                        
                        if (payoutElement) break;
                    }
                }
                
                if (payoutElement) {
                    // Extrair valor do payout
                    const payoutText = payoutElement.textContent || payoutElement.innerText || '';
                    this.log(`📊 Texto do elemento de payout: "${payoutText}"`, 'DEBUG');
                    
                    const payoutMatch = payoutText.match(/(\d+(?:\.\d+)?)/);
                    
                    if (payoutMatch) {
                        payoutValue = parseFloat(payoutMatch[1]);
                        this.log(`✅ Payout extraído: ${payoutValue}% (seletor: ${foundSelector})`, 'SUCCESS');
                    } else {
                        this.log(`⚠️ Não foi possível extrair valor numérico do texto: "${payoutText}"`, 'WARN');
                        payoutValue = 85; // Valor padrão mais realista
                    }
                } else {
                    this.log('⚠️ Elemento de payout não encontrado, usando valor padrão', 'WARN');
                    
                    // Tentar uma busca mais ampla
                    const allElements = document.querySelectorAll('*');
                    let foundAny = false;
                    
                    for (const element of allElements) {
                        const text = element.textContent || element.innerText || '';
                        if (text.includes('%') && text.match(/\d+\s*%/)) {
                            this.log(`🔍 Elemento com % encontrado: "${text}" (tag: ${element.tagName})`, 'DEBUG');
                            const match = text.match(/(\d+)\s*%/);
                            if (match) {
                                const value = parseInt(match[1]);
                                if (value >= 50 && value <= 200) {
                                    payoutValue = value;
                                    foundAny = true;
                                    this.log(`🎯 Payout encontrado em busca ampla: ${payoutValue}%`, 'INFO');
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (!foundAny) {
                        payoutValue = 85; // Valor padrão mais realista
                        this.log(`🔧 Usando valor padrão: ${payoutValue}%`, 'INFO');
                    }
                }
                
                const result = {
                    success: true,
                    payout: payoutValue,
                    source: payoutElement ? 'platform' : 'default',
                    selector: foundSelector || 'none',
                    timestamp: new Date().toISOString()
                };
                
                this.log(`📈 Resultado final: ${JSON.stringify(result)}`, 'INFO');
                resolve(result);
                
            } catch (error) {
                this.log(`❌ Erro ao obter payout: ${error.message}`, 'ERROR');
                reject(error);
            }
        });
    }
    
    // Verificar payout antes da análise e aplicar comportamento configurado
    async checkPayoutBeforeAnalysis() {
        return new Promise(async (resolve, reject) => {
            try {
                // Obter configurações
                const config = await this.getConfig();
                const minPayout = parseFloat(config.minPayout) || 80;
                const payoutBehavior = config.payoutBehavior || 'cancel';
                const checkInterval = parseInt(config.payoutTimeout) || 5;
                
                this.log(`Verificando payout: Mínimo=${minPayout}%, Comportamento=${payoutBehavior}, Intervalo=${checkInterval}s`, 'INFO');
                
                // Obter payout atual
                const payoutResult = await this.getCurrentPayout();
                const currentPayout = payoutResult.payout;
                this.log(`Payout atual detectado: ${currentPayout}%`, 'INFO');
                
                if (currentPayout >= minPayout) {
                    this.log(`Payout adequado (${currentPayout}% >= ${minPayout}%). Prosseguindo com análise.`, 'SUCCESS');
                    resolve(true);
                    return;
                }
                
                // Payout insuficiente - aplicar comportamento configurado
                this.log(`Payout insuficiente (${currentPayout}% < ${minPayout}%). Aplicando comportamento: ${payoutBehavior}`, 'WARN');
                
                switch (payoutBehavior) {
                    case 'cancel':
                        await this.handleCancelOperation(currentPayout, minPayout);
                        reject('PAYOUT_INSUFFICIENT');
                        break;
                        
                    case 'wait':
                        await this.handleWaitForPayout(currentPayout, minPayout, checkInterval, resolve, reject);
                        break;
                        
                    case 'switch':
                        await this.handleSwitchAsset(currentPayout, minPayout, config, resolve, reject);
                        break;
                        
                    default:
                        this.log(`Comportamento de payout desconhecido: ${payoutBehavior}. Cancelando.`, 'ERROR');
                        reject('UNKNOWN_BEHAVIOR');
                }
                
            } catch (error) {
                this.log(`Erro na verificação de payout: ${error.message}`, 'ERROR');
                reject(error);
            }
        });
    }
    
    // Handler para cancelamento de operação
    async handleCancelOperation(currentPayout, minPayout) {
        const cancelMsg = `Operação cancelada pelo Controle de Payout: ${currentPayout}% abaixo do limite de ${minPayout}%`;
        this.log(cancelMsg, 'WARN');
        this.updateStatus(cancelMsg, 'warn', 8000);
        
        // Cancelar operação atual via chrome.runtime
        try {
            chrome.runtime.sendMessage({
                action: 'CANCEL_CURRENT_OPERATION',
                reason: `Payout inadequado: ${currentPayout}% < ${minPayout}%`,
                source: 'payout-control'
            });
            this.log('Comando de cancelamento enviado via runtime message', 'INFO');
        } catch (error) {
            this.log(`Erro ao enviar comando de cancelamento: ${error.message}`, 'ERROR');
        }
    }
    
    // Handler para aguardar payout adequado
    async handleWaitForPayout(currentPayout, minPayout, checkInterval, resolve, reject) {
        this.log(`Iniciando aguardo de payout adequado (mínimo: ${minPayout}%, verificação a cada ${checkInterval}s)...`, 'INFO');
        this.updateStatus(`⏳ Payout baixo (${currentPayout}% < ${minPayout}%) - Aguardando melhoria...`, 'warn', 0);
        
        // Registrar no log que entrou no modo espera
        this.log(`Sistema entrou no modo ESPERA de payout - aguardando ${minPayout}% (atual: ${currentPayout}%)`, 'INFO');
        
        this.waitForPayoutImprovement(minPayout, checkInterval, resolve, reject);
    }
    
    // Handler para troca de ativo
    async handleSwitchAsset(currentPayout, minPayout, config, resolve, reject) {
        this.log(`Iniciando troca automática de ativo pelo Controle de Payout (atual: ${currentPayout}%, mínimo: ${minPayout}%)`, 'INFO');
        this.updateStatus(`Payout baixo (${currentPayout}%). Procurando melhor ativo...`, 'warn', 4000);
        
        // Obter configurações de troca de ativos
        const assetConfig = config.assetSwitching || {};
        const preferredCategory = assetConfig.preferredCategory || 'crypto';
        
        this.log(`Configuração de troca: categoria preferida = ${preferredCategory}`, 'DEBUG');
        
        // Enviar comando para troca de ativos via chrome.runtime
        try {
            chrome.runtime.sendMessage({
                action: 'ENSURE_BEST_ASSET',
                minPayout: minPayout,
                preferredCategory: preferredCategory,
                source: 'payout-control'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    this.log(`❌ Erro na comunicação para troca de ativo: ${chrome.runtime.lastError.message}`, 'ERROR');
                    reject(`ASSET_SWITCH_COMMUNICATION_ERROR: ${chrome.runtime.lastError.message}`);
                    return;
                }
                
                if (response && response.success) {
                    this.log(`✅ Troca de ativo realizada pelo Controle de Payout: ${response.message}`, 'SUCCESS');
                    this.updateStatus(response.message, 'success', 4000);
                    
                    // Aguardar um pouco para a interface atualizar e resolver
                    setTimeout(() => {
                        this.log('Troca de ativo concluída pelo sistema de controle de payout. Prosseguindo com análise.', 'SUCCESS');
                        resolve(true);
                    }, 2000);
                } else {
                    const errorMsg = response ? response.error : 'Sem resposta do sistema de troca de ativos';
                    this.log(`❌ Falha na troca de ativo pelo Controle de Payout: ${errorMsg}`, 'ERROR');
                    this.updateStatus(`Erro na troca de ativo: ${errorMsg}`, 'error', 5000);
                    reject(`ASSET_SWITCH_FAILED: ${errorMsg}`);
                }
            });
        } catch (error) {
            this.log(`❌ Erro ao solicitar troca de ativo: ${error.message || error}`, 'ERROR');
            this.updateStatus(`Erro na troca de ativo: ${error.message || error}`, 'error', 5000);
            reject(`ASSET_SWITCH_ERROR: ${error.message || error}`);
        }
    }
    
    // Aguardar melhora do payout
    waitForPayoutImprovement(minPayout, checkInterval, resolve, reject) {
        let elapsedTime = 0;
        let isCancelled = false;
        let nextCheckIn = checkInterval; // Contador regressivo para próxima verificação
        
        this.log(`Aguardando payout adequado - verificação ativa (mínimo: ${minPayout}%, intervalo: ${checkInterval}s)`, 'INFO');
        
        // Timer visual que atualiza a cada segundo
        const visualTimer = setInterval(async () => {
            if (isCancelled || !this.isMonitoring) {
                clearInterval(visualTimer);
                return;
            }
            
            nextCheckIn--;
            const minutes = Math.floor(elapsedTime / 60);
            const seconds = elapsedTime % 60;
            const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            
            // Atualizar status visual a cada segundo com contador regressivo e quebra de linha
            this.updateStatus(
                `⏳ Aguardando payout adequado (${minPayout}%) Próxima verificação em ${nextCheckIn}s | Tempo total: ${timeStr}`, 
                'info', 
                0
            );
            
            // Quando o contador chegar a zero, fazer nova verificação de payout
            if (nextCheckIn <= 0) {
                try {
                    this.log(`🔍 Iniciando verificação automática de payout (contador zerou)...`, 'DEBUG');
                    
                    // Mostrar status de verificação
                    this.updateStatus(`🔍 Verificando payout atual...`, 'info', 2000);
                    
                    const payoutResult = await this.getCurrentPayout();
                    const currentPayout = payoutResult.payout;
                    elapsedTime += checkInterval;
                    
                    // LOG DETALHADO DO RESULTADO
                    this.log(`📊 RESULTADO DA VERIFICAÇÃO:`, 'INFO');
                    this.log(`   • Payout atual: ${currentPayout}%`, 'INFO');
                    this.log(`   • Payout necessário: ${minPayout}%`, 'INFO');
                    this.log(`   • Fonte: ${payoutResult.source}`, 'INFO');
                    this.log(`   • Seletor usado: ${payoutResult.selector}`, 'INFO');
                    this.log(`   • Timestamp: ${payoutResult.timestamp}`, 'INFO');
                    
                    this.log(`🔢 Comparação: ${currentPayout} >= ${minPayout} = ${currentPayout >= minPayout}`, 'DEBUG');
                    this.log(`📝 Tipos: currentPayout=${typeof currentPayout}, minPayout=${typeof minPayout}`, 'DEBUG');
                    
                    // Verificar se o payout melhorou (garantir que ambos sejam números)
                    const currentPayoutNum = parseFloat(currentPayout);
                    const minPayoutNum = parseFloat(minPayout);
                    
                    this.log(`🔄 Valores convertidos: currentPayout=${currentPayoutNum}, minPayout=${minPayoutNum}`, 'DEBUG');
                    
                    // MOSTRAR STATUS COM RESULTADO DA VERIFICAÇÃO
                    this.updateStatus(
                        `📊 Payout verificado: ${currentPayoutNum}% (necessário: ${minPayoutNum}%)`, 
                        currentPayoutNum >= minPayoutNum ? 'success' : 'warn', 
                        3000
                    );
                    
                    if (currentPayoutNum >= minPayoutNum) {
                        this.stopMonitoring();
                        clearInterval(visualTimer);
                        this.log(`✅ Payout adequado alcançado! ${currentPayoutNum}% >= ${minPayoutNum}%. Prosseguindo com análise.`, 'SUCCESS');
                        this.updateStatus(`✅ Payout adequado (${currentPayoutNum}%)! Iniciando análise...`, 'success', 3000);
                        resolve(true);
                        return;
                    } else {
                        this.log(`⏳ Payout ainda insuficiente: ${currentPayoutNum}% < ${minPayoutNum}%. Continuando aguardo...`, 'INFO');
                        
                        // Mostrar mensagem de continuação
                        setTimeout(() => {
                            this.updateStatus(
                                `⏳ Payout insuficiente (${currentPayoutNum}% < ${minPayoutNum}%) - Continuando aguardo...`, 
                                'warn', 
                                2000
                            );
                        }, 3000);
                    }
                    
                    // Reset do contador para próxima verificação
                    nextCheckIn = checkInterval;
                    
                } catch (payoutError) {
                    this.stopMonitoring();
                    clearInterval(visualTimer);
                    this.log(`❌ Erro ao verificar payout durante monitoramento: ${payoutError.message}`, 'ERROR');
                    this.updateStatus(`❌ Erro na verificação de payout: ${payoutError.message}`, 'error', 5000);
                    reject(`PAYOUT_READ_ERROR: ${payoutError.message}`);
                    return;
                }
            }
        }, 1000);
        
        const checkPayoutPeriodically = async () => {
            // Verificar cancelamento APENAS via storage
            try {
                const result = await new Promise((storageResolve) => {
                    chrome.storage.local.get(['cancelPayoutWait'], (data) => {
                        storageResolve(data.cancelPayoutWait || false);
                    });
                });
                
                if (result || isCancelled) {
                    this.stopMonitoring();
                    clearInterval(visualTimer);
                    this.log('Aguardo de payout cancelado pelo usuário', 'INFO');
                    this.updateStatus('Aguardo de payout cancelado pelo usuário', 'warn', 3000);
                    
                    // Limpar flag de cancelamento
                    chrome.storage.local.remove(['cancelPayoutWait']);
                    reject('USER_CANCELLED');
                    return;
                }
            } catch (storageError) {
                this.log(`Erro ao verificar cancelamento: ${storageError.message}`, 'WARN');
            }
        };
        
        // Iniciar monitoramento apenas para verificar cancelamento
        // A verificação de payout agora é feita pelo timer visual
        this.startMonitoring(checkPayoutPeriodically, checkInterval * 1000);
    }
    
    // Iniciar monitoramento
    startMonitoring(callback, interval) {
        if (this.isMonitoring) {
            this.log('Monitoramento já está ativo', 'WARN');
            return;
        }
        
        this.isMonitoring = true;
        
        // Executar imediatamente
        callback();
        
        // Configurar intervalo
        this.monitoringInterval = setInterval(callback, interval);
        
        // Armazenar estado no storage
        chrome.storage.local.set({
            payoutMonitoringActive: true
        });
        
        this.log('Monitoramento de payout iniciado', 'INFO');
    }
    
    // Parar monitoramento
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        // Limpar estado no storage
        chrome.storage.local.remove(['payoutMonitoringActive']);
        
        this.log('Monitoramento de payout parado', 'INFO');
    }
    
    // Cancelar monitoramento de payout
    cancelPayoutMonitoring() {
        chrome.storage.local.set({ cancelPayoutWait: true }, () => {
            this.log('Sinal de cancelamento de monitoramento enviado via chrome.storage', 'INFO');
            this.updateStatus('Cancelando monitoramento de payout...', 'info', 3000);
        });
    }
    
    // Obter configurações
    async getConfig() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['userConfig'], (result) => {
                if (chrome.runtime.lastError) {
                    this.log(`Erro ao obter configurações: ${chrome.runtime.lastError.message}`, 'ERROR');
                    resolve({});
                    return;
                }
                
                const config = result.userConfig || {};
                this.currentConfig = config;
                resolve(config);
            });
        });
    }
}

// Criar instância global usando uma abordagem compatível com MV3
if (typeof globalThis !== 'undefined') {
    globalThis.PayoutController = new PayoutController();
} else if (typeof self !== 'undefined') {
    self.PayoutController = new PayoutController();
} else {
    // Fallback para ambientes mais antigos
    window.PayoutController = new PayoutController();
}

// Expor métodos principais globalmente para compatibilidade (usando abordagem MV3)
const payoutControllerInstance = globalThis.PayoutController || self.PayoutController || window.PayoutController;

if (typeof globalThis !== 'undefined') {
    globalThis.getCurrentPayout = payoutControllerInstance.getCurrentPayout.bind(payoutControllerInstance);
    globalThis.checkPayoutBeforeAnalysis = payoutControllerInstance.checkPayoutBeforeAnalysis.bind(payoutControllerInstance);
    globalThis.cancelPayoutMonitoring = payoutControllerInstance.cancelPayoutMonitoring.bind(payoutControllerInstance);
} else if (typeof self !== 'undefined') {
    self.getCurrentPayout = payoutControllerInstance.getCurrentPayout.bind(payoutControllerInstance);
    self.checkPayoutBeforeAnalysis = payoutControllerInstance.checkPayoutBeforeAnalysis.bind(payoutControllerInstance);
    self.cancelPayoutMonitoring = payoutControllerInstance.cancelPayoutMonitoring.bind(payoutControllerInstance);
} else {
    // Fallback para ambientes mais antigos
    window.getCurrentPayout = payoutControllerInstance.getCurrentPayout.bind(payoutControllerInstance);
    window.checkPayoutBeforeAnalysis = payoutControllerInstance.checkPayoutBeforeAnalysis.bind(payoutControllerInstance);
    window.cancelPayoutMonitoring = payoutControllerInstance.cancelPayoutMonitoring.bind(payoutControllerInstance);
}

// Listener para mensagens do chrome.runtime
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'cancelPayoutMonitoring') {
        payoutControllerInstance.cancelPayoutMonitoring();
        sendResponse({ success: true });
        return true;
    }
    
    if (message.action === 'STOP_PAYOUT_MONITORING') {
        payoutControllerInstance.log(`Recebido comando para parar monitoramento: ${message.reason}`, 'INFO');
        payoutControllerInstance.stopMonitoring();
        sendResponse({ success: true, message: 'Monitoramento parado' });
        return true;
    }
});

console.log('[PayoutController] Módulo carregado com sucesso'); 