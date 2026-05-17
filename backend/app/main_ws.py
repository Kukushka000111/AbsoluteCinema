from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.redis_client import close_redis, get_redis, init_redis


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_redis()
    yield
    await close_redis()


settings = get_settings()

app = FastAPI(
    title="FastWatch WebSocket Sync",
    description="WebSocket Sync Module для FastWatch (без прямых запросов к PostgreSQL)",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    redis_client = get_redis()
    pong = await redis_client.ping()
    return {"status": "ok", "service": "ws", "redis": str(pong)}


@app.websocket("/ws/rooms/{room_id}")
async def room_websocket(websocket: WebSocket, room_id: str) -> None:
    """Заглушка WS-эндпоинта — полная логика синхронизации на следующих этапах."""
    await websocket.accept()
    try:
        await websocket.send_json(
            {
                "type": "CONNECTED",
                "room_id": room_id,
                "message": "WebSocket Sync Module is ready (stub)",
            }
        )
        while True:
            data = await websocket.receive_json()
            await websocket.send_json({"type": "ECHO", "payload": data})
    except WebSocketDisconnect:
        pass
