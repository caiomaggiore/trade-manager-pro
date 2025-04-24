// ================== GERENCIADOR DE NAVEGAÇÃO ==================
class NavigationManager {
    constructor() {
        console.log('[NavigationManager] Inicializando...');
        this.currentPage = null;
        this.pages = {
            settings: chrome.runtime.getURL('src/layout/settings.html'),
            logs: chrome.runtime.getURL('src/layout/logs.html')
        };
        
        // Monitorar o container da página
        this.pageContainerObserver = null;
        
        // Bind dos métodos
        this.openPage = this.openPage.bind(this);
        this.closePage = this.closePage.bind(this);
        this.initPageHandlers = this.initPageHandlers.bind(this);
        this.init = this.init.bind(this);

        // Inicializa quando o DOM estiver pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', this.init);
        } else {
            this.init();
        }
        
        console.log('[NavigationManager] Construtor concluído');
    }

    // Método para configurar o observador de mutação para monitorar páginas
    setupPageObserver() {
        // Cancela qualquer observador existente
        if (this.pageContainerObserver) {
            this.pageContainerObserver.disconnect();
        }
        
        // Configurar um observador para monitorar o container da página
        this.pageContainerObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Verificar se algum elemento foi adicionado
                    mutation.addedNodes.forEach((node) => {
                        if (node.id === 'page-container') {
                            console.log('[NavigationManager] Container de página detectado:', node);
                            this.currentPage = node;
                        }
                    });
                    
                    // Verificar se algum elemento foi removido
                    mutation.removedNodes.forEach((node) => {
                        if (node.id === 'page-container' && this.currentPage === node) {
                            console.log('[NavigationManager] Container de página removido');
                            this.currentPage = null;
                        }
                    });
                }
            });
        });
        
        // Iniciar observação do body para detectar quando containers de página são adicionados/removidos
        this.pageContainerObserver.observe(document.body, { 
            childList: true,
            subtree: true
        });
        
        console.log('[NavigationManager] Observador de páginas configurado');
    }

    // Inicialização
    init() {
        console.log('[NavigationManager] Método init iniciado');
        
        // Configura o observador de páginas
        this.setupPageObserver();
        
        // Adiciona o event listener para o botão de configurações
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openPage('settings'));
        }
        
        // Adiciona o event listener para o botão de logs
        const logsBtn = document.getElementById('logs-btn');
        if (logsBtn) {
            logsBtn.addEventListener('click', () => this.openPage('logs'));
        }

        // Adiciona listener para mensagens Chrome
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'closePage') {
                this.closePage();
                sendResponse({ success: true });
                return true;
            }
            
            if (request.action === 'openPage') {
                const { page } = request;
                if (this.pages[page]) {
                    this.openPage(page);
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: `Página ${page} não encontrada` });
                }
                return true;
            }
            
            return false;
        });
        
        // Adiciona listener para mensagens postMessage das subpáginas
        window.addEventListener('message', (event) => {
            console.log(`[NavigationManager] Recebido postMessage! Evento completo:`, event);
            console.log(`[NavigationManager] Dados da mensagem:`, event.data);
            console.log(`[NavigationManager] Origem da mensagem:`, event.origin);
            console.log(`[NavigationManager] Action da mensagem: ${event.data?.action}`);
            
            // Fecha a página quando receber a ação closePage
            if (event.data?.action === 'closePage') {
                console.log('[NavigationManager] Executando closePage via postMessage');
                this.closePage();
            }
            
            // Abre uma página quando receber a ação openPage
            if (event.data?.action === 'openPage' && event.data?.page) {
                if (this.pages[event.data.page]) {
                    this.openPage(event.data.page);
                }
            }
        });
    }

    // Atualiza a UI principal com as novas configurações
    updateMainUI(config) {
        console.log('[NavigationManager] Atualizando UI principal com config:', JSON.stringify(config));
        
        // Atualiza o display de Gale
        const currentGale = document.getElementById('current-gale');
        if (currentGale) {
            // Verifica se temos config.gale.active direto ou config.galeEnabled
            const galeActive = typeof config.gale?.active !== 'undefined' ? 
                config.gale.active : 
                (typeof config.galeEnabled !== 'undefined' ? config.galeEnabled : false);
                
            // Verifica se temos config.gale.level direto ou config.galeLevel
            const galeLevel = typeof config.gale?.level !== 'undefined' ? 
                config.gale.level : 
                (typeof config.galeLevel !== 'undefined' ? config.galeLevel : 1);
                
            if (galeActive) {
                currentGale.textContent = `Gale: ${galeLevel}`;
                currentGale.className = 'gale-status active';
            } else {
                currentGale.textContent = 'Gale: Desativado';
                currentGale.className = 'gale-status inactive';
            }
            console.log(`[NavigationManager] Status do Gale atualizado: ${galeActive ? 'Ativo' : 'Desativado'}, Nível: ${galeLevel}`);
        }

        // Atualiza o display de Lucro Diário
        const currentProfit = document.getElementById('current-profit');
        if (currentProfit) {
            currentProfit.textContent = `Lucro Diário: R$ ${config.dailyProfit}`;
        }

        // Atualiza o display de Stop Loss
        const currentStop = document.getElementById('current-stop');
        if (currentStop) {
            currentStop.textContent = `Stop Loss: R$ ${config.stopLoss}`;
        }

        // Atualiza o status de automação
        const automationStatus = document.getElementById('automation-status');
        if (automationStatus) {
            automationStatus.textContent = `Automação: ${config.automation ? 'Ativa' : 'Inativa'}`;
        }

        // Atualiza o valor de entrada
        const currentValue = document.getElementById('current-value');
        if (currentValue) {
            currentValue.textContent = `Valor de entrada: R$ ${config.value}`;
        }

        // Atualiza o período
        const currentTime = document.getElementById('current-time');
        if (currentTime) {
            currentTime.textContent = `Período: ${config.period}m`;
        }
    }

    // Função para injetar os estilos das subpáginas
    injectSubpageStyles() {
        const styleId = 'trade-manager-subpage-styles';
        
        // Verifica se os estilos já foram injetados
        if (document.getElementById(styleId)) return;

        // Cria o elemento style
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .subpage-container {
                position: fixed;
                right: -480px;
                top: 0;
                width: 480px;
                height: calc(100% - 65px);
                z-index: 9999999;
                display: flex;
                justify-content: flex-end;
                transition: all 0.3s ease-in-out;
            }

            .subpage-container.active {
                right: 0;
            }

            .subpage-iframe {
                width: 480px;
                height: 100%;
                border: none;
                background: #fff;
                box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
            }
        `;

        // Adiciona o style ao head da página web
        document.head.appendChild(style);
    }

    // Função para abrir uma página em um iframe
    openPage(pageName) {
        console.log(`[NavigationManager] Abrindo página ${pageName}...`);
        
        if (!this.pages[pageName]) {
            console.error(`Página ${pageName} não encontrada`);
            return;
        }

        // Injeta os estilos necessários para as subpáginas
        this.injectSubpageStyles();
        
        // Se já existe um iframe, remove ele primeiro
        this.closePage();

        // Cria o container do iframe
        const container = document.createElement('div');
        container.id = 'page-container';
        container.className = 'subpage-container';
        
        // Armazena o nome da página para referência
        container.dataset.pageName = pageName;

        // Cria o iframe
        const iframe = document.createElement('iframe');
        iframe.src = this.pages[pageName];
        iframe.className = 'subpage-iframe';

        // Adiciona o iframe ao container e o container ao documento da página web
        container.appendChild(iframe);
        document.body.appendChild(container);
        
        // Definimos currentPage após adicionar ao DOM
        this.currentPage = container;
        console.log(`[NavigationManager] Página ${pageName} aberta, referência salva:`, this.currentPage);

        // Adiciona listeners globais
        this.addGlobalListeners();

        // Ativa a animação após um pequeno delay para garantir que o DOM foi atualizado
        requestAnimationFrame(() => {
            container.classList.add('active');
        });

        // Quando o iframe carregar, inicializa os handlers da página
        iframe.addEventListener('load', () => {
            this.initPageHandlers(iframe, pageName);
        });
    }

    // Adiciona listeners globais (ESC e clique fora)
    addGlobalListeners() {
        // Listener para ESC
        const escListener = (e) => {
            if (e.key === 'Escape') this.closePage();
        };
        document.addEventListener('keydown', escListener);

        // Listener para clique fora
        this.currentPage.addEventListener('click', (e) => {
            if (e.target === this.currentPage) this.closePage();
        });

        // Armazena os listeners para remoção posterior
        this.currentPage.escListener = escListener;
    }

    // Remove listeners globais
    removeGlobalListeners() {
        if (this.currentPage?.escListener) {
            document.removeEventListener('keydown', this.currentPage.escListener);
        }
    }

    // Função para realmente remover o elemento com segurança
    forceRemoveElement(element) {
        console.log('[NavigationManager] Tentando remover o elemento forçadamente');
        if (!element) return false;
        
        try {
            // Método 1: remover diretamente
            if (element.parentNode) {
                element.parentNode.removeChild(element);
                return true;
            }
            
            // Método 2: esconder o elemento (quando não conseguimos remover)
            element.style.display = 'none';
            element.style.visibility = 'hidden';
            element.style.position = 'absolute';
            element.style.left = '-9999px';
            
            // Método 3: definir uma classe que oculta o elemento
            element.className = 'hidden-container';
            
            return true;
        } catch (e) {
            console.error('[NavigationManager] Não foi possível remover ou ocultar o elemento:', e);
            return false;
        }
    }
    
    // Função para fechar a página atual
    closePage() {
        console.log('[NavigationManager] Fechando página...');
        console.log('[NavigationManager] Estado atual - currentPage:', this.currentPage);
        console.log('[NavigationManager] Elemento page-container existe?', document.getElementById('page-container') !== null);
        
        // Se this.currentPage está nulo, mas o container existe no DOM, vamos recuperá-lo
        if (!this.currentPage && document.getElementById('page-container')) {
            console.log('[NavigationManager] Recuperando referência perdida para página atual');
            this.currentPage = document.getElementById('page-container');
        }
        
        if (!this.currentPage) {
            console.log('[NavigationManager] Nenhuma página aberta para fechar');
            return;
        }
        
        try {
            // Remove a classe active para iniciar a animação de saída
            this.currentPage.classList.remove('active');
            
            // Remove listeners
            this.removeGlobalListeners();
            
            // Guarda uma referência para o elemento que queremos remover
            const elementToRemove = this.currentPage;
            
            // Remove o elemento após a animação terminar
            setTimeout(() => {
                if (elementToRemove) {
                    try {
                        if (document && document.body && elementToRemove.parentNode === document.body) {
                            document.body.removeChild(elementToRemove);
                            console.log('[NavigationManager] Página removida com sucesso');
                        } else {
                            console.log('[NavigationManager] Página não está no document.body, tentando método alternativo');
                            if (elementToRemove.parentNode) {
                                elementToRemove.parentNode.removeChild(elementToRemove);
                                console.log('[NavigationManager] Página removida com método alternativo');
                            } else {
                                console.log('[NavigationManager] Página não tem pai, não pode ser removida');
                                this.forceRemoveElement(elementToRemove);
                            }
                        }
                    } catch (error) {
                        console.error('[NavigationManager] Erro ao remover página:', error);
                        this.forceRemoveElement(elementToRemove);
                    } finally {
                        // Limpar a referência
                        this.currentPage = null;
                    }
                }
            }, 500);
        } catch (error) {
            console.error('[NavigationManager] Erro ao fechar página:', error);
            
            // Força a remoção em caso de erro
            if (this.currentPage) {
                this.forceRemoveElement(this.currentPage);
                this.currentPage = null;
            }
        }
    }

    // Inicializa os handlers específicos de cada página
    initPageHandlers(iframe, pageName) {
        const contentWindow = iframe.contentWindow;
        const document = contentWindow.document;

        switch(pageName) {
            case 'settings':
                this.initSettingsPage(document);
                break;
            case 'logs':
                this.initLogsPage(document);
                break;
            default:
                console.log(`Página ${pageName} não tem handlers específicos`);
        }
    }

    // Handlers específicos para a página de configurações
    initSettingsPage(doc) {
        console.log('Página de configurações carregada');
    }
    
    // Handlers específicos para a página de logs
    initLogsPage(doc) {
        console.log('Página de logs carregada');
    }
}

// Cria e exporta a instância do gerenciador de navegação
const navigationManager = new NavigationManager();
console.log('[NavigationManager] Inicializado com sucesso');

// Expõe uma API para outros scripts
window.Navigation = {
    openPage: pageName => navigationManager.openPage(pageName),
    closePage: () => navigationManager.closePage()
};

// Também expõe o próprio navigationManager para acesso direto se necessário
window.navigationManager = navigationManager;
console.log('[NavigationManager] API exposta globalmente via window.Navigation e window.navigationManager'); 