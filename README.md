# ProjetoIntegrador-ciencia-inovacao

Sistema de geracao automatica de grade horaria escolar com 3 opcoes de agendamento por requisicao.

## Arquitetura

```
Frontend (React:3000) --> Backend API (NestJS:5001) --> Redis (BullMQ)
                                                            |
                                                     Worker (BullMQ consumer)
                                                            |
                                                      PostgreSQL
```

| Servico | Tecnologia | Porta | Descricao |
|---------|-----------|-------|-----------|
| Frontend | React 19 | 3000 | Interface de usuario para configurar escola, gerar e visualizar grades |
| Backend | NestJS 10 | 5001 | API REST (config, form, schedule), enfileira jobs no Redis |
| Worker | Node.js + BullMQ | - | Consome jobs e executa 3 estrategias de agendamento |
| Redis | Redis 7 Alpine | 6379 | Fila de mensagens (BullMQ) |
| Banco | PostgreSQL 16 | 5432 | Armazena schema, dados e resultados |

## Estrutura do Projeto

```
projetointegrador-html5/         # Frontend React
  src/
    api.js                       # API_URL compartilhado
    App.js                       # Shell principal (router hash-based)
    App.css                      # Reset global
    components/                  # Componentes reutilizaveis
      Header.js / .css           # Cabecalho do app
      NavBar.js / .css           # Navegacao principal
      TabBar.js / .css           # Abas de sub-navegacao
      Button.js / .css           # Botoes (primary, danger, warning, info, etc.)
      Badge.js / .css            # Badges de status e tipo
      Spinner.js / .css          # Indicador de carregamento
      Toast.js / .css            # Mensagens de feedback
      DataTable.js / .css        # Tabelas de dados
      TimetableGrid.js / .css    # Grade de horarios por turma
      OptionCard.js / .css       # Card de opcao de grade com timetables
    ui/                          # Paginas compostas
      ConfigPage.js / .css       # Configuracao da escola (periodos, professores, disciplinas, turmas, atribuicoes)
      ProfessoresPage.js / .css  # Geracao de links de disponibilidade
      ProfessorFormPage.js / .css# Formulario publico do professor (via token)
      GradePage.js / .css        # Gerador de grade horaria com opcoes e edicao

projetointegrador-web/           # Backend NestJS
  src/
    app.module.ts                # Modulo raiz (imports Config, Form, Schedule, Database, Queue)
    config/                      # CRUD de turnos, periodos, professores, disciplinas, turmas, atribuicoes
    form/                        # Geracao de links e formulario de disponibilidade
    schedule/                    # Criacao de requisicoes, selecao, edicao e confirmacao de grade
    database/                    # Conexao PostgreSQL
    queue/                       # BullMQ producer

projetointegrador-worker/        # Worker BullMQ
  src/
    worker.ts                    # Consumer que executa 3 estrategias de agendamento

sql/
  init.sql                       # Schema do banco + seeds (turnos, dias_semana)

docker-compose.yml               # Orquestracao dos 5 servicos
```

## Como Executar

### Pre-requisitos
- Docker e Docker Compose instalados

### Comando unico

```bash
docker-compose up --build
```

Servicos disponiveis:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **PostgreSQL**: localhost:5432 (admin/admin123)

### Comandos Docker uteis

```bash
docker-compose up -d           # Rodar em background
docker-compose down            # Parar containers
docker-compose down -v         # Parar e limpar volumes (reset DB)
docker-compose logs -f         # Ver todos os logs
docker-compose logs -f worker  # Logs do worker
docker-compose logs -f backend # Logs do backend
```

## Paginas do Frontend

### Configuracao (#config)
Permite ao administrador cadastrar toda a estrutura da escola:
- **Periodos**: horarios de aula, intervalo e extras por turno
- **Professores**: nome, email e carga horaria maxima
- **Disciplinas**: nome, sigla e peso
- **Turmas**: nome, serie, ano letivo e turno
- **Atribuicoes**: vinculo turma + disciplina + professor com aulas/semana e tamanho de bloco

### Professores (#professores)
Gera links unicos para cada professor preencher sua disponibilidade de horarios. Mostra historico de links e status (pendente/respondido).

### Formulario do Professor (#form/:token)
Pagina publica acessada via link. O professor marca os horarios em que esta disponivel e define preferencia (1-5) por slot.

### Gerar Grade (#grade)
Dispara a geracao automatica de 3 opcoes de grade. O usuario pode:
- Selecionar uma opcao
- Editar movendo aulas entre slots (drag & drop por clique)
- Confirmar a grade final (salva no banco)

## API

### Config (CRUD)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/config/turnos | Listar turnos |
| GET | /api/config/dias | Listar dias da semana |
| GET | /api/config/periodos | Listar periodos |
| POST | /api/config/periodos | Criar periodo |
| DELETE | /api/config/periodos/:id | Remover periodo |
| POST | /api/config/periodos/regenerar-slots | Regenerar time slots |
| GET | /api/config/professores | Listar professores |
| POST | /api/config/professores | Criar professor |
| DELETE | /api/config/professores/:id | Remover professor |
| GET | /api/config/disciplinas | Listar disciplinas |
| POST | /api/config/disciplinas | Criar disciplina |
| DELETE | /api/config/disciplinas/:id | Remover disciplina |
| GET | /api/config/turmas | Listar turmas |
| POST | /api/config/turmas | Criar turma |
| DELETE | /api/config/turmas/:id | Remover turma |
| GET | /api/config/turma-disciplinas | Listar atribuicoes |
| POST | /api/config/turma-disciplinas | Criar atribuicao |
| DELETE | /api/config/turma-disciplinas/:id | Remover atribuicao |

### Form (Disponibilidade)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | /api/form/generate/:professorId | Gerar link de formulario |
| GET | /api/form/links | Listar todos os links |
| GET | /api/form/:token | Obter dados do formulario |
| POST | /api/form/:token/submit | Enviar disponibilidade |

### Schedule (Grade Horaria)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | /api/schedule | Criar requisicao de geracao |
| GET | /api/schedule | Listar requisicoes |
| GET | /api/schedule/:id | Detalhes com opcoes e itens |
| POST | /api/schedule/:id/select | Selecionar opcao |
| PUT | /api/schedule/:id/items/:itemId | Mover aula de slot |
| POST | /api/schedule/:id/confirm | Confirmar grade final |

### Health
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/health | Health check do backend |
| GET | /api/db-health | Health check do banco |

## Estrategias de Agendamento

O worker gera 3 opcoes usando estrategias diferentes:

1. **greedy_best_preference** - Prioriza disciplinas mais restritas (menos opcoes de horario) e aloca nos slots de maior preferencia do professor.
2. **random_first_fit** - Embaralha a ordem das turma_disciplinas e aloca em slots validos aleatorios. Gera variedade.
3. **balanced_distribution** - Distribui aulas uniformemente ao longo da semana, priorizando dias com menos carga por turma.

Cada opcao recebe um score (0-100%) baseado na proporcao de aulas alocadas com sucesso.

## Variaveis de Ambiente

| Variavel | Padrao | Servico |
|----------|--------|---------|
| DB_HOST | db | backend, worker |
| DB_PORT | 5432 | backend, worker |
| DB_NAME | projetointegrador | backend, worker |
| DB_USER | admin | backend, worker |
| DB_PASSWORD | admin123 | backend, worker |
| REDIS_HOST | redis | backend, worker |
| REDIS_PORT | 6379 | backend, worker |
| PORT | 5001 | backend |
| REACT_APP_API_URL | http://localhost:5001 | frontend |

## Desenvolvimento Local (sem Docker)

### Backend
```bash
cd projetointegrador-web
npm install
npm run start:dev
```

### Worker
```bash
cd projetointegrador-worker
npm install
npm run start:dev
```

### Frontend
```bash
cd projetointegrador-html5
npm install
npm start
```

Requer PostgreSQL e Redis rodando localmente.

---

## Equipe

Guilherme Becker, Nathan, Victor, Anderson, Henrique

#### Links relacionados
- [Brainstorm](https://docs.google.com/document/d/1EnJqXf9fOiF0WdU1zKbFT2c4RSY2FJBa9HUVffkZN_0/edit?usp=sharing)
- [SQLSchema](https://excalidraw.com/#room=515214038d17ffe6b14f,TlkKqZ4JJ3FXbx5RHOL3Gg)
- [Schemas](https://app.diagrams.net/?src=about#G1jZnkLJyUpjMNUL6ojI5T5hGRflElrK0l#%7B%22pageId%22%3A%22Tn-VLyU7JnAyeUWjYoj8%22%7D)

#### EI 1 - Observacao da realidade
- [Guilherme Becker](https://docs.google.com/document/d/12jOV01ho_7-I8DX4pJSrgOnNP_TIm-eZ4paqD2Loexc/edit?usp=sharing)
- [Nathan](https://docs.google.com/document/d/1JvRbP3S5rKVBHpJiEQtdgqNNlvm2yQgE-9xoeInZl2s/edit?usp=sharing)
- [Victor](https://docs.google.com/document/d/103vBZUB4yWUC7UD_pqKSaKyhfg762lt-WWv9FsOc2WA/edit?usp=sharing)
- [Anderson](https://docs.google.com/document/d/1bjfe1yFNRZ9LrU-4yNGNKF0e0FlTsOBZAGm1oCKG1DE/edit?usp=sharing)
- [Henrique](https://docs.google.com/document/d/1jbpMk_BcG3A7aISHRYrBRlC7h38M07AddzvmLbzhaec/edit?usp=sharing)

#### EI 2 - Definicao de pontos-chaves
- [Docs](https://docs.google.com/document/d/1N9enOUNENvEvrqJLTzDohm6vG22rIurjSkAFWuw7sG4/edit?usp=sharing)
