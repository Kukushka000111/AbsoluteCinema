from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.redis_client import close_redis, get_redis, init_redis
from app.services.redis_room_service import clear_all_online_participants
from app.ws.pubsub_listener import start_pubsub_listener
from app.ws.router import router as ws_router

_pubsub_task = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _pubsub_task
    await init_redis()
    await clear_all_online_participants(get_redis())
    _pubsub_task = start_pubsub_listener()
    yield
    if _pubsub_task is not None:
        _pubsub_task.cancel()
        try:
            await _pubsub_task
        except Exception:
            pass
    await close_redis()


settings = get_settings()

app = FastAPI(
    title="FastWatch WebSocket Sync",
    description="WebSocket Sync Module для FastWatch (только Redis + Pub/Sub)",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    redis_client = get_redis()
    pong = await redis_client.ping()
    return {"status": "ok", "service": "ws", "redis": str(pong)}
