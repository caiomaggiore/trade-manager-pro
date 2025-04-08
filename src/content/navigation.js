// ================== GERENCIADOR DE NAVEGAÇÃO ==================
class NavigationManager {
    constructor() {
        this.currentPage = null;
        this.pages = {
            test: chrome.runtime.getURL('src/layout/test-page.html')
            // Adicione outras páginas aqui conforme necessário
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
            testBtn.addEventListener('click', () => this.openPage('test'));
        }

        // Adiciona listener para mensagens do iframe
        window.addEventListener('message', (event) => {
            if (event.data.action === 'closePage') {
                this.closePage();
            }
        });
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
                height: 100vh;
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

    // Função para fechar a página atual
    closePage() {
        if (this.currentPage) {
            // Remove a classe active para iniciar a animação de saída
            this.currentPage.classList.remove('active');
            
            // Remove os listeners globais
            this.removeGlobalListeners();
            
            // Aguarda a animação terminar antes de remover o elemento
            setTimeout(() => {
                if (this.currentPage) {
                    this.currentPage.remove();
                    this.currentPage = null;
                }
            }, 300); // Mesmo tempo da transição CSS
        }
    }

    // Inicializa os handlers específicos de cada página
    initPageHandlers(iframe, pageName) {
        const contentWindow = iframe.contentWindow;
        const document = contentWindow.document;

        switch(pageName) {
            case 'test':
                this.initTestPage(document);
                break;
            // Adicione outros casos aqui para outras páginas
        }
    }

    // Handlers específicos para a página de teste
    initTestPage(doc) {
        const UI = {
            closeBtn: doc.getElementById('close-test'),
            saveBtn: doc.getElementById('save-test'),
            cancelBtn: doc.getElementById('cancel-test'),
            testInput: doc.getElementById('test-input'),
            testSelect: doc.getElementById('test-select'),
            resultsContainer: doc.getElementById('test-results')
        };

        // Função para salvar as configurações de teste
        const saveTestSettings = () => {
            const value = UI.testInput.value;
            const option = UI.testSelect.value;
            
            // Adiciona resultado ao container
            const result = doc.createElement('div');
            result.className = 'test-result';
            result.innerHTML = `
                <p><strong>Valor:</strong> ${value}</p>
                <p><strong>Opção:</strong> ${option}</p>
                <p><strong>Data:</strong> ${new Date().toLocaleString()}</p>
            `;
            
            // Remove o estado vazio se existir
            const emptyState = UI.resultsContainer.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }
            
            UI.resultsContainer.appendChild(result);
            
            // Limpa os campos
            UI.testInput.value = '';
            UI.testSelect.value = '1';
        };

        // Adiciona event listeners
        UI.closeBtn?.addEventListener('click', () => this.closePage());
        UI.saveBtn?.addEventListener('click', saveTestSettings);
        UI.cancelBtn?.addEventListener('click', () => this.closePage());
    }
}

// Cria e exporta a instância do gerenciador de navegação
window.NavigationManager = new NavigationManager(); 