# Trade Manager Pro

Uma extensão Chrome profissional para análise e automação de operações de trading, utilizando IA para análise de gráficos e tomada de decisões.

## 🚀 Recursos

- 📊 Análise avançada de gráficos usando IA (Gemini API)
- 🤖 Automação inteligente de operações
- 📈 Gerenciamento de risco integrado
- 📱 Interface moderna e responsiva
- 📝 Sistema de logs avançado
- 🔄 Integração com múltiplas plataformas
- 🔒 Segurança e privacidade dos dados

## 🏗️ Estrutura do Projeto

```
trade-manager-pro/
├── src/                    # Código fonte
│   ├── components/         # Componentes da interface
│   ├── services/          # Serviços (API, análise, etc.)
│   ├── utils/             # Utilitários e helpers
│   ├── background/        # Scripts background da extensão
│   └── popup/             # Interface do popup da extensão
├── assets/                # Recursos estáticos
│   ├── icons/            # Ícones da extensão
│   ├── images/           # Imagens
│   └── styles/           # Arquivos CSS
├── docs/                  # Documentação
│   ├── api/              # Documentação da API
│   ├── setup/            # Guias de instalação
│   └── usage/            # Guias de uso
├── tests/                # Testes
│   ├── unit/            # Testes unitários
│   └── integration/     # Testes de integração
├── config/               # Arquivos de configuração
├── manifest.json         # Configuração da extensão
└── package.json         # Dependências e scripts
```

## 🛠️ Tecnologias

- JavaScript/TypeScript
- Chrome Extension API
- Gemini AI API
- HTML5/CSS3
- WebSocket para dados em tempo real
- Jest para testes

## 📦 Instalação

1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/trade-manager-pro.git
cd trade-manager-pro
```

2. Instale as dependências
```bash
npm install
```

3. Configure as variáveis de ambiente
```bash
cp .env.example .env
# Edite .env com suas chaves de API
```

4. Build do projeto
```bash
npm run build
```

5. Carregue a extensão no Chrome
- Abra chrome://extensions/
- Ative o "Modo do desenvolvedor"
- Clique em "Carregar sem compactação"
- Selecione a pasta `dist`

## 🔧 Configuração

1. API Keys
   - Configure sua chave da API Gemini
   - Configure outras integrações necessárias

2. Preferências de Trading
   - Defina limites de risco
   - Configure estratégias automáticas
   - Ajuste parâmetros de análise

## 🚦 Versionamento

Usamos [SemVer](http://semver.org/) para versionamento. Para ver as versões disponíveis, veja as [tags neste repositório](https://github.com/seu-usuario/trade-manager-pro/tags).

## 👥 Contribuição

1. Fork o projeto
2. Crie sua Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a Branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Changelog

### [1.0.0] - 2024-04-04
- Primeira versão estável
- Implementação da análise por IA
- Interface moderna com modal de resultados
- Sistema de logs avançado

## 📄 Licença

Este projeto está sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📧 Contato

Seu Nome - [@seu_twitter](https://twitter.com/seu_twitter) - email@exemplo.com

Link do Projeto: [https://github.com/seu-usuario/trade-manager-pro](https://github.com/seu-usuario/trade-manager-pro) 