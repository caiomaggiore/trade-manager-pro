# ======================================================================
# TESTE SIMPLES DE CLIPBOARD
# ======================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   TESTE SIMPLES DE CLIPBOARD" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Write-Status {
    param([string]$Message, [string]$Status = "INFO")
    
    switch ($Status) {
        "SUCCESS" { Write-Host "[OK] $Message" -ForegroundColor Green }
        "ERROR"   { Write-Host "[ERRO] $Message" -ForegroundColor Red }
        "INFO"    { Write-Host "[INFO] $Message" -ForegroundColor White }
    }
}

Write-Status "Verificando simplificacao do sistema..." "INFO"

# ======================================================================
# VERIFICAR OFFSCREEN SIMPLIFICADO
# ======================================================================
Write-Host ""
Write-Host "OFFSCREEN SIMPLIFICADO:" -ForegroundColor Yellow

$offscreenFile = "src/content/offscreen.js"
if (Test-Path $offscreenFile) {
    $content = Get-Content $offscreenFile -Raw
    
    if ($content.Length -lt 1000) {
        Write-Status "Offscreen.js foi simplificado (menos de 1KB)" "SUCCESS"
    } else {
        Write-Status "Offscreen.js ainda esta complexo" "ERROR"
    }
    
    if ($content -match "ultra-simples") {
        Write-Status "Marcacao de versao simples encontrada" "SUCCESS"
    } else {
        Write-Status "Ainda nao eh versao simples" "ERROR"
    }
}

# ======================================================================
# VERIFICAR CLIPBOARD HELPER OTIMIZADO
# ======================================================================
Write-Host ""
Write-Host "CLIPBOARD HELPER OTIMIZADO:" -ForegroundColor Yellow

$helperFile = "src/content/clipboard-helper.js"
if (Test-Path $helperFile) {
    $content = Get-Content $helperFile -Raw
    
    if ($content -match "DIRECT.*method.*this.copyViaDirect") {
        Write-Status "Metodo DIRECT priorizado corretamente" "SUCCESS"
    } else {
        Write-Status "Ordem de metodos nao otimizada" "ERROR"
    }
    
    if ($content -match "Estratégias SIMPLES") {
        Write-Status "Versao simplificada do ClipboardHelper" "SUCCESS"
    } else {
        Write-Status "ClipboardHelper ainda complexo" "ERROR"
    }
}

# ======================================================================
# INSTRUÇÕES DE TESTE
# ======================================================================
Write-Host ""
Write-Host "COMO TESTAR AGORA:" -ForegroundColor Cyan
Write-Host ""
Write-Status "1. Recarregue a extensao no Chrome" "INFO"
Write-Status "2. Abra o DevTools (F12)" "INFO"
Write-Status "3. Va para a aba Console" "INFO"
Write-Status "4. Abra a pagina de logs na extensao" "INFO"
Write-Status "5. Clique no botao 'Copiar'" "INFO"
Write-Status "6. Observe os logs no console" "INFO"

Write-Host ""
Write-Host "LOGS ESPERADOS (em ordem):" -ForegroundColor Yellow
Write-Host "  1. 'Tentando estratégia: DIRECT'" -ForegroundColor Cyan
Write-Host "  2. 'Sucesso com estratégia: DIRECT'" -ForegroundColor Green
Write-Host "  3. 'Logs copiados via DIRECT!'" -ForegroundColor Green

Write-Host ""
Write-Host "SE O DIRECT FALHAR:" -ForegroundColor Yellow
Write-Host "  1. 'Tentando estratégia: BACKGROUND'" -ForegroundColor Cyan
Write-Host "  2. 'Tentando estratégia: OFFSCREEN'" -ForegroundColor Cyan

Write-Host ""
Write-Status "Agora teste e veja se funciona!" "SUCCESS"
Write-Host "" 