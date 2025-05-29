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

// Lista de mensagens que devem ser ignoradas para não poluir o log
const IGNORED_MESSAGES = [
    'Página de logs inicializada',
    'Sistema de logs inicializado',
    'undefined'
];

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
        case 'DEBUG': return '🐛 DEBUG';
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
            
            // Verificar se os logs foram recentemente limpos
            const clearFlag = localStorage.getItem('logsRecentlyCleared');
            if (clearFlag && (Date.now() - parseInt(clearFlag)) < 5000) { // 5 segundos
                console.log('[LogSystem] Logs foram recentemente limpos, ignorando carregamento do storage');
                this.logs = []; // Garantir que logs estejam vazios
                return;
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
            
            // Verificar se o storage está vazio ou tem apenas o log de limpeza
            if (storedLogs.length === 0) {
                this.logs = [];
                return;
            }
            
            if (storedLogs.length === 1 && 
                storedLogs[0].message && 
                storedLogs[0].message.includes('Todos os logs foram limpos')) {
                this.logs = storedLogs;
                return;
            }
            
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
                    
                    // Usar apenas o campo timestampFormatted salvo
                    return {
                        message: message,
                        level: log.level || 'INFO',
                        source: log.source || 'SYSTEM',
                        timestampFormatted: log.timestampFormatted || ''
                    };
                }).filter(log => log !== null); // Remover logs inválidos
                
                // Ordenar logs cronologicamente
                this.logs.sort((a, b) => a.timestampFormatted.localeCompare(b.timestampFormatted));
                
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
                (uniqueMap.get(key).timestampFormatted < (log.timestampFormatted || ''))) {
                uniqueMap.set(key, log);
            }
        });
        
        // Converter o map de volta para array
        return Array.from(uniqueMap.values());
    },
    
    // Verificar se um log é duplicado
    isDuplicateLog(message, level, source) {
        // Temporariamente desabilitado para garantir que todos os logs sejam exibidos durante o teste
        return false; 
    },
    
    // Adicionar log ao sistema
    addLog(message, level = 'INFO', source = 'SYSTEM') {
        if (!message) return false;
        const normalizedLevel = (level || 'INFO').toUpperCase();
        const normalizedSource = source || 'SYSTEM';
        // Sempre gerar o timestamp formatado no momento do registro
        const now = new Date();
        const formattedTimestamp = formatTimestamp(now);
        const logEntry = {
            message: message,
            level: normalizedLevel,
            source: normalizedSource,
            timestampFormatted: formattedTimestamp
        };
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        this.saveLogToStorage(logEntry);
        if (this.container && window.IS_LOG_PAGE) {
            this.updateUI();
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
        
        // Limpar o container
        this.container.innerHTML = '';
        
        if (this.logs.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'log-entry log-info';
            emptyMsg.textContent = 'Nenhum log encontrado.';
            this.container.appendChild(emptyMsg);
            return;
        }
        
        // Adicionar cada log ao container
        this.logs.forEach(log => {
            const logElement = document.createElement('div');
            logElement.className = `log-entry log-${log.level.toLowerCase()}`;
            
            // Formato: [timestamp] [ fonte ]\n[emoji] NIVEL - mensagem
            const formattedText = `${log.timestampFormatted} [ ${log.source} ]\n${formatLogLevel(log.level)} - ${log.message}`;
            logElement.textContent = formattedText;
            
            this.container.appendChild(logElement);
        });
        
        // Rolar para o último log
        this.container.scrollTop = this.container.scrollHeight;
    },
    
    // Limpar todos os logs
    async clearLogs() {
        // Limpar o array de logs em memória
        this.logs = [];
        
        // Variável para rastrear se o storage foi limpo com sucesso
        let storageCleared = false;
        
        // Definir flag no localStorage para indicar que os logs foram limpos recentemente
        try {
            localStorage.setItem('logsRecentlyCleared', Date.now().toString());
        } catch (e) {
            console.warn('[LogSystem] Não foi possível definir flag de limpeza:', e);
        }
        
        // Limpar no storage também - com múltiplas tentativas
        if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
            try {
                // Primeira tentativa: remover a chave systemLogs
                await new Promise(resolve => {
                    chrome.storage.local.remove(['systemLogs'], () => {
                        if (chrome.runtime.lastError) {
                            console.error(`[LogSystem] Erro ao limpar logs (tentativa 1): ${chrome.runtime.lastError.message}`);
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    });
                });
                
                // Segunda tentativa: definir a chave systemLogs como um array vazio
                await new Promise(resolve => {
                    chrome.storage.local.set({ systemLogs: [] }, () => {
                        if (chrome.runtime.lastError) {
                            console.error(`[LogSystem] Erro ao limpar logs (tentativa 2): ${chrome.runtime.lastError.message}`);
                            resolve(false);
                        } else {
                            storageCleared = true;
                            resolve(true);
                        }
                    });
                });
                
                // Verificar se a limpeza foi bem-sucedida
                if (storageCleared) {
                    console.log('[LogSystem] Storage limpo com sucesso');
                } else {
                    console.warn('[LogSystem] Possível falha ao limpar o storage');
                }
            } catch (error) {
                console.error(`[LogSystem] Erro ao limpar logs do storage: ${error.message}`);
            }
        } else {
            console.warn('[LogSystem] Contexto da extensão inválido, não foi possível limpar o storage');
        }
        
        // Adicionar log de limpeza - apenas após tentar limpar o storage para não salvar novamente
        this.addLog('Todos os logs foram limpos', 'INFO', 'LogSystem');
        
        // Verificar novamente o storage para garantir que está vazio
        this.verifyStorageCleared();
        
        // Atualizar a UI
        this.updateUI();
        
        // Notificar outras instâncias sobre a limpeza de logs
        try {
            chrome.runtime.sendMessage({
                action: 'logsCleaned',
                timestamp: Date.now()
            });
        } catch (e) {
            // Ignorar erros de comunicação
        }
        
        return storageCleared;
    },
    
    // Método auxiliar para verificar se o storage foi realmente limpo
    async verifyStorageCleared() {
        if (!isExtensionContextValid() || !chrome.storage || !chrome.storage.local) {
            return false;
        }
        
        try {
            const result = await new Promise(resolve => {
                chrome.storage.local.get(['systemLogs'], result => {
                    resolve(result);
                });
            });
            
            const logs = result.systemLogs || [];
            
            // Se ainda houver logs no storage após a limpeza
            if (logs.length > 1) { // Permitir 1 log (o da limpeza)
                console.warn(`[LogSystem] Detectados ${logs.length} logs no storage após limpeza`);
                
                // Tentar limpar novamente
                await new Promise(resolve => {
                    chrome.storage.local.set({ systemLogs: [] }, resolve);
                });
                
                return false;
            }
            
            return true;
        } catch (error) {
            console.error(`[LogSystem] Erro ao verificar limpeza do storage: ${error.message}`);
            return false;
        }
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
            // Formato: [timestamp] [ fonte ]\n[emoji] NIVEL - mensagem
            `${log.timestampFormatted} [ ${log.source} ]\n${formatLogLevel(log.level)} - ${log.message}`
        ).join('\n\n');
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
        
        // Atualizar status em vez de mostrar alert
        toUpdateStatus('Logs salvos como arquivo', 'success');
    },
    
    // Copiar logs para a área de transferência
    copyLogs() {
        const content = this.getFormattedLogs();
        
        // Usar apenas o método seguro - via background script
        try {
            if (isExtensionContextValid()) {
                toUpdateStatus('Copiando logs...', 'info');
                
                // Enviar para o background script, que injetará na página principal
                chrome.runtime.sendMessage({
                    action: 'copyTextToClipboard',
                    text: content
                }, response => {
                    if (response && response.success) {
                        toUpdateStatus('Logs copiados para a área de transferência', 'success');
                    } else {
                        const errorMsg = response ? response.error : 'Erro desconhecido';
                        toUpdateStatus('Não foi possível copiar: ' + errorMsg, 'error');
                        this.offerDownloadAlternative();
                    }
                });
            } else {
                toUpdateStatus('Conexão com a extensão perdida', 'error');
                this.offerDownloadAlternative();
            }
        } catch (err) {
            console.error('Erro ao solicitar cópia:', err);
            toUpdateStatus('Erro ao copiar logs', 'error');
            this.offerDownloadAlternative();
        }
    },
    
    // Sugerir alternativa de download
    offerDownloadAlternative() {
        setTimeout(() => {
            toUpdateStatus('Tente usar o botão "Salvar como arquivo"', 'info');
        }, 2000);
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
        
        // Inicializar o sistema de logs (sem criar log de inicialização)
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

// Função padronizada para enviar status para o index
function toUpdateStatus(message, type = 'info', duration = 3000) {
    if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
            action: 'updateStatus',
            message: message,
            type: type,
            duration: duration
        });
    }
}

// Função para verificar se uma mensagem deve ser ignorada
function shouldIgnoreMessage(message) {
    if (!message) return true;
    
    // Verificar se a mensagem está na lista de ignorados
    return IGNORED_MESSAGES.some(ignored => 
        message.includes(ignored) || message === ignored
    );
}

// Listener para logs em tempo real vindos do background
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'newLog' && request.log) {
            if (window.LogSystem && window.LogSystem.logs) {
                window.LogSystem.logs.push(request.log);
                if (window.IS_LOG_PAGE) {
                    window.LogSystem.updateUI();
                }
            }
        }
    });
} 