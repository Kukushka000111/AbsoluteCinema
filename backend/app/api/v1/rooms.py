from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession, OptionalAuth, RedisDep
from app.schemas.room import (
    BanUserRequest,
    JoinRoomRequest,
    JoinRoomResponse,
    PlayerStateSnapshot,
    RoomCreate,
    RoomHistoryItem,
    RoomPublic,
    RoomUpdate,
)
from app.services.ban_service import is_user_banned
from app.services.moderation_service import ban_user_in_room
from app.services.redis_room_service import (
    add_participant,
    cache_banned_user,
    create_ws_session,
    get_player_state,
    hydrate_room_redis,
)
from app.services.room_service import (
    RoomError,
    build_room_public,
    create_room,
    delete_room,
    get_room_history,
    get_room_or_404,
    list_admin_rooms,
    update_room,
)
from app.utils.slug import generate_guest_display_name, generate_guest_id

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/mine", response_model=list[RoomPublic])
async def my_rooms(
    session: DbSession,
    redis: RedisDep,
    current_user: CurrentUser,
) -> list[RoomPublic]:
    """Комнаты текущего пользователя (для иконки истории на главной)."""
    rooms = await list_admin_rooms(session, current_user.id)
    result: list[RoomPublic] = []
    for room in rooms:
        data = await build_room_public(room, redis)
        result.append(RoomPublic.model_validate(data))
    return result


@router.post("", response_model=RoomPublic, status_code=status.HTTP_201_CREATED)
async def create_room_endpoint(
    payload: RoomCreate,
    session: DbSession,
    redis: RedisDep,
    current_user: CurrentUser,
) -> RoomPublic:
    room = await create_room(
        session,
        redis,
        admin=current_user,
        name=payload.name,
        is_private=payload.is_private,
        tags=payload.tags,
    )
    data = await build_room_public(room, redis)
    return RoomPublic.model_validate(data)


@router.get("/{room_id}", response_model=RoomPublic)
async def get_room(
    room_id: str,
    session: DbSession,
    redis: RedisDep,
) -> RoomPublic:
    try:
        room = await get_room_or_404(session, room_id)
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    data = await build_room_public(room, redis)
    return RoomPublic.model_validate(data)


@router.patch("/{room_id}", response_model=RoomPublic)
async def patch_room(
    room_id: str,
    payload: RoomUpdate,
    session: DbSession,
    redis: RedisDep,
    current_user: CurrentUser,
) -> RoomPublic:
    try:
        room = await get_room_or_404(session, room_id)
        room = await update_room(
            session,
            room,
            current_user,
            name=payload.name,
            is_private=payload.is_private,
            tags=payload.tags,
        )
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    data = await build_room_public(room, redis)
    return RoomPublic.model_validate(data)


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_room(
    room_id: str,
    session: DbSession,
    redis: RedisDep,
    current_user: CurrentUser,
) -> None:
    try:
        room = await get_room_or_404(session, room_id)
        await delete_room(session, redis, room, current_user)
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/{room_id}/history", response_model=list[RoomHistoryItem])
async def room_history(
    room_id: str,
    session: DbSession,
) -> list[RoomHistoryItem]:
    try:
        await get_room_or_404(session, room_id)
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    entries = await get_room_history(session, room_id)
    return [RoomHistoryItem.model_validate(e) for e in entries]


@router.post("/{room_id}/join", response_model=JoinRoomResponse)
async def join_room(
    room_id: str,
    session: DbSession,
    redis: RedisDep,
    auth: OptionalAuth,
    body: JoinRoomRequest | None = None,
) -> JoinRoomResponse:
    try:
        room = await get_room_or_404(session, room_id)
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    body = body or JoinRoomRequest()

    if auth.user is not None:
        if await is_user_banned(session, room_id, auth.user.id):
            await cache_banned_user(redis, room_id, str(auth.user.id))
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Вы забанены в этой комнате")

        participant_id = str(auth.user.id)
        display_name = auth.user.username
        is_guest = False
        guest_id = None
        is_admin = room.admin_id == auth.user.id
        role = "admin" if is_admin else "viewer"
    else:
        guest_id = body.guest_id or generate_guest_id()
        display_name = body.guest_display_name or generate_guest_display_name()
        participant_id = guest_id
        is_guest = True
        is_admin = False
        role = "guest"

    await hydrate_room_redis(redis, room_id)
    await add_participant(
        redis,
        room_id,
        participant_id,
        display_name,
        role=role,
        is_guest=is_guest,
    )

    player_raw = await get_player_state(redis, room_id)
    room_data = await build_room_public(room, redis)

    ws_token = await create_ws_session(
        redis,
        room_id=room_id,
        participant_id=participant_id,
        display_name=display_name,
        role=role,
        is_admin=is_admin,
        is_guest=is_guest,
    )

    return JoinRoomResponse(
        room=RoomPublic.model_validate(room_data),
        player_state=PlayerStateSnapshot(**player_raw),
        participant_id=participant_id,
        display_name=display_name,
        is_admin=is_admin,
        is_guest=is_guest,
        guest_id=guest_id if is_guest else None,
        ws_token=ws_token,
    )


@router.post("/{room_id}/ban", status_code=status.HTTP_201_CREATED)
async def ban_user_endpoint(
    room_id: str,
    body: BanUserRequest,
    session: DbSession,
    redis: RedisDep,
    current_user: CurrentUser,
) -> dict[str, str]:
    try:
        ban = await ban_user_in_room(
            session,
            redis,
            room_id=room_id,
            target_user_id=body.user_id,
            admin_id=current_user.id,
        )
    except RoomError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"id": str(ban.id), "status": "ok"}
