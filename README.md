# FastWatch (AbsoluteCinema)

Синхронный просмотр видео: модульный монолит с разделением REST API и WebSocket Sync.

## Структура

```
AbsoluteCinema/
├── backend/          # Общий код FastAPI (api + ws)
├── frontend/         # React + Vite + Tailwind
├── docker-compose.yml
└── .env.example
```

## Быстрый старт (Docker)

```powershell
cd D:\KGU\6semestr\KURSACH\AbsoluteCinema
Copy-Item .env.example .env
docker compose up -d --build
```

Миграции (после старта postgres):

```powershell
docker compose exec api alembic upgrade head
```

Проверка:

- API: http://localhost:8000/health
- WS: http://localhost:8001/health
- Frontend (локально): `cd frontend && npm install && npm run dev`

## Локальная разработка backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item ..\.env.example ..\.env
# В .env для локального запуска:
# DATABASE_URL=postgresql+asyncpg://fastwatch:fastwatch_secret@localhost:5432/fastwatch
# REDIS_URL=redis://localhost:6379/0
alembic upgrade head
uvicorn app.main_api:app --reload --port 8000
# В другом терминале:
uvicorn app.main_ws:app --reload --port 8001
```
