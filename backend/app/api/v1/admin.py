from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DbSession, GlobalAdmin, RedisDep
from app.schemas.admin import AdminRoomUpdate, GlobalBanItem, GlobalBanRequest
from app.schemas.room import RoomPublic
from app.services.global_ban_service import (
    GlobalBanError,
    ban_user_globally,
    list_global_bans,
    unban_user_globally,
)
from app.services.profile_service import ProfileError, get_user_by_username_or_404
from app.services.room_service import (
    RoomError,
    build_room_public,
    delete_room,
    get_room_or_404,
    list_all_rooms,
    update_room,
)
from app.services.ws_control_service import notify_room_closed, notify_user_globally_banned
from app.ws.handlers import broadcast_room_update, broadcast_system

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/bans", response_model=list[GlobalBanItem])
async def list_bans(session: DbSession, _: GlobalAdmin) -> list[GlobalBanItem]:
    bans = await list_global_bans(session)
    return [
        GlobalBanItem(
            user_id=ban.user_id,
            username=ban.user.username,
            reason=ban.reason,
            banned_at=ban.banned_at,
            banned_by_username=ban.banned_by.username if ban.banned_by else None,
        )
        for ban in bans
    ]


@router.post("/users/{username}/ban", response_model=GlobalBanItem, status_code=status.HTTP_201_CREATED)
async def ban_user(
    username: str,
    body: GlobalBanRequest,
    session: DbSession,
    redis: RedisDep,
    admin: GlobalAdmin,
) -> GlobalBanItem:
    try:
        target = await get_user_by_username_or_404(session, username)
        ban = await ban_user_globally(
            session,
            target=target,
            banned_by=admin,
            reason=body.reason,
        )
    except ProfileError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except GlobalBanError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    await notify_user_globally_banned(
        redis, str(target.id), reason=body.reason
    )

    return GlobalBanItem(
        user_id=ban.user_id,
        username=target.username,
        reason=ban.reason,
        banned_at=ban.banned_at,
        banned_by_username=admin.username,
    )


@router.delete("/users/{username}/ban", status_code=status.HTTP_204_NO_CONTENT)
async def unban_user(
    username: str,
    session: DbSession,
    _: GlobalAdmin,
) -> None:
    try:
        target = await get_user_by_username_or_404(session, username)
        await unban_user_globally(session, target)
    except ProfileError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except GlobalBanError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/rooms", response_model=list[RoomPublic])
async def admin_list_rooms(
    session: DbSession,
    redis: RedisDep,
    _: GlobalAdmin,
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[RoomPublic]:
    rooms, _total = await list_all_rooms(session, redis, q=q, limit=limit, offset=0)
    result: list[RoomPublic] = []
    for room in rooms:
        data = await build_room_public(room, redis)
        result.append(RoomPublic.model_validate(data))
    return result


@router.patch("/rooms/{room_id}", response_model=RoomPublic)
async def admin_update_room(
    room_id: str,
    payload: AdminRoomUpdate,
    session: DbSession,
    redis: RedisDep,
    admin: GlobalAdmin,
) -> RoomPublic:
    try:
        room = await get_room_or_404(session, room_id)
        old_name = room.name
        old_is_private = room.is_private
        room = await update_room(
            session,
            room,
            admin,
            name=payload.name,
            is_private=payload.is_private,
            tags=payload.tags,
        )
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    actor = admin.username
    if payload.is_private is not None and payload.is_private != old_is_private:
        text = (
            f"Глобальный админ {actor} сделал комнату приватной"
            if room.is_private
            else f"Глобальный админ {actor} открыл комнату для всех"
        )
        await broadcast_system(room_id, text, event="room_privacy_changed", actor_display_name=actor)
    if payload.name is not None and payload.name != old_name:
        await broadcast_system(
            room_id,
            f"Глобальный админ {actor} переименовал комнату в «{room.name}»",
            event="room_renamed",
            actor_display_name=actor,
        )

    await broadcast_room_update(
        room_id,
        name=room.name,
        is_private=room.is_private,
        tags=room.tags or [],
    )
    data = await build_room_public(room, redis)
    return RoomPublic.model_validate(data)


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_room(
    room_id: str,
    session: DbSession,
    redis: RedisDep,
    admin: GlobalAdmin,
) -> None:
    try:
        room = await get_room_or_404(session, room_id)
        await delete_room(session, redis, room, admin)
        await notify_room_closed(redis, room_id)
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
