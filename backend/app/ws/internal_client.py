"""HTTP-вызовы из WS-сервиса в REST API (PostgreSQL только в API)."""

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def record_video_history(room_id: str, video_url: str, title: str | None) -> None:
    settings = get_settings()
    url = f"{settings.internal_api_url.rstrip('/')}/internal/rooms/{room_id}/history"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json={"video_url": video_url, "title": title},
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            response.raise_for_status()
    except Exception:
        logger.exception("Failed to record room history for %s", room_id)


async def record_room_visit(user_id: str, room_id: str) -> None:
    settings = get_settings()
    url = f"{settings.internal_api_url.rstrip('/')}/internal/users/{user_id}/room-visits"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json={"room_id": room_id},
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            response.raise_for_status()
    except Exception:
        logger.exception("Failed to record room visit for user %s room %s", user_id, room_id)


async def persist_ban(room_id: str, user_id: str) -> bool:
    settings = get_settings()
    url = f"{settings.internal_api_url.rstrip('/')}/internal/rooms/{room_id}/ban"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json={"user_id": user_id},
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            return response.status_code < 300
    except Exception:
        logger.exception("Failed to persist ban for room %s user %s", room_id, user_id)
        return False
