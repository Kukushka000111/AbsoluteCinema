from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.internal import router as internal_router
from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.redis_client import close_redis, init_redis
from app.services.global_ban_service import promote_configured_global_admins


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_redis()
    async with async_session_factory() as session:
        await promote_configured_global_admins(session)
    yield
    await close_redis()


settings = get_settings()

app = FastAPI(
    title="FastWatch API",
    description="REST API для FastWatch (AbsoluteCinema)",
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


app.include_router(api_router)
app.include_router(internal_router)

static_dir = Path(__file__).resolve().parent.parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "api"}
