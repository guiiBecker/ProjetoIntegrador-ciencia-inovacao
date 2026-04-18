# Frontend - Grade Horaria Escolar

Interface React para o sistema de geracao automatica de grade horaria escolar.

## Tecnologias

- React 19
- Create React App
- CSS puro (sem frameworks)

## Estrutura de Pastas

```
src/
  api.js                       # Constante API_URL compartilhada
  App.js                       # Shell principal com router hash-based
  App.css                      # Reset CSS global

  components/                  # Componentes reutilizaveis
    Header.js / .css           # Cabecalho do aplicativo
    NavBar.js / .css           # Barra de navegacao principal
    TabBar.js / .css           # Abas de sub-navegacao (ex: tabs da ConfigPage)
    Button.js / .css           # Botao com variantes (primary, danger, warning, info, generate, confirm, select, submit)
    Badge.js / .css            # Badges de tipo (aula, intervalo, extra) e status (pending, completed, etc.)
    Spinner.js / .css          # Indicador de carregamento animado
    Toast.js / .css            # Mensagem de feedback temporaria
    DataTable.js / .css        # Tabela de dados generica com suporte a empty state
    TimetableGrid.js / .css    # Grade de horarios de uma turma (dias x periodos)
    OptionCard.js / .css       # Card de opcao de grade com label de estrategia e TimetableGrids

  ui/                          # Paginas compostas (cada uma monta componentes em tela)
    ConfigPage.js / .css       # Configuracao da escola: periodos, professores, disciplinas, turmas, atribuicoes
    ProfessoresPage.js / .css  # Geracao e gerenciamento de links de disponibilidade
    ProfessorFormPage.js / .css# Formulario publico (acesso via token) para professor informar disponibilidade
    GradePage.js / .css        # Gerador de grade com sidebar de requisicoes, opcoes, edicao e confirmacao
```

## Paginas

| Rota (hash) | Pagina | Descricao |
|-------------|--------|-----------|
| #config | ConfigPage | CRUD de periodos, professores, disciplinas, turmas e atribuicoes |
| #professores | ProfessoresPage | Gerar links de formulario e ver status de respostas |
| #form/:token | ProfessorFormPage | Formulario publico do professor (sem navegacao) |
| #grade | GradePage | Gerar grade, selecionar opcao, editar e confirmar |

## Desenvolvimento

```bash
npm install
npm start          # Dev server na porta 3000
npm run build      # Build de producao em /build
```

## Variavel de Ambiente

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| REACT_APP_API_URL | http://localhost:5001 | URL base da API backend |

## Docker

O Dockerfile usa multi-stage build:
1. Stage `build`: instala dependencias e roda `npm run build`
2. Stage final: serve arquivos estaticos com `serve -s build` na porta 3000
