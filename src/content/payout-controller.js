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
        
        this.logToSystem('PayoutController inicializado', 'INFO');
    }
    
    // Sistema de logs otimizado (novo padrão)
    logToSystem(message, level = 'INFO') {
        if (window.sendLog) {
            window.sendLog(message, level, 'payout-controller');
        }
    }
    
    // Sistema de status otimizado (novo padrão)
    updateStatus(message, type = 'info', duration = 5000) {
        if (window.sendStatus) {
            window.sendStatus(message, type, duration);
        }
    }
    
    // Obter payout atual da plataforma
    async getCurrentPayout() {
        return new Promise((resolve, reject) => {
            try {
                // Usar a MESMA função que o painel de desenvolvimento usa
                if (typeof window.capturePayoutFromDOM === 'function') {
                    window.capturePayoutFromDOM()
                        .then(result => {
                            this.logToSystem(`Payout capturado: ${result.payout}%`, 'SUCCESS');
                            resolve(result);
                        })
                        .catch(error => {
                            this.logToSystem(`Erro na captura: ${error.message}`, 'ERROR');
                            reject(error);
                        });
                } else {
                    // Fallback: usar chrome.runtime para acessar a função via content.js
                    this.logToSystem('capturePayoutFromDOM não disponível, usando chrome.runtime', 'WARN');
                    chrome.runtime.sendMessage({
                        action: 'GET_CURRENT_PAYOUT'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            const errorMsg = `Erro de comunicação: ${chrome.runtime.lastError.message}`;
                            this.logToSystem(errorMsg, 'ERROR');
                            reject(new Error(errorMsg));
                            return;
                        }
                        
                        if (!response || !response.success) {
                            const errorMsg = response?.error || 'Erro ao obter payout';
                            this.logToSystem(errorMsg, 'ERROR');
                            reject(new Error(errorMsg));
                            return;
                        }
                        
                        this.logToSystem(`Payout capturado: ${response.payout}%`, 'SUCCESS');
                        resolve(response);
                    });
                }
                
            } catch (error) {
                this.logToSystem(`Erro ao obter payout: ${error.message}`, 'ERROR');
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
                
                this.logToSystem(`Verificando payout: mínimo ${minPayout}%, comportamento ${payoutBehavior}`, 'INFO');
                
                // Obter payout atual
                const payoutResult = await this.getCurrentPayout();
                const currentPayout = payoutResult.payout;
                
                if (currentPayout >= minPayout) {
                    this.logToSystem(`Payout adequado (${currentPayout}% >= ${minPayout}%)`, 'SUCCESS');
                    resolve(true);
                    return;
                }
                
                // Payout insuficiente - aplicar comportamento configurado
                this.logToSystem(`Payout insuficiente (${currentPayout}% < ${minPayout}%), aplicando ${payoutBehavior}`, 'WARN');
                
                switch (payoutBehavior) {
                    case 'wait':
                        await this.handleWaitForPayout(currentPayout, minPayout, checkInterval, resolve, reject);
                        break;
                        
                    case 'switch':
                        await this.handleSwitchAsset(currentPayout, minPayout, config, resolve, reject);
                        break;
                        
                    default:
                        this.logToSystem(`Comportamento desconhecido: ${payoutBehavior}, usando 'wait'`, 'WARN');
                        await this.handleWaitForPayout(currentPayout, minPayout, checkInterval, resolve, reject);
                }
                
            } catch (error) {
                this.logToSystem(`Erro na verificação de payout: ${error.message}`, 'ERROR');
                reject(error);
            }
        });
    }
    
    // Handler para aguardar payout adequado
    async handleWaitForPayout(currentPayout, minPayout, checkInterval, resolve, reject) {
        this.logToSystem(`Iniciando aguardo de payout (mínimo: ${minPayout}%)`, 'INFO');
        this.updateStatus(`⏳ Payout baixo (${currentPayout}% < ${minPayout}%) - Aguardando melhoria...`, 'warn', 0);
        
        this.waitForPayoutImprovement(minPayout, checkInterval, resolve, reject);
    }
    
    // Handler para troca de ativo
    async handleSwitchAsset(currentPayout, minPayout, config, resolve, reject) {
        this.logToSystem(`Iniciando troca de ativo (atual: ${currentPayout}%, mínimo: ${minPayout}%)`, 'INFO');
        this.updateStatus(`Payout baixo (${currentPayout}%). Procurando melhor ativo...`, 'warn', 4000);
        
        // Obter configurações de troca de ativos
        const assetConfig = config.assetSwitching || {};
        const preferredCategory = assetConfig.preferredCategory || 'crypto';
        
        // Enviar comando para troca de ativos via chrome.runtime
        try {
            chrome.runtime.sendMessage({
                action: 'ENSURE_BEST_ASSET',
                minPayout: minPayout,
                preferredCategory: preferredCategory,
                source: 'payout-control'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    this.logToSystem(`Erro na comunicação para troca de ativo: ${chrome.runtime.lastError.message}`, 'ERROR');
                    reject(`ASSET_SWITCH_COMMUNICATION_ERROR: ${chrome.runtime.lastError.message}`);
                    return;
                }
                
                if (response && response.success) {
                    this.logToSystem(`Troca de ativo realizada: ${response.message}`, 'SUCCESS');
                    this.updateStatus(response.message, 'success', 4000);
                    
                    // Aguardar um pouco para a interface atualizar e resolver
                    setTimeout(() => {
                        this.logToSystem('Troca de ativo concluída, prosseguindo com análise', 'SUCCESS');
                        resolve(true);
                    }, 2000);
                } else {
                    const errorMsg = response ? response.error : 'Sem resposta do sistema de troca de ativos';
                    this.logToSystem(`Falha na troca de ativo: ${errorMsg}`, 'ERROR');
                    this.updateStatus(`Erro na troca de ativo: ${errorMsg}`, 'error', 5000);
                    reject(`ASSET_SWITCH_FAILED: ${errorMsg}`);
                }
            });
        } catch (error) {
            this.logToSystem(`Erro ao solicitar troca de ativo: ${error.message || error}`, 'ERROR');
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
        
        this.logToSystem(`Iniciando aguardo de payout (mínimo: ${minPayout}%)`, 'INFO');
        
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
                    this.logToSystem('Aguardo de payout cancelado pelo usuário', 'INFO');
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
                    this.updateStatus(`Verificando payout...`, 'info', 1000);
                    
                    try {
                    const payoutResult = await this.getCurrentPayout();
                        const currentPayoutNum = parseFloat(payoutResult.payout);
                    const minPayoutNum = parseFloat(minPayout);
                    
                        this.logToSystem(`Verificação: ${currentPayoutNum}% vs necessário ${minPayoutNum}%`, 'INFO');
                    
                    if (currentPayoutNum >= minPayoutNum) {
                            // ✅ PAYOUT ADEQUADO - SUCESSO
                            clearInterval(mainTimer);
                            this.logToSystem(`Payout adequado alcançado: ${currentPayoutNum}% >= ${minPayoutNum}%`, 'SUCCESS');
                        this.updateStatus(`Payout adequado (${currentPayoutNum}%)! Iniciando análise...`, 'success', 3000);
                        resolve(true);
                        return;
                    } else {
                            // ⏳ PAYOUT AINDA BAIXO - CONTINUAR
                            this.logToSystem(`Payout ainda baixo: ${currentPayoutNum}% < ${minPayoutNum}%`, 'INFO');
                            elapsedTime += checkInterval;
                            nextCheckIn = checkInterval; // Reset contador
                        }
                    
                } catch (payoutError) {
                        clearInterval(mainTimer);
                        this.logToSystem(`Erro ao verificar payout: ${payoutError.message}`, 'ERROR');
                        this.updateStatus(`Erro na verificação: ${payoutError.message}`, 'error', 5000);
                    reject(`PAYOUT_READ_ERROR: ${payoutError.message}`);
                    return;
                }
            }
                
                    } catch (error) {
            clearInterval(mainTimer);
            this.logToSystem(`Erro crítico no aguardo de payout: ${error.message}`, 'ERROR');
            reject(`CRITICAL_ERROR: ${error.message}`);
        }
        }, 1000); // Executar a cada 1 segundo
        
        // Armazenar referência do timer para limpeza
        this.payoutWaitTimer = mainTimer;
        
        this.logToSystem(`Sistema de aguardo de payout iniciado`, 'DEBUG');
    }
    
    // Parar aguardo de payout (limpar timer)
    stopPayoutWait() {
        if (this.payoutWaitTimer) {
            clearInterval(this.payoutWaitTimer);
            this.payoutWaitTimer = null;
            this.logToSystem('Timer de aguardo de payout parado', 'INFO');
        }
    }
    
    // Cancelar aguardo de payout
    cancelPayoutMonitoring() {
        chrome.storage.local.set({ cancelPayoutWait: true }, () => {
            this.logToSystem('Sinal de cancelamento de aguardo de payout enviado', 'INFO');
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
                    this.logToSystem(`Erro ao obter configurações: ${chrome.runtime.lastError.message}`, 'ERROR');
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
        if (!assets || assets.length === 0) {
            return 'Nenhum ativo encontrado';
        }
        
        // Formatar lista de ativos com informações detalhadas
        const formattedList = assets.map((asset, index) => {
            const selectionStatus = asset.isSelected ? ' [SELECIONADO]' : '';
            return `${index + 1}. ${asset.name} (${asset.payout}%)${selectionStatus}`;
        }).join('<br>');
        
        return formattedList;
    }
    
    // Teste de busca do melhor ativo
    async testFindBestAsset(minPayout = 85) {
        return new Promise((resolve, reject) => {
            this.logToSystem(`Teste: buscando melhor ativo (payout >= ${minPayout}%)`, 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'TEST_FIND_BEST_ASSET',
                minPayout: minPayout
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `Erro: ${chrome.runtime.lastError.message}`;
                    this.logToSystem(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                if (response && response.success) {
                    let resultText = `✅ ${response.message}<br><br>`;
                    resultText += `<strong>Todos os ativos encontrados:</strong><br>`;
                    resultText += this.formatAssetsList(response.allAssets);
                    
                    this.logToSystem(`Teste concluído: ${response.message}`, 'SUCCESS');
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
                    
                    this.logToSystem(`Erro no teste: ${response?.error}`, 'ERROR');
                    reject({
                        success: false,
                        message: errorText,
                        allAssets: response?.allAssets
                    });
                }
            });
        });
    }
    
    // Teste de troca para categoria específica
    async testSwitchAssetCategory(category) {
        return new Promise((resolve, reject) => {
            this.logToSystem(`Teste: troca para categoria ${category}`, 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'TEST_SWITCH_ASSET_CATEGORY',
                category: category
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `Erro: ${chrome.runtime.lastError.message}`;
                    this.logToSystem(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                if (response && response.success) {
                    let resultText = `${response.message}<br><br>`;
                    resultText += `<strong>Ativos de ${response.category}:</strong><br>`;
                    
                    // Verificar se temos ativos capturados
                    if (response.assets && response.assets.length > 0) {
                        resultText += `📊 Total de ativos encontrados: ${response.totalAssetsFound || response.assets.length}<br><br>`;
                        
                        // Usar a lista formatada se disponível, senão formatar manualmente
                        if (response.assetsList) {
                            resultText += response.assetsList;
                        } else {
                            resultText += this.formatAssetsList(response.assets);
                        }
                        
                        // Mostrar ativo selecionado se disponível
                        if (response.selectedAsset) {
                            resultText += `<br><br>🎯 <strong>Ativo Selecionado:</strong> ${response.selectedAsset.name} (${response.selectedAsset.payout}%)`;
                        }
                    } else {
                        resultText += `❌ Nenhum ativo encontrado na categoria ${response.category}`;
                    }
                    
                    this.logToSystem(`Teste concluído: ${response.message}`, 'SUCCESS');
                    
                    resolve({
                        success: true,
                        message: resultText,
                        category: response.category,
                        assets: response.assets,
                        selectedAsset: response.selectedAsset,
                        totalAssetsFound: response.totalAssetsFound
                    });
                } else {
                    const error = `❌ ${response?.error || 'Falha ao mudar categoria'}`;
                    this.logToSystem(`Erro no teste: ${response?.error}`, 'ERROR');
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
            this.logToSystem('Teste: abrindo modal de ativos', 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'TEST_OPEN_ASSET_MODAL'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `❌ ERRO: ${chrome.runtime.lastError.message}`;
                    this.logToSystem(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                if (response && response.success) {
                    const success = `✅ SUCESSO: ${response.message}`;
                    this.logToSystem(`Modal aberto: ${response.message}`, 'SUCCESS');
                    resolve(success);
                } else {
                    const error = `❌ FALHA: ${response?.error || 'Erro desconhecido'}`;
                    this.logToSystem(`Erro ao abrir modal: ${response?.error}`, 'ERROR');
                    reject(error);
                }
            });
        });
    }
    
    // Fechar modal de ativos (debug)
    async testCloseAssetModal() {
        return new Promise((resolve, reject) => {
            this.logToSystem('Teste: fechando modal de ativos', 'INFO');
            
            chrome.runtime.sendMessage({
                action: 'CLOSE_ASSET_MODAL'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = `❌ ERRO: ${chrome.runtime.lastError.message}`;
                    this.logToSystem(error, 'ERROR');
                    reject(error);
                    return;
                }
                
                if (response && response.success) {
                    const success = `✅ SUCESSO: ${response.message}`;
                    this.logToSystem(`Modal fechado: ${response.message}`, 'SUCCESS');
                    resolve(success);
                } else {
                    const error = `❌ FALHA: ${response?.error || 'Erro desconhecido'}`;
                    this.logToSystem(`Erro ao fechar modal: ${response?.error}`, 'ERROR');
                    reject(error);
                }
            });
        });
    }
    
    // Verificar status do modal
    async checkModalStatus() {
        return new Promise((resolve, reject) => {
            this.logToSystem('Verificando status do modal de ativos', 'INFO');
            
            // Executar script para verificar status do modal na página
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (!tabs || !tabs.length) {
                    const error = '❌ ERRO: Aba ativa não encontrada';
                    this.logToSystem(error, 'ERROR');
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
                        this.logToSystem(error, 'ERROR');
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
                        
                        this.logToSystem(`Status do modal verificado`, 'INFO');
                        resolve(statusText.replace(/\n/g, '<br>'));
                    } else {
                        const error = '❌ ERRO: Nenhum resultado retornado';
                        this.logToSystem(error, 'ERROR');
                        reject(error);
                    }
                });
            });
        });
    }
    
    // Toggle do modal (abrir/fechar automaticamente)
    async testToggleModal() {
        try {
            this.logToSystem('Teste: toggle do modal de ativos', 'INFO');
            
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
            
                            this.logToSystem(`Modal ${isModalOpen ? 'aberto' : 'fechado'}, tentando ${actionText}`, 'INFO');
            
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: action
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        const error = `❌ ERRO: ${chrome.runtime.lastError.message}`;
                        this.logToSystem(error, 'ERROR');
                        reject(error);
                        return;
                    }
                    
                    if (response && response.success) {
                        const success = `✅ SUCESSO: Modal ${isModalOpen ? 'fechado' : 'aberto'} com sucesso!`;
                        this.logToSystem(`Toggle realizado: ${success}`, 'SUCCESS');
                        resolve(success);
                    } else {
                        const error = `❌ FALHA: ${response?.error || 'Erro desconhecido'}`;
                        this.logToSystem(`Erro no toggle: ${response?.error}`, 'ERROR');
                        reject(error);
                    }
                });
            });
            
        } catch (error) {
            const errorMsg = `❌ ERRO: ${error}`;
            this.logToSystem(`Erro no toggle: ${error}`, 'ERROR');
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
        payoutControllerInstance.cancelPayoutMonitoring();
        sendResponse({ success: true, message: 'Monitoramento parado' });
        return true;
    }
});

        // Módulo carregado 
