// Script de inicialização do popup
document.addEventListener('DOMContentLoaded', () => {
    // Adicionar identificação de ambiente
    document.body.setAttribute('data-environment', 'popup');
    document.body.classList.add('popup-page');
    
    console.log('Inicializando popup...');
    
    if (!window.CaptureScreen) {
        console.error('Módulo CaptureScreen não carregado corretamente');
        
        // Tentar carregar novamente
        const script = document.createElement('script');
        script.src = '../content/capture-screen.js';
        script.onload = () => {
            console.log('Módulo CaptureScreen carregado dinamicamente');
            
            // Verificar se o módulo foi carregado corretamente
            if (window.CaptureScreen && typeof window.CaptureScreen.captureScreenSimple === 'function') {
                console.log('Módulo CaptureScreen inicializado com sucesso');
                
                // Atualizar status se necessário
                const status = document.getElementById('status');
                if (status) {
                    status.textContent = 'Sistema de captura inicializado';
                    status.className = 'status success';
                    status.style.display = 'block';
                    
                    setTimeout(() => {
                        status.style.display = 'none';
                    }, 2000);
                }
            } else {
                console.error('Módulo CaptureScreen não contém as funções esperadas');
                
                // Exibir erro no status
                const status = document.getElementById('status');
                if (status) {
                    status.textContent = 'Erro ao inicializar captura';
                    status.className = 'status error';
                    status.style.display = 'block';
                }
            }
        };
        script.onerror = (error) => {
            console.error('Falha ao carregar o módulo CaptureScreen:', error);
            
            // Exibir erro no status
            const status = document.getElementById('status');
            if (status) {
                status.textContent = 'Erro ao carregar sistema de captura';
                status.className = 'status error';
                status.style.display = 'block';
            }
        };
        document.head.appendChild(script);
    } else {
        console.log('Módulo CaptureScreen disponível no carregamento');
        
        // Verificar se as funções necessárias estão presentes
        if (typeof window.CaptureScreen.captureScreenSimple === 'function') {
            console.log('Módulo CaptureScreen já inicializado corretamente');
        } else {
            console.warn('Módulo CaptureScreen disponível, mas funções esperadas não encontradas');
        }
    }
}); 