// modal-analyze.js
// Modal de Análise - isolado do index.js

// Dependências globais esperadas: addLog, updateStatus (ou toUpdateStatus), window.StateManager, chrome.runtime

function showAnalysisModal(result) {
    // Validação crítica: verificar se result e result.action existem
    if (!result) {
        console.error('showAnalysisModal: result é undefined ou null');
        if (typeof addLog === 'function') {
            addLog('Erro: Resultado da análise é undefined', 'ERROR', 'analysis');
        }
        return;
    }
    
    if (!result.action) {
        console.error('showAnalysisModal: result.action é undefined ou null', result);
        if (typeof addLog === 'function') {
            addLog(`Erro: Ação da análise é undefined. Resultado recebido: ${JSON.stringify(result)}`, 'ERROR', 'analysis');
        }
        return;
    }
    
    window.currentAnalysisResult = result;
    
    // Log da análise recebida
    if (typeof addLog === 'function') {
        addLog(`Análise concluída: ${result.action} (Confiança: ${result.trust}%)`, 'INFO', 'analysis');
    } else if (typeof sendToLogSystem === 'function') {
        sendToLogSystem(`Análise concluída: ${result.action} (Confiança: ${result.trust}%)`, 'INFO');
    }
    
    const modal = document.getElementById('analysis-modal');
    const actionElement = document.getElementById('result-action');
    const confidenceElement = document.getElementById('result-confidence');
    const reasonElement = document.getElementById('result-reason');
    const periodElement = document.getElementById('result-period');
    const valueElement = document.getElementById('result-value');
    const testModeWarningElement = document.getElementById('test-mode-warning');
    const countdownElement = document.getElementById('countdown');
    const closeButton = document.getElementById('close-modal');
    const infoIcon = document.getElementById('info-icon');
    const executeButton = document.getElementById('execute-action');
    const cancelButton = document.getElementById('cancel-action');
    const waitButton = document.getElementById('wait-action');
    const waitTextElement = document.getElementById('wait-text');

    // Função para cancelar a contagem de espera
    const cancelWaitCountdown = () => {
        if (waitCountdownInterval) {
            clearInterval(waitCountdownInterval);
            waitCountdownInterval = null;
            if (typeof updateStatus === 'function') {
                updateStatus('Contagem de espera cancelada pelo usuário', 'info', 3000);
            } else if (typeof toUpdateStatus === 'function') {
                toUpdateStatus('Contagem de espera cancelada pelo usuário', 'info', 3000);
            }
            if (typeof addLog === 'function') {
                addLog('Contagem de espera para nova análise cancelada pelo usuário', 'INFO', 'automation');
            } else if (typeof sendToLogSystem === 'function') {
                sendToLogSystem('Contagem de espera para nova análise cancelada pelo usuário', 'INFO');
            }
            // Remover o botão de cancelamento
            const cancelWaitBtn = document.getElementById('cancel-wait-btn');
            if (cancelWaitBtn) {
                cancelWaitBtn.remove();
            }
        }
    };

    // Função para criar um botão de cancelamento da espera
    const createCancelWaitButton = () => {
        if (document.getElementById('cancel-wait-btn')) {
            return;
        }
        const cancelWaitBtn = document.createElement('button');
        cancelWaitBtn.id = 'cancel-wait-btn';
        cancelWaitBtn.className = 'floating-cancel-btn';
        cancelWaitBtn.innerHTML = '<i class="fas fa-times"></i> Cancelar Espera';
        cancelWaitBtn.style.position = 'fixed';
        cancelWaitBtn.style.bottom = '20px';
        cancelWaitBtn.style.right = '20px';
        cancelWaitBtn.style.padding = '10px 15px';
        cancelWaitBtn.style.backgroundColor = '#f44336';
        cancelWaitBtn.style.color = 'white';
        cancelWaitBtn.style.border = 'none';
        cancelWaitBtn.style.borderRadius = '4px';
        cancelWaitBtn.style.cursor = 'pointer';
        cancelWaitBtn.style.zIndex = '1000';
        cancelWaitBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        cancelWaitBtn.addEventListener('click', cancelWaitCountdown);
        document.body.appendChild(cancelWaitBtn);
    };

    // Atualiza o conteúdo do modal
    actionElement.textContent = result.action;
    actionElement.className = `result-action ${result.action.toLowerCase()}`;
    confidenceElement.textContent = `${result.trust}%`;
    reasonElement.textContent = result.reason;
    periodElement.textContent = result.period || 'Não especificado';
    valueElement.textContent = result.entry || 'Não especificado';

    if (testModeWarningElement) {
        if (result.isTestMode) {
            testModeWarningElement.style.display = 'block';
            if (typeof addLog === 'function') {
                addLog('Modo de teste ativado para esta análise', 'WARN', 'analysis');
            } else if (typeof sendToLogSystem === 'function') {
                sendToLogSystem('Modo de teste ativado para esta análise', 'WARN');
            }
        } else {
            testModeWarningElement.style.display = 'none';
        }
    }

    // Verificar o status de automação para decidir o comportamento
    let isAutomationActive = false;
    if (window.StateManager && typeof window.StateManager.getConfig === 'function') {
        const config = window.StateManager.getConfig();
        isAutomationActive = config && config.automation === true;
    } else if (typeof isAutomationRunning !== 'undefined') {
        isAutomationActive = isAutomationRunning;
    }
    if (typeof addLog === 'function') {
        addLog(`Status de automação inicial: ${isAutomationActive ? 'Ativado' : 'Desativado'}`, 'DEBUG', 'automation');
    } else if (typeof sendToLogSystem === 'function') {
        sendToLogSystem(`Status de automação inicial: ${isAutomationActive ? 'Ativado' : 'Desativado'}`, 'DEBUG');
    }

    if (result.action === 'WAIT') {
        executeButton.style.display = 'none';
        waitButton.style.display = 'inline-block';
        cancelButton.style.display = 'inline-block';
        if (typeof addLog === 'function') {
            addLog('Ação WAIT detectada, configurando modal para modo de espera', 'INFO', 'ui');
        } else if (typeof sendToLogSystem === 'function') {
            sendToLogSystem('Ação WAIT detectada, configurando modal para modo de espera', 'INFO');
        }
    } else {
        executeButton.style.display = 'inline-block';
        waitButton.style.display = 'none';
        cancelButton.style.display = 'inline-block';
    }

    modal.style.display = 'block';
    if (typeof addLog === 'function') {
        addLog(`Modal de análise aberto: ${result.action}`, 'INFO', 'ui');
    } else if (typeof sendToLogSystem === 'function') {
        sendToLogSystem(`Modal de análise aberto: ${result.action}`, 'INFO');
    }

    let countdown = 15;
    let countdownInterval = null;
    let autoExecutionEnabled = true;
    let waitCountdown = 30;
    let waitCountdownInterval = null;
    let waitLogSent = false;
    const waitForNextAnalysis = () => {
        if (typeof updateStatus === 'function') {
            updateStatus(`Aguardando próxima análise: ${waitCountdown}s...`, 'info', 0);
        } else if (typeof toUpdateStatus === 'function') {
            toUpdateStatus(`Aguardando próxima análise: ${waitCountdown}s...`, 'info', 0);
        }
        createCancelWaitButton();
        if (!waitLogSent) {
            if (typeof addLog === 'function') {
                addLog('Aguardando tempo para nova análise!', 'INFO', 'automation');
            } else if (typeof sendToLogSystem === 'function') {
                sendToLogSystem('Aguardando tempo para nova análise!', 'INFO');
            }
            waitLogSent = true;
        }
        if (waitCountdown <= 0) {
            clearInterval(waitCountdownInterval);
            waitCountdownInterval = null;
            if (typeof updateStatus === 'function') {
                updateStatus('Iniciando nova análise...', 'info');
            } else if (typeof toUpdateStatus === 'function') {
                toUpdateStatus('Iniciando nova análise...', 'info');
            }
            const cancelWaitBtn = document.getElementById('cancel-wait-btn');
            if (cancelWaitBtn) {
                cancelWaitBtn.remove();
            }
            let automationStillEnabled = false;
            if (window.StateManager && typeof window.StateManager.getConfig === 'function') {
                const config = window.StateManager.getConfig();
                automationStillEnabled = config && config.automation === true;
            } else if (typeof isAutomationRunning !== 'undefined') {
                automationStillEnabled = isAutomationRunning;
            }
            if (!automationStillEnabled) {
                if (typeof addLog === 'function') {
                    addLog('Automação foi desativada durante a contagem, cancelando nova análise', 'WARN', 'automation');
                } else if (typeof sendToLogSystem === 'function') {
                    sendToLogSystem('Automação foi desativada durante a contagem, cancelando nova análise', 'WARN');
                }
                if (typeof updateStatus === 'function') {
                    updateStatus('Análise cancelada - Automação desativada', 'warn', 3000);
                } else if (typeof toUpdateStatus === 'function') {
                    toUpdateStatus('Análise cancelada - Automação desativada', 'warn', 3000);
                }
                return;
            }
            setTimeout(() => {
                // SOLUÇÃO IDEAL: Simular clique no botão "Iniciar Análise" ao invés de criar nova função
                
                // Primeiro, garantir que qualquer modal anterior esteja completamente fechado
                const existingModal = document.getElementById('analysis-modal');
                if (existingModal) {
                    existingModal.style.display = 'none';
                    if (typeof addLog === 'function') {
                        addLog('Modal anterior fechado antes de nova análise', 'DEBUG', 'automation');
                    }
                }
                
                // ID correto do botão conforme index.html: 'analyzeBtn' (não 'analyze-btn')
                const analyzeButton = document.getElementById('analyzeBtn');
                
                if (analyzeButton) {
                    if (typeof addLog === 'function') {
                        addLog('Simulando clique no botão "Iniciar Análise" após espera', 'INFO', 'automation');
                    } else if (typeof sendToLogSystem === 'function') {
                        sendToLogSystem('Simulando clique no botão "Iniciar Análise" após espera', 'INFO');
                    }
                    
                    // Simular clique no botão existente
                    analyzeButton.click();
                } else {
                    if (typeof addLog === 'function') {
                        addLog('Erro: Botão "Iniciar Análise" não encontrado para simulação de clique', 'ERROR', 'automation');
                    } else if (typeof sendToLogSystem === 'function') {
                        sendToLogSystem('Erro: Botão "Iniciar Análise" não encontrado para simulação de clique', 'ERROR');
                    }
                    
                    if (typeof updateStatus === 'function') {
                        updateStatus('Erro: Botão de análise não encontrado', 'error', 5000);
                    } else if (typeof toUpdateStatus === 'function') {
                        toUpdateStatus('Erro: Botão de análise não encontrado', 'error', 5000);
                    }
                }
            }, 500);
        }
        waitCountdown--;
    };

    const updateCountdown = () => {
        countdownElement.textContent = `Janela fecha em ${countdown}s`;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            modal.style.display = 'none';
            if (autoExecutionEnabled) {
                // Registrar tentativa de execução automática
                if (typeof addLog === 'function') {
                    addLog('Tentativa de executar operação automaticamente após fechamento do modal', 'INFO', 'trade-execution');
                } else if (typeof sendToLogSystem === 'function') {
                    sendToLogSystem('Tentativa de executar operação automaticamente após fechamento do modal', 'INFO');
                }
                
                if (result.action === 'WAIT') {
                    // Liberar a flag, já que a ação WAIT não executa operação
                    
                    let automationEnabled = false;
                    if (window.StateManager && typeof window.StateManager.getConfig === 'function') {
                        const config = window.StateManager.getConfig();
                        automationEnabled = config && config.automation === true;
                    } else if (typeof isAutomationRunning !== 'undefined') {
                        automationEnabled = isAutomationRunning;
                    }
                    if (typeof addLog === 'function') {
                        addLog(`Status de automação verificado: ${automationEnabled ? 'Ativado' : 'Desativado'}`, 'INFO', 'automation');
                    } else if (typeof sendToLogSystem === 'function') {
                        sendToLogSystem(`Status de automação verificado: ${automationEnabled ? 'Ativado' : 'Desativado'}`, 'INFO');
                    }
                    if (automationEnabled) {
                        if (typeof addLog === 'function') {
                            addLog(`Iniciando contador de espera para nova análise (${waitCountdown}s)`, 'INFO', 'automation');
                        } else if (typeof sendToLogSystem === 'function') {
                            sendToLogSystem(`Iniciando contador de espera para nova análise (${waitCountdown}s)`, 'INFO');
                        }
                        waitCountdownInterval = setInterval(waitForNextAnalysis, 1000);
                        waitForNextAnalysis();
                    } else {
                        if (typeof addLog === 'function') {
                            addLog('Ação WAIT ignorada, automação não está ativa', 'INFO', 'automation');
                        } else if (typeof sendToLogSystem === 'function') {
                            sendToLogSystem('Ação WAIT ignorada, automação não está ativa', 'INFO');
                        }
                        if (typeof updateStatus === 'function') {
                            updateStatus('Análise aguardando - Automação desativada', 'info', 3000);
                        } else if (typeof toUpdateStatus === 'function') {
                            toUpdateStatus('Análise aguardando - Automação desativada', 'info', 3000);
                        }
                    }
                } else if (result.action !== 'WAIT') {
                    // Encaminhar a execução para o content.js apenas uma vez
                    // Gerar um identificador único para esta operação automática
                    const autoOperationId = `auto_${result.action}_${Date.now()}`;
                    if (typeof addLog === 'function') {
                        addLog(`Iniciando operação automática ${autoOperationId} após fechamento do modal`, 'INFO', 'trade-execution');
                    } else if (typeof sendToLogSystem === 'function') {
                        sendToLogSystem(`Iniciando operação automática ${autoOperationId} após fechamento do modal`, 'INFO');
                    }
                    
                    sendTradeRequest(result.action);
                }
            }
        }
        countdown--;
    };

    countdownInterval = setInterval(updateCountdown, 1000);

    // NOVA FUNÇÃO: Encaminha a solicitação para o content.js executar a operação
    // Esta substitui a antiga executeTradeAction para evitar duplicação
    function sendTradeRequest(action) {
        if (chrome && chrome.runtime && chrome.runtime.id) {
            // Obter configurações atuais do usuário
            let userConfig = {};
            
            if (window.StateManager && typeof window.StateManager.getConfig === 'function') {
                userConfig = window.StateManager.getConfig();
                if (typeof addLog === 'function') {
                    addLog(`Configurações obtidas: Valor=${userConfig.value}, Tempo=${userConfig.period}`, 'INFO', 'trade-execution');
                }
            } else {
                if (typeof addLog === 'function') {
                    addLog('StateManager não disponível, usando valores padrão', 'WARN', 'trade-execution');
                }
            }
            
            // Estruturar dados da operação
            const tradeData = {
                // Configurações do usuário - corrigindo para usar os campos corretos do StateManager
                tradeValue: userConfig.value || 10,
                tradeTime: userConfig.period || 1,
                minPayout: userConfig.minPayout || 80,
                
                // Dados da análise (usando o resultado armazenado)
                analysisResult: window.currentAnalysisResult || result,
                
                // Flag para evitar execução duplicada
                isFromModal: true
            };
            
            // Mostrar informação sobre a operação ao usuário
            if (typeof toUpdateStatus === 'function') {
                toUpdateStatus(`Executando ${action} - Valor: ${tradeData.tradeValue}, Período: ${tradeData.tradeTime}min`, 'info');
            }
            
            if (typeof addLog === 'function') {
                addLog(`Enviando solicitação de operação ${action} com: valor=${tradeData.tradeValue}, período=${tradeData.tradeTime}`, 'INFO', 'trade-execution');
            }
            
            // Enviar solicitação única para o content.js executar a operação
            chrome.runtime.sendMessage({
                action: 'EXECUTE_TRADE_ACTION',
                tradeAction: action,
                tradeData: tradeData
            }, (response) => {
                if (typeof addLog === 'function') {
                    if (response && response.success) {
                        addLog(`Operação ${action} executada com sucesso via chrome.runtime`, 'SUCCESS', 'trade-execution');
                        if (typeof toUpdateStatus === 'function') {
                            toUpdateStatus(`Operação ${action} executada com sucesso`, 'success');
                        }
                    } else {
                        const errorMsg = response ? response.error : 'Sem resposta';
                        addLog(`Falha ao executar operação ${action}: ${errorMsg}`, 'WARN', 'trade-execution');
                        
                        if (typeof toUpdateStatus === 'function') {
                            toUpdateStatus(`Falha: ${errorMsg}`, 'warn');
                        }
                    }
                }
            });
        }
    }
    
    // Função para cancelar automação
    function cancelAutomation() {
        if (chrome && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: 'CANCEL_AUTOMATION'
            }, (response) => {
                if (typeof addLog === 'function') {
                    if (response && response.success) {
                        addLog('Automação cancelada com sucesso via chrome.runtime', 'SUCCESS', 'automation');
                    } else {
                        addLog(`Falha ao cancelar automação: ${response ? response.error : 'Sem resposta'}`, 'ERROR', 'automation');
                    }
                }
            });
        }
    }

    // Eventos dos botões
    executeButton.onclick = () => {
        clearInterval(countdownInterval);
        modal.style.display = 'none';
        autoExecutionEnabled = false;
        sendTradeRequest(result.action);
        if (typeof logAndUpdateStatus === 'function') {
            logAndUpdateStatus('Operação executada manualmente pelo usuário', 'INFO', 'trade-execution', true);
        }
    };
    waitButton.onclick = () => {
        // Fechar o modal imediatamente quando o usuário clica em "Aguardar"
        clearInterval(countdownInterval);
        modal.style.display = 'none';
        autoExecutionEnabled = false;
        
        // Log da ação do usuário
        if (typeof logAndUpdateStatus === 'function') {
            logAndUpdateStatus('Usuário escolheu aguardar próxima análise', 'INFO', 'ui', true);
        } else if (typeof addLog === 'function') {
            addLog('Usuário escolheu aguardar próxima análise', 'INFO', 'ui');
        }
        
        // Iniciar o contador de WAIT (se já não estiver rodando)
        if (!waitCountdownInterval) {
            waitCountdownInterval = setInterval(waitForNextAnalysis, 1000);
            waitForNextAnalysis(); // Chamar imediatamente para atualizar o status
        }
    };
    cancelButton.onclick = () => {
        clearInterval(countdownInterval);
        if (waitCountdownInterval) {
            clearInterval(waitCountdownInterval);
            waitCountdownInterval = null;
        }
        const cancelWaitBtn = document.getElementById('cancel-wait-btn');
        if (cancelWaitBtn) {
            cancelWaitBtn.remove();
        }
        modal.style.display = 'none';
        autoExecutionEnabled = false;
        
        // Usar a função global de cancelamento para garantir consistência
        if (typeof window.cancelCurrentOperation === 'function') {
            window.cancelCurrentOperation('Operação cancelada pelo usuário no modal de análise');
        } else {
            // Fallback para o comportamento anterior
            if (typeof logAndUpdateStatus === 'function') {
                logAndUpdateStatus('Operação cancelada pelo usuário', 'INFO', 'trade-execution', true);
            } else if (typeof addLog === 'function') {
                addLog('Operação cancelada pelo usuário', 'INFO', 'trade-execution');
            }
            if (typeof updateStatus === 'function') {
                updateStatus('Operação cancelada pelo usuário', 'info', 3000);
            } else if (typeof toUpdateStatus === 'function') {
                toUpdateStatus('Operação cancelada pelo usuário', 'info', 3000);
            }
        }
    };
    closeButton.onclick = () => {
        clearInterval(countdownInterval);
        if (waitCountdownInterval) {
            clearInterval(waitCountdownInterval);
            waitCountdownInterval = null;
        }
        const cancelWaitBtn = document.getElementById('cancel-wait-btn');
        if (cancelWaitBtn) {
            cancelWaitBtn.remove();
        }
        modal.style.display = 'none';
        autoExecutionEnabled = false;
        
        // Usar a função global de cancelamento para garantir consistência
        if (typeof window.cancelCurrentOperation === 'function') {
            window.cancelCurrentOperation('Modal de análise fechado pelo usuário');
        } else {
            // Fallback para o comportamento anterior
            if (typeof logAndUpdateStatus === 'function') {
                logAndUpdateStatus('Modal fechado pelo usuário (operação cancelada)', 'INFO', 'ui', true);
            }
        }
    };
    countdownElement.ondblclick = () => {
        clearInterval(countdownInterval);
        countdownElement.textContent = 'Cancelado';
        countdownElement.classList.add('cancelled');
        autoExecutionEnabled = false;
        if (typeof logAndUpdateStatus === 'function') {
            logAndUpdateStatus('Fechamento automático cancelado. Aguardando ação manual.', 'INFO', 'ui', true);
        }
    };
    window.onclick = (event) => {
        if (event.target === modal) {
            clearInterval(countdownInterval);
            if (waitCountdownInterval) {
                clearInterval(waitCountdownInterval);
                waitCountdownInterval = null;
            }
            const cancelWaitBtn = document.getElementById('cancel-wait-btn');
            if (cancelWaitBtn) {
                cancelWaitBtn.remove();
            }
            modal.style.display = 'none';
            autoExecutionEnabled = false;
            
            // Usar a função global de cancelamento para garantir consistência
            if (typeof window.cancelCurrentOperation === 'function') {
                window.cancelCurrentOperation('Modal de análise fechado ao clicar fora');
            } else {
                // Fallback para o comportamento anterior
                if (typeof logAndUpdateStatus === 'function') {
                    logAndUpdateStatus('Modal fechado ao clicar fora (operação cancelada)', 'INFO', 'ui', true);
                }
            }
        }
    };
}

// Exportar globalmente
window.showAnalysisModal = showAnalysisModal; 