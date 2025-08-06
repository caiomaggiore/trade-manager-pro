# Arquitetura do Sistema - Trade Manager Pro

Este documento descreve a arquitetura principal da extensão Trade Manager Pro, com foco na comunicação entre seus componentes e nas decisões de design impostas pelas regras do Manifest V3 do Chrome.

## 1. Visão Geral da Arquitetura

O sistema é uma extensão do Chrome que opera injetando uma interface de usuário (`iframe`) diretamente na página da plataforma de trading (Pocket Option). A arquitetura é dividida em três camadas principais que operam em contextos diferentes:

### a) Camada de Interface (UI - Iframe)
- **Tecnologia:** HTML, CSS, JavaScript.
- **Arquivos Principais:** `src/layout/index.html`, `src/layout/settings.html`, etc.
- **Contexto de Execução:** Sandbox de `iframe`.
- **Responsabilidade:** Fornecer toda a interface visual e de interação para o usuário. Isso inclui o painel principal, a tela de configurações, os logs e todos os botões de controle.
- **Comunicação:** **NÃO** possui acesso direto ao DOM da página da plataforma. Toda e qualquer ação que precise interagir com a página (clicar em botões, ler valores) ou com o estado global da extensão deve ser feita através do envio de mensagens.

### b) Camada de Conteúdo (Content Scripts)
- **Tecnologia:** JavaScript.
- **Arquivos Principais:** `src/content/content.js`, `src/content/index.js`, `src/content/navigation.js`, etc.
- **Contexto de Execução:** Injetado diretamente no contexto da página da plataforma.
- **Responsabilidade:**
    - **`content.js`:** Atua como o "maestro" das interações com o DOM da página hospedeira. Ele contém a lógica para clicar em botões de compra/venda, selecionar ativos, ler o valor do payout, etc.
    - **`index.js`:** É o "cérebro" da UI dentro do `iframe`. Ele adiciona os `event listeners` a todos os botões do `index.html` e dispara as mensagens para os outros componentes.
    - **Outros scripts (`.js`):** Módulos especialistas que lidam com tarefas específicas, como `payout-controller.js` ou `gale-system.js`.
- **Comunicação:** É a ponte entre a UI e o Background. Recebe mensagens da UI e executa ações no DOM. Também pode enviar mensagens para o Background para solicitar ou salvar dados.

### c) Camada de Fundo (Background Script)
- **Tecnologia:** JavaScript (Service Worker).
- **Arquivo Principal:** `src/background/background.js`.
- **Contexto de Execução:** Service Worker do Manifest V3.
- **Responsabilidade:**
    - Gerenciar o estado global e persistente da aplicação (configurações do usuário, status da automação, etc.) usando `chrome.storage`.
    - Orquestrar operações complexas que não dependem diretamente da UI, como o envio de notificações.
    - Atuar como um roteador de mensagens seguro e centralizado, especialmente para o gerenciamento de estado.
- **Comunicação:** Ouve mensagens de todas as partes da extensão (UI e Content Scripts) e responde a elas. É o único componente que deve ter a responsabilidade de gerenciar o `storage`.

## 2. Padrão de Comunicação e Limitações do Manifest V3

A escolha do método de comunicação é a decisão de arquitetura mais crítica nesta extensão, impulsionada pelas restrições de segurança do Manifest V3.

### O Problema: Isolamento de Contexto
- **Scripts de Conteúdo são Isolados:** No Manifest V3, os scripts de conteúdo executam em um "mundo isolado". Eles não compartilham o objeto `window` com os scripts da página hospedeira nem entre si. Isso significa que a comunicação via `window.dispatchEvent` ou variáveis globais é impossível.
- **Iframes são Cross-Origin:** O `iframe` da nossa UI, embora injetado na página, é carregado de uma URL `chrome-extension://`. Para o navegador, isso é uma origem diferente da página `https://pocketoption.com`, aplicando políticas de mesma origem que restringem o acesso direto (ex: `iframe.contentWindow`).

### A Solução: `chrome.runtime.messaging`
A única maneira confiável e robusta de fazer esses diferentes componentes conversarem é através da API de mensagens do Chrome.

- **Fluxo Típico:**
    1.  **Usuário clica em um botão na UI** (ex: `index.html`).
    2.  O `index.js` (no `iframe`) captura o clique e envia uma mensagem clara e específica usando `chrome.runtime.sendMessage({ action: 'NOME_DA_ACAO', ...payload })`.
    3.  Um `listener` no `content.js` ou no `background.js` (dependendo da ação) está ouvindo por essa `action`.
    4.  O script receptor executa a lógica necessária (ex: clica em um botão na página ou salva um dado no `storage`).
    5.  Se a ação exigir uma resposta, o receptor a envia de volta usando a função `sendResponse`.

### O Erro `Message Port Closed` e a Importância do Retorno Síncrono

- **Causa Raiz:** Este erro fatal ocorre quando um script receptor pretende enviar uma resposta de forma assíncrona, mas a porta de comunicação se fecha antes que a resposta seja enviada. Isso acontece porque o `listener` de mensagens (`chrome.runtime.onMessage.addListener`) precisa **retornar `true` de forma síncrona** para sinalizar ao Chrome: "Espere, eu vou enviar uma resposta mais tarde".

- **A Armadilha do Código Assíncrono (`async/await`):** Se o `return true` for executado *após* uma operação `await` dentro do `listener`, já é tarde demais. O `listener` já terá terminado sua execução síncrona e retornado `undefined` (que é tratado como `false`), fazendo com que a porta se feche.

- **Exemplo Prático (Bug Recente):** Uma refatoração recente no `background.js` moveu a lógica para dentro de um `switch`. A intenção era marcar uma flag `isAsync = true` e retorná-la no final. No entanto, para casos que envolviam um `await`, a flag era definida apenas *após* a conclusão da operação assíncrona. Como resultado, o `listener` retornava o valor inicial da flag (`false`), causando uma falha em cascata em todas as funções assíncronas.

- **Solução Arquitetural:** A solução robusta é garantir que `return true` seja executado no caminho síncrono do código sempre que uma resposta assíncrona for necessária. Uma abordagem comum é usar uma flag (ex: `let isAsync = false;`), defini-la como `true` **antes** de qualquer chamada `await` ou `Promise`, e retorná-la no final da execução síncrona do `listener`. Isso assegura que a porta de comunicação permaneça aberta, aguardando a chamada de `sendResponse`.

### O Desafio da Área de Transferência: `Offscreen Documents` e `execCommand`

Uma operação aparentemente simples como "copiar para a área de transferência" apresenta desafios únicos no Manifest V3 que ilustram os princípios de arquitetura da extensão.

-   **Por que não funciona direto do Background?** O `background.js` é um Service Worker, um ambiente que não tem acesso ao DOM (Document Object Model). Isso significa que ele não pode criar elementos como `<textarea>` ou acessar o `document`, que são pré-requisitos para interagir com a área de transferência de forma programática.

-   **A Solução Oficial: `chrome.offscreen`:** Para resolver isso, o Chrome oferece a API `chrome.offscreen`. Ela permite que a extensão crie um documento HTML invisível e de curta duração com o único propósito de dar acesso a APIs de DOM. O fluxo correto é: o `background.js` envia uma mensagem para o `offscreen document`, que executa a ação de DOM e retorna o resultado.

-   **A Armadilha do `navigator.clipboard`:** A API moderna `navigator.clipboard.writeText()` parece a escolha óbvia. No entanto, ela possui um requisito de segurança estrito: o documento que a invoca **precisa estar em foco**. Como o `offscreen document` é invisível por definição, ele nunca ganha foco, resultando no erro `Document is not focused`.

-   **O Padrão Robusto: `document.execCommand('copy')`:** A solução confiável e testada pela comunidade é usar o método legado `document.execCommand('copy')`. Embora mais antigo, ele não tem o requisito de foco. O padrão de implementação correto dentro do `offscreen document` é:
    1.  Criar um elemento `<textarea>` dinamicamente via JavaScript.
    2.  Inserir o texto desejado no `textarea`.
    3.  Adicionar o `textarea` ao `body` do documento.
    4.  Selecionar o conteúdo do `textarea` (`textarea.select()`).
    5.  Executar `document.execCommand('copy')`.
    6.  Remover o `textarea` do `body` para limpeza.

-   **Lembrete de CSP (Política de Segurança de Conteúdo):** Como este caso demonstrou, qualquer script dentro de um arquivo HTML (como `offscreen.html`) deve ser carregado de um arquivo `.js` externo (`<script src="..."></script>`). Scripts inline são bloqueados pela CSP da extensão, uma medida de segurança fundamental.

## Diagrama Simplificado do Fluxo de Mensagens

```mermaid
graph TD
    subgraph UI (Iframe)
        A[index.html / settings.html] -- Interação do Usuário --> B(index.js / settings.js);
    end

    subgraph Content Script (Injetado na Página)
        C(content.js);
        D(Outros Módulos .js);
    end

    subgraph Background (Service Worker)
        E(background.js);
        F[chrome.storage];
    end

    B -- chrome.runtime.sendMessage --> C;
    B -- chrome.runtime.sendMessage --> E;
    C -- Ação no DOM --> G(Página da Pocket Option);
    C -- chrome.runtime.sendMessage --> E;
    
    E -- Acesso ao Storage --> F;
``` 

## 3. Padrão UI - Controle Centralizado de Elementos

Para manter a consistência e facilitar a manutenção da interface do usuário, foi estabelecido um padrão arquitetural para o controle de elementos DOM.

### O Padrão UI

O padrão UI consiste em criar um objeto centralizado que gerencia todos os elementos da interface, seguindo a convenção:

```javascript
// Objeto UI para controle centralizado dos elementos (padrão arquitetural)
const UI = {
    // Propriedades para elementos de controle
    captureScreen: document.getElementById('captureBtn'),
    canvasInfo: document.getElementById('captureCanvasInfoBtn'),
    chartOnly: document.getElementById('captureChartOnlyBtn'),
    
    // Propriedades para elementos de status e resultado
    statusElement: document.getElementById('dev-status'),
    resultElement: document.getElementById('analysis-debug-result')
};
```

### Vantagens do Padrão UI

1. **Centralização:** Todos os elementos DOM são referenciados em um único local
2. **Simplicidade:** Busca direta dos elementos sem necessidade de método `init()`
3. **Debugging:** Facilita a identificação de elementos não encontrados
4. **Manutenibilidade:** Mudanças de IDs ou seletores são feitas em um só lugar
5. **Consistência:** Padroniza o acesso aos elementos em todo o projeto
6. **Documentação:** Serve como documentação viva dos elementos da interface
7. **Performance:** Evita chamadas desnecessárias de inicialização
8. **Clareza:** Estrutura visual clara da relação entre elementos e suas funções

### Uso do Padrão

```javascript
// Usar elementos diretamente
UI.captureScreen.addEventListener('click', async () => {
    // Lógica do botão com tratamento de erro
    try {
        const result = await someFunction();
        if (UI.statusElement) {
            UI.statusElement.textContent = 'Sucesso';
        }
    } catch (error) {
        if (UI.statusElement) {
            UI.statusElement.textContent = 'Erro: ' + error.message;
        }
    }
});

// Verificar se elemento existe antes de usar
if (UI.resultElement) {
    UI.resultElement.innerHTML = `
        <div><strong>Resultado:</strong></div>
        <div>Dados: ${data}</div>
    `;
}
```

### Implementação em Módulos

Cada módulo que precisa interagir com elementos DOM deve:

1. **Declarar seu próprio objeto UI** no topo do arquivo
2. **Buscar elementos diretamente** na declaração do objeto (sem método `init()`)
3. **Usar logs de debug** para verificar se os elementos foram encontrados
4. **Verificar a existência dos elementos** antes de usá-los
5. **Seguir o padrão de nomenclatura** consistente

### Exemplo de Implementação Completa

```javascript
// ================== PADRÃO UI - CONTROLE DE ELEMENTOS ==================

// Objeto UI para controle centralizado dos elementos (padrão arquitetural)
const UI = {
    // Elementos de controle
    captureScreen: document.getElementById('captureBtn'),
    canvasInfo: document.getElementById('captureCanvasInfoBtn'),
    chartOnly: document.getElementById('captureChartOnlyBtn'),
    
    // Elementos de status e resultado
    statusElement: document.getElementById('dev-status'),
    resultElement: document.getElementById('analysis-debug-result')
};

// ================== CONFIGURAÇÃO DOS BOTÕES ==================

function setupButtons() {
    // Verificar se elementos existem antes de configurar
    if (!UI.captureScreen) {
        console.error('Elemento captureScreen não encontrado');
        return;
    }
    
    UI.captureScreen.addEventListener('click', async () => {
        // Lógica do botão
    });
}
```

### Boas Práticas e Considerações

#### 1. **Verificação de Existência**
Sempre verifique se os elementos existem antes de usá-los:
```javascript
if (UI.captureScreen) {
    UI.captureScreen.addEventListener('click', handler);
} else {
    console.error('Elemento captureScreen não encontrado');
}
```

#### 2. **Nomenclatura Consistente**
Use nomes descritivos que indiquem a função do elemento:
- `captureScreen` para botão de captura
- `statusElement` para elemento de status
- `resultElement` para elemento de resultado

#### 3. **Organização por Categorias**
Agrupe elementos por função no objeto UI:
```javascript
const UI = {
    // Elementos de controle
    captureScreen: document.getElementById('captureBtn'),
    chartOnly: document.getElementById('captureChartOnlyBtn'),
    
    // Elementos de feedback
    statusElement: document.getElementById('dev-status'),
    resultElement: document.getElementById('analysis-debug-result')
};
```

#### 4. **Integração com Sistema de Logs**
Use o sistema de logs do projeto para debug:
```javascript
if (!UI.captureScreen) {
    devLog('Elemento captureScreen não encontrado', 'ERROR');
    return;
}
```

#### 5. **Compatibilidade com Chrome Runtime**
O padrão UI funciona perfeitamente com a arquitetura de mensagens:
```javascript
UI.captureScreen.addEventListener('click', async () => {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'CAPTURE_SCREENSHOT'
        });
        // Processar resposta
    } catch (error) {
        if (UI.statusElement) {
            UI.statusElement.textContent = 'Erro: ' + error.message;
        }
    }
});
```

## 4. Versionamento e Publicação de Novas Versões

Para manter a consistência e o rastreamento do projeto, é fundamental seguir um processo de versionamento rigoroso sempre que uma nova versão estável for concluída.

O fluxo de trabalho correto é o seguinte:

### Passo 1: Verificar a Versão Atual
Antes de iniciar o processo, verifique qual é a última versão do projeto. Você pode fazer isso de duas formas:
- **No repositório remoto:** Olhe a seção "Releases" ou "Tags" no GitHub.
- **Localmente:** Use o comando `git tag` para listar todas as tags existentes.

### Passo 2: Atualizar o `manifest.json`
Esta é a etapa mais crítica. O arquivo `manifest.json` contém a chave `"version"` que define a versão da extensão para o Chrome. **Este número deve ser atualizado** para a nova versão.

Recomenda-se seguir o padrão de **Versionamento Semântico (MAJOR.MINOR.PATCH)**:
- **PATCH** (`1.0.10` -> `1.0.11`): Para correções de bugs retrocompatíveis.
- **MINOR** (`1.0.10` -> `1.1.0`): Para novas funcionalidades retrocompatíveis.
- **MAJOR** (`1.0.10` -> `2.0.0`): Para mudanças que quebram a compatibilidade.

### Passo 3: Adicionar e Commitar as Alterações
Adicione todos os seus arquivos modificados, incluindo o `manifest.json` atualizado, e crie um commit com uma mensagem descritiva.

```bash
# Adicionar todos os arquivos
git add .

# Criar o commit (exemplo para uma nova funcionalidade)
git commit -m "feat: Descrição da nova funcionalidade ou correção"
```

### Passo 4: Criar a Tag de Versão
A tag é o que marca um commit específico como uma "release" oficial. Ela deve corresponder à versão definida no `manifest.json`.

```bash
# Criar uma tag anotada (recomendado)
git tag -a v1.0.10 -m "Version 1.0.10"
```

### Passo 5: Enviar para o Repositório Remoto
Finalmente, envie o commit e a nova tag para o repositório remoto (ex: `origin`).

```bash
# O argumento --tags envia todas as suas tags locais que não estão no remoto
git push origin master --tags
```

Seguindo este processo, garantimos que a versão no `manifest.json` esteja sempre sincronizada com as tags do Git, criando um histórico de lançamentos limpo e confiável. 

## 8. Comunicação Interna do Iframe - Padrão Implementado

### ✅ Resultado do Teste: SUCESSO TOTAL
A comunicação via `window.postMessage` foi validada e implementada com sucesso. O sistema agora usa um padrão unificado para comunicação interna.

### Sistema Global de Logs Implementado

#### Funções Globais Disponíveis:
```javascript
// Enviar log (simples e direto)
window.sendLog(message, level = 'INFO', source = 'SYSTEM')

// Enviar status (simples e direto)
window.sendStatus(message, type = 'info', duration = 3000)
```

#### Estrutura das Mensagens:
```javascript
// Para logs
window.postMessage({
    type: 'LOG_MESSAGE',
    data: {
        message: 'Mensagem do log',
        level: 'INFO', // DEBUG, INFO, WARN, ERROR, SUCCESS
        source: 'nome-do-modulo'
    }
}, '*');

// Para status
window.postMessage({
    type: 'UPDATE_STATUS',
    data: {
        message: 'Mensagem de status',
        type: 'info', // info, success, warn, error
        duration: 3000
    }
}, '*');
```

### Padrão de Implementação por Arquivo

#### 1. log-sys.js (PRIMEIRO A SER CARREGADO)
```javascript
// ================== SISTEMA GLOBAL DE LOGS ==================
// Função global para envio de logs via window.postMessage
window.sendLog = (message, level = 'INFO', source = 'SYSTEM') => {
    // Implementação direta sem fallbacks
    window.postMessage({
        type: 'LOG_MESSAGE',
        data: { message, level, source }
    }, '*');
};

// Função global para envio de status via window.postMessage
window.sendStatus = (message, type = 'info', duration = 3000) => {
    // Implementação direta sem fallbacks
    window.postMessage({
        type: 'UPDATE_STATUS',
        data: { message, type, duration }
    }, '*');
};

// Listener para receber logs (apenas log-sys.js recebe logs)
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'LOG_MESSAGE') {
        // Processar log recebido
    }
});
```

#### 2. index.js (SEGUNDO A SER CARREGADO)
```javascript
// ================== SISTEMA DE COMUNICAÇÃO INTERNA ==================
// Listener para mensagens internas do iframe (PRIMEIRA COISA A SER DECLARADA)
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'UPDATE_STATUS') {
        // Processar status recebido (apenas index.js recebe status)
    }
});
```

#### 3. Qualquer Outro Arquivo
```javascript
// ================== SISTEMA DE LOGS PADRÃO ==================
// Função simplificada para logs usando o sistema global
const logFromModule = (message, level = 'INFO') => {
    // Uso direto da função global
    window.sendLog(message, level, 'nome-do-modulo');
};

// Função para status usando o sistema global
const statusFromModule = (message, type = 'info', duration = 3000) => {
    // Uso direto da função global
    window.sendStatus(message, type, duration);
};
```

### Vantagens do Novo Padrão:

#### ✅ **Simplicidade Máxima:**
- **Uma linha para logs:** `window.sendLog(message, level, source)`
- **Uma linha para status:** `window.sendStatus(message, type)`
- **Sem fallbacks complexos** - se falhar, é erro crítico
- **Código limpo e direto**

#### ✅ **Responsabilidades Claras:**
- **log-sys.js:** Recebe e processa logs
- **index.js:** Recebe e processa status
- **Outros arquivos:** Apenas enviam mensagens

#### ✅ **Performance:**
- Comunicação síncrona sem overhead
- Sem verificações desnecessárias
- Código otimizado

#### ✅ **Manutenibilidade:**
- Funções globais centralizadas
- Padrão único em todo o projeto
- Fácil de debugar (erros críticos são claros)

### Exemplo de Uso em Qualquer Arquivo:

```javascript
// Log simples
logFromModule('Operação iniciada', 'INFO');

// Log de erro
logFromModule('Erro na operação', 'ERROR');

// Status para o usuário
statusFromModule('Operação concluída com sucesso', 'success');

// Ou usar diretamente as funções globais:
window.sendLog('Mensagem direta', 'INFO', 'meu-modulo');
window.sendStatus('Status direto', 'success');
```

### Tratamento de Erros:

```javascript
// Se o sistema falhar, é um erro crítico que deve ser corrigido
try {
    window.sendLog('Mensagem', 'INFO', 'meu-modulo');
} catch (error) {
    // Erro crítico do sistema - deve ser investigado
    console.error('Sistema de logs falhou:', error);
    // Não há fallback - o erro deve ser corrigido
}
```

## 9. Comunicação Interna do Iframe - Padrão Implementado

### ✅ Resultado do Teste: SUCESSO TOTAL
A comunicação via `window.postMessage` foi validada e implementada com sucesso. O sistema agora usa um padrão unificado para comunicação interna.

### Sistema Global de Logs Implementado

#### Funções Globais Disponíveis:
```javascript
// Enviar log (simples e direto)
window.sendLog(message, level = 'INFO', source = 'SYSTEM')

// Enviar status (simples e direto)
window.sendStatus(message, type = 'info', duration = 3000)
```

#### Estrutura das Mensagens:
```javascript
// Para logs
window.postMessage({
    type: 'LOG_MESSAGE',
    data: {
        message: 'Mensagem do log',
        level: 'INFO', // DEBUG, INFO, WARN, ERROR, SUCCESS
        source: 'nome-do-modulo'
    }
}, '*');

// Para status
window.postMessage({
    type: 'UPDATE_STATUS',
    data: {
        message: 'Mensagem de status',
        type: 'info', // info, success, warn, error
        duration: 3000
    }
}, '*');
```

### Padrão de Implementação por Arquivo

#### 1. log-sys.js (PRIMEIRO A SER CARREGADO)
```javascript
// ================== SISTEMA GLOBAL DE LOGS ==================
// Função global para envio de logs via window.postMessage
window.sendLog = (message, level = 'INFO', source = 'SYSTEM') => {
    // Implementação direta sem fallbacks
    window.postMessage({
        type: 'LOG_MESSAGE',
        data: { message, level, source }
    }, '*');
};

// Função global para envio de status via window.postMessage
window.sendStatus = (message, type = 'info', duration = 3000) => {
    // Implementação direta sem fallbacks
    window.postMessage({
        type: 'UPDATE_STATUS',
        data: { message, type, duration }
    }, '*');
};

// Listener para receber logs (apenas log-sys.js recebe logs)
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'LOG_MESSAGE') {
        // Processar log recebido
    }
});
```

#### 2. index.js (SEGUNDO A SER CARREGADO)
```javascript
// ================== SISTEMA DE COMUNICAÇÃO INTERNA ==================
// Listener para mensagens internas do iframe (PRIMEIRA COISA A SER DECLARADA)
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'UPDATE_STATUS') {
        // Processar status recebido (apenas index.js recebe status)
    }
});
```

#### 3. Qualquer Outro Arquivo
```javascript
// ================== SISTEMA DE LOGS PADRÃO ==================
// Função simplificada para logs usando o sistema global
const logFromModule = (message, level = 'INFO') => {
    // Uso direto da função global
    window.sendLog(message, level, 'nome-do-modulo');
};

// Função para status usando o sistema global
const statusFromModule = (message, type = 'info', duration = 3000) => {
    // Uso direto da função global
    window.sendStatus(message, type, duration);
};
```

### Vantagens do Novo Padrão:

#### ✅ **Simplicidade Máxima:**
- **Uma linha para logs:** `window.sendLog(message, level, source)`
- **Uma linha para status:** `window.sendStatus(message, type)`
- **Sem fallbacks complexos** - se falhar, é erro crítico
- **Código limpo e direto**

#### ✅ **Responsabilidades Claras:**
- **log-sys.js:** Recebe e processa logs
- **index.js:** Recebe e processa status
- **Outros arquivos:** Apenas enviam mensagens

#### ✅ **Performance:**
- Comunicação síncrona sem overhead
- Sem verificações desnecessárias
- Código otimizado

#### ✅ **Manutenibilidade:**
- Funções globais centralizadas
- Padrão único em todo o projeto
- Fácil de debugar (erros críticos são claros)

### Exemplo de Uso em Qualquer Arquivo:

```javascript
// Log simples
logFromModule('Operação iniciada', 'INFO');

// Log de erro
logFromModule('Erro na operação', 'ERROR');

// Status para o usuário
statusFromModule('Operação concluída com sucesso', 'success');

// Ou usar diretamente as funções globais:
window.sendLog('Mensagem direta', 'INFO', 'meu-modulo');
window.sendStatus('Status direto', 'success');
```

### Tratamento de Erros:

```javascript
// Se o sistema falhar, é um erro crítico que deve ser corrigido
try {
    window.sendLog('Mensagem', 'INFO', 'meu-modulo');
} catch (error) {
    // Erro crítico do sistema - deve ser investigado
    console.error('Sistema de logs falhou:', error);
    // Não há fallback - o erro deve ser corrigido
}
``` 

## 9. Arquitetura Central: dev-tools.js como Hub de Funcionalidades

### 🎯 **Novo Padrão Arquitetural Implementado**

O `dev-tools.js` foi redefinido como o **hub central de todas as funcionalidades** do sistema, não apenas um painel de desenvolvimento. Esta arquitetura concentra toda a lógica principal em um local, promovendo maior organização e reduzindo duplicações.

### Responsabilidades por Arquivo

#### **1. dev-tools.js - HUB CENTRAL 🎛️**
**Papel:** Concentrador de todas as funcionalidades principais do sistema

**Responsabilidades:**
- ✅ **Todas as funções de captura** (payout, ativos, canvas, análise)
- ✅ **Todas as funções de manipulação de dados** (processamento, validação)
- ✅ **Todas as funções de teste e debugging** (simulações, verificações)
- ✅ **Coordenação de operações complexas** (automação, gale, switching)
- ✅ **Interface para outras partes do sistema** via `chrome.runtime.sendMessage`

**Padrão de Implementação:**
```javascript
// Função completa com toda a lógica
const executeCompleteOperation = async (params) => {
    try {
        // 1. Validação dos parâmetros
        const validatedParams = validateParams(params);
        
        // 2. Solicitar dados específicos do DOM (se necessário)
        const domData = await requestDOMData('SPECIFIC_DOM_ACTION', validatedParams);
        
        // 3. Processar lógica completa
        const result = processCompleteLogic(domData, validatedParams);
        
        // 4. Retornar resultado processado
        return { success: true, result };
    } catch (error) {
        logToSystem(`Erro em executeCompleteOperation: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
};

// Exposição via mensagens (não global)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXECUTE_COMPLETE_OPERATION') {
        executeCompleteOperation(message.params)
            .then(sendResponse)
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Resposta assíncrona
    }
});
```

#### **2. content.js - ESPECIALISTA EM DOM 🔧**
**Papel:** Manipulação específica e focada do DOM da PocketOption

**Responsabilidades:**
- ✅ **Apenas operações diretas no DOM** (cliques, leituras, verificações)
- ✅ **Captura de dados simples** sem processamento complexo
- ✅ **Responder a solicitações específicas** do dev-tools.js
- ❌ **NÃO deve conter lógica de negócio complexa**
- ❌ **NÃO deve tomar decisões sobre o que fazer com os dados**

**Padrão de Implementação:**
```javascript
// Função simples e focada
const captureSpecificDOMData = (selector, dataType) => {
    try {
        const element = document.querySelector(selector);
        if (!element) {
            return { success: false, error: `Elemento ${selector} não encontrado` };
        }
        
        // Captura simples sem processamento complexo
        const rawData = element.textContent.trim();
        return { success: true, data: rawData, selector };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// Responder apenas a solicitações específicas
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'CAPTURE_SPECIFIC_DOM_DATA') {
        const result = captureSpecificDOMData(message.selector, message.dataType);
        sendResponse(result);
        return true;
    }
});
```

#### **3. index.js - CONTROLADOR DE UI 🖥️**
**Papel:** Controle da interface do usuário e coordenação de eventos

**Responsabilidades:**
- ✅ **Controle de elementos UI** (botões, displays, modais)
- ✅ **Event listeners básicos** (cliques, inputs)
- ✅ **Atualizações de status e displays**
- ✅ **Coordenação simples** entre UI e funcionalidades
- ❌ **NÃO deve implementar lógica de negócio**
- ❌ **NÃO deve conter funções de captura complexas**

**Padrão de Implementação:**
```javascript
// Coordenação simples
const handleAnalysisButtonClick = async () => {
    try {
        updateStatus('Iniciando análise...', 'info');
        
        // Delegar toda a lógica para dev-tools.js
        const response = await chrome.runtime.sendMessage({
            action: 'EXECUTE_COMPLETE_ANALYSIS',
            params: getUIParameters()
        });
        
        if (response.success) {
            updateStatus('Análise concluída!', 'success');
            updateAnalysisDisplay(response.result);
        } else {
            updateStatus(`Erro: ${response.error}`, 'error');
        }
    } catch (error) {
        updateStatus(`Erro de comunicação: ${error.message}`, 'error');
    }
};

// Event listener simples
document.getElementById('analyzeBtn').addEventListener('click', handleAnalysisButtonClick);
```

### Fluxo de Comunicação

```mermaid
graph TD
    A[index.js - UI] -->|chrome.runtime.sendMessage| B[dev-tools.js - HUB]
    B -->|chrome.runtime.sendMessage| C[content.js - DOM]
    C -->|sendResponse| B
    B -->|sendResponse| A
    
    D[automation.js] -->|chrome.runtime.sendMessage| B
    E[settings.js] -->|chrome.runtime.sendMessage| B
    F[Outros módulos] -->|chrome.runtime.sendMessage| B
    
    B -->|logToSystem| G[log-sys.js]
    B -->|updateStatus| A
```

### Vantagens da Nova Arquitetura

#### **🎯 Centralização de Funcionalidades**
- **Uma fonte de verdade** para cada funcionalidade
- **Redução drástica de código duplicado**
- **Manutenção facilitada** (alterar em um local apenas)

#### **🔄 Separação Clara de Responsabilidades**
- **dev-tools.js:** Lógica e processamento
- **content.js:** Manipulação de DOM
- **index.js:** Controle de UI

#### **📡 Comunicação Padronizada**
- **Todas as operações** via `chrome.runtime.sendMessage`
- **Sem exposição global** de funções
- **Controle total de acesso** e segurança

#### **🧪 Testabilidade Aprimorada**
- **Funções isoladas** e testáveis
- **Mocking facilitado** para testes
- **Debug centralizado** no dev-tools.js

### Exemplo de Refatoração

#### **ANTES (Código Duplicado):**
```javascript
// content.js - Função complexa duplicada
const findBestAsset = async (minPayout) => {
    // 50+ linhas de lógica complexa
};

// index.js - Mesma função duplicada  
const findBestAsset = async (minPayout) => {
    // 50+ linhas de lógica complexa (DUPLICADA)
};

// dev-tools.js - Versão "de teste"
const testFindBestAsset = async (minPayout) => {
    // 50+ linhas de lógica complexa (TRIPLICADA)
};
```

#### **DEPOIS (Centralizado):**
```javascript
// dev-tools.js - ÚNICA implementação
const findBestAsset = async (minPayout) => {
    // Lógica completa centralizada
    const domData = await requestDOMData('GET_AVAILABLE_ASSETS');
    const processedResult = processAssetSelection(domData, minPayout);
    return processedResult;
};

// content.js - Apenas captura
const getAvailableAssets = () => {
    // Apenas captura do DOM, sem lógica
};

// index.js - Apenas coordenação
const handleFindBestAssetClick = () => {
    // Apenas chama dev-tools.js
    chrome.runtime.sendMessage({ action: 'FIND_BEST_ASSET' });
};
```

### Migração Gradual

**Fase 1:** Identificar duplicações (✅ CONCLUÍDA)
**Fase 2:** Consolidar funções no dev-tools.js
**Fase 3:** Refatorar content.js para operações DOM simples
**Fase 4:** Refatorar index.js para controle UI básico
**Fase 5:** Remover código duplicado e obsoleto