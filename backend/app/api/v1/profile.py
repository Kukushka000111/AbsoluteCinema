from fastapi import APIRouter, HTTPException, status

from app.api.deps import ActiveUser, CurrentUser, DbSession, RedisDep, OptionalAuth
from app.schemas.profile import ProfileMe, ProfilePublic, ProfileUpdate, WatchHistoryEntry
from app.schemas.room import RoomPublic
from app.services.profile_service import (
    ProfileError,
    build_profile_me,
    build_public_profile,
    get_user_by_username_or_404,
    get_user_watch_history,
    update_profile,
)
from app.services.room_service import build_room_public, list_admin_rooms

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=ProfileMe)
async def get_my_profile(
    session: DbSession,
    redis: RedisDep,
    current_user: CurrentUser,
) -> ProfileMe:
    data = await build_profile_me(session, redis, current_user)
    return ProfileMe.model_validate(data)


@router.patch("/me", response_model=ProfileMe)
async def patch_my_profile(
    payload: ProfileUpdate,
    session: DbSession,
    redis: RedisDep,
    current_user: ActiveUser,
) -> ProfileMe:
    try:
        await update_profile(
            session,
            current_user,
            bio=payload.bio,
            tags=payload.tags,
            link_telegram=payload.link_telegram,
            link_vk=payload.link_vk,
            profile_visibility=payload.profile_visibility,
            email=payload.email,
        )
    except ProfileError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    data = await build_profile_me(session, redis, current_user)
    return ProfileMe.model_validate(data)


@router.get("/me/rooms", response_model=list[RoomPublic])
async def get_my_rooms(
    session: DbSession,
    redis: RedisDep,
    current_user: ActiveUser,
) -> list[RoomPublic]:
    rooms = await list_admin_rooms(session, current_user.id)
    result: list[RoomPublic] = []
    for room in rooms:
        data = await build_room_public(room, redis)
        result.append(RoomPublic.model_validate(data))
    return result


@router.get("/me/watch-history", response_model=list[WatchHistoryEntry])
async def get_my_watch_history(
    session: DbSession,
    current_user: ActiveUser,
) -> list[WatchHistoryEntry]:
    entries = await get_user_watch_history(session, current_user.id)
    return [WatchHistoryEntry.model_validate(e) for e in entries]


@router.get("/{username}", response_model=ProfilePublic)
async def get_user_profile(
    username: str,
    session: DbSession,
    redis: RedisDep,
    auth: OptionalAuth,
) -> ProfilePublic:
    try:
        user = await get_user_by_username_or_404(session, username)
        data = await build_public_profile(
            session,
            redis,
            user,
            viewer=auth.user,
        )
    except ProfileError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return ProfilePublic.model_validate(data)
