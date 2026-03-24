# ProjetoIntegrador-ciencia-inovacao

## 🚀 Como Executar

### Pré-requisitos
- Docker e Docker Compose instalados

### Executar com Docker (Recomendado)

```bash
# Subir frontend (React) e backend (Express) juntos
docker-compose up --build
```

Serviços disponíveis:
- **Frontend (React)**: http://localhost:3000
- **Backend (Express)**: http://localhost:5000

### Comandos Docker úteis

```bash
# Rodar em background
docker-compose up -d

# Parar os containers
docker-compose down

# Ver logs
docker-compose logs -f

# Logs de um serviço específico
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Executar localmente (sem Docker)

#### Backend
```bash
cd projetointegrador-web
npm install
npm start  # ou node index.js
```

#### Frontend
```bash
cd projetointegrador-html5
npm install
npm start
```

---



#### Links relacionados
- [Brainstorm](https://docs.google.com/document/d/1EnJqXf9fOiF0WdU1zKbFT2c4RSY2FJBa9HUVffkZN_0/edit?usp=sharing)
- [SQLSchema](https://excalidraw.com/#room=515214038d17ffe6b14f,TlkKqZ4JJ3FXbx5RHOL3Gg)


#### EI 1 - Observação da realidade
- [Guilherme Becker](https://docs.google.com/document/d/12jOV01ho_7-I8DX4pJSrgOnNP_TIm-eZ4paqD2Loexc/edit?usp=sharing)
- [Nathan](https://docs.google.com/document/d/1JvRbP3S5rKVBHpJiEQtdgqNNlvm2yQgE-9xoeInZl2s/edit?usp=sharing)
- [Victor](https://docs.google.com/document/d/103vBZUB4yWUC7UD_pqKSaKyhfg762lt-WWv9FsOc2WA/edit?usp=sharing)
- [Anderson](https://docs.google.com/document/d/1bjfe1yFNRZ9LrU-4yNGNKF0e0FlTsOBZAGm1oCKG1DE/edit?usp=sharing)

#### EI 2 - Definição de pontos-chaves
- [Docs](https://docs.google.com/document/d/1N9enOUNENvEvrqJLTzDohm6vG22rIurjSkAFWuw7sG4/edit?usp=sharing)
