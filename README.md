# AbsoluteCinema

Синхронный просмотр видео (REST API + WebSocket + Redis + PostgreSQL).

## Быстрый запуск

```powershell
Copy-Item .env.example .env   # если ещё нет
docker compose up -d --build
docker compose exec api alembic upgrade head
```

| Сервис | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API + Swagger | http://localhost:8000/docs |
| WS health | http://localhost:8001/health |

## Основные возможности

- Синхронный просмотр (YouTube, Rutube, Vimeo и др.)
- Комнаты: открытые и приватные, очередь, чат, модерация
- Профили: аватар, био, теги, подписки, блокировки, приватность
- Глобальный администратор: `/admin` — бан пользователей, управление любыми комнатами

## Глобальный администратор

В `.env` укажите username через запятую — роль назначается при старте API:

```env
GLOBAL_ADMIN_USERNAMES=your_username
```

Или вручную в БД:

```sql
UPDATE users SET is_global_admin = true WHERE username = 'your_username';
```

## Стек

- **Backend:** FastAPI, SQLAlchemy, Alembic, Redis
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Infra:** Docker Compose, nginx, PostgreSQL 16
