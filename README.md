# Nexus Knowledge Portal

The intelligent, self-hosted knowledge discovery and task management portal.

## Architecture

This project is fully containerized with Docker, encompassing 6 distinct services:
1. **Frontend**: React 18, Vite, Tailwind CSS.
2. **Backend API**: FastAPI framework serving endpoints on port 8000.
3. **Background Worker**: Redis Queue (`rq`) processor for async ingestion.
4. **Database**: PostgreSQL with `pgvector` for strict schema and embedding persistence.
5. **Cache/Queue**: Redis for task tracking and lightweight state.
6. **LLM Engine**: Ollama running strictly local instances of Mistral and LLaVA.

## Quick Start

### 1. Environment Setup
Copy the example environment variables to a new `.env` file:
```bash
cp .env.example .env
```
*(Optionally modify `.env` to suit your host ports or credentials.)*

### 2. Boot Up the Platform
Ensure Docker Desktop is running, then boot the entire architecture detached:
```bash
docker-compose up -d --build
```
This will compile the frontend/backend images and start all 6 services.

### 3. Initialize AI Models
Once the containers are running (specifically the `ollama` container), you must pull the required AI models. A convenience script is provided:
```bash
# On Linux/macOS or Git Bash
bash scripts/init-models.sh
```
This pulls:
- `mistral` (for Chat Logic)
- `llava` (for Vision Logic)
- `nomic-embed-text` (for Vector Embeddings)

### 4. Access the Services
- **Web App**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **Ollama**: http://localhost:11434

## Troubleshooting
- **Database Connection Errors**: If `fastapi-backend` crashes on startup claiming it can't find `123@localhost`, ensure your `.env` is loaded properly and `DB_HOST` is set to `postgres`.
- **GPU Not Found**: If you have an NVIDIA GPU (e.g., RTX 4050), open `docker-compose.yml` and uncomment the `deploy` block under the `ollama` service to pass hardware acceleration down to the models.

## Development Workflow
Because we mount `./backend:/app` and `./frontend:/app` inside the compose volumes, changes you make to the source code on your host machine will immediately hot-reload the containers!
