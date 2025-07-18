// ================== GERENCIADOR DE NAVEGAÇÃO ==================
class NavigationManager {
    constructor() {
        this.currentPage = null;
        this.pages = {
            settings: chrome.runtime.getURL('src/layout/settings.html'),
            logs: chrome.runtime.getURL('src/layout/logs.html')
        };
        
        // Monitorar o container da página
        this.pageContainerObserver = null;
        
        // Propriedade para rastrear a largura da barra de rolagem
        this.scrollbarWidth = this.getScrollbarWidth();
        
        // Bind dos métodos
        this.openPage = this.openPage.bind(this);
        this.closePage = this.closePage.bind(this);
        this.initPageHandlers = this.initPageHandlers.bind(this);
        this.init = this.init.bind(this);
        this.adjustForScrollbar = this.adjustForScrollbar.bind(this);
        
        // Listener para redimensionamento da janela
        window.addEventListener('resize', () => {
            this.scrollbarWidth = this.getScrollbarWidth();
            this.adjustForScrollbar();
        });

        // Inicializa quando o DOM estiver pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', this.init);
        } else {
            this.init();
        }
    }
    
    // Método para calcular a largura da barra de rolagem
    getScrollbarWidth() {
        // Cria um elemento div oculto com barra de rolagem forçada
        const outer = document.createElement('div');
        outer.style.visibility = 'hidden';
        outer.style.overflow = 'scroll';
        document.body.appendChild(outer);
        
        // Cria um elemento div interno
        const inner = document.createElement('div');
        outer.appendChild(inner);
        
        // Calcula a diferença entre as larguras
        const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
        
        // Remove os elementos temporários
        outer.parentNode.removeChild(outer);
        
        return scrollbarWidth;
    }
    
    // Verifica se a página tem barra de rolagem vertical
    hasVerticalScrollbar() {
        return document.body.scrollHeight > window.innerHeight;
    }
    
    // Ajusta o posicionamento das subpáginas quando há barra de rolagem
    adjustForScrollbar() {
        // Se não há página aberta, não faz nada
        if (!this.currentPage) return;
        
        // Verifica se há barra de rolagem vertical
        const hasScrollbar = this.hasVerticalScrollbar();
        
        // Obtém altura do rodapé global para ajustar altura do container
        const globalFooter = document.querySelector('.global-footer');
        const footerHeight = globalFooter ? globalFooter.offsetHeight : 0;
        
        // Ajusta o container da subpágina
        if (hasScrollbar) {
            // Reduz a largura da subpágina quando há barra de rolagem
            this.currentPage.style.width = '465px';
            // Ajusta a altura para não cobrir o rodapé
            this.currentPage.style.height = `calc(100% - ${footerHeight}px)`;
        } else {
            // Restaura a largura original quando não há barra de rolagem
            this.currentPage.style.width = '475px';
            this.currentPage.style.height = `calc(100% - ${footerHeight}px)`;
        }
        
        // Atualiza o iframe para usar 100% da largura/altura disponível
        const iframe = this.currentPage.querySelector('.subpage-iframe');
        if (iframe) {
            iframe.style.width = '100%';
            iframe.style.height = '100%';
        }
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
                            this.currentPage = node;
                            this.adjustForScrollbar();
                        }
                    });
                    
                    // Verificar se algum elemento foi removido
                    mutation.removedNodes.forEach((node) => {
                        if (node.id === 'page-container' && this.currentPage === node) {
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
    }

    // Inicialização
    init() {
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
            try {
                if (request.action === 'closePage') {
                    this.closePage();
                    sendResponse({ success: true });
                    return false; // Não manter canal aberto
                }
                
                if (request.action === 'openPage') {
                    const { page } = request;
                    if (this.pages[page]) {
                        this.openPage(page);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: `Página ${page} não encontrada` });
                    }
                    return false; // Não manter canal aberto
                }
                
                // Listener para atualizações de configuração
                if (request.action === 'configUpdated' && request.config) {
                    this.updateMainUI(request.config);
                    sendResponse({ success: true });
                    return false; // Não manter canal aberto
                }
                
                return false; // Não manter canal aberto para mensagens não tratadas
            } catch (error) {
                // Em caso de erro, enviar resposta e não manter canal aberto
                sendResponse({ success: false, error: error.message });
                return false;
            }
        });
        
        // Adiciona listener para mensagens postMessage das subpáginas
        window.addEventListener('message', (event) => {
            // Fecha a página quando receber a ação closePage
            if (event.data?.action === 'closePage') {
                this.closePage();
            }
            
            // Abre uma página quando receber a ação openPage
            if (event.data?.action === 'openPage' && event.data?.page) {
                if (this.pages[event.data.page]) {
                    this.openPage(event.data.page);
                }
            }
        });
        
        // Adiciona o observer para monitorar mudanças no tamanho do conteúdo da página
        const bodyObserver = new ResizeObserver(() => {
            this.adjustForScrollbar();
        });
        bodyObserver.observe(document.body);
    }

    // Atualiza a UI principal com as novas configurações
    updateMainUI(config) {
        // Log para debug
        if (window.addLog) {
            window.addLog('NavigationManager: Atualizando UI principal com configurações', 'INFO');
            window.addLog(`NavigationManager: Config recebido: ${JSON.stringify(config)}`, 'DEBUG');
        }
        
        // Atualiza o status de Gale
        const currentGale = document.getElementById('gale-status');
        const galeLed = document.getElementById('gale-led');
        if (currentGale) {
            // Usar estrutura normalizada: config.gale.active
            const galeActive = config.gale?.active ?? config.galeEnabled ?? false;
            const galeLevel = config.gale?.level ?? config.galeLevel ?? '20%';
                
            if (galeActive) {
                currentGale.textContent = 'Ativado';
                currentGale.className = 'status-value';
                // Atualizar LED
                if (galeLed) {
                    galeLed.className = 'status-led gale-led active';
                }
                if (window.addLog) {
                    window.addLog(`NavigationManager: Gale atualizado para Ativado (${galeLevel})`, 'DEBUG');
                }
            } else {
                currentGale.textContent = 'Desativado';
                currentGale.className = 'status-value';
                // Atualizar LED
                if (galeLed) {
                    galeLed.className = 'status-led gale-led inactive';
                }
                if (window.addLog) {
                    window.addLog('NavigationManager: Gale atualizado para Desativado', 'DEBUG');
                }
            }
        }

        // Atualiza o display de Lucro Diário
        const currentProfit = document.getElementById('current-profit');
        if (currentProfit) {
            currentProfit.textContent = `R$ ${config.dailyProfit}`;
            if (window.addLog) {
                window.addLog(`NavigationManager: Lucro diário atualizado para R$ ${config.dailyProfit}`, 'DEBUG');
            }
        }

        // Atualiza o display de Stop Loss
        const currentStop = document.getElementById('current-stop');
        if (currentStop) {
            currentStop.textContent = `R$ ${config.stopLoss}`;
            if (window.addLog) {
                window.addLog(`NavigationManager: Stop loss atualizado para R$ ${config.stopLoss}`, 'DEBUG');
            }
        }

        // Atualiza o status de automação
        const automationStatus = document.getElementById('automation-status');
        const automationLed = document.getElementById('automation-led');
        if (automationStatus) {
            // Usar estrutura normalizada: config.automation
            const automationActive = config.automation ?? config.autoActive ?? false;
            
            if (automationActive) {
                automationStatus.textContent = 'Ativado';
                automationStatus.className = 'status-value';
                // Atualizar LED
                if (automationLed) {
                    automationLed.className = 'status-led automation-led active';
                }
                if (window.addLog) {
                    window.addLog('NavigationManager: Automação atualizada para Ativado', 'DEBUG');
                }
            } else {
                automationStatus.textContent = 'Desativado';
                automationStatus.className = 'status-value';
                // Atualizar LED
                if (automationLed) {
                    automationLed.className = 'status-led automation-led inactive';
                }
                if (window.addLog) {
                    window.addLog('NavigationManager: Automação atualizada para Desativado', 'DEBUG');
                }
            }
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
                right: 0;
                top: 0;
                width: 475px; /* Ajustando para nova largura */
                height: calc(100% - 65px); /* Ajuste padrão para o rodapé */
                z-index: 9999999;
                display: flex;
                justify-content: flex-end;
                transition: all 0.3s ease-in-out;
                transform: translateX(100%);
                box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
                box-sizing: border-box;
                max-width: 100vw;
                overflow: hidden;
            }

            .subpage-container.active {
                transform: translateX(5px);
            }

            .subpage-iframe {
                width: 100%;
                height: 100%;
                border: none;
                background: #fff;
                overflow: hidden;
            }
        `;

        // Adiciona o style ao head da página web
        document.head.appendChild(style);
    }

    // Função para abrir uma página em um iframe
    openPage(pageName) {
        // Verificar se a página solicitada existe
        if (!this.pages[pageName]) {
            // Página não encontrada
            return false;
        }
        
        // Se já tem uma página aberta, fechar primeiro
        if (this.currentPage) {
            this.closePage();
        }
        
        // Criar o container da página
        const pageContainer = document.createElement('div');
        pageContainer.id = 'page-container';
        pageContainer.className = 'subpage-container';
        pageContainer.dataset.pageName = pageName;
        
        // Injetar o iframe
        const iframe = document.createElement('iframe');
        iframe.className = 'subpage-iframe';
        iframe.src = this.pages[pageName];
        iframe.allowTransparency = true;
        iframe.frameBorder = '0';
        iframe.scrolling = 'auto';
        
        // Adicionar o iframe ao container
        pageContainer.appendChild(iframe);
        
        // Adicionar o container ao body
        document.body.appendChild(pageContainer);
        
        // Armazenar referência para a página atual
        this.currentPage = pageContainer;
        
        // Configurar as dimensões corretas
        this.adjustForScrollbar();
        
        // Adicionar listeners específicos para esta página
        this.initPageHandlers(iframe, pageName);
        
        // Adicionar classe 'active' após um pequeno delay para permitir animação
        setTimeout(() => {
            pageContainer.classList.add('active');
        }, 10);
        
        // Configurar listeners globais para gerenciar a página
        this.addGlobalListeners();
        
        return true;
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
            // Erro ao remover elemento
            return false;
        }
    }
    
    // Função para fechar a página atual
    closePage() {
        // Verificar se há uma página aberta
        if (!this.currentPage) {
            return;
        }
        
        // Remover listeners globais
        this.removeGlobalListeners();
        
        // Referência temporária para a página atual
        const pageElement = this.currentPage;
        
        // Limpar a referência antes de remover o elemento
        this.currentPage = null;
        
        // Remover a classe 'active' para iniciar a animação de saída
        pageElement.classList.remove('active');
        
        // Remover o elemento após a transição
        setTimeout(() => {
            try {
                // Verificar se o elemento ainda existe no DOM
                if (document.body.contains(pageElement)) {
                    document.body.removeChild(pageElement);
                } else {
                    // O elemento não está no document.body, tentar método alternativo
                    
                    // Tentar remover do pai diretamente
                    if (pageElement.parentNode) {
                        pageElement.parentNode.removeChild(pageElement);
                    } else {
                        // Removido log de página sem pai
                    }
                }
            } catch (error) {
                // Tentar remoção forçada como último recurso
                this.forceRemoveElement(pageElement);
            }
        }, 300); // Tempo suficiente para a animação de saída
    }

    // Inicializa os handlers específicos de cada página
    initPageHandlers(iframe, pageName) {
        try {
            // Aguardar o iframe carregar completamente
            iframe.addEventListener('load', () => {
                try {
                    const contentWindow = iframe.contentWindow;
                    const document = contentWindow?.document;

                    if (!document) {
                        return; // Documento não disponível
                    }

                    switch(pageName) {
                        case 'settings':
                            this.initSettingsPage(document);
                            break;
                        case 'logs':
                            this.initLogsPage(document);
                            break;
                        default:
                            // Página sem handlers específicos
                    }
                } catch (error) {
                    // Erro ao inicializar handlers específicos da página
                }
            });
        } catch (error) {
            // Erro ao configurar listener de load do iframe
        }
    }

    // Inicializa a página de configurações
    initSettingsPage(doc) {
        // Inicializa handlers específicos para a página de configurações
        if (!doc) return;
        
        try {
            // Configura evento para o botão de salvar configurações
            const saveBtn = doc.getElementById('save-settings');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    // Evento de salvar configurações
                });
            }
            
            // Configura evento para o botão de fechar
            const closeBtn = doc.getElementById('close-settings');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closePage();
                });
            }
        } catch (error) {
            // Erro ao inicializar página
        }
    }
    
    // Inicializa a página de logs
    initLogsPage(doc) {
        // Inicializa handlers específicos para a página de logs
        if (!doc) return;
        
        try {
            // Configura evento para o botão de fechar logs
            const closeBtn = doc.getElementById('close-logs');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closePage();
                });
            }
            
            // Configura evento para o botão de limpar logs
            const clearBtn = doc.getElementById('clear-logs');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    // Evento de limpar logs
                });
            }
        } catch (error) {
            // Erro ao inicializar página
        }
    }
}

// Cria e exporta a instância do gerenciador de navegação
const navigationManager = new NavigationManager();

// Injecta os estilos das subpáginas para garantir o funcionamento correto
navigationManager.injectSubpageStyles();

// Expõe uma API para outros scripts
window.Navigation = {
    openPage: pageName => navigationManager.openPage(pageName),
    closePage: () => navigationManager.closePage()
};

// Também expõe o próprio navigationManager para acesso direto se necessário
window.navigationManager = navigationManager; 