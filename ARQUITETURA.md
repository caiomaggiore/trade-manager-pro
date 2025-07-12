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