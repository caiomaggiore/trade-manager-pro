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
            // Erro silencioso
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
            // Erro silencioso
        }
    }
    
    // Obter payout atual da plataforma
    async getCurrentPayout() {
        return new Promise((resolve, reject) => {
            try {
                this.log('🔍 Obtendo payout atual usando capturePayoutFromDOM (mesma função do painel)...', 'DEBUG');
                
                // ✅ CORREÇÃO: Usar a MESMA função que o painel de desenvolvimento usa
                if (typeof window.capturePayoutFromDOM === 'function') {
                    this.log('✅ Usando capturePayoutFromDOM global', 'DEBUG');
                    window.capturePayoutFromDOM()
                        .then(result => {
                            this.log(`✅ Payout capturado via capturePayoutFromDOM: ${result.payout}%`, 'SUCCESS');
                            resolve(result);
                        })
                        .catch(error => {
                            this.log(`❌ Erro na captura via capturePayoutFromDOM: ${error.message}`, 'ERROR');
                            reject(error);
                        });
                } else {
                    // Fallback: usar chrome.runtime para acessar a função via content.js
                    this.log('⚠️ capturePayoutFromDOM não disponível globalmente, usando chrome.runtime', 'WARN');
                    chrome.runtime.sendMessage({
                        action: 'GET_CURRENT_PAYOUT'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            const errorMsg = `Erro de comunicação: ${chrome.runtime.lastError.message}`;
                            this.log(errorMsg, 'ERROR');
                            reject(new Error(errorMsg));
                            return;
                        }
                        
                        if (!response || !response.success) {
                            const errorMsg = response?.error || 'Erro ao obter payout';
                            this.log(errorMsg, 'ERROR');
                            reject(new Error(errorMsg));
                            return;
                        }
                        
                        this.log(`✅ Payout capturado via chrome.runtime: ${response.payout}%`, 'SUCCESS');
                        resolve(response);
                    });
                }
                
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
                const payoutBehavior = config.payoutBehavior || 'wait';
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
                    case 'wait':
                        await this.handleWaitForPayout(currentPayout, minPayout, checkInterval, resolve, reject);
                        break;
                        
                    case 'switch':
                        await this.handleSwitchAsset(currentPayout, minPayout, config, resolve, reject);
                        break;
                        
                    default:
                        this.log(`Comportamento de payout desconhecido: ${payoutBehavior}. Usando 'wait' como padrão.`, 'WARN');
                        await this.handleWaitForPayout(currentPayout, minPayout, checkInterval, resolve, reject);
                }
                
            } catch (error) {
                this.log(`Erro na verificação de payout: ${error.message}`, 'ERROR');
                reject(error);
            }
        });
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
    
    // Aguardar melhora do payout - VERSÃO SIMPLIFICADA E CORRIGIDA
    waitForPayoutImprovement(minPayout, checkInterval, resolve, reject) {
        let elapsedTime = 0;
        let nextCheckIn = checkInterval;
        let mainTimer = null;
        let isCancelled = false;
        
        this.log(`🔄 Iniciando aguardo de payout adequado (mínimo: ${minPayout}%, verificação a cada ${checkInterval}s)`, 'INFO');
        
        // Limpar qualquer flag de cancelamento anterior
        chrome.storage.local.remove(['cancelPayoutWait']);
        
        // ✅ TIMER ÚNICO que faz tudo: atualização visual + verificação de payout + cancelamento
        mainTimer = setInterval(async () => {
            try {
                // 1. VERIFICAR CANCELAMENTO
                const cancelResult = await new Promise((storageResolve) => {
                    chrome.storage.local.get(['cancelPayoutWait'], (data) => {
                        storageResolve(data.cancelPayoutWait || false);
                    });
                });
                
                if (cancelResult || isCancelled) {
                    clearInterval(mainTimer);
                    this.log('🛑 Aguardo de payout cancelado pelo usuário', 'INFO');
                    this.updateStatus('Aguardo cancelado pelo usuário', 'warn', 3000);
                    chrome.storage.local.remove(['cancelPayoutWait']);
                    reject('USER_CANCELLED');
                return;
            }
            
                // 2. ATUALIZAR DISPLAY VISUAL
            nextCheckIn--;
            const minutes = Math.floor(elapsedTime / 60);
            const seconds = elapsedTime % 60;
            const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            
            this.updateStatus(
                    `⏳ Aguardando payout (${minPayout}%) | Próxima verificação: ${nextCheckIn}s | Total: ${timeStr}`, 
                'info', 
                0
            );
            
                // 3. VERIFICAR PAYOUT QUANDO CONTADOR ZERAR
            if (nextCheckIn <= 0) {
                    this.log(`🔍 [${timeStr}] Verificando payout atual...`, 'DEBUG');
                    this.updateStatus(`🔍 Verificando payout...`, 'info', 1000);
                    
                    try {
                    const payoutResult = await this.getCurrentPayout();
                        const currentPayoutNum = parseFloat(payoutResult.payout);
                    const minPayoutNum = parseFloat(minPayout);
                    
                        // LOG DETALHADO
                        this.log(`📊 [VERIFICAÇÃO] Payout: ${currentPayoutNum}% vs Necessário: ${minPayoutNum}%`, 'INFO');
                        this.log(`📊 [VERIFICAÇÃO] Fonte: ${payoutResult.source} | Seletor: ${payoutResult.selector}`, 'DEBUG');
                    
                    if (currentPayoutNum >= minPayoutNum) {
                            // ✅ PAYOUT ADEQUADO - SUCESSO
                            clearInterval(mainTimer);
                            this.log(`✅ Payout adequado alcançado! ${currentPayoutNum}% >= ${minPayoutNum}%`, 'SUCCESS');
                        this.updateStatus(`✅ Payout adequado (${currentPayoutNum}%)! Iniciando análise...`, 'success', 3000);
                        resolve(true);
                        return;
                    } else {
                            // ⏳ PAYOUT AINDA BAIXO - CONTINUAR
                            this.log(`⏳ Payout ainda baixo: ${currentPayoutNum}% < ${minPayoutNum}%. Continuando...`, 'INFO');
                            elapsedTime += checkInterval;
                            nextCheckIn = checkInterval; // Reset contador
                        }
                    
                } catch (payoutError) {
                        clearInterval(mainTimer);
                        this.log(`❌ Erro ao verificar payout: ${payoutError.message}`, 'ERROR');
                        this.updateStatus(`❌ Erro na verificação: ${payoutError.message}`, 'error', 5000);
                    reject(`PAYOUT_READ_ERROR: ${payoutError.message}`);
                    return;
                }
            }
                
            } catch (error) {
                clearInterval(mainTimer);
                this.log(`❌ Erro crítico no aguardo de payout: ${error.message}`, 'ERROR');
                reject(`CRITICAL_ERROR: ${error.message}`);
            }
        }, 1000); // Executar a cada 1 segundo
        
        // Armazenar referência do timer para limpeza
        this.payoutWaitTimer = mainTimer;
        
        this.log(`✅ Sistema de aguardo de payout iniciado (timer único)`, 'DEBUG');
    }
    
    // Parar aguardo de payout (limpar timer)
    stopPayoutWait() {
        if (this.payoutWaitTimer) {
            clearInterval(this.payoutWaitTimer);
            this.payoutWaitTimer = null;
            this.log('Timer de aguardo de payout parado', 'INFO');
        }
    }
    
    // Cancelar aguardo de payout
    cancelPayoutMonitoring() {
        chrome.storage.local.set({ cancelPayoutWait: true }, () => {
            this.log('🛑 Sinal de cancelamento de aguardo de payout enviado', 'INFO');
            this.updateStatus('Cancelando aguardo de payout...', 'info', 3000);
        });
        
        // Também parar o timer diretamente
        this.stopPayoutWait();
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
    
    // =================== FUNÇÕES DE TESTE DE ATIVOS ===================
    
    // Função auxiliar para formatar lista de ativos
    formatAssetsList(assets) {
        if (!assets || assets.length === 0) return 'Nenhum ativo encontrado';
        
        return assets.map((asset, index) => 
            `${index + 1}. ${asset.name} - ${asset.payout}%${asset.isSelected ? ' (SELECIONADO)' : ''}`
        ).join('<br>');
    }
    
    // Teste de busca do melhor ativo
    async testFindBestAsset(minPayout = 85) {
        return new Promise((resolve, reject) => {
            this.log(`Iniciando teste de busca do melhor ativo (payout >= ${minPayout}%)`, 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'TEST_FIND_BEST_ASSET',
                minPayout: minPayout
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `Erro: ${chrome.runtime.lastError.message}`;
                    this.log(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                if (response && response.success) {
                    let resultText = `✅ ${response.message}<br><br>`;
                    resultText += `<strong>Todos os ativos encontrados:</strong><br>`;
                    resultText += this.formatAssetsList(response.allAssets);
                    
                    this.log(`Teste de busca de ativo concluído com sucesso: ${response.message}`, 'SUCCESS');
                    resolve({
                        success: true,
                        message: resultText,
                        asset: response.asset,
                        allAssets: response.allAssets
                    });
                } else {
                    let errorText = `❌ ${response?.error || 'Falha ao buscar ativo'}`;
                    if (response?.allAssets && response.allAssets.length > 0) {
                        errorText += `<br><br><strong>Ativos disponíveis:</strong><br>`;
                        errorText += this.formatAssetsList(response.allAssets);
                    }
                    
                    this.log(`Erro no teste de busca de ativo: ${response?.error}`, 'ERROR');
                    reject({
                        success: false,
                        message: errorText,
                        allAssets: response?.allAssets
                    });
                }
            });
        });
    }
    
    // Teste de troca para categoria específica - CORRIGIDO: Usar lógica do botão "Melhor Ativo"
    async testSwitchAssetCategory(category) {
        return new Promise((resolve, reject) => {
            this.log(`🔄 Iniciando troca para categoria: ${category} (sequência correta: modal→categoria→dados→seleção→fechar)`, 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'TEST_SWITCH_ASSET_CATEGORY',
                category: category
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `Erro: ${chrome.runtime.lastError.message}`;
                    this.log(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                if (response && response.success) {
                    // ✅ NOVA FORMATAÇÃO: Usar dados detalhados da nova função com verificações
                    const category = response.category || 'Não informado';
                    const selectedAsset = response.selectedAsset || 'Não informado';
                    const selectedPayout = response.selectedPayout || 0;
                    const currentAsset = response.currentAsset || 'Verificando...';
                    const totalAssets = response.totalAssets || 0;
                    const validAssets = response.validAssets || 0;
                    const verified = response.verified || false;
                    const attempts = response.verificationAttempts || 0;
                    
                    let resultText = `✅ ${response.message}<br><br>`;
                    resultText += `<strong>📊 Categoria:</strong> ${category}<br>`;
                    resultText += `<strong>🎯 Ativo Selecionado:</strong> ${selectedAsset} (${selectedPayout}%)<br>`;
                    resultText += `<strong>📈 Ativo Atual:</strong> ${currentAsset}<br>`;
                    resultText += `<strong>📁 Total de Ativos:</strong> ${totalAssets}<br>`;
                    resultText += `<strong>✅ Ativos Válidos:</strong> ${validAssets}<br>`;
                    resultText += `<strong>🔍 Verificação:</strong> ${verified ? '✅ Confirmada' : '⚠️ Não confirmada'} (${attempts} tentativas)<br>`;
                    
                    this.log(`✅ Teste de troca de categoria concluído: ${response.message}`, 'SUCCESS');
                    this.log(`📊 DEBUG - Categoria: "${category}", Ativo: "${selectedAsset}", Payout: ${selectedPayout}`, 'DEBUG');
                    
                    resolve({
                        success: true,
                        message: resultText,
                        category: category,
                        selectedAsset: selectedAsset,
                        selectedPayout: selectedPayout,
                        totalAssets: totalAssets,
                        validAssets: validAssets,
                        currentAsset: currentAsset,
                        verified: verified
                    });
                } else {
                    const error = `❌ ${response?.error || 'Falha ao mudar categoria'}`;
                    this.log(`❌ Erro no teste de troca de categoria: ${response?.error}`, 'ERROR');
                    reject({
                        success: false,
                        message: error
                    });
                }
            });
        });
    }
    
    // =================== FUNÇÕES DE DEBUG DO MODAL ===================
    
    // Abrir modal de ativos (debug)
    async testOpenAssetModal() {
        return new Promise((resolve, reject) => {
            this.log('Executando teste de abertura do modal de ativos', 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'TEST_OPEN_ASSET_MODAL'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `❌ ERRO: ${chrome.runtime.lastError.message}`;
                    this.log(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                if (response && response.success) {
                    const success = `✅ SUCESSO: ${response.message}`;
                    this.log(`Modal aberto com sucesso: ${response.message}`, 'SUCCESS');
                    resolve(success);
                } else {
                    const error = `❌ FALHA: ${response?.error || 'Erro desconhecido'}`;
                    this.log(`Erro ao abrir modal: ${response?.error}`, 'ERROR');
                    reject(error);
                }
            });
        });
    }
    
    // Fechar modal de ativos (debug)
    async testCloseAssetModal() {
        return new Promise((resolve, reject) => {
            this.log('Executando teste de fechamento do modal de ativos', 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'CLOSE_ASSET_MODAL'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `❌ ERRO: ${chrome.runtime.lastError.message}`;
                    this.log(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                if (response && response.success) {
                    const success = `✅ SUCESSO: ${response.message}`;
                    this.log(`Modal fechado com sucesso: ${response.message}`, 'SUCCESS');
                    resolve(success);
                } else {
                    const error = `❌ FALHA: ${response?.error || 'Erro desconhecido'}`;
                    this.log(`Erro ao fechar modal: ${response?.error}`, 'ERROR');
                    reject(error);
                }
            });
        });
    }
    
    // Verificar status do modal
    async checkModalStatus() {
        return new Promise((resolve, reject) => {
            this.log('Verificando status do modal de ativos', 'INFO');
            
            // Executar script para verificar status do modal na página
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (!tabs || !tabs.length) {
                    const error = '❌ ERRO: Aba ativa não encontrada';
                    this.log(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        // Verificar elementos do modal
                        const assetButton = document.querySelector('.currencies-block .pair-number-wrap');
                        const activeControl = document.querySelector('.currencies-block__in.active');
                        const modal = document.querySelector('.drop-down-modal.drop-down-modal--quotes-list');
                        const currentAsset = document.querySelector('.current-symbol, .currencies-block .current-symbol_cropped');
                        
                        return {
                            assetButtonExists: !!assetButton,
                            modalIsActive: !!activeControl,
                            modalExists: !!modal,
                            modalVisible: modal ? (modal.style.display !== 'none' && modal.offsetParent !== null) : false,
                            currentAsset: currentAsset ? currentAsset.textContent.trim() : 'Não detectado',
                            timestamp: new Date().toLocaleTimeString()
                        };
                    }
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        const error = `❌ ERRO: ${chrome.runtime.lastError.message}`;
                        this.log(error, 'ERROR');
                        reject(error);
                        return;
                    }
                    
                    if (results && results[0] && results[0].result) {
                        const status = results[0].result;
                        let statusText = `📊 STATUS DO MODAL [${status.timestamp}]:\n`;
                        statusText += `• Botão de controle: ${status.assetButtonExists ? '✅' : '❌'}\n`;
                        statusText += `• Modal ativo (classe): ${status.modalIsActive ? '✅ ABERTO' : '❌ FECHADO'}\n`;
                        statusText += `• Modal existe: ${status.modalExists ? '✅' : '❌'}\n`;
                        statusText += `• Modal visível: ${status.modalVisible ? '✅' : '❌'}\n`;
                        statusText += `• Ativo atual: ${status.currentAsset}`;
                        
                        this.log(`Status do modal verificado: ${JSON.stringify(status)}`, 'INFO');
                        resolve(statusText.replace(/\n/g, '<br>'));
                    } else {
                        const error = '❌ ERRO: Nenhum resultado retornado';
                        this.log(error, 'ERROR');
                        reject(error);
                    }
                });
            });
        });
    }
    
    // Toggle do modal (abrir/fechar automaticamente)
    async testToggleModal() {
        try {
            this.log('Executando toggle do modal de ativos', 'INFO');
            
            // Primeiro verificar status
            const isModalOpen = await new Promise((resolve, reject) => {
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    if (!tabs || !tabs.length) {
                        reject('Aba ativa não encontrada');
                        return;
                    }
                    
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        func: () => {
                            const activeControl = document.querySelector('.currencies-block__in.active');
                            return !!activeControl; // true se modal estiver aberto
                        }
                    }, (results) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError.message);
                            return;
                        }
                        
                        resolve(results && results[0] && results[0].result);
                    });
                });
            });
            
            const action = isModalOpen ? 'CLOSE_ASSET_MODAL' : 'TEST_OPEN_ASSET_MODAL';
            const actionText = isModalOpen ? 'fechar' : 'abrir';
            
            this.log(`Modal está ${isModalOpen ? 'ABERTO' : 'FECHADO'}, tentando ${actionText}...`, 'INFO');
            
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: action
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        const error = `❌ ERRO: ${chrome.runtime.lastError.message}`;
                        this.log(error, 'ERROR');
                        reject(error);
                        return;
                    }
                    
                    if (response && response.success) {
                        const success = `✅ SUCESSO: Modal ${isModalOpen ? 'fechado' : 'aberto'} com sucesso!`;
                        this.log(`Toggle do modal realizado: ${success}`, 'SUCCESS');
                        resolve(success);
                    } else {
                        const error = `❌ FALHA: ${response?.error || 'Erro desconhecido'}`;
                        this.log(`Erro no toggle do modal: ${response?.error}`, 'ERROR');
                        reject(error);
                    }
                });
            });
            
        } catch (error) {
            const errorMsg = `❌ ERRO: ${error}`;
            this.log(`Erro no toggle do modal: ${error}`, 'ERROR');
            throw errorMsg;
        }
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
    // Funções de teste de ativos
    globalThis.testFindBestAsset = payoutControllerInstance.testFindBestAsset.bind(payoutControllerInstance);
    globalThis.testSwitchAssetCategory = payoutControllerInstance.testSwitchAssetCategory.bind(payoutControllerInstance);
    // Funções de debug do modal
    globalThis.testOpenAssetModal = payoutControllerInstance.testOpenAssetModal.bind(payoutControllerInstance);
    globalThis.testCloseAssetModal = payoutControllerInstance.testCloseAssetModal.bind(payoutControllerInstance);
    globalThis.checkModalStatus = payoutControllerInstance.checkModalStatus.bind(payoutControllerInstance);
    globalThis.testToggleModal = payoutControllerInstance.testToggleModal.bind(payoutControllerInstance);
} else if (typeof self !== 'undefined') {
    self.getCurrentPayout = payoutControllerInstance.getCurrentPayout.bind(payoutControllerInstance);
    self.checkPayoutBeforeAnalysis = payoutControllerInstance.checkPayoutBeforeAnalysis.bind(payoutControllerInstance);
    self.cancelPayoutMonitoring = payoutControllerInstance.cancelPayoutMonitoring.bind(payoutControllerInstance);
    // Funções de teste de ativos
    self.testFindBestAsset = payoutControllerInstance.testFindBestAsset.bind(payoutControllerInstance);
    self.testSwitchAssetCategory = payoutControllerInstance.testSwitchAssetCategory.bind(payoutControllerInstance);
    // Funções de debug do modal
    self.testOpenAssetModal = payoutControllerInstance.testOpenAssetModal.bind(payoutControllerInstance);
    self.testCloseAssetModal = payoutControllerInstance.testCloseAssetModal.bind(payoutControllerInstance);
    self.checkModalStatus = payoutControllerInstance.checkModalStatus.bind(payoutControllerInstance);
    self.testToggleModal = payoutControllerInstance.testToggleModal.bind(payoutControllerInstance);
} else {
    // Fallback para ambientes mais antigos
    window.getCurrentPayout = payoutControllerInstance.getCurrentPayout.bind(payoutControllerInstance);
    window.checkPayoutBeforeAnalysis = payoutControllerInstance.checkPayoutBeforeAnalysis.bind(payoutControllerInstance);
    window.cancelPayoutMonitoring = payoutControllerInstance.cancelPayoutMonitoring.bind(payoutControllerInstance);
    // Funções de teste de ativos
    window.testFindBestAsset = payoutControllerInstance.testFindBestAsset.bind(payoutControllerInstance);
    window.testSwitchAssetCategory = payoutControllerInstance.testSwitchAssetCategory.bind(payoutControllerInstance);
    // Funções de debug do modal
    window.testOpenAssetModal = payoutControllerInstance.testOpenAssetModal.bind(payoutControllerInstance);
    window.testCloseAssetModal = payoutControllerInstance.testCloseAssetModal.bind(payoutControllerInstance);
    window.checkModalStatus = payoutControllerInstance.checkModalStatus.bind(payoutControllerInstance);
    window.testToggleModal = payoutControllerInstance.testToggleModal.bind(payoutControllerInstance);
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

        // Módulo carregado 