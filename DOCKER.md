# Docker Setup

## Servicos

| Container | Servico | Porta | Imagem |
|-----------|---------|-------|--------|
| react-frontend | frontend | 3000 | node:18-alpine (build) + serve |
| nest-backend | backend | 5001 | node:18-alpine + NestJS |
| schedule-worker | worker | - | node:18-alpine + BullMQ consumer |
| postgres-db | db | 5432 | postgres:16-alpine |
| redis-broker | redis | 6379 | redis:7-alpine |

## Comandos

### Build e inicie todos os containers:
```bash
docker-compose up --build
```

### Rodar em background:
```bash
docker-compose up --build -d
```

### Parar os containers:
```bash
docker-compose down
```

### Parar e limpar volumes (reset completo do banco):
```bash
docker-compose down -v
```

### Rebuild apenas o frontend:
```bash
docker-compose build frontend && docker-compose up -d frontend
```

### Ver logs:
```bash
docker-compose logs -f              # Todos
docker-compose logs -f backend      # Apenas backend
docker-compose logs -f worker       # Apenas worker
docker-compose logs -f frontend     # Apenas frontend
```

### Ver status dos containers:
```bash
docker-compose ps
```

## Acessar os servicos

- **Frontend (React)**: http://localhost:3000
- **Backend API (NestJS)**: http://localhost:5001
- **PostgreSQL**: localhost:5432 (usuario: admin / senha: admin123 / db: projetointegrador)
- **Redis**: localhost:6379

## Estrutura Docker

- `projetointegrador-html5/Dockerfile` - Multi-stage: npm build -> serve static
- `projetointegrador-web/Dockerfile` - NestJS build -> node dist/main
- `projetointegrador-worker/Dockerfile` - TypeScript build -> node dist/worker
- `docker-compose.yml` - Orquestracao com rede bridge `app-network` e volume `pgdata`

## Notas

- O banco e inicializado automaticamente com `sql/init.sql` no primeiro `docker-compose up`
- Para resetar o banco (ex: apos alterar init.sql), use `docker-compose down -v` antes de subir novamente
- No macOS, a porta 5000 pode conflitar com AirPlay Receiver. O backend usa a porta 5001
- O frontend faz build estatico e serve via `serve -s build` na porta 3000
