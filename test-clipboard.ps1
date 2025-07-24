# ======================================================================
# TRADE MANAGER PRO - TESTE DE SISTEMA DE CLIPBOARD
# ======================================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   TESTE DE SISTEMA DE CLIPBOARD" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Função para exibir mensagens com cores
function Write-Status {
    param(
        [string]$Message,
        [string]$Status = "INFO"
    )
    
    switch ($Status) {
        "SUCCESS" { Write-Host "[OK] $Message" -ForegroundColor Green }
        "ERROR"   { Write-Host "[ERRO] $Message" -ForegroundColor Red }
        "WARN"    { Write-Host "[AVISO] $Message" -ForegroundColor Yellow }
        "INFO"    { Write-Host "[INFO] $Message" -ForegroundColor White }
    }
}

Write-Status "Verificando implementacao do sistema de clipboard..." "INFO"

# ======================================================================
# VERIFICAÇÃO 1: ARQUIVO CLIPBOARD-HELPER.JS
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 1: CLIPBOARD HELPER" -ForegroundColor Yellow

$clipboardHelper = "src/content/clipboard-helper.js"
if (Test-Path $clipboardHelper) {
    $helperContent = Get-Content $clipboardHelper -Raw
    
    # Verificar se tem as 3 estratégias
    if ($helperContent -match "copyViaOffscreen" -and 
        $helperContent -match "copyViaBackground" -and 
        $helperContent -match "copyViaDirect") {
        Write-Status "Todas as 3 estrategias de clipboard implementadas" "SUCCESS"
    } else {
        Write-Status "Algumas estrategias de clipboard faltando" "ERROR"
    }
    
    # Verificar se tem função global
    if ($helperContent -match "window.copyToClipboard") {
        Write-Status "Funcao global copyToClipboard disponivel" "SUCCESS"
    } else {
        Write-Status "Funcao global copyToClipboard nao encontrada" "ERROR"
    }
} else {
    Write-Status "Arquivo clipboard-helper.js nao encontrado" "ERROR"
}

# ======================================================================
# VERIFICAÇÃO 2: OFFSCREEN.JS MELHORADO
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 2: OFFSCREEN DOCUMENT" -ForegroundColor Yellow

$offscreenFile = "src/content/offscreen.js"
if (Test-Path $offscreenFile) {
    $offscreenContent = Get-Content $offscreenFile -Raw
    
    # Verificar se tem tratamento melhorado de erro
    if ($offscreenContent -match "errorDetails.*name.*message") {
        Write-Status "Tratamento melhorado de erro DOMException implementado" "SUCCESS"
    } else {
        Write-Status "Tratamento de erro nao melhorado" "WARN"
    }
    
    # Verificar se tem fallback
    if ($offscreenContent -match "execCommand.*copy") {
        Write-Status "Fallback com execCommand implementado" "SUCCESS"
    } else {
        Write-Status "Fallback execCommand nao encontrado" "ERROR"
    }
} else {
    Write-Status "Arquivo offscreen.js nao encontrado" "ERROR"
}

# ======================================================================
# VERIFICAÇÃO 3: BACKGROUND SCRIPT
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 3: BACKGROUND SCRIPT" -ForegroundColor Yellow

$backgroundFile = "src/background/background.js"
if (Test-Path $backgroundFile) {
    $backgroundContent = Get-Content $backgroundFile -Raw
    
    # Verificar se tem método copyTextDirect
    if ($backgroundContent -match "copyTextDirect") {
        Write-Status "Metodo copyTextDirect adicionado ao background" "SUCCESS"
    } else {
        Write-Status "Metodo copyTextDirect nao encontrado" "ERROR"
    }
    
    # Verificar se tem permissão clipboardWrite
    $manifestFile = "manifest.json"
    if (Test-Path $manifestFile) {
        $manifestContent = Get-Content $manifestFile -Raw
        if ($manifestContent -match "clipboardWrite") {
            Write-Status "Permissao clipboardWrite encontrada no manifest" "SUCCESS"
        } else {
            Write-Status "Permissao clipboardWrite nao encontrada no manifest" "WARN"
        }
    }
} else {
    Write-Status "Arquivo background.js nao encontrado" "ERROR"
}

# ======================================================================
# VERIFICAÇÃO 4: LOG-SYS.JS INTEGRADO
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 4: INTEGRACAO COM LOG-SYS" -ForegroundColor Yellow

$logSysFile = "src/content/log-sys.js"
if (Test-Path $logSysFile) {
    $logSysContent = Get-Content $logSysFile -Raw
    
    # Verificar se usa ClipboardHelper
    if ($logSysContent -match "window.ClipboardHelper") {
        Write-Status "LogSystem integrado com ClipboardHelper" "SUCCESS"
    } else {
        Write-Status "LogSystem nao integrado com ClipboardHelper" "ERROR"
    }
} else {
    Write-Status "Arquivo log-sys.js nao encontrado" "ERROR"
}

# ======================================================================
# VERIFICAÇÃO 5: LOGS.HTML ATUALIZADO
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 5: PAGINA DE LOGS" -ForegroundColor Yellow

$logsHtml = "src/layout/logs.html"
if (Test-Path $logsHtml) {
    $logsContent = Get-Content $logsHtml -Raw
    
    # Verificar se carrega clipboard-helper.js
    if ($logsContent -match "clipboard-helper.js") {
        Write-Status "Pagina de logs carrega clipboard-helper.js" "SUCCESS"
    } else {
        Write-Status "Pagina de logs nao carrega clipboard-helper.js" "ERROR"
    }
} else {
    Write-Status "Arquivo logs.html nao encontrado" "ERROR"
}

# ======================================================================
# RESUMO
# ======================================================================
Write-Host ""
Write-Host "RESUMO DO SISTEMA DE CLIPBOARD" -ForegroundColor Cyan

Write-Status "IMPLEMENTACOES DISPONIVEIS:" "SUCCESS"
Write-Host "   1. OFFSCREEN: Usa offscreen document (Manifest V3)" -ForegroundColor Green
Write-Host "   2. BACKGROUND: Usa background script (fallback)" -ForegroundColor Green
Write-Host "   3. DIRECT: Usa execCommand no iframe (compatibilidade)" -ForegroundColor Green

Write-Host ""
Write-Status "COMO TESTAR:" "INFO"
Write-Host "   1. Recarregue a extensao no Chrome" -ForegroundColor White
Write-Host "   2. Abra a pagina de logs" -ForegroundColor White
Write-Host "   3. Clique no botao 'Copiar'" -ForegroundColor White
Write-Host "   4. Observe no console qual metodo foi usado" -ForegroundColor White
Write-Host "   5. Cole o texto em qualquer editor" -ForegroundColor White

Write-Host ""
Write-Status "LOGS ESPERADOS NO CONSOLE:" "INFO"
Write-Host "   - 'Tentando estrategia: OFFSCREEN/BACKGROUND/DIRECT'" -ForegroundColor Cyan
Write-Host "   - 'Sucesso com estrategia: [METODO]'" -ForegroundColor Cyan
Write-Host "   - 'Logs copiados via [METODO]!'" -ForegroundColor Cyan

Write-Host ""
Write-Host "Teste de clipboard concluido!" -ForegroundColor Cyan 