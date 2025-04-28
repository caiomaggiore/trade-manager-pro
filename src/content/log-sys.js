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

// ================== ELEMENTOS DA UI ==================
const sysUI = {
    copyBtn: document.getElementById('copy-logs'),
    saveBtn: document.getElementById('export-logs'),
    clearBtn: document.getElementById('clear-logs'),
    closeBtn: document.getElementById('close-logs'),
    logContainer: document.getElementById('log-container'),
    levelFilter: document.getElementById('log-level-filter')
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
    'Construtor concluído',
    'Fechando página de logs',
    'Fechando página de configurações',
    'UI atualizada com as configurações'
];

// Função para verificar se uma mensagem deve ser filtrada
const shouldFilterMessage = (message, level, source) => {
    // Nunca filtrar mensagens - queremos ver todos os logs sem exceção
    return false;
};

// ================== FUNÇÃO GLOBAL DE LOGGING ==================

/**
 * Função global para enviar logs para o sistema
 * @param {string} message Mensagem para registrar
 * @param {string} level Nível do log: INFO, DEBUG, ERROR, WARNING, SUCCESS
 * @param {string} source Origem do log: SYSTEM, ANALYTICS, UI, API, etc
 */
function logToSystem(message, level = 'INFO', source = 'SYSTEM') {
    // Normalizar nível e fonte
    const logLevel = level.toUpperCase();
    const logSource = source.toUpperCase();
    
    // Log no console apenas para erros
    if (logLevel === 'ERROR') {
        console.error(`[${logLevel}][${logSource}] ${message}`);
    }
    
    try {
        // Se estamos na página de logs, adicionar diretamente
        if (window.location.href.includes('logs.html')) {
            try {
                addLogEntry(message, logLevel, logSource);
            } catch (error) {
                console.error('Erro ao adicionar log na página:', error);
            }
            return;
        }

        // Verificar contexto da extensão e enviar para o background
        if (isExtensionContextValid()) {
            try {
                chrome.runtime.sendMessage({
                    action: 'addLog',
                    logMessage: message,
                    logLevel: logLevel,
                    logSource: logSource
                }, response => {
                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message || 'Erro desconhecido';
                        // Ignorar o erro específico de message port closed
                        if (errorMsg.includes('message port closed') || 
                            errorMsg.includes('port closed') || 
                            errorMsg.includes('Receiving end does not exist')) {
                            // Silenciar este erro específico, é esperado em alguns cenários
                            return;
                        }
                        console.error(`Erro ao enviar log: ${errorMsg}`);
                    }
                });
            } catch (error) {
                const errorMsg = error.message || error.toString() || 'Erro desconhecido';
                console.error(`Erro ao enviar log para o background: ${errorMsg}`);
            }
        } else {
            console.warn('Contexto de extensão inválido, log não enviado para background:', message);
        }
    } catch (e) {
        console.error('Erro geral ao processar log:', e);
    }
}

// Função para verificar se o contexto da extensão é válido
function isExtensionContextValid() {
    return typeof chrome !== 'undefined' && 
           chrome.runtime && 
           chrome.runtime.id;
}

// ================== SISTEMA DE LOGS ==================
const LogSystem = {
    logs: [],
    maxLogs: 500,
    container: null,
    initialized: false,
    
    // Mensagens que serão filtradas (não aparecem no log)
    filteredPhrases: [
        'Fechando página de configurações',
        'Elemento status-processo não encontrado',
        'configurações...',
        'Página de logs inicializada'
    ],
    
    init() {
        this.container = document.querySelector('.log-container');
        
        // Para evitar inicializações duplicadas
        if (this.initialized) {
            return this;
        }
        
        // Primeiro, carregar logs do storage
        this.loadLogsFromStorage().then(() => {
            // Marcar como inicializado somente após carregar os logs
            this.initialized = true;
            
            // Adicionar log de inicialização somente uma vez
            if (this.logs.length === 0) {
                this.addLog('Sistema de logs inicializado', 'INFO', 'LogSystem');
            }
            
            // Atualizar a UI agora que temos os logs
            this.updateUI();
        }).catch(error => {
            console.error('[LogSystem] Erro ao inicializar sistema de logs:', error);
            this.initialized = true; // Inicializar mesmo com erro
            this.addLog(`Erro ao carregar logs: ${error.message}`, 'ERROR', 'LogSystem');
        });
        
        return this;
    },
    
    // Carregar logs do storage
    async loadLogsFromStorage() {
        if (!isExtensionContextValid()) {
            console.warn('[LogSystem] Contexto de extensão inválido, não é possível carregar logs do storage');
            return;
        }
        
        try {
            // Verificar se temos acesso ao storage
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                throw new Error('API de storage não disponível');
            }
            
            // Carregar logs
            return new Promise((resolve, reject) => {
                chrome.storage.local.get(['systemLogs'], (result) => {
                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message || 'Erro desconhecido';
                        console.error(`[LogSystem] Erro ao carregar logs do storage: ${errorMsg}`);
                        reject(new Error(errorMsg));
                        return;
                    }
                    
                    const storedLogs = result.systemLogs || [];
                    
                    if (storedLogs.length > 0) {
                        // Filtrar logs duplicados antes de processá-los
                        const uniqueLogs = this.removeDuplicateLogs(storedLogs);
                        
                        // Converter os logs armazenados para o formato interno
                        this.logs = uniqueLogs.map(log => {
                            // Criar um timestamp baseado na data armazenada ou usar a atual como fallback
                            const logDate = log.date ? new Date(log.date) : new Date();
                            
                            return {
                                raw: log.message,
                                formatted: this.formatLog(log.message, log.level, log.source, logDate),
                                level: log.level,
                                source: log.source,
                                timestamp: logDate
                            };
                        });
                        
                        // Ordenar logs cronologicamente
                        this.logs.sort((a, b) => a.timestamp - b.timestamp);
                        
                        // Limitar ao número máximo de logs
                        if (this.logs.length > this.maxLogs) {
                            this.logs = this.logs.slice(-this.maxLogs);
                        }
                    }
                    
                    resolve();
                });
            });
        } catch (error) {
            console.error('[LogSystem] Erro ao carregar logs:', error);
            throw error;
        }
    },
    
    // Método para remover logs duplicados
    removeDuplicateLogs(logs) {
        // Map para armazenar logs únicos usando uma chave composta
        const uniqueMap = new Map();
        
        // Percorrer todos os logs
        logs.forEach(log => {
            // Criar uma chave composta de timestamp + message + source + level
            // Para identificar logs idênticos ou quase idênticos
            const key = `${log.timestamp || ''}-${log.message}-${log.source}-${log.level}`;
            
            // Se já existe um log com esta chave, só mantém o mais recente
            if (!uniqueMap.has(key) || (uniqueMap.get(key).timestamp < log.timestamp)) {
                uniqueMap.set(key, log);
            }
        });
        
        // Converter o map de volta para array
        return Array.from(uniqueMap.values());
    },
    
    shouldFilterMessage(message) {
        // Nunca filtrar mensagens - queremos ver todos os logs
        return false;
    },
    
    formatTimestamp(date = new Date()) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `[${day}/${month}/${year}, ${hours}:${minutes}:${seconds}]`;
    },
    
    formatLogLevel(level) {
        switch(level.toUpperCase()) {
            case 'INFO': return 'ℹ️ INFO';
            case 'WARN': return '⚠️ AVISO';
            case 'ERROR': return '❌ ERRO';
            case 'SUCCESS': return '✅ SUCESSO';
            case 'DEBUG': return '🔍 DEBUG';
            default: return 'ℹ️ INFO';
        }
    },
    
    formatLog(message, level, source, timestamp = null) {
        // Usar o timestamp fornecido ou gerar um novo
        const formattedTimestamp = timestamp 
            ? (typeof timestamp === 'string' ? timestamp : this.formatTimestamp(new Date(timestamp)))
            : this.formatTimestamp();
            
        const formattedLevel = this.formatLogLevel(level);
        return `${formattedTimestamp} ${formattedLevel} [${source}] ${message}`;
    },
    
    addLog(message, level = 'INFO', source = 'system') {
        // Criar timestamp atual
        const now = new Date();
        
        // Formatar a mensagem com o timestamp atual
        const formattedLog = this.formatLog(message, level, source, now);
        
        // Criar objeto de log
        const logEntry = {
            raw: message,
            formatted: formattedLog,
            level: level.toUpperCase(),
            source,
            timestamp: now
        };
        
        // Adicionar ao array de logs
        this.logs.push(logEntry);
        
        // Limitar o número de logs armazenados
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Salvar no storage para persistência se possível
        this.saveLogToStorage(message, level, source);
        
        // Enviar para o sistema de logs da extensão se possível
        if (isExtensionContextValid()) {
            try {
                chrome.runtime.sendMessage({
                    action: 'ADD_LOG',
                    log: formattedLog,
                    level: level,
                    source: source
                }, response => {
                    // Tratar erros do callback adequadamente
                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message || 'Erro desconhecido';
                        // Ignorar o erro específico de message port closed
                        if (errorMsg.includes('message port closed') || 
                            errorMsg.includes('port closed') || 
                            errorMsg.includes('Receiving end does not exist')) {
                            // Silenciar este erro específico, é esperado em alguns cenários
                            return;
                        }
                        console.log(`[LogSystem] Aviso ao enviar log: ${errorMsg}`);
                    }
                });
            } catch (error) {
                const errorMsg = error.message || error.toString() || 'Erro desconhecido';
                console.log(`[LogSystem] Não foi possível enviar log para o background: ${errorMsg}`);
            }
        }
        
        // Atualizar a UI se o container existir
        this.updateUI();
        
        return formattedLog;
    },
    
    // Salvar log no storage para persistência
    saveLogToStorage(message, level, source) {
        if (!isExtensionContextValid()) {
            return false;
        }
        
        try {
            // Verificar se temos acesso ao storage
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                return false;
            }
            
            // Obter logs existentes do storage
            chrome.storage.local.get(['systemLogs'], (result) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message || 'Erro desconhecido';
                    console.error(`[LogSystem] Erro ao acessar storage: ${errorMsg}`);
                    return;
                }
                
                let storedLogs = result.systemLogs || [];
                
                // Criar timestamp atual
                const now = new Date();
                
                // Criar o novo log
                const newLog = {
                    message,
                    level,
                    source,
                    date: now.toISOString(), // Formato ISO para fácil conversão
                    timestamp: now.getTime() // Timestamp em milissegundos para ordenação
                };
                
                // Verificar se já existe um log muito similar nos últimos 10 segundos
                const isDuplicate = storedLogs.some(log => {
                    return log.message === message && 
                           log.level === level && 
                           log.source === source &&
                           (now.getTime() - log.timestamp) < 10000; // 10 segundos
                });
                
                // Só adiciona se não for um log duplicado muito recente
                if (!isDuplicate) {
                    // Adicionar novo log
                    storedLogs.push(newLog);
                    
                    // Limitar a quantidade de logs armazenados
                    if (storedLogs.length > 1000) {
                        storedLogs = storedLogs.slice(-1000);
                    }
                    
                    // Remover duplicados antes de salvar
                    storedLogs = this.removeDuplicateLogs(storedLogs);
                    
                    // Salvar logs atualizados
                    chrome.storage.local.set({ systemLogs: storedLogs }, () => {
                        if (chrome.runtime.lastError) {
                            const errorMsg = chrome.runtime.lastError.message || 'Erro desconhecido';
                            console.error(`[LogSystem] Erro ao salvar logs: ${errorMsg}`);
                        }
                    });
                }
            });
            
            return true;
        } catch (error) {
            console.error('[LogSystem] Erro ao salvar log no storage:', error);
            return false;
        }
    },
    
    updateUI() {
        if (!this.container) return;
        
        // Limpar o container
        this.container.innerHTML = '';
        
        // Adicionar cada log ao container
        this.logs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-${log.level.toLowerCase()}`;
            logEntry.textContent = log.formatted;
            this.container.appendChild(logEntry);
        });
        
        // Rolar para o último log
        this.container.scrollTop = this.container.scrollHeight;
    },
    
    clearLogs() {
        this.logs = [];
        
        // Adicionar log de limpeza
        this.logs.push({
            raw: 'Todos os logs foram limpos',
            formatted: this.formatLog('Todos os logs foram limpos', 'INFO', 'LogSystem'),
            level: 'INFO',
            source: 'LogSystem',
            timestamp: new Date()
        });
        
        // Limpar no storage também
        try {
            if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
                chrome.storage.local.remove(['systemLogs'], () => {
                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message || 'Erro desconhecido';
                        console.error(`[LogSystem] Erro ao limpar logs do storage: ${errorMsg}`);
                    } else {
                        console.log('[LogSystem] Logs limpos do storage com sucesso');
                    }
                });
            }
        } catch (error) {
            const errorMsg = error.message || error.toString() || 'Erro desconhecido';
            console.error(`[LogSystem] Erro ao limpar logs do storage: ${errorMsg}`);
        }
        
        this.updateUI();
    },
    
    filterByLevel(level) {
        if (!this.container) return;
        
        // Se o nível for 'ALL', mostrar todos os logs
        if (level === 'ALL') {
            this.container.querySelectorAll('.log-entry').forEach(entry => {
                entry.style.display = 'block';
            });
            return;
        }
        
        // Caso contrário, filtrar por nível
        this.container.querySelectorAll('.log-entry').forEach(entry => {
            if (entry.classList.contains(`log-${level.toLowerCase()}`)) {
                entry.style.display = 'block';
            } else {
                entry.style.display = 'none';
            }
        });
    },
    
    getLogs() {
        return this.logs;
    },
    
    getFormattedLogs() {
        return this.logs.map(log => log.formatted).join('\n');
    },
    
    downloadLogs() {
        const content = this.getFormattedLogs();
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `trade-manager-logs-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
    },
    
    copyLogs() {
        const content = this.getFormattedLogs();
        
        // Criar um elemento de textarea temporário
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        try {
            // Selecionar e copiar o texto
            textarea.select();
            const success = document.execCommand('copy');
            
            if (success) {
                alert('Logs copiados para a área de transferência!');
                return true;
            } else {
                throw new Error('Comando de copiar falhou');
            }
        } catch (err) {
            console.error('Erro ao copiar logs:', err);
            alert('Erro ao copiar logs: ' + err.message);
            return false;
        } finally {
            // Remover o elemento temporário
            document.body.removeChild(textarea);
        }
    }
};

// Adicionar uma entrada de log
const sysAddLog = async (message, level = 'INFO', source = 'SYSTEM') => {
    // Validar parâmetros
    const logLevel = level ? (LOG_LEVELS[level] || LOG_LEVELS.INFO) : LOG_LEVELS.INFO;
    const logSource = source || 'SYSTEM';
    
    try {
        // Criar o timestamp
        const now = new Date();
        
        // Formatar o timestamp de maneira consistente com LogSystem
        const formatTimestamp = (date) => {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `[${day}/${month}/${year}, ${hours}:${minutes}:${seconds}]`;
        };
        
        const formattedTimestamp = formatTimestamp(now);
        
        // Objeto de log
        const logEntry = {
            message,
            level,
            source: logSource,
            date: now.toISOString(),
            timestamp: now.getTime()
        };
        
        // Salvar no storage
        if (isExtensionContextValid()) {
            try {
                chrome.storage.local.get(['systemLogs'], (result) => {
                    let logs = result.systemLogs || [];
                    
                    // Limitar o número de logs armazenados
                    const MAX_LOGS = 500; // Limitar a 500 logs
                    if (logs.length >= MAX_LOGS) {
                        logs = logs.slice(-MAX_LOGS + 1); // Manter os logs mais recentes
                    }
                    
                    logs.push(logEntry);
                    chrome.storage.local.set({ systemLogs: logs });
                });
            } catch (storageError) {
                console.error('[log-sys] Erro ao salvar log no storage:', storageError);
            }
        }
        
        // Se estamos na página de logs, adicionar o log à UI
        if (window.IS_LOG_PAGE && sysUI.logContainer) {
            // Criar elemento de log
            const logElement = document.createElement('div');
            logElement.className = `log-entry ${logLevel.className}`;
            logElement.textContent = `${formattedTimestamp} ${logLevel.prefix} [${logSource}] ${message}`;
            
            // Armazena os dados para recuperação posterior
            logElement.setAttribute('data-message', message);
            logElement.setAttribute('data-level', level);
            logElement.setAttribute('data-source', logSource);
            logElement.setAttribute('data-timestamp', now.getTime().toString());
            
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
    try {
        // Método 1: Tentar acessar diretamente o navigationManager
        if (window.parent && window.parent.navigationManager) {
            window.parent.navigationManager.closePage();
            return;
        }
        
        // Método 2: Tentar fechar usando window.close()
        window.close();
        
        // Método 3: Usar postMessage para comunicar com o frame pai
        if (window.parent) {
            window.parent.postMessage({ action: 'closePage' }, '*');
        }
        
        // Método 4: Tentar esconder o elemento iframe (fallback)
        if (window.frameElement) {
            window.frameElement.style.display = 'none';
        }
        
        // Caso extremo: recarregar a página principal
        if (window.parent) {
            window.parent.location.href = 'index.html';
        }
    } catch (error) {
        console.error('[LogSystem] Erro ao tentar fechar página:', error);
        
        // Último recurso: avisar o usuário
        alert('Não foi possível fechar a página de logs automaticamente. Por favor, recarregue a página.');
    }
};

// ================== LISTENERS DE MENSAGENS ==================
// Configurar receptor de mensagens para receber logs de outros scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Processamento simplificado de mensagens de log
    if (request.action === 'logMessage') {
        const { message, level, source } = request;
        
        // Nunca filtrar mensagens - queremos ver todos os logs
        // if (shouldFilterMessage(message, level, source)) {
        //     // Responder sucesso, mas não salvar o log
        //     try {
        //         sendResponse({ success: true, filtered: true });
        //     } catch (e) {
        //         // Ignora erros de porta fechada
        //     }
        //     return true;
        // }
        
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
                    // Ignora erros de porta fechada - é normal que ocorram quando o remetente não está mais esperando resposta
                    // Apenas registra para debug se não for um erro de porta fechada
                    if (!e.message?.includes("message port closed") && 
                        !e.message?.includes("port closed") && 
                        !e.message?.includes("Receiving end does not exist")) {
                        console.debug(`[LogSystem] Erro ao enviar resposta de erro: ${e.message}`);
                    }
                }
            } catch (error) {
                const errorMsg = error.message || error.toString() || 'Erro desconhecido';
                console.error(`[LogSystem] Erro ao processar log: ${errorMsg}`);
                try {
                    sendResponse({ success: false, error: errorMsg });
                } catch (e) {
                    // Ignora erros de porta fechada - é normal que ocorram quando o remetente não está mais esperando resposta
                    // Apenas registra para debug se não for um erro de porta fechada
                    if (!e.message?.includes("message port closed") && 
                        !e.message?.includes("port closed") && 
                        !e.message?.includes("Receiving end does not exist")) {
                        console.debug(`[LogSystem] Erro ao enviar resposta de erro: ${e.message}`);
                    }
                }
            }
        })();
        
        // Retorna true para indicar que o processamento é assíncrono
        return true;
    }
    
    // Processa o pedido de adição de log explícito
    if (request.action === 'addLog') {
        // Nunca filtrar mensagens - queremos ver todos os logs
        // if (shouldFilterMessage(request.message, request.level, request.source)) {
        //    sendResponse({ success: true, filtered: true });
        //    return true;
        // }
        
        (async () => {
            try {
                const logEntry = await sysAddLog(request.message, request.level, request.source);
                
                try {
                    sendResponse({ success: true, logEntry });
                } catch (e) {
                    // Ignora erros de porta fechada - é normal que ocorram quando o remetente não está mais esperando resposta
                    if (!e.message?.includes("message port closed") && 
                        !e.message?.includes("port closed") && 
                        !e.message?.includes("Receiving end does not exist")) {
                        console.debug(`[LogSystem] Erro ao enviar resposta para addLog: ${e.message}`);
                    }
                }
            } catch (error) {
                const errorMsg = error.message || error.toString() || 'Erro desconhecido';
                console.error(`[LogSystem] Erro ao adicionar log: ${errorMsg}`);
                
                try {
                    sendResponse({ success: false, error: errorMsg });
                } catch (e) {
                    // Ignora erros de porta fechada - é normal que ocorram quando o remetente não está mais esperando resposta
                    if (!e.message?.includes("message port closed") && 
                        !e.message?.includes("port closed") && 
                        !e.message?.includes("Receiving end does not exist")) {
                        console.debug(`[LogSystem] Erro ao enviar resposta de erro para addLog: ${e.message}`);
                    }
                }
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
    
    // Adicionar um log de inicialização
    sysAddLog('Sistema de logs inicializado', 'INFO', 'log-sys.js');
};

// ================== EVENT LISTENERS ==================
document.addEventListener('DOMContentLoaded', () => {
    if (window.IS_LOG_PAGE) {
        // Atualizar referências de UI que podem não estar disponíveis no carregamento do script
        sysUI.copyBtn = document.getElementById('copy-logs') || document.getElementById('copy-log-btn');
        sysUI.saveBtn = document.getElementById('export-logs') || document.getElementById('save-log-btn');
        sysUI.clearBtn = document.getElementById('clear-logs');
        sysUI.closeBtn = document.getElementById('close-logs');
        sysUI.logContainer = document.getElementById('log-container');
        sysUI.levelFilter = document.getElementById('log-level-filter');
        
        // Verificar elementos obrigatórios
        if (!sysUI.logContainer) {
            console.error('Container de logs não encontrado');
            return;
        }
    
        // Inicializar o novo sistema de logs em vez de carregar o sistema antigo
        if (window.LogSystem) {
            window.LogSystem.init();
        }
        
        // Configurar eventos dos botões
        if (sysUI.copyBtn) sysUI.copyBtn.addEventListener('click', () => window.LogSystem.copyLogs());
        if (sysUI.saveBtn) sysUI.saveBtn.addEventListener('click', () => window.LogSystem.downloadLogs());
        if (sysUI.clearBtn) sysUI.clearBtn.addEventListener('click', () => window.LogSystem.clearLogs());
        if (sysUI.closeBtn) sysUI.closeBtn.addEventListener('click', closeLogs);
        
        // Configurar evento do filtro de nível
        if (sysUI.levelFilter) {
            sysUI.levelFilter.addEventListener('change', () => {
                const selectedLevel = sysUI.levelFilter.value;
                
                // Atualizar o filtro para categoria exata
                CURRENT_FILTER_LEVEL = selectedLevel;
                
                // Usar o novo método de filtragem
                if (window.LogSystem) {
                    window.LogSystem.filterByLevel(selectedLevel);
                }
            });
        }
        
        // Registrar log de inicialização usando o novo sistema
        if (window.LogSystem) {
            window.LogSystem.addLog('Página de logs inicializada', 'INFO', 'log-sys.js');
        }
    }
});

// Inicializar o LogSystem quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.log-container')) {
        LogSystem.init();
    }
});

// Expor o LogSystem globalmente
window.LogSystem = LogSystem;

// Função global para adicionar logs de qualquer lugar
window.addLog = (message, level, source) => {
    if (window.LogSystem) {
        return window.LogSystem.addLog(message, level, source);
    } else {
        // Não usar console.log para evitar logs desnecessários
        if (level.toUpperCase() === 'ERROR') {
            console.error(`[${level}][${source}] ${message} (LogSystem não inicializado)`);
        }
        return false;
    }
};

/**
 * Adiciona uma nova entrada de log na interface
 * @param {string} message Mensagem do log
 * @param {string} level Nível do log
 * @param {string} source Origem do log
 */
function addLogEntry(message, level, source) {
    if (!message) return;

    try {
        // Verificar se temos os elementos necessários
        const logContainer = document.getElementById('log-container');
        if (!logContainer) {
            console.error('Container de logs não encontrado');
            return;
        }

        // Criar a entrada de log
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level.toLowerCase()}`;
        logEntry.setAttribute('data-source', source);
        logEntry.setAttribute('data-level', level);

        // Timestamp
        const timestamp = new Date().toLocaleTimeString();
        
        // Montar a entrada de log com todos os dados
        logEntry.innerHTML = `
            <span class="log-time">${timestamp}</span>
            <span class="log-level ${level.toLowerCase()}">${level}</span>
            <span class="log-source">${source}</span>
            <span class="log-message">${message}</span>
        `;
        
        // Adicionar a entrada ao container
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Atualizar os contadores
        updateLogCounters();
    } catch (error) {
        console.error('Erro ao adicionar entrada de log:', error);
    }
}

/**
 * Atualiza a exibição dos logs com base nos filtros
 */
function updateLogFilters() {
    const selectedSource = document.getElementById('filter-source').value;
    const selectedLevel = document.getElementById('filter-level').value;
    const searchText = document.getElementById('filter-text').value.toLowerCase();
    
    document.querySelectorAll('.log-entry').forEach(entry => {
        const entrySource = entry.getAttribute('data-source');
        const entryLevel = entry.getAttribute('data-level');
        const entryText = entry.querySelector('.log-message').textContent.toLowerCase();
        
        let shouldShow = true;
        
        // Filtrar por fonte se não for "Todos"
        if (selectedSource !== 'ALL' && entrySource !== selectedSource) {
            shouldShow = false;
        }
        
        // Filtrar por nível se não for "Todos"
        if (selectedLevel !== 'ALL' && entryLevel !== selectedLevel) {
            shouldShow = false;
        }
        
        // Filtrar por texto
        if (searchText && !entryText.includes(searchText)) {
            shouldShow = false;
        }
        
        entry.style.display = shouldShow ? 'flex' : 'none';
    });
    
    // Atualizar os contadores
    updateLogCounters();
} 