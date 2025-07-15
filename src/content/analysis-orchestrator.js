/**
 * @class AnalysisOrchestrator
 * @description Orquestra o fluxo de análise de gráfico, desde a captura de tela até a exibição dos resultados.
 */
class AnalysisOrchestrator {
    /**
     * @param {object} dependencies - Um objeto contendo as dependências necessárias.
     * @param {function} dependencies.log - Função para registrar logs.
     * @param {function} dependencies.updateStatus - Função para atualizar a barra de status.
     * @param {function} dependencies.updateSystemStatus - Função para atualizar o status geral do sistema.
     * @param {object} dependencies.stateManager - O gerenciador de estado (StateManager).
     * @param {function} dependencies.showAnalysisModal - Função para exibir o modal com o resultado da análise.
     * @param {function} dependencies.safeExecute - Wrapper para execução segura de funções.
     */
    constructor(dependencies) {
        this.log = dependencies.log;
        this.updateStatus = dependencies.updateStatus;
        this.updateSystemStatus = dependencies.updateSystemStatus;
        this.stateManager = dependencies.stateManager;
        this.showAnalysisModal = dependencies.showAnalysisModal;
        this.safeExecute = dependencies.safeExecute;

        this.log('Orquestrador de Análise inicializado.', 'INFO');
    }

    /**
     * Executa o fluxo completo de análise.
     */
    async execute() {
        return this.safeExecute(async () => {
            if (this.stateManager) {
                this.stateManager.startOperation('analysis');
            }
            this.updateSystemStatus('Operando...');
            this.updateStatus('Iniciando análise...', 'info');
            this.log('🚀 [AnalysisOrchestrator] Iniciando análise do gráfico...');

            // ETAPA 1: Capturar a tela
            this.log('📸 [AnalysisOrchestrator] Iniciando captura de tela para análise...', 'INFO');
            let dataUrl;
            
            if (!window.CaptureScreen || typeof window.CaptureScreen.captureForAnalysis !== 'function') {
                this.log('Módulo de captura de tela não encontrado.', 'ERROR');
                throw new Error('Módulo de captura de tela indisponível.');
            }

            try {
                dataUrl = await window.CaptureScreen.captureForAnalysis();
                this.log('✅ [AnalysisOrchestrator] Captura de tela para análise concluída.', 'SUCCESS');
            } catch (captureError) {
                throw new Error(`Falha ao capturar tela para análise: ${captureError.message}`);
            }

            if (!dataUrl || !dataUrl.startsWith('data:image')) {
                throw new Error('Dados de imagem da captura são inválidos ou ausentes.');
            }

            window.lastCapturedImage = dataUrl;
            window.lastCapturedImageTimestamp = Date.now();

            // ETAPA 2: Processar a análise
            this.log('🧠 [AnalysisOrchestrator] Iniciando etapa de processamento de análise...', 'INFO');
            
            try {
                const settings = this.stateManager ? this.stateManager.getConfig() || {} : {};

                if (settings.testMode) {
                    return this._executeTestModeAnalysis(settings);
                }

                if (!window.AnalyzeGraph || typeof window.AnalyzeGraph.analyzeImage !== 'function') {
                     this.log('Módulo de análise de gráfico não encontrado.', 'ERROR');
                    throw new Error('Módulo de análise de gráfico indisponível.');
                }
                
                this.log('🧠 [AnalysisOrchestrator] Usando módulo AnalyzeGraph para processamento...', 'INFO');
                const analysisResult = await window.AnalyzeGraph.analyzeImage(dataUrl, settings);
                
                this._finalizeOperation(analysisResult);
                
                return { success: true, results: analysisResult };

            } catch (analysisError) {
                this.log(`Erro no processamento da análise: ${analysisError.message}`, 'ERROR');
                this.updateStatus('Erro ao analisar o gráfico', 'error');
                throw analysisError;
            }
        }, 'AnalysisOrchestrator.execute');
    }

    /**
     * Executa uma análise em modo de teste com dados simulados.
     * @private
     * @param {object} settings - As configurações atuais.
     * @returns {object} O resultado da análise simulada.
     */
    _executeTestModeAnalysis(settings) {
        this.log('Modo de teste ativado - usando análise simplificada', 'INFO');
        this.updateStatus('Executando análise de teste...', 'info');

        const mockResult = {
            action: Math.random() > 0.5 ? 'BUY' : 'SELL',
            confidence: Math.floor(Math.random() * 40) + 60,
            period: settings.period ? `${settings.period}min` : '1min',
            value: settings.value ? `R$ ${settings.value.toFixed(2)}` : 'R$ 10,00',
            reason: 'Análise de teste executada com dados simulados.',
            isTestMode: true
        };

        this._finalizeOperation(mockResult, true);
        
        return { success: true, results: mockResult };
    }

    /**
     * Finaliza a operação, atualizando status e exibindo o modal.
     * @private
     * @param {object} result - O resultado da análise.
     * @param {boolean} isTest - Indica se é uma análise de teste.
     */
    _finalizeOperation(result, isTest = false) {
        const mode = isTest ? 'de teste' : '';
        
        if (this.stateManager) {
            const automationState = this.stateManager.getAutomationState();
            const isInAutomaticMode = automationState && automationState.isRunning;

            if (!isInAutomaticMode) {
                this.stateManager.stopOperation('completed');
                this.updateSystemStatus('Pronto');
            }
        } else {
            this.updateSystemStatus('Pronto');
        }

        this.log(`Análise ${mode} concluída: ${result.action}`, 'SUCCESS');
        this.updateStatus(`Análise ${mode}: ${result.action}`, 'success');

        if (this.showAnalysisModal && typeof this.showAnalysisModal === 'function') {
            this.showAnalysisModal(result);
        } else {
            this.log('Função para exibir modal de análise não disponível', 'WARN');
        }
    }
} 