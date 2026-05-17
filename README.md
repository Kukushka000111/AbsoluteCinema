# FastWatch (AbsoluteCinema)

Синхронный просмотр видео: модульный монолит (REST API + WebSocket Sync + Redis + PostgreSQL).

## Быстрый старт (полный стек в Docker)

```powershell
cd D:\KGU\6semestr\KURSACH\AbsoluteCinema
Copy-Item .env.example .env   # если ещё нет
docker compose up -d --build
docker compose exec api alembic upgrade head
```

Откройте **http://localhost:3000** — frontend (nginx проксирует `/api` и `/ws`).

| Сервис | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| API + Swagger | http://localhost:8000/docs |
| WS health | http://localhost:8001/health |

## Локальная разработка (frontend hot-reload)

```powershell
docker compose up -d postgres redis api ws
docker compose exec api alembic upgrade head
cd frontend
npm install
npm run dev
```

Vite: http://localhost:5173 (proxy на API/WS).

## Тесты backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest -v
```

## Архитектура

```
frontend (nginx:3000)
    ├── /api/*  → api:8000   (PostgreSQL, JWT)
    └── /ws/*   → ws:8001    (Redis only, Pub/Sub)

ws ──internal HTTP──► api  (room_history, room_bans в PG)
```

## Основные возможности

- Регистрация / вход (JWT httpOnly cookie), гости без БД
- Лобби с поиском и тегами, приватные комнаты по ссылке
- Синхронный плеер (ReactPlayer), чат, очереди, модерация
- История просмотров, бан по user_id

## Переменные окружения

См. `.env.example` — `SECRET_KEY`, `INTERNAL_API_KEY`, `CORS_ORIGINS`, порты.
