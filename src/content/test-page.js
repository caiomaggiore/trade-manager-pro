// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Adiciona o event listener para o botão de fechar
    const closeBtn = document.getElementById('close-test');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            // Envia mensagem para o script pai fechar a página
            window.parent.postMessage({ action: 'closePage' }, '*');
        });
    }
}); 