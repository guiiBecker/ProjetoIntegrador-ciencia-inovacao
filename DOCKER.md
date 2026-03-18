# Docker Setup

## Comandos úteis

### Build e inicie os containers:
```bash
docker-compose up --build
```

### Apenas inicie (sem rebuild):
```bash
docker-compose up
```

### Para em background:
```bash
docker-compose up -d
```

### Parar os containers:
```bash
docker-compose down
```

### Ver logs:
```bash
docker-compose logs -f
```

### Acessar os serviços:
- **Frontend (React)**: http://localhost:3000
- **Backend (Express)**: http://localhost:5000

## Estrutura

- `projetointegrador-html5/`: Frontend React
- `projetointegrador-web/`: Backend Express
- `docker-compose.yml`: Orquestração dos containers

## Configuração

Copie os arquivos `.env.example` para `.env` em cada pasta para customizar as variáveis de ambiente.
