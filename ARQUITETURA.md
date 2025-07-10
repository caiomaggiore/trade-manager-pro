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

### O Erro `Message Port Closed` e a Solução
- **Causa:** Este erro fatal ocorre quando um script receptor declara que enviará uma resposta assíncrona (retornando `true` do `listener`), mas, por algum motivo (um erro, uma condição não tratada), a função `sendResponse` nunca é chamada.
- **Solução Arquitetural:** Em `background.js`, foi implementado um **manipulador de estado seguro** (`handleStateRequest`). Todas as ações relacionadas ao `chrome.storage` (que são assíncronas) passam por ele. Este manipulador usa `try/catch` e promessas para **garantir** que, independentemente do resultado da operação de `storage`, `sendResponse` seja **sempre** chamada. Isso torna a comunicação de estado resiliente e elimina o erro.

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