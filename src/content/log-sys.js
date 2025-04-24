/**
 * Trade Manager Pro - Sistema de Logs
 * Este arquivo gerencia o sistema centralizado de logs da aplicação
 */

// ================== VERIFICAÇÃO DE PÁGINA ==================
// Função para verificar se estamos na página de logs
const isLogPage = () => {
    return document.getElementById('log-container') !== null;
};

// Detectar se estamos na página de logs
window.IS_LOG_PAGE = isLogPage();
console.log(`[log-sys.js] Estamos na página de logs? ${window.IS_LOG_PAGE}`);

// ================== ELEMENTOS DA UI ==================
const sysUI = {
    copyBtn: document.getElementById('copy-logs'),
    saveBtn: document.getElementById('export-logs'),
    clearBtn: document.getElementById('clear-logs'),
    closeBtn: document.getElementById('close-logs'),
    logContainer: document.getElementById('log-container'),
    levelFilter: document.getElementById('log-level-filter'),
    version: document.getElementById('version')
};

// ================== NÍVEIS DE LOG ==================
const LOG_LEVELS = {
    DEBUG: { value: 0, prefix: '🐛 DEBUG', className: 'log-debug' },
    INFO: { value: 1, prefix: 'ℹ️ INFO', className: 'log-info' },
    WARN: { value: 2, prefix: '⚠️ AVISO', className: 'log-warn' },
    ERROR: { value: 3, prefix: '❌ ERRO', className: 'log-error' },
    SUCCESS: { value: 4, prefix: '✅ SUCESSO', className: 'log-success' }
};

// Filtro de nível atual (null = mostrar todos)
let CURRENT_FILTER_LEVEL = null;

// Lista de fontes/origens de logs que devem ser filtradas (logs destas fontes serão ignorados a menos que sejam erros)
const FILTERED_SOURCES = [
    'navigationManager', 
    'NavigationManager', 
    'navigation.js',
    'log-sys.js'
];

// Lista de padrões de mensagens que devem ser ignoradas (mesmo sendo de níveis mais altos)
const FILTERED_MESSAGE_PATTERNS = [
    'Container de página detectado',
    'Container de página removido',
    'Página removida com sucesso',
    'Inicializando',
    'Carregando',
    'Inicializado',
    'Sistema iniciado',
    'API exposta',
    'Observador de páginas',
    'Recebido postMessage',
    'Método init',
    'Construtor concluído'
];

// Função para verificar se uma mensagem deve ser filtrada
const shouldFilterMessage = (message, level, source) => {
    // Se temos um filtro de nível específico e o nível não corresponde, filtrar
    if (CURRENT_FILTER_LEVEL && level !== CURRENT_FILTER_LEVEL && CURRENT_FILTER_LEVEL !== 'ALL') {
        return true;
    }
    
    // Se a fonte está na lista de filtros e não é um erro ou aviso, filtrar
    if (FILTERED_SOURCES.some(filteredSource => source.includes(filteredSource)) && 
        level !== 'ERROR' && level !== 'WARN') {
        return true;
    }
    
    // Verificar se a mensagem contém algum dos padrões a serem filtrados
    // Somente filtrar se não for ERRO ou AVISO
    if (level !== 'ERROR' && level !== 'WARN') {
        return FILTERED_MESSAGE_PATTERNS.some(pattern => 
            message.toLowerCase().includes(pattern.toLowerCase())
        );
    }
    
    return false;
};

// ================== FUNÇÃO GLOBAL DE LOGGING ==================
// Definir a função global logToSystem que pode ser acessada por qualquer script
window.logToSystem = function(message, level = 'INFO', source = 'system') {
    // Verificar e normalizar o nível de log
    const normalizedLevel = (level && typeof level === 'string') ? level.toUpperCase() : 'INFO';
    
    // Verificar se temos uma fonte válida
    const normalizedSource = source || 'system';
    
    // Verificar se a mensagem deve ser filtrada
    if (shouldFilterMessage(message, normalizedLevel, normalizedSource)) {
        // Não registrar logs filtrados no sistema, apenas exibir no console quando for DEBUG
        if (window.DEBUG_LOGS) {
            console.log(`[${normalizedLevel}][${normalizedSource}] ${message} [FILTRADO]`);
        }
        return true;
    }
    
    // Log no console para debugging
    console.log(`[${normalizedLevel}][${normalizedSource}] ${message}`);
    
    // Tentar adicionar diretamente se estamos na página de logs
    if (window.IS_LOG_PAGE && typeof sysAddLog === 'function') {
        try {
            sysAddLog(message, normalizedLevel, normalizedSource).catch(e => 
                console.error('[logToSystem] Erro ao adicionar log diretamente:', e)
            );
            return true;
        } catch (error) {
            console.error('[logToSystem] Erro ao adicionar log diretamente:', error);
        }
    }
    
    // Enviar para o sistema de logs via mensagens do Chrome
    try {
        // Enviar mensagem sem esperar resposta (sem callback)
        chrome.runtime.sendMessage({
            action: 'logMessage',
            message,
            level: normalizedLevel,
            source: normalizedSource
        });
        
        // Para debug, mas não mostrar erros
        if (window.DEBUG_LOGS) {
            console.log('[logToSystem] Mensagem enviada');
        }
    } catch (error) {
        console.error('[logToSystem] Erro ao enviar log:', error);
    }
    
    return true;
};

// ================== SISTEMA DE LOGS ==================
// Carregar logs do storage
const sysLoadLogs = async () => {
    try {
        const result = await chrome.storage.local.get(['systemLogs']);
        const logs = result.systemLogs || [];
        
        if (logs.length === 0) {
            console.log('[LogSystem] Nenhum log encontrado no storage');
            if (sysUI.logContainer) {
                sysUI.logContainer.innerHTML = '<div class="log-entry log-info">Nenhum log encontrado. Aguardando eventos...</div>';
            }
            return;
        }
        
        console.log(`[LogSystem] ${logs.length} logs carregados do storage`);
        
        if (sysUI.logContainer) {
            sysUI.logContainer.innerHTML = ''; // Limpa o container
            
            // Adiciona cada log ao container
            logs.forEach(log => {
                // Verificar se o log deve ser exibido (não filtrado)
                if (!shouldFilterMessage(log.message, log.level, log.source)) {
                    const logEntry = document.createElement('div');
                    logEntry.className = `log-entry ${(LOG_LEVELS[log.level] || LOG_LEVELS.INFO).className}`;
                    logEntry.textContent = `[${log.timestamp}] ${(LOG_LEVELS[log.level] || LOG_LEVELS.INFO).prefix} [${log.source}] ${log.message}`;
                    
                    // Armazena os dados para recuperação posterior
                    logEntry.setAttribute('data-message', log.message);
                    logEntry.setAttribute('data-level', log.level);
                    logEntry.setAttribute('data-source', log.source);
                    logEntry.setAttribute('data-timestamp', log.timestamp);
                    
                    sysUI.logContainer.appendChild(logEntry);
                }
            });
            
            // Rolar para o final
            sysUI.logContainer.scrollTop = sysUI.logContainer.scrollHeight;
        }
    } catch (error) {
        console.error('Erro ao carregar logs:', error);
        if (sysUI.logContainer) {
            sysUI.logContainer.innerHTML = `<div class="log-entry log-error">Erro ao carregar logs: ${error.message}</div>`;
        }
    }
};

// Adicionar uma entrada de log
const sysAddLog = async (message, level = 'INFO', source = 'SYSTEM') => {
    // Validar parâmetros
    const logLevel = level ? (LOG_LEVELS[level] || LOG_LEVELS.INFO) : LOG_LEVELS.INFO;
    const logSource = source || 'SYSTEM';
    
    // Verificar se a mensagem deve ser filtrada
    if (shouldFilterMessage(message, level, logSource)) {
        return false;
    }
    
    try {
        // Criar o timestamp
        const now = new Date();
        const timestamp = now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR');
        
        // Objeto de log
        const logEntry = {
            message,
            level,
            source: logSource,
            timestamp
        };
        
        // Salvar no storage
        const result = await chrome.storage.local.get(['systemLogs']);
        let logs = result.systemLogs || [];
        
        // Limitar o número de logs armazenados
        const MAX_LOGS = 1000; // Limitar a 1000 logs
        if (logs.length >= MAX_LOGS) {
            logs = logs.slice(-MAX_LOGS + 1); // Manter os logs mais recentes
        }
        
        logs.push(logEntry);
        await chrome.storage.local.set({ systemLogs: logs });
        
        // Se estamos na página de logs, adicionar o log à UI
        if (window.IS_LOG_PAGE && sysUI.logContainer) {
            // Verificar se o elemento existe
            if (!sysUI.logContainer) {
                console.error('Container de logs não encontrado');
                return false;
            }
            
            // Verificar filtro de nível, se disponível
            if (sysUI.levelFilter) {
                const selectedLevel = sysUI.levelFilter.value;
                if (selectedLevel !== 'ALL' && level !== selectedLevel) {
                    // Não mostrar este log se estiver filtrado
                    return true;
                }
            }
            
            // Criar elemento de log
            const logElement = document.createElement('div');
            logElement.className = `log-entry ${logLevel.className}`;
            logElement.textContent = `[${timestamp}] ${logLevel.prefix} [${logSource}] ${message}`;
            
            // Armazena os dados para recuperação posterior
            logElement.setAttribute('data-message', message);
            logElement.setAttribute('data-level', level);
            logElement.setAttribute('data-source', logSource);
            logElement.setAttribute('data-timestamp', timestamp);
            
            // Adicionar ao container
            sysUI.logContainer.appendChild(logElement);
            
            // Rolar para o final
            sysUI.logContainer.scrollTop = sysUI.logContainer.scrollHeight;
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao adicionar log:', error);
        return false;
    }
};

// Função para copiar logs
const sysCopyLogs = () => {
    if (!window.IS_LOG_PAGE || !sysUI.logContainer) return;
    
    const logs = Array.from(sysUI.logContainer.children)
        .map(entry => entry.textContent)
        .join('\n');
    
    if (!logs) {
        alert('Não há logs para copiar');
        return;
    }
    
    // Criar um elemento textarea temporário
    const textarea = document.createElement('textarea');
    textarea.value = logs;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    try {
        // Selecionar e copiar o texto
        textarea.select();
        document.execCommand('copy');
        alert('Logs copiados para a área de transferência!');
    } catch (err) {
        console.error('Erro ao copiar logs:', err);
        alert('Erro ao copiar logs');
    } finally {
        // Remover o elemento temporário
        document.body.removeChild(textarea);
    }
};

// Salvar logs como arquivo
const sysSaveLogsToFile = () => {
    if (!window.IS_LOG_PAGE || !sysUI.logContainer) return;
    
    const logs = Array.from(sysUI.logContainer.children)
        .map(entry => entry.textContent)
        .join('\n');
    
    if (!logs) {
        alert('Não há logs para salvar');
        return;
    }
    
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-manager-logs-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    alert('Logs salvos como arquivo');
};

// Limpar todos os logs
const sysClearLogs = async () => {
    try {
        await chrome.storage.local.remove(['systemLogs']);
        
        if (sysUI.logContainer) {
            sysUI.logContainer.innerHTML = '<div class="log-entry">Todos os logs foram limpos.</div>';
        }
        
        sysAddLog('Todos os logs foram limpos', 'INFO', 'LogSystem');
    } catch (error) {
        console.error('Erro ao limpar logs:', error);
    }
};

// Fechar página de logs
const closeLogs = () => {
    console.log('[log-sys.js] Botão de fechamento clicado!');
    console.log('[log-sys.js] Referência do botão:', sysUI.closeBtn);
    console.log('[log-sys.js] Tentando fechar a página de logs...');
    
    try {
        // Método 1: Tentar acessar diretamente o navigationManager
        if (window.parent && window.parent.navigationManager) {
            console.log('[log-sys.js] Chamando diretamente navigationManager.closePage()');
            window.parent.navigationManager.closePage();
            return;
        }
        
        // Método 2: Tentar acessar via window.Navigation
        if (window.parent && window.parent.Navigation) {
            console.log('[log-sys.js] Chamando window.parent.Navigation.closePage()');
            window.parent.Navigation.closePage();
            return;
        }
        
        // Método 3: Usar postMessage como fallback
        console.log('[log-sys.js] Enviando mensagem closePage para parent...');
        window.parent.postMessage({ action: 'closePage' }, '*');
        console.log('[log-sys.js] Mensagem enviada!');
    } catch (error) {
        console.error('[log-sys.js] Erro ao tentar fechar página:', error);
        // Último recurso: tentar fechar com método direto no DOM
        try {
            const container = window.frameElement.parentNode;
            if (container && container.parentNode) {
                console.log('[log-sys.js] Tentando remover container diretamente');
                container.parentNode.removeChild(container);
            }
        } catch (e) {
            console.error('[log-sys.js] Não foi possível remover o container:', e);
        }
    }
};

// ================== LISTENERS DE MENSAGENS ==================
// Configurar receptor de mensagens para receber logs de outros scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Processamento simplificado de mensagens de log
    if (request.action === 'logMessage') {
        const { message, level, source } = request;
        
        // Verificar se a mensagem deve ser filtrada
        if (shouldFilterMessage(message, level, source)) {
            // Responder sucesso, mas não salvar o log
            try {
                sendResponse({ success: true, filtered: true });
            } catch (e) {
                // Ignora erros de porta fechada
            }
            return true;
        }
        
        // Salvar log de forma assíncrona sem preocupação com resposta
        (async () => {
            try {
                // Se estamos na página de logs, adicionar à UI
                if (window.IS_LOG_PAGE && typeof sysAddLog === 'function') {
                    await sysAddLog(message, level, source);
                } else {
                    // Se não estamos na página de logs, salvar no storage diretamente
                    // Obter logs existentes
                    const result = await chrome.storage.local.get(['systemLogs']);
                    let logs = result.systemLogs || [];
                    const timestamp = new Date().toLocaleString();
                    
                    // Adicionar novo log
                    logs.push({
                        message,
                        level,
                        source,
                        timestamp,
                        date: new Date().toISOString()
                    });
                    
                    // Limitar a quantidade de logs (manter apenas os 1000 mais recentes)
                    if (logs.length > 1000) {
                        logs = logs.slice(-1000);
                    }
                    
                    // Salvar logs atualizados
                    await chrome.storage.local.set({ systemLogs: logs });
                }
                
                // A resposta pode não ser necessária já que o remetente pode não esperar
                try {
                    sendResponse({ success: true });
                } catch (e) {
                    // Ignora erros de porta fechada
                }
            } catch (error) {
                console.error('[LogSystem] Erro ao processar log:', error);
                try {
                    sendResponse({ success: false, error: error.message });
                } catch (e) {
                    // Ignora erros de porta fechada
                }
            }
        })();
        
        // Retorna true para indicar que o processamento é assíncrono
        return true;
    }
    
    // Processa o pedido de adição de log explícito
    if (request.action === 'addLog') {
        // Verificar se a mensagem deve ser filtrada
        if (shouldFilterMessage(request.message, request.level, request.source)) {
            sendResponse({ success: true, filtered: true });
            return true;
        }
        
        (async () => {
            try {
                const logEntry = await sysAddLog(request.message, request.level, request.source);
                sendResponse({ success: true, logEntry });
            } catch (error) {
                console.error('[LogSystem] Erro ao adicionar log:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true; // Indica que a resposta será assíncrona
    }
    
    return false;
});

// ================== INICIALIZAÇÃO DA UI ==================
// Inicializar elementos da UI da página de logs
const initLogUI = () => {
    // Atualizar referências aos elementos da UI
    sysUI.copyBtn = document.getElementById('copy-logs');
    sysUI.saveBtn = document.getElementById('export-logs');
    sysUI.clearBtn = document.getElementById('clear-logs');
    sysUI.closeBtn = document.getElementById('close-logs');
    sysUI.logContainer = document.getElementById('log-container');
    sysUI.levelFilter = document.getElementById('log-level-filter');
    sysUI.version = document.getElementById('version');
    
    // Exibir versão se disponível
    if (sysUI.version) {
        try {
            const manifest = chrome.runtime.getManifest();
            sysUI.version.textContent = manifest.version;
        } catch (error) {
            console.error('Erro ao obter versão:', error);
        }
    }
    
    console.log('[log-sys.js] UI da página de logs inicializada');
    
    // Adicionar um log de inicialização
    sysAddLog('Sistema de logs inicializado', 'INFO', 'log-sys.js');
};

// ================== EVENT LISTENERS ==================
document.addEventListener('DOMContentLoaded', () => {
    if (window.IS_LOG_PAGE) {
        console.log('[LogSystem] Inicializando página de logs');
        
        // Atualizar referências de UI que podem não estar disponíveis no carregamento do script
        sysUI.copyBtn = document.getElementById('copy-logs');
        sysUI.saveBtn = document.getElementById('export-logs');
        sysUI.clearBtn = document.getElementById('clear-logs');
        sysUI.closeBtn = document.getElementById('close-logs');
        sysUI.logContainer = document.getElementById('log-container');
        sysUI.levelFilter = document.getElementById('log-level-filter');
        sysUI.version = document.getElementById('version');
        
        // Verificar elementos obrigatórios
        if (!sysUI.logContainer) {
            console.error('Container de logs não encontrado');
            return;
        }
        
        // Carregar logs
        sysLoadLogs();
        
        // Configurar eventos dos botões
        if (sysUI.copyBtn) sysUI.copyBtn.addEventListener('click', sysCopyLogs);
        if (sysUI.saveBtn) sysUI.saveBtn.addEventListener('click', sysSaveLogsToFile);
        if (sysUI.clearBtn) sysUI.clearBtn.addEventListener('click', sysClearLogs);
        if (sysUI.closeBtn) sysUI.closeBtn.addEventListener('click', closeLogs);
        
        // Configurar evento do filtro de nível
        if (sysUI.levelFilter) {
            sysUI.levelFilter.addEventListener('change', () => {
                const selectedLevel = sysUI.levelFilter.value;
                
                // Atualizar o filtro para categoria exata
                CURRENT_FILTER_LEVEL = selectedLevel;
                console.log(`[LogSystem] Filtro de logs alterado para: ${selectedLevel}`);
                
                // Recarregar logs com o novo filtro
                sysLoadLogs();
            });
        }
        
        // Exibir versão
        if (sysUI.version && chrome.runtime) {
            try {
                const manifestData = chrome.runtime.getManifest();
                sysUI.version.textContent = manifestData.version || 'N/A';
            } catch (error) {
                console.error('Erro ao obter versão:', error);
                sysUI.version.textContent = 'N/A';
            }
        }
        
        // Registrar log de inicialização
        logToSystem('Página de logs inicializada', 'INFO', 'log-sys.js');
    }
}); 