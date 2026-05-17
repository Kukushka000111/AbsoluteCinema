from fastapi import APIRouter, Query

from app.api.deps import DbSession, RedisDep
from app.schemas.lobby import LobbyListResponse
from app.schemas.room import RoomPublic
from app.services.room_service import build_room_public, list_public_rooms

router = APIRouter(prefix="/lobby", tags=["lobby"])


@router.get("/rooms", response_model=LobbyListResponse)
async def list_lobby_rooms(
    session: DbSession,
    redis: RedisDep,
    q: str | None = Query(default=None, description="Поиск по названию комнаты"),
    tags: str | None = Query(default=None, description="Теги через запятую"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> LobbyListResponse:
    tag_list = [t.strip().lower() for t in tags.split(",") if t.strip()] if tags else None
    rooms, total = await list_public_rooms(
        session,
        redis,
        q=q,
        tag_list=tag_list,
        limit=limit,
        offset=offset,
    )

    items: list[RoomPublic] = []
    for room in rooms:
        data = await build_room_public(room, redis)
        items.append(RoomPublic.model_validate(data))

    return LobbyListResponse(items=items, total=total, limit=limit, offset=offset)
