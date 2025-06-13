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
                this.log('Obtendo payout atual da plataforma...', 'DEBUG');
                
                // Procurar elemento de payout na página
                const payoutSelectors = [
                    '.payout-value',
                    '.payout',
                    '[data-payout]',
                    '.profit-value',
                    '.profit-percent'
                ];
                
                let payoutElement = null;
                let payoutValue = 0;
                
                // Tentar encontrar o elemento de payout
                for (const selector of payoutSelectors) {
                    payoutElement = document.querySelector(selector);
                    if (payoutElement) {
                        this.log(`Elemento de payout encontrado com seletor: ${selector}`, 'DEBUG');
                        break;
                    }
                }
                
                if (payoutElement) {
                    // Extrair valor do payout
                    const payoutText = payoutElement.textContent || payoutElement.innerText || '';
                    const payoutMatch = payoutText.match(/(\d+(?:\.\d+)?)/);
                    
                    if (payoutMatch) {
                        payoutValue = parseFloat(payoutMatch[1]);
                        this.log(`Payout extraído: ${payoutValue}%`, 'SUCCESS');
                    } else {
                        this.log(`Não foi possível extrair valor numérico do texto: "${payoutText}"`, 'WARN');
                        payoutValue = 80; // Valor padrão
                    }
                } else {
                    this.log('Elemento de payout não encontrado, usando valor padrão', 'WARN');
                    payoutValue = 80; // Valor padrão
                }
                
                resolve({
                    success: true,
                    payout: payoutValue,
                    source: payoutElement ? 'platform' : 'default'
                });
                
            } catch (error) {
                this.log(`Erro ao obter payout: ${error.message}`, 'ERROR');
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
        
        // Cancelar operação atual
        if (typeof window.cancelCurrentOperation === 'function') {
            window.cancelCurrentOperation(`Payout inadequado: ${currentPayout}% < ${minPayout}%`);
            this.log('Operação cancelada automaticamente pelo sistema de controle de payout', 'INFO');
        } else {
            // Fallback: enviar mensagem para cancelar
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
        
        // Verificar se a função de troca de ativos está disponível
        if (typeof window.ensureBestAsset === 'function') {
            try {
                const assetResult = await window.ensureBestAsset(minPayout, preferredCategory);
                
                if (assetResult.success) {
                    this.log(`✅ Troca de ativo realizada pelo Controle de Payout: ${assetResult.message}`, 'SUCCESS');
                    this.updateStatus(assetResult.message, 'success', 4000);
                    
                    // Aguardar um pouco para a interface atualizar e resolver
                    setTimeout(() => {
                        this.log('Troca de ativo concluída pelo sistema de controle de payout. Prosseguindo com análise.', 'SUCCESS');
                        resolve(true);
                    }, 2000);
                } else {
                    this.log(`❌ Falha na troca de ativo pelo Controle de Payout: ${assetResult.error}`, 'ERROR');
                    this.updateStatus(`Erro na troca de ativo: ${assetResult.error}`, 'error', 5000);
                    reject(`ASSET_SWITCH_FAILED: ${assetResult.error}`);
                }
            } catch (error) {
                this.log(`❌ Erro na troca de ativo: ${error.message || error}`, 'ERROR');
                this.updateStatus(`Erro na troca de ativo: ${error.message || error}`, 'error', 5000);
                reject(`ASSET_SWITCH_ERROR: ${error.message || error}`);
            }
        } else {
            this.log('❌ Função ensureBestAsset não disponível', 'ERROR');
            reject('ASSET_SWITCH_FUNCTION_NOT_AVAILABLE');
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
                `⏳ Aguardando payout adequado (${minPayout}%)<br>Próxima verificação em ${nextCheckIn}s | Tempo total: ${timeStr}`, 
                'info', 
                0
            );
            
            // Quando o contador chegar a zero, fazer nova verificação de payout
            if (nextCheckIn <= 0) {
                try {
                    const payoutResult = await this.getCurrentPayout();
                    const currentPayout = payoutResult.payout;
                    elapsedTime += checkInterval;
                    
                    this.log(`Verificação automática: Payout atual ${currentPayout}% (necessário: ${minPayout}%)`, 'DEBUG');
                    
                    // Verificar se o payout melhorou
                    if (currentPayout >= minPayout) {
                        this.stopMonitoring();
                        clearInterval(visualTimer);
                        this.log(`Payout adequado alcançado! ${currentPayout}% >= ${minPayout}%. Prosseguindo com análise.`, 'SUCCESS');
                        this.updateStatus(`✅ Payout adequado (${currentPayout}%)! Iniciando análise...`, 'success', 3000);
                        resolve(true);
                        return;
                    }
                    
                    // Reset do contador para próxima verificação
                    nextCheckIn = checkInterval;
                    
                } catch (payoutError) {
                    this.stopMonitoring();
                    clearInterval(visualTimer);
                    this.log(`Erro ao verificar payout durante monitoramento: ${payoutError.message}`, 'ERROR');
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
    
    // Método para atualizar visibilidade dos campos na UI de configurações
    updatePayoutBehaviorVisibility() {
        const payoutBehaviorSelect = document.getElementById('payout-behavior-select');
        const timeoutContainer = document.getElementById('payout-timeout-container');
        const assetContainer = document.getElementById('asset-switching-container');
        
        if (!payoutBehaviorSelect || !timeoutContainer || !assetContainer) {
            this.log('Elementos de UI não encontrados para atualizar visibilidade', 'WARN');
            return;
        }
        
        const behavior = payoutBehaviorSelect.value;
        this.log(`Atualizando visibilidade dos campos - comportamento: ${behavior}`, 'DEBUG');
        
        // Resetar visibilidade
        timeoutContainer.style.display = 'none';
        assetContainer.style.display = 'none';
        
        // Mostrar campos baseado no comportamento
        switch (behavior) {
            case 'wait':
                timeoutContainer.style.display = 'block';
                this.log('Campo de intervalo de verificação exibido', 'DEBUG');
                break;
            case 'switch':
                assetContainer.style.display = 'block';
                this.log('Campo de categoria de ativos exibido', 'DEBUG');
                break;
            case 'cancel':
            default:
                this.log('Todos os campos condicionais ocultados', 'DEBUG');
                break;
        }
    }
}

// Criar instância global
window.PayoutController = new PayoutController();

// Expor métodos principais globalmente para compatibilidade
window.getCurrentPayout = window.PayoutController.getCurrentPayout;
window.checkPayoutBeforeAnalysis = window.PayoutController.checkPayoutBeforeAnalysis;
window.cancelPayoutMonitoring = window.PayoutController.cancelPayoutMonitoring;
window.updatePayoutBehaviorVisibility = window.PayoutController.updatePayoutBehaviorVisibility.bind(window.PayoutController);

// Listener para mensagens do chrome.runtime
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'cancelPayoutMonitoring') {
        window.PayoutController.cancelPayoutMonitoring();
        sendResponse({ success: true });
        return true;
    }
    
    if (message.action === 'STOP_PAYOUT_MONITORING') {
        window.PayoutController.log(`Recebido comando para parar monitoramento: ${message.reason}`, 'INFO');
        window.PayoutController.stopMonitoring();
        sendResponse({ success: true, message: 'Monitoramento parado' });
        return true;
    }
});

console.log('[PayoutController] Módulo carregado com sucesso'); 