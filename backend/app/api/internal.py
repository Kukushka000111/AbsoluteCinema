import uuid

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

from app.api.deps import DbSession, RedisDep
from app.core.config import get_settings
from app.services.history_service import record_video_started
from app.services.moderation_service import ban_user_in_room
from app.services.profile_service import record_room_visit
from app.services.room_service import RoomError

router = APIRouter(prefix="/internal", tags=["internal"])


def _verify_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not x_internal_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


class HistoryRecordBody(BaseModel):
    video_url: str
    title: str | None = None


class BanRecordBody(BaseModel):
    user_id: str


class RoomVisitBody(BaseModel):
    room_id: str


@router.post("/rooms/{room_id}/history", status_code=status.HTTP_201_CREATED)
async def internal_record_history(
    room_id: str,
    body: HistoryRecordBody,
    session: DbSession,
    x_internal_key: str | None = Header(default=None),
) -> dict[str, str]:
    _verify_internal_key(x_internal_key)
    try:
        entry = await record_video_started(session, room_id, body.video_url, body.title)
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"id": str(entry.id), "status": "ok"}


@router.post("/rooms/{room_id}/ban", status_code=status.HTTP_201_CREATED)
async def internal_ban_user(
    room_id: str,
    body: BanRecordBody,
    session: DbSession,
    redis: RedisDep,
    x_internal_key: str | None = Header(default=None),
) -> dict[str, str]:
    _verify_internal_key(x_internal_key)
    try:
        target_id = uuid.UUID(body.user_id)
        ban = await ban_user_in_room(
            session,
            redis,
            room_id=room_id,
            target_user_id=target_id,
            verify_admin=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid user_id") from exc
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return {"id": str(ban.id), "status": "ok"}


@router.post("/users/{user_id}/room-visits", status_code=status.HTTP_201_CREATED)
async def internal_record_room_visit(
    user_id: str,
    body: RoomVisitBody,
    session: DbSession,
    x_internal_key: str | None = Header(default=None),
) -> dict[str, str]:
    _verify_internal_key(x_internal_key)
    try:
        uid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid user_id") from exc

    await record_room_visit(session, uid, body.room_id)
    return {"status": "ok"}
