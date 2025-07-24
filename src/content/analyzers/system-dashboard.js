/**
 * System Dashboard - Painel de Controle dos Módulos Inteligentes
 * Exibe estatísticas, status e controles dos novos módulos
 */

class SystemDashboard {
    constructor() {
        this.name = 'SystemDashboard';
        this.version = '1.0.0';
        this.updateInterval = null;
        
        this.init();
    }
    
    init() {
        // Log removido - inicialização lazy
        
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    setup() {
        // Criar container do dashboard
        this.createDashboardContainer();
        
        // Iniciar atualizações periódicas
        this.startPeriodicUpdates();
        
                    // Log removido - inicialização lazy
    }
    
    createDashboardContainer() {
        // Verificar se já existe
        if (document.getElementById('system-dashboard')) {
            return;
        }
        
        // Criar HTML do dashboard
        const dashboardHTML = `
        <div id="system-dashboard" class="dashboard-container" style="
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            display: none;
        ">
            <div class="dashboard-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                border-bottom: 1px solid #333;
                padding-bottom: 8px;
            ">
                <h3 style="margin: 0; color: #00ff88;">🧠 Sistema Inteligente</h3>
                <button id="dashboard-close" style="
                    background: #ff4444;
                    border: none;
                    color: white;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 12px;
                ">×</button>
            </div>
            
            <div class="modules-status">
                <h4 style="margin: 8px 0; color: #ffaa00;">📊 Status dos Módulos:</h4>
                <div id="module-status-list">
                    <!-- Status será inserido dinamicamente -->
                </div>
            </div>
            
            <div class="statistics">
                <h4 style="margin: 8px 0; color: #ffaa00;">📈 Estatísticas:</h4>
                <div id="stats-container">
                    <!-- Estatísticas serão inseridas dinamicamente -->
                </div>
            </div>
            
            <div class="controls">
                <h4 style="margin: 8px 0; color: #ffaa00;">🎛️ Controles:</h4>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <button id="dashboard-refresh" style="
                        background: #0088ff;
                        border: none;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 10px;
                    ">🔄 Atualizar</button>
                    
                    <button id="dashboard-clear-cache" style="
                        background: #ff8800;
                        border: none;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 10px;
                    ">🗑️ Limpar Cache</button>
                    
                    <button id="dashboard-test-gale" style="
                        background: #8800ff;
                        border: none;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 10px;
                    ">🧪 Testar Gale</button>
                </div>
            </div>
        </div>
        `;
        
        // Inserir no DOM
        document.body.insertAdjacentHTML('beforeend', dashboardHTML);
        
        // Configurar event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Botão fechar
        const closeBtn = document.getElementById('dashboard-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // Botão atualizar
        const refreshBtn = document.getElementById('dashboard-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                updateStatus('Atualizando dashboard do sistema...', 'info');
                try {
                    this.updateDashboard();
                    updateStatus('Dashboard atualizado com sucesso', 'success', 3000);
                } catch (error) {
                    updateStatus(`Erro ao atualizar dashboard: ${error.message}`, 'error', 5000);
                }
            });
        }
        
        // Botão limpar cache
        const clearCacheBtn = document.getElementById('dashboard-clear-cache');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                updateStatus('Limpando cache do sistema...', 'info');
                try {
                    this.clearCache();
                    updateStatus('Cache do sistema limpo com sucesso', 'success', 3000);
                } catch (error) {
                    updateStatus(`Erro ao limpar cache: ${error.message}`, 'error', 5000);
                }
            });
        }
        
        // Botão testar Gale
        const testGaleBtn = document.getElementById('dashboard-test-gale');
        if (testGaleBtn) {
            testGaleBtn.addEventListener('click', () => {
                updateStatus('Executando teste do Gale inteligente...', 'info');
                try {
                    this.testIntelligentGale();
                    updateStatus('Teste do Gale inteligente concluído', 'success', 3000);
                } catch (error) {
                    updateStatus(`Erro no teste do Gale: ${error.message}`, 'error', 5000);
                }
            });
        }
        
        // Atalho de teclado para mostrar/ocultar (Ctrl+Shift+D)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggle();
            }
        });
    }
    
    startPeriodicUpdates() {
        // Atualizar a cada 5 segundos
        this.updateInterval = setInterval(() => {
            if (this.isVisible()) {
                this.updateDashboard();
            }
        }, 5000);
    }
    
    updateDashboard() {
        this.updateModuleStatus();
        this.updateStatistics();
    }
    
    updateModuleStatus() {
        const statusContainer = document.getElementById('module-status-list');
        if (!statusContainer) return;
        
        const modules = [
            {
                name: 'Local Pattern Detector',
                instance: window.localPatternDetector,
                icon: '🔍'
            },
            {
                name: 'Cache Analyzer',
                instance: window.cacheAnalyzer,
                icon: '💾'
            },
            {
                name: 'Limits Checker',
                instance: window.limitsChecker,
                icon: '⚠️'
            },
            {
                name: 'Intelligent Gale',
                instance: window.intelligentGale,
                icon: '🧠'
            }
        ];
        
        let statusHTML = '';
        
        modules.forEach(module => {
            const available = !!module.instance;
            const status = available ? '✅ Ativo' : '❌ Inativo';
            const color = available ? '#00ff88' : '#ff4444';
            
            statusHTML += `
            <div style="display: flex; justify-content: space-between; margin: 3px 0;">
                <span>${module.icon} ${module.name}:</span>
                <span style="color: ${color};">${status}</span>
            </div>
            `;
        });
        
        statusContainer.innerHTML = statusHTML;
    }
    
    updateStatistics() {
        const statsContainer = document.getElementById('stats-container');
        if (!statsContainer) return;
        
        let statsHTML = '';
        
        // Cache Statistics
        if (window.cacheAnalyzer) {
            const cacheStats = window.cacheAnalyzer.getStats();
            statsHTML += `
            <div style="margin: 5px 0; padding: 5px; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">
                <strong>💾 Cache:</strong><br>
                <span style="color: #00ff88;">Hits: ${cacheStats.hits || 0}</span> | 
                <span style="color: #ff8888;">Misses: ${cacheStats.misses || 0}</span><br>
                <span style="color: #ffaa00;">Hit Rate: ${cacheStats.hitRate || 0}%</span><br>
                <span style="color: #88ff88;">Tokens Salvos: ${cacheStats.tokensSaved || 0}</span>
            </div>
            `;
        }
        
        // Limits Checker Statistics
        if (window.limitsChecker) {
            const limitsStatus = window.limitsChecker.getStatus();
            statsHTML += `
            <div style="margin: 5px 0; padding: 5px; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">
                <strong>⚠️ Limites:</strong><br>
                <span>Status: ${limitsStatus.isActive ? '🟢 Ativo' : '🔴 Inativo'}</span><br>
                <span>Profit: ${limitsStatus.dailyProfit || 0}</span><br>
                <span>Balance: ${limitsStatus.currentBalance || 0}</span>
            </div>
            `;
        }
        
        // Intelligent Gale Statistics
        if (window.intelligentGale) {
            const galeStatus = window.intelligentGale.getStatus();
            statsHTML += `
            <div style="margin: 5px 0; padding: 5px; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">
                <strong>🧠 Gale Inteligente:</strong><br>
                <span>Nível: ${galeStatus.level || 0}</span><br>
                <span>Valor: $${galeStatus.currentValue || 0}</span><br>
                <span>Risco: ${galeStatus.riskLevel || 'normal'}</span><br>
                <span>Confiança: ${galeStatus.lastAnalysisConfidence || 0}%</span>
            </div>
            `;
        }
        
        // StateManager Statistics
        if (window.StateManager) {
            const operationalStatus = window.StateManager.getOperationalStatus();
            statsHTML += `
            <div style="margin: 5px 0; padding: 5px; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">
                <strong>⚙️ Sistema:</strong><br>
                <span>Status: ${operationalStatus.status || 'Unknown'}</span><br>
                <span>Última Atualização: ${new Date(operationalStatus.lastUpdate || 0).toLocaleTimeString()}</span>
            </div>
            `;
        }
        
        if (!statsHTML) {
            statsHTML = '<span style="color: #ffaa00;">Nenhum módulo disponível</span>';
        }
        
        statsContainer.innerHTML = statsHTML;
    }
    
    clearCache() {
        if (window.cacheAnalyzer) {
            window.cacheAnalyzer.clearAll();
            
            // Mostrar feedback
            this.showFeedback('Cache limpo com sucesso!', '#00ff88');
            
            // Atualizar dashboard
            setTimeout(() => this.updateDashboard(), 500);
        } else {
            this.showFeedback('Cache Analyzer não disponível', '#ff4444');
        }
    }
    
    testIntelligentGale() {
        if (window.intelligentGale) {
            const result = window.intelligentGale.forceGale({
                confidence: 65,
                value: 10
            });
            
            if (result.success) {
                this.showFeedback(`Gale Inteligente testado! Nível: ${result.level}, Valor: $${result.value}`, '#00ff88');
            } else {
                this.showFeedback('Erro no teste do Gale Inteligente', '#ff4444');
            }
            
            // Atualizar dashboard
            setTimeout(() => this.updateDashboard(), 500);
        } else {
            this.showFeedback('Intelligent Gale não disponível', '#ff4444');
        }
    }
    
    showFeedback(message, color = '#ffaa00') {
        // Criar elemento de feedback
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: ${color};
            padding: 15px 25px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            z-index: 10001;
            border: 2px solid ${color};
        `;
        feedback.textContent = message;
        
        document.body.appendChild(feedback);
        
        // Remover após 3 segundos
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 3000);
    }
    
    show() {
        const dashboard = document.getElementById('system-dashboard');
        if (dashboard) {
            dashboard.style.display = 'block';
            this.updateDashboard();
        }
    }
    
    hide() {
        const dashboard = document.getElementById('system-dashboard');
        if (dashboard) {
            dashboard.style.display = 'none';
        }
    }
    
    toggle() {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    isVisible() {
        const dashboard = document.getElementById('system-dashboard');
        return dashboard && dashboard.style.display !== 'none';
    }
    
    destroy() {
        // Limpar interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Remover do DOM
        const dashboard = document.getElementById('system-dashboard');
        if (dashboard) {
            dashboard.remove();
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.SystemDashboard = SystemDashboard;
}

// Criar instância global - SEM LOGS de inicialização
window.systemDashboard = new SystemDashboard();