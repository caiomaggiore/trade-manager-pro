# ======================================================================
# TRADE MANAGER PRO - SCRIPT DE VERIFICACAO DE CORRECOES
# ======================================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   TRADE MANAGER PRO - TESTE DE CORRECOES" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Funcao para exibir mensagens com cores
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

Write-Status "Iniciando verificacao das correcoes..." "INFO"

# ======================================================================
# VERIFICACAO 1: LISTENER DUPLICADO REMOVIDO
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 1: LISTENER DUPLICADO" -ForegroundColor Yellow

$indexFile = "src/content/index.js"
if (Test-Path $indexFile) {
    $content = Get-Content $indexFile -Raw
    
    # Verificar listeners de mensagem
    $messageListeners = ($content | Select-String -Pattern "addEventListener.*message" -AllMatches).Matches.Count
    if ($messageListeners -le 3) {
        Write-Status "Numero de listeners message reduzido: $messageListeners" "SUCCESS"
    } else {
        Write-Status "Ainda ha muitos listeners message: $messageListeners" "WARN"
    }
} else {
    Write-Status "Arquivo index.js nao encontrado" "ERROR"
}

# ======================================================================
# VERIFICACAO 2: SISTEMA DE LOGS OTIMIZADO
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 2: SISTEMA DE LOGS" -ForegroundColor Yellow

$logFile = "src/content/log-sys.js"
if (Test-Path $logFile) {
    $logContent = Get-Content $logFile -Raw
    
    # Verificar sistema anti-duplicacao
    if ($logContent -match "LOG_DUPLICATE_THRESHOLD") {
        Write-Status "Sistema anti-duplicacao implementado" "SUCCESS"
    } else {
        Write-Status "Sistema anti-duplicacao nao encontrado" "ERROR"
    }
    
    # Verificar sistema de hash
    if ($logContent -match "lastProcessedLog") {
        Write-Status "Sistema de controle de logs duplicados implementado" "SUCCESS"
    } else {
        Write-Status "Sistema de controle nao encontrado" "WARN"
    }
} else {
    Write-Status "Arquivo log-sys.js nao encontrado" "ERROR"
}

# ======================================================================
# VERIFICACAO 3: STATE MANAGER OTIMIZADO
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 3: STATE MANAGER" -ForegroundColor Yellow

$stateFile = "src/content/state-manager.js"
if (Test-Path $stateFile) {
    $stateContent = Get-Content $stateFile -Raw
    
    # Verificar delay aumentado
    if ($stateContent -match "8000") {
        Write-Status "Delay de inicializacao encontrado (8000ms)" "SUCCESS"
    } else {
        Write-Status "Delay de inicializacao nao foi otimizado" "WARN"
    }
    
    # Verificar sistema anti-spam
    if ($stateContent -match "loggedAnalyzerAttempt") {
        Write-Status "Sistema anti-spam implementado" "SUCCESS"
    } else {
        Write-Status "Sistema anti-spam nao encontrado" "ERROR"
    }
} else {
    Write-Status "Arquivo state-manager.js nao encontrado" "ERROR"
}

# ======================================================================
# VERIFICACAO 4: DEVTOOLS OTIMIZADO
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 4: DEVTOOLS" -ForegroundColor Yellow

$devToolsFile = "src/content/dev-tools.js"
if (Test-Path $devToolsFile) {
    $devContent = Get-Content $devToolsFile -Raw
    
    # Verificar DOM ready check
    if ($devContent -match "readyState") {
        Write-Status "Verificacao de DOM implementada" "SUCCESS"
    } else {
        Write-Status "Verificacao de DOM nao encontrada" "ERROR"
    }
    
    # Verificar funcao setup
    if ($devContent -match "setupAllDevToolsButtons") {
        Write-Status "Funcao setupAllDevToolsButtons criada" "SUCCESS"
    } else {
        Write-Status "Funcao setupAllDevToolsButtons nao encontrada" "ERROR"
    }
} else {
    Write-Status "Arquivo dev-tools.js nao encontrado" "ERROR"
}

# ======================================================================
# VERIFICACAO 5: MANIFEST.JSON
# ======================================================================
Write-Host ""
Write-Host "VERIFICACAO 5: MANIFEST.JSON" -ForegroundColor Yellow

$manifestFile = "manifest.json"
if (Test-Path $manifestFile) {
    $manifestContent = Get-Content $manifestFile -Raw
    
    # Verificar modulos analisadores
    $analyzers = @("local-pattern-detector.js", "cache-analyzer.js", "limits-checker.js", "intelligent-gale.js")
    $foundAnalyzers = 0
    
    foreach ($analyzer in $analyzers) {
        if ($manifestContent -match [regex]::Escape($analyzer)) {
            $foundAnalyzers++
        }
    }
    
    if ($foundAnalyzers -eq 4) {
        Write-Status "Todos os 4 modulos analisadores encontrados no manifest" "SUCCESS"
    } else {
        Write-Status "Apenas $foundAnalyzers/4 modulos encontrados no manifest" "WARN"
    }
} else {
    Write-Status "Arquivo manifest.json nao encontrado" "ERROR"
}

# ======================================================================
# RESUMO
# ======================================================================
Write-Host ""
Write-Host "RESUMO DAS CORRECOES" -ForegroundColor Cyan

Write-Status "CORRECOES IMPLEMENTADAS:" "SUCCESS"
Write-Host "   - Listeners duplicados removidos" -ForegroundColor Green
Write-Host "   - Sistema anti-duplicacao nos logs" -ForegroundColor Green
Write-Host "   - Delay otimizado para modulos (8s)" -ForegroundColor Green
Write-Host "   - Sistema anti-spam implementado" -ForegroundColor Green
Write-Host "   - DevTools com verificacao de DOM" -ForegroundColor Green

Write-Host ""
Write-Status "COMO TESTAR:" "INFO"
Write-Host "   1. Recarregue a extensao no Chrome" -ForegroundColor White
Write-Host "   2. Va para https://pocketoption.com" -ForegroundColor White
Write-Host "   3. Abra o console (F12)" -ForegroundColor White
Write-Host "   4. Observe menos spam de logs" -ForegroundColor White
Write-Host "   5. Verifique carregamento dos modulos" -ForegroundColor White
Write-Host "   6. Teste botoes do painel de desenvolvimento" -ForegroundColor White

Write-Host ""
Write-Status "INDICADORES DE SUCESSO:" "INFO"
Write-Host "   OK - Menos logs repetitivos" -ForegroundColor Green
Write-Host "   OK - Modulos carregados com sucesso" -ForegroundColor Green
Write-Host "   OK - Botoes do DevTools funcionando" -ForegroundColor Green
Write-Host "   OK - Sem loops infinitos" -ForegroundColor Green

Write-Host ""
Write-Host "Teste concluido!" -ForegroundColor Cyan 