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

// ================== UTILIDADES DO SISTEMA DE LOGS ==================

// Função para verificar se o contexto da extensão é válido
function isExtensionContextValid() {
    return typeof chrome !== 'undefined' && 
           chrome.runtime && 
           chrome.runtime.id;
}

// Função para formatar timestamp de maneira consistente
function formatTimestamp(date = new Date()) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `[${day}/${month}/${year}, ${hours}:${minutes}:${seconds}]`;
}

// Função para formatar nível de log
function formatLogLevel(level) {
    const upperLevel = (level || 'INFO').toUpperCase();
    switch(upperLevel) {
        case 'INFO': return 'ℹ️ INFO';
        case 'WARN': return '⚠️ AVISO';
        case 'ERROR': return '❌ ERRO';
        case 'SUCCESS': return '✅ SUCESSO';
        case 'DEBUG': return '🔍 DEBUG';
        default: return 'ℹ️ INFO';
    }
}

// ================== SISTEMA DE LOGS ==================
const LogSystem = {
    logs: [],
    maxLogs: 500,
    container: null,
    initialized: false,
    lastLogKey: '', // Para evitar duplicação imediata do mesmo log
    
    init() {
        // Atualizar referência ao container de logs
        this.container = document.querySelector('.log-container');
        
        // Evitar inicializações duplicadas
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
            return;
        }
        
        try {
            // Verificar se temos acesso ao storage
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                throw new Error('API de storage não disponível');
            }
            
            // Carregar logs usando Promise
            const result = await new Promise((resolve, reject) => {
                chrome.storage.local.get(['systemLogs'], (result) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message || 'Erro desconhecido'));
                        return;
                    }
                    resolve(result);
                });
            });
            
            const storedLogs = result.systemLogs || [];
            
            if (storedLogs.length > 0) {
                // Filtrar logs duplicados
                const uniqueLogs = this.removeDuplicateLogs(storedLogs);
                
                // Converter os logs armazenados para o formato interno
                this.logs = uniqueLogs.map(log => {
                    // Validar a mensagem para evitar undefined
                    const message = log.message || '';
                    if (!message && typeof message !== 'string') {
                        // Ignorar logs com mensagem undefined 
                        return null;
                    }
                    
                    // Criar um timestamp baseado na data armazenada ou usar a atual como fallback
                    const logDate = log.date ? new Date(log.date) : new Date();
                    
                    return {
                        message: message,
                        level: log.level || 'INFO',
                        source: log.source || 'SYSTEM',
                        timestamp: logDate,
                        timestampFormatted: formatTimestamp(logDate)
                    };
                }).filter(log => log !== null); // Remover logs inválidos
                
                // Ordenar logs cronologicamente
                this.logs.sort((a, b) => a.timestamp - b.timestamp);
                
                // Limitar ao número máximo de logs
                if (this.logs.length > this.maxLogs) {
                    this.logs = this.logs.slice(-this.maxLogs);
                }
            }
        } catch (error) {
            console.error('[LogSystem] Erro ao carregar logs:', error);
            throw error;
        }
    },
    
    // Método para remover logs duplicados
    removeDuplicateLogs(logs) {
        // Map para armazenar logs únicos usando uma chave composta
        const uniqueMap = new Map();
        
        // Percorrer todos os logs válidos
        logs.filter(log => log.message).forEach(log => {
            // Criar uma chave composta baseada apenas em message + source + level
            // Ignorando timestamp para eliminar duplicatas com timestamps diferentes
            const key = `${log.message || ''}-${log.source || ''}-${log.level || ''}`;
            
            // Se já existe um log com esta chave, só mantém o mais recente
            if (!uniqueMap.has(key) || 
                (uniqueMap.get(key).timestamp < (log.timestamp || 0))) {
                uniqueMap.set(key, log);
            }
        });
        
        // Converter o map de volta para array
        return Array.from(uniqueMap.values());
    },
    
    // Verificar se um log é duplicado
    isDuplicateLog(message, level, source) {
        if (!message) return true; // Considerar undefined como duplicata
        
        // Chave para verificação de duplicata no curto prazo
        const key = `${message}-${level}-${source}`;
        
        // Verificar se é a mesma mensagem chamada imediatamente
        if (key === this.lastLogKey) {
            return true;
        }
        
        // Atualizar a última chave
        this.lastLogKey = key;
        
        // Verificar nos logs recentes (último minuto)
        const now = new Date().getTime();
        return this.logs.some(log => 
            log.message === message && 
            log.level === level && 
            log.source === source && 
            (now - log.timestamp.getTime()) < 10000 // 10 segundos
        );
    },
    
    // Adicionar log ao sistema
    addLog(message, level = 'INFO', source = 'SYSTEM') {
        // Validar entrada
        if (!message) return false; // Não registrar logs vazios ou undefined
        
        // Normalizar parâmetros
        const normalizedLevel = (level || 'INFO').toUpperCase();
        const normalizedSource = source || 'SYSTEM';
        
        // Verificar duplicidade
        if (this.isDuplicateLog(message, normalizedLevel, normalizedSource)) {
            return false;
        }
        
        // Criar dados do log
        const now = new Date();
        const formattedTimestamp = formatTimestamp(now);
        
        // Objeto de log interno
        const logEntry = {
            message: message,
            level: normalizedLevel,
            source: normalizedSource,
            timestamp: now,
            timestampFormatted: formattedTimestamp
        };
        
        // Adicionar ao array de logs
        this.logs.push(logEntry);
        
        // Limitar o número de logs armazenados
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Salvar no storage para persistência
        this.saveLogToStorage(logEntry);
        
        // Atualizar a UI se o container existir
        this.updateUI();
        
        // Log no console apenas para erros
        if (normalizedLevel === 'ERROR') {
            console.error(`[${normalizedLevel}][${normalizedSource}] ${message}`);
        }
        
        return true;
    },
    
    // Salvar log no storage para persistência
    async saveLogToStorage(logEntry) {
        if (!isExtensionContextValid()) {
            return false;
        }
        
        try {
            // Verificar se temos acesso ao storage
            if (!chrome.storage || !chrome.storage.local) {
                return false;
            }
            
            // Obter logs existentes
            const result = await new Promise(resolve => {
                chrome.storage.local.get(['systemLogs'], result => {
                    resolve(result);
                });
            });
            
            // Preparar logs para salvar
            let storedLogs = result.systemLogs || [];
            
            // Adicionar novo log
            storedLogs.push(logEntry);
            
            // Limitar a quantidade de logs armazenados
            if (storedLogs.length > this.maxLogs) {
                storedLogs = storedLogs.slice(-this.maxLogs);
            }
            
            // Remover duplicados antes de salvar
            storedLogs = this.removeDuplicateLogs(storedLogs);
            
            // Salvar logs atualizados
            await new Promise(resolve => {
                chrome.storage.local.set({ systemLogs: storedLogs }, resolve);
            });
            
            return true;
        } catch (error) {
            // Silenciar erros de storage - não são críticos
            return false;
        }
    },
    
    // Atualizar a UI com os logs mais recentes
    updateUI() {
        if (!this.container) return;
        
        // Limpar o container mantendo apenas a mensagem de carregamento
        const loadingMsg = document.querySelector('.log-entry:first-child');
        this.container.innerHTML = '';
        
        if (this.logs.length === 0) {
            // Mostrar mensagem "Nenhum log encontrado"
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'log-entry log-info';
            emptyMsg.textContent = 'Nenhum log encontrado.';
            this.container.appendChild(emptyMsg);
            return;
        }
        
        // Adicionar cada log ao container
        this.logs.forEach(log => {
            // Criar elemento do log
            const logElement = document.createElement('div');
            logElement.className = `log-entry log-${log.level.toLowerCase()}`;
            
            // Adicionar atributos para filtragem futura
            logElement.setAttribute('data-level', log.level);
            logElement.setAttribute('data-source', log.source);
            
            // Construir o texto do log
            logElement.textContent = `${log.timestampFormatted} ${formatLogLevel(log.level)} [${log.source}] ${log.message}`;
            
            // Adicionar ao container
            this.container.appendChild(logElement);
        });
        
        // Rolar para o último log
        this.container.scrollTop = this.container.scrollHeight;
    },
    
    // Limpar todos os logs
    async clearLogs() {
        this.logs = [];
        
        // Adicionar log de limpeza
        this.addLog('Todos os logs foram limpos', 'INFO', 'LogSystem');
        
        // Limpar no storage também
        if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
            try {
                await new Promise(resolve => {
                    chrome.storage.local.remove(['systemLogs'], resolve);
                });
            } catch (error) {
                console.error(`[LogSystem] Erro ao limpar logs do storage: ${error.message}`);
            }
        }
        
        // Atualizar a UI
        this.updateUI();
    },
    
    // Filtrar logs por nível
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
    
    // Obter todos os logs
    getLogs() {
        return this.logs;
    },
    
    // Obter logs formatados como texto para exportação
    getFormattedLogs() {
        return this.logs.map(log => 
            `${log.timestampFormatted} ${formatLogLevel(log.level)} [${log.source}] ${log.message}`
        ).join('\n');
    },
    
    // Baixar logs como arquivo
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
    
    // Copiar logs para a área de transferência
    copyLogs() {
        const content = this.getFormattedLogs();
        
        // Usar a nova API Clipboard se disponível
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(content)
                .then(() => alert('Logs copiados para a área de transferência!'))
                .catch(err => {
                    console.error('Erro ao copiar logs:', err);
                    this.fallbackCopy(content);
                });
            return;
        }
        
        // Método fallback para browsers mais antigos
        this.fallbackCopy(content);
    },
    
    // Método alternativo de cópia para browsers antigos
    fallbackCopy(content) {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        try {
            textarea.select();
            const success = document.execCommand('copy');
            
            if (success) {
                alert('Logs copiados para a área de transferência!');
            } else {
                throw new Error('Comando de copiar falhou');
            }
        } catch (err) {
            console.error('Erro ao copiar logs:', err);
            alert('Erro ao copiar logs: ' + err.message);
        } finally {
            document.body.removeChild(textarea);
        }
    }
};

// ================== FUNÇÃO GLOBAL DE LOGGING ==================

/**
 * Função global para enviar logs para o sistema
 * @param {string} message Mensagem para registrar
 * @param {string} level Nível do log: INFO, DEBUG, ERROR, WARN, SUCCESS
 * @param {string} source Origem do log: SYSTEM, ANALYTICS, UI, API, etc
 */
function logToSystem(message, level = 'INFO', source = 'SYSTEM') {
    // Validar mensagem para evitar logs undefined
    if (!message) return false;
    
    // Normalizar nível e fonte
    const logLevel = (level || 'INFO').toUpperCase();
    const logSource = source || 'SYSTEM';
    
    try {
        // Se estamos na página de logs e o LogSystem está inicializado, usar diretamente
        if (window.IS_LOG_PAGE && window.LogSystem && window.LogSystem.initialized) {
            return LogSystem.addLog(message, logLevel, logSource);
        }

        // Verificar contexto da extensão e enviar para o background
        if (isExtensionContextValid()) {
            chrome.runtime.sendMessage({
                action: 'addLog',
                logMessage: message,
                logLevel: logLevel,
                logSource: logSource
            });
        }
        
        // Log no console apenas para erros
        if (logLevel === 'ERROR') {
            console.error(`[${logLevel}][${logSource}] ${message}`);
        }
        
        return true;
    } catch (e) {
        // Log de erro no console apenas
        console.error(`Erro ao processar log: ${e.message || e}`);
        return false;
    }
}

// ================== MANIPULAÇÃO DE EVENTOS DO CHROME ==================

// Configurar receptor de mensagens para receber logs de outros scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Processamento simplificado de mensagens de log
    if (request.action === 'logMessage' || request.action === 'addLog') {
        const message = request.message || request.logMessage;
        const level = request.level || request.logLevel || 'INFO';
        const source = request.source || request.logSource || 'SYSTEM';
        
        // Validar mensagem
        if (!message) {
            sendResponse({ success: false, error: 'Mensagem de log vazia' });
            return false;
        }
        
        // Se estamos na página de logs e o LogSystem está inicializado
        if (window.IS_LOG_PAGE && LogSystem.initialized) {
            const success = LogSystem.addLog(message, level, source);
            sendResponse({ success });
            return false;
        }
        
        // Caso contrário, salvar no storage
        if (isExtensionContextValid()) {
            try {
                chrome.storage.local.get(['systemLogs'], (result) => {
                    let logs = result.systemLogs || [];
                    const now = new Date();
                    
                    // Verificar duplicidade
                    const isDuplicate = logs.some(log => 
                        log.message === message && 
                        log.level === level && 
                        log.source === source &&
                        (now.getTime() - log.timestamp) < 10000
                    );
                    
                    if (!isDuplicate) {
                        // Adicionar novo log
                        logs.push({
                            message,
                            level,
                            source,
                            date: now.toISOString(),
                            timestamp: now.getTime()
                        });
                        
                        // Limitar a quantidade de logs
                        if (logs.length > LogSystem.maxLogs) {
                            logs = logs.slice(-LogSystem.maxLogs);
                        }
                        
                        // Salvar logs atualizados
                        chrome.storage.local.set({ systemLogs: logs });
                    }
                    
                    sendResponse({ success: true });
                });
                
                return true; // Manter o canal aberto para resposta assíncrona
            } catch (error) {
                sendResponse({ success: false, error: error.message });
                return false;
            }
        }
        
        sendResponse({ success: false, error: 'Contexto de extensão inválido' });
        return false;
    }
    
    return false;
});

// ================== INICIALIZAÇÃO ==================

// Função para fechar a página de logs
function closeLogs() {
    try {
        // Método 1: Usar o navigationManager do frame pai
        if (window.parent && window.parent.navigationManager) {
            window.parent.navigationManager.closePage();
            return;
        }
        
        // Método 2: Usar API Navigation
        if (window.parent && window.parent.Navigation) {
            window.parent.Navigation.closePage();
            return;
        }
        
        // Método 3: Usar postMessage
        window.parent.postMessage({ action: 'closePage' }, '*');
    } catch (error) {
        console.error('[LogSystem] Erro ao fechar página:', error);
    }
}

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    if (window.IS_LOG_PAGE) {
        // Atualizar referências aos elementos da UI
        sysUI.copyBtn = document.getElementById('copy-logs') || document.getElementById('copy-log-btn');
        sysUI.saveBtn = document.getElementById('export-logs') || document.getElementById('save-log-btn');
        sysUI.clearBtn = document.getElementById('clear-logs');
        sysUI.closeBtn = document.getElementById('close-logs');
        sysUI.logContainer = document.getElementById('log-container');
        sysUI.levelFilter = document.getElementById('log-level-filter');
        
        // Inicializar o sistema de logs
        LogSystem.init();
        
        // Configurar eventos dos botões
        if (sysUI.copyBtn) sysUI.copyBtn.addEventListener('click', () => LogSystem.copyLogs());
        if (sysUI.saveBtn) sysUI.saveBtn.addEventListener('click', () => LogSystem.downloadLogs());
        if (sysUI.clearBtn) sysUI.clearBtn.addEventListener('click', () => LogSystem.clearLogs());
        if (sysUI.closeBtn) sysUI.closeBtn.addEventListener('click', closeLogs);
        
        // Configurar evento do filtro de nível
        if (sysUI.levelFilter) {
            sysUI.levelFilter.addEventListener('change', () => {
                const selectedLevel = sysUI.levelFilter.value;
                LogSystem.filterByLevel(selectedLevel);
            });
        }
    }
});

// ================== EXPORTAÇÃO GLOBAL ==================

// Expor o LogSystem globalmente
window.LogSystem = LogSystem;

// Função global para adicionar logs de qualquer lugar
window.addLog = (message, level, source) => {
    if (!message) return false;
    
    // Usar LogSystem se disponível, ou fallback para logToSystem
    return window.LogSystem && window.LogSystem.initialized
        ? window.LogSystem.addLog(message, level, source)
        : logToSystem(message, level, source);
};

// Aliás para compatibilidade com código existente
window.sysAddLog = window.addLog;

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