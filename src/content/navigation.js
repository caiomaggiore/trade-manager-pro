// ================== GERENCIADOR DE NAVEGAÇÃO ==================
class NavigationManager {
    constructor() {
        this.currentPage = null;
        this.pages = {
            settings: chrome.runtime.getURL('src/layout/settings.html')
        };
        
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
    }

    // Inicialização
    init() {
        // Adiciona o event listener para o botão de teste
        const testBtn = document.getElementById('test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.openPage('settings'));
        }

        // Adiciona listener para mensagens do iframe
        window.addEventListener('message', async (event) => {
            if (event.data.action === 'closePage') {
                this.closePage();
            }
            if (event.data.action === 'settingsSaved') {
                // Atualizar a UI principal quando as configurações forem salvas
                const config = event.data.config;
                if (config) {
                    // Atualiza o StateManager
                    await window.StateManager?.saveConfig(config);
                    
                    // Atualiza a UI
                    this.updateMainUI(config);
                }
            }
        });
    }

    // Atualiza a UI principal com as novas configurações
    updateMainUI(config) {
        // Atualiza o display de Gale
        const currentGale = document.getElementById('current-gale');
        if (currentGale) {
            currentGale.textContent = `Gale: ${config.gale.active ? config.gale.level : 'Desativado'}`;
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

        // Cria o iframe
        const iframe = document.createElement('iframe');
        iframe.src = this.pages[pageName];
        iframe.className = 'subpage-iframe';

        // Adiciona o iframe ao container e o container ao documento da página web
        container.appendChild(iframe);
        document.body.appendChild(container);
        this.currentPage = container;

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

    // Função para fechar a página atual (ADICIONANDO LOGS)
    closePage() {
        console.log('[NavigationManager] closePage chamada.'); // Log DEBUG
        console.log('[NavigationManager] Valor de this.currentPage no início:', this.currentPage); // Log DEBUG

        if (this.currentPage) {
            console.log('[NavigationManager] Removendo classe active de:', this.currentPage); // Log DEBUG
            this.currentPage.classList.remove('active');
            
            console.log('[NavigationManager] Chamando removeGlobalListeners...'); // Log DEBUG
            this.removeGlobalListeners();
            
            console.log('[NavigationManager] Agendando remoção do elemento em 300ms...'); // Log DEBUG
            setTimeout(() => {
                console.log('[NavigationManager] Dentro do setTimeout para remover. this.currentPage:', this.currentPage);
                if (this.currentPage) {
                    console.log('[NavigationManager] Chamando this.currentPage.remove()...');
                    try {
                      this.currentPage.remove();
                      console.log('[NavigationManager] Elemento removido com sucesso.');
                      this.currentPage = null;
                      console.log('[NavigationManager] this.currentPage definido como null.');
                    } catch (removeError) {
                        console.error('[NavigationManager] Erro ao remover elemento:', removeError);
                    }
                } else {
                    console.log('[NavigationManager] this.currentPage era null/undefined dentro do setTimeout.');
                }
            }, 500); // <<< TEMPO AUMENTADO PARA 500ms
        } else {
             console.log('[NavigationManager] this.currentPage era null/undefined, nada a fazer.');
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
            // Adicione outros casos aqui para outras páginas
        }
    }

    // Handlers específicos para a página de configurações
    initSettingsPage(doc) {
        // Não precisamos inicializar nada aqui pois o settings.js
        // já cuida de toda a lógica da página de configurações
        console.log('Página de configurações carregada');
    }
}

// Cria e exporta a instância do gerenciador de navegação
window.NavigationManager = new NavigationManager(); 