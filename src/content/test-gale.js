// Script para testar o GaleSystem e clique no botão de análise

// Função para testar o sistema de gale
function testGaleSystem() {
    console.log('Testando sistema de gale...');
    
    // Verificar se o GaleSystem está carregado
    if (!window.GaleSystem) {
        console.error('GaleSystem não encontrado!');
        return;
    }
    
    console.log('Verificando status inicial...');
    const initialStatus = window.GaleSystem.getStatus();
    console.log('Status inicial:', initialStatus);
    
    // Verificar as referências aos botões
    const analyzeBtn = document.querySelector('#analyzeBtn');
    console.log('Botão analyzeBtn encontrado:', analyzeBtn ? true : false);
    
    const runAnalysis = document.querySelector('#run-analysis');
    console.log('Botão run-analysis encontrado:', runAnalysis ? true : false);
    
    // Testar apenas o método de análise
    console.log('Testando triggerAnalysis()...');
    try {
        if (window.GaleSystem.triggerAnalysis) {
            console.log('Função triggerAnalysis encontrada, executando...');
            const analysisResult = window.GaleSystem.triggerAnalysis();
            console.log('Resultado da análise:', analysisResult);
        } else {
            console.error('Função triggerAnalysis não encontrada!');
        }
    } catch (error) {
        console.error('Erro ao testar análise:', error);
    }
}

// Executar teste após 2 segundos para garantir que tudo foi carregado
setTimeout(testGaleSystem, 2000);

console.log('Script de teste de análise carregado, executando em 2 segundos...');

// Adicionar um evento para monitorar se o botão de análise foi clicado
if (document.querySelector('#analyzeBtn')) {
    document.querySelector('#analyzeBtn').addEventListener('click', () => {
        console.log('✅ Botão de análise foi clicado com sucesso!');
    });
    console.log('Listener de clique adicionado ao botão de análise');
} 