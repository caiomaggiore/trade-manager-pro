// Script para testar o GaleSystem

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
    
    console.log('Testando simulateGale()...');
    try {
        const galeResult = window.GaleSystem.simulateGale();
        console.log('Resultado do simulateGale():', galeResult);
        
        // Verificar se o estado foi atualizado
        const afterGaleStatus = window.GaleSystem.getStatus();
        console.log('Status após gale:', afterGaleStatus);
        
        // Verificar se o valor mudou
        if (afterGaleStatus.level > initialStatus.level) {
            console.log('✅ Nível de gale incrementado com sucesso!');
        } else {
            console.error('❌ Nível de gale não foi incrementado!');
        }
        
        // Testar sistema de análise automática
        console.log('Testando chamada de análise após gale...');
        if (window.GaleSystem.triggerAnalysis) {
            const analysisResult = window.GaleSystem.triggerAnalysis();
            console.log('Resultado da análise:', analysisResult);
        } else {
            console.error('Função triggerAnalysis não encontrada!');
        }
    } catch (error) {
        console.error('Erro ao testar simulateGale():', error);
    }
    
    // Aplicar um pequeno delay antes do reset
    setTimeout(() => {
        console.log('Testando simulateReset()...');
        try {
            const resetResult = window.GaleSystem.simulateReset();
            console.log('Resultado do simulateReset():', resetResult);
            
            // Verificar se o estado foi resetado
            const afterResetStatus = window.GaleSystem.getStatus();
            console.log('Status após reset:', afterResetStatus);
            
            // Verificar se o valor voltou ao original
            if (afterResetStatus.level === 0) {
                console.log('✅ Nível de gale resetado com sucesso!');
            } else {
                console.error('❌ Nível de gale não foi resetado!');
            }
        } catch (error) {
            console.error('Erro ao testar simulateReset():', error);
        }
        
        console.log('Testes finalizados!');
    }, 2000);
}

// Executar teste após 2 segundos para garantir que tudo foi carregado
setTimeout(testGaleSystem, 2000);

console.log('Script de teste carregado, executando em 2 segundos...'); 