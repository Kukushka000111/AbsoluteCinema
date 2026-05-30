# FastWatch

Синхронный просмотр видео (REST API + WebSocket Sync + Redis + PostgreSQL)

## Быстрый запуск

```powershell
Copy-Item .env.example .env   # если ещё нет
docker compose up -d --build
docker compose exec api alembic upgrade head
```

 **http://localhost:3000** — frontend (nginx проксирует `/api` и `/ws`).


| Frontend | http://localhost:3000 |
| API + Swagger | http://localhost:8000/docs |
| WS health | http://localhost:8001/health |



