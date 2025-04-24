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

// Helper para verificar se o contexto da extensão é válido
const isExtensionContextValid = () => {
    try {
        return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    } catch (e) {
        return false;
    }
};

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
        console.log('[LogSystem] Inicializando sistema de logs...');
        this.container = document.querySelector('.log-container');
        
        // Para evitar inicializações duplicadas
        if (this.initialized) {
            console.log('[LogSystem] Sistema já inicializado, ignorando...');
            return this;
        }
        
        // Primeiro, carregar logs do storage
        this.loadLogsFromStorage().then(() => {
            // Marcar como inicializado somente após carregar os logs
            this.initialized = true;
            
            // Adicionar log de inicialização somente uma vez
            if (this.logs.length === 0) {
                this.addLog('Sistema de logs inicializado', 'INFO', 'LogSystem');
            } else {
                console.log(`[LogSystem] ${this.logs.length} logs carregados do storage`);
            }
            
            // Atualizar a UI agora que temos os logs
            this.updateUI();
            
            // Tentar sincronizar logs pendentes
            this.syncPendingLogs();
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
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    const storedLogs = result.systemLogs || [];
                    
                    if (storedLogs.length > 0) {
                        console.log(`[LogSystem] Carregando ${storedLogs.length} logs do storage`);
                        
                        // Converter os logs armazenados para o formato interno
                        this.logs = storedLogs.map(log => {
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
                        
                        console.log(`[LogSystem] ${this.logs.length} logs carregados e ordenados`);
                    }
                    
                    resolve();
                });
            });
        } catch (error) {
            console.error('[LogSystem] Erro ao carregar logs:', error);
            throw error;
        }
    },
    
    // Sincronizar logs armazenados no localStorage
    syncPendingLogs() {
        try {
            // Verificar se há logs pendentes no localStorage
            const pendingLogs = JSON.parse(localStorage.getItem('pendingLogs') || '[]');
            
            if (pendingLogs.length > 0) {
                console.log(`LogSystem: Encontrados ${pendingLogs.length} logs pendentes para sincronização`);
                
                // Adicionar no máximo 50 logs pendentes por vez para não sobrecarregar
                const logsToSync = pendingLogs.slice(0, 50);
                const remainingLogs = pendingLogs.slice(50);
                
                // Adicionar cada log
                logsToSync.forEach(log => {
                    this.addLog(log.message, log.level, log.source);
                });
                
                // Atualizar localStorage se ainda houver logs pendentes
                if (remainingLogs.length > 0) {
                    localStorage.setItem('pendingLogs', JSON.stringify(remainingLogs));
                    console.log(`LogSystem: ${logsToSync.length} logs sincronizados, ${remainingLogs.length} pendentes`);
                } else {
                    localStorage.removeItem('pendingLogs');
                    console.log('LogSystem: Todos os logs pendentes foram sincronizados');
                }
            }
        } catch (error) {
            console.error('LogSystem: Erro ao sincronizar logs pendentes:', error);
        }
    },
    
    shouldFilterMessage(message) {
        return this.filteredPhrases.some(phrase => message.toLowerCase().includes(phrase.toLowerCase()));
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
        // Não processar se a mensagem deve ser filtrada
        if (this.shouldFilterMessage(message)) {
            console.log(`[${level}][${source}] ${message} (filtrado)`);
            return;
        }
        
        // Criar timestamp atual
        const now = new Date();
        
        // Verificar se a mensagem é uma duplicação recente (últimos 3 segundos)
        const isDuplicate = this.logs.some(log => {
            return (
                log.raw === message && 
                log.source === source && 
                log.level === level.toUpperCase() &&
                (now - log.timestamp) < 3000 // 3 segundos
            );
        });
        
        if (isDuplicate) {
            console.log(`[${level}][${source}] ${message} (duplicado, ignorado)`);
            return;
        }
        
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
        
        // Adicionar ao console para debugging
        console.log(formattedLog);
        
        // Salvar no storage para persistência se possível
        this.saveLogToStorage(message, level, source);
        
        // Enviar para o sistema de logs da extensão se possível
        if (isExtensionContextValid()) {
            try {
                chrome.runtime.sendMessage({
                    action: 'ADD_LOG',
                    log: formattedLog,
                    level: level
                }, response => {
                    // Silenciar erros do callback
                    if (chrome.runtime.lastError) {
                        console.log(`[LogSystem] Aviso: ${chrome.runtime.lastError.message}`);
                    }
                });
            } catch (error) {
                console.log(`[LogSystem] Não foi possível enviar log para o background: ${error.message}`);
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
                    console.error('[LogSystem] Erro ao acessar storage:', chrome.runtime.lastError);
                    return;
                }
                
                let storedLogs = result.systemLogs || [];
                
                // Criar timestamp atual
                const now = new Date();
                
                // Adicionar novo log
                storedLogs.push({
                    message,
                    level,
                    source,
                    date: now.toISOString(), // Formato ISO para fácil conversão
                    timestamp: now.getTime() // Timestamp em milissegundos para ordenação
                });
                
                // Limitar a quantidade de logs armazenados (manter os 1000 mais recentes)
                if (storedLogs.length > 1000) {
                    storedLogs = storedLogs.slice(-1000);
                }
                
                // Salvar logs atualizados
                chrome.storage.local.set({ systemLogs: storedLogs }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[LogSystem] Erro ao salvar logs:', chrome.runtime.lastError);
                    }
                });
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
                        console.error('[LogSystem] Erro ao limpar logs do storage:', chrome.runtime.lastError);
                    } else {
                        console.log('[LogSystem] Logs limpos do storage com sucesso');
                    }
                });
        }
    } catch (error) {
            console.error('[LogSystem] Erro ao limpar logs do storage:', error);
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
    
    // Verificar se a mensagem deve ser filtrada
    if (shouldFilterMessage(message, level, logSource)) {
        return false;
    }
    
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
    console.log('[LogSystem] Tentando fechar a página de logs...');
    
    try {
        // Adicionar um log usando o novo sistema
        if (window.LogSystem) {
            window.LogSystem.addLog('Fechando página de logs', 'INFO', 'LogSystem');
        }
        
        // Método 1: Tentar acessar diretamente o navigationManager
        if (window.parent && window.parent.navigationManager) {
            console.log('[LogSystem] Chamando navigationManager.closePage()');
            window.parent.navigationManager.closePage();
            return;
        }
        
        // Método 2: Tentar fechar usando window.close()
        console.log('[LogSystem] Tentando window.close()');
        window.close();
        
        // Método 3: Usar postMessage para comunicar com o frame pai
        console.log('[LogSystem] Enviando mensagem postMessage para fechar');
        if (window.parent) {
            window.parent.postMessage({ action: 'closePage' }, '*');
        }
        
        // Método 4: Tentar esconder o elemento iframe (fallback)
        console.log('[LogSystem] Tentando esconder o elemento iframe');
        if (window.frameElement) {
            window.frameElement.style.display = 'none';
        }
        
        // Caso extremo: recarregar a página principal
        console.log('[LogSystem] Última tentativa: voltando para a página principal');
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
        sysUI.copyBtn = document.getElementById('copy-logs') || document.getElementById('copy-log-btn');
        sysUI.saveBtn = document.getElementById('export-logs') || document.getElementById('save-log-btn');
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
                console.log(`[LogSystem] Filtro de logs alterado para: ${selectedLevel}`);
                
                // Usar o novo método de filtragem
                if (window.LogSystem) {
                    window.LogSystem.filterByLevel(selectedLevel);
                }
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
        console.log(`[${level}][${source}] ${message} (LogSystem não inicializado)`);
    }
}; 