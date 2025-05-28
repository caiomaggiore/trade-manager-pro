# Sistema de Containers Genéricos - Trade Manager Pro

## Visão Geral

O Trade Manager Pro agora possui um sistema padronizado de containers que garante consistência visual e estrutural em toda a aplicação. Este sistema é baseado na estrutura bem-sucedida do painel de desenvolvimento.

## Estrutura Hierárquica

```
main-panel (Container Principal)
├── main-panel-header (Header com título e descrição)
└── sub-panel (Containers Secundários)
    ├── sub-panel-header (Header opcional)
    └── Conteúdo (grids, itens, etc.)
```

## Classes Disponíveis

### 1. Container Principal (.main-panel)
**Uso:** Seções principais como Dashboard, Histórico, Configurações, etc.

```html
<div class="main-panel">
  <div class="main-panel-header">
    <h3><i class="fas fa-tachometer-alt"></i> Dashboard</h3>
    <p class="main-panel-description">Painel de controle e monitoramento do sistema</p>
  </div>
  <!-- Conteúdo -->
</div>
```

### 2. Container Secundário (.sub-panel)
**Uso:** Grupos dentro dos painéis principais

```html
<div class="sub-panel">
  <h4 class="sub-panel-header"><i class="fas fa-chart-line"></i> Estratégia</h4>
  <!-- Conteúdo -->
</div>
```

### 3. Container Compacto (.compact-panel)
**Uso:** Seções menores sem header elaborado

```html
<div class="compact-panel">
  <h4 class="compact-panel-header"><i class="fas fa-cogs"></i> Controles</h4>
  <!-- Conteúdo -->
</div>
```

## Grids de Layout

### Grid Responsivo (.panel-grid)
```html
<div class="panel-grid">
  <button class="btn">Botão 1</button>
  <button class="btn">Botão 2</button>
  <button class="btn">Botão 3</button>
</div>
```

### Grid 2 Colunas (.panel-grid-2)
```html
<div class="panel-grid-2">
  <div class="sub-panel">Coluna 1</div>
  <div class="sub-panel">Coluna 2</div>
</div>
```

### Grid 3 Colunas (.panel-grid-3)
```html
<div class="panel-grid-3">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

## Itens de Informação

### Pares Label/Valor (.panel-item)
```html
<div class="panel-item">
  <span class="panel-item-label">Lucro diário:</span>
  <span class="panel-item-value">R$ 100</span>
</div>
```

## Containers de Conteúdo

### Centralizado (.panel-content-center)
```html
<div class="panel-content-center">
  <button class="action-button">Botão Principal</button>
  <p>Texto centralizado</p>
</div>
```

### Em Linha (.panel-content-row)
```html
<div class="panel-content-row">
  <span>Item 1</span>
  <span>Item 2</span>
  <span>Item 3</span>
</div>
```

## Exemplo Completo: Painel de Configurações

```html
<div class="main-panel">
  <div class="main-panel-header">
    <h3><i class="fas fa-cog"></i> Configurações</h3>
    <p class="main-panel-description">Ajustes e preferências do sistema</p>
  </div>

  <!-- Configurações Gerais -->
  <div class="sub-panel">
    <h4 class="sub-panel-header"><i class="fas fa-sliders-h"></i> Configurações Gerais</h4>
    
    <div class="panel-item">
      <span class="panel-item-label">Valor de entrada:</span>
      <span class="panel-item-value">R$ 2,00</span>
    </div>
    
    <div class="panel-item">
      <span class="panel-item-label">Stop loss:</span>
      <span class="panel-item-value">R$ 30,00</span>
    </div>
  </div>

  <!-- Configurações Avançadas -->
  <div class="panel-grid-2">
    <div class="sub-panel">
      <h4 class="sub-panel-header"><i class="fas fa-brain"></i> Análise</h4>
      <div class="panel-content-center">
        <button class="btn">Configurar IA</button>
      </div>
    </div>
    
    <div class="sub-panel">
      <h4 class="sub-panel-header"><i class="fas fa-shield-alt"></i> Segurança</h4>
      <div class="panel-content-center">
        <button class="btn">Configurar Proteções</button>
      </div>
    </div>
  </div>
</div>
```

## Vantagens do Sistema

1. **Consistência Visual:** Todos os painéis seguem o mesmo padrão
2. **Manutenibilidade:** Mudanças de estilo são centralizadas
3. **Flexibilidade:** Grids responsivos e fixos conforme necessário
4. **Hierarquia Clara:** Estrutura bem definida de containers
5. **Reutilização:** Classes genéricas podem ser usadas em qualquer lugar

## Migração de Código Existente

Para migrar código existente:

1. Substitua containers específicos por `.main-panel`
2. Use `.sub-panel` para grupos internos
3. Aplique grids apropriados (`.panel-grid`, `.panel-grid-2`, `.panel-grid-3`)
4. Converta itens de informação para `.panel-item`
5. Use containers de conteúdo para organização

## Classes Legadas

As seguintes classes são mantidas para compatibilidade:
- `.dev-test-panel` → Use `.main-panel`
- `.dev-section` → Use `.sub-panel`
- `.dev-grid` → Use `.panel-grid`
- `.strategy-control-section` → Use `.panel-grid-2`
- `.analysis-control-section` → Use `.sub-panel` 