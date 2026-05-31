from fastapi import APIRouter, HTTPException, status

from app.api.deps import ActiveUser, CurrentUser, DbSession, OptionalAuth, RedisDep
from app.schemas.profile import (
    BlockStatus,
    FollowStatus,
    ProfileMe,
    ProfilePublic,
    ProfileUpdate,
    WatchHistoryEntry,
)
from app.schemas.room import RoomPublic
from app.services.profile_service import (
    ProfileError,
    block_user,
    build_profile_me,
    build_public_profile,
    follow_user,
    get_user_by_username_or_404,
    get_user_watch_history,
    unblock_user,
    unfollow_user,
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
            link_twitch=payload.link_twitch,
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


@router.post("/{username}/follow", response_model=FollowStatus)
async def follow_user_endpoint(
    username: str,
    session: DbSession,
    current_user: ActiveUser,
) -> FollowStatus:
    try:
        target = await get_user_by_username_or_404(session, username)
        is_following, followers_count = await follow_user(session, current_user, target)
    except ProfileError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return FollowStatus(is_following=is_following, followers_count=followers_count)


@router.delete("/{username}/follow", response_model=FollowStatus)
async def unfollow_user_endpoint(
    username: str,
    session: DbSession,
    current_user: ActiveUser,
) -> FollowStatus:
    try:
        target = await get_user_by_username_or_404(session, username)
        is_following, followers_count = await unfollow_user(session, current_user, target)
    except ProfileError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return FollowStatus(is_following=is_following, followers_count=followers_count)


@router.post("/{username}/block", response_model=BlockStatus)
async def block_user_endpoint(
    username: str,
    session: DbSession,
    current_user: ActiveUser,
) -> BlockStatus:
    try:
        target = await get_user_by_username_or_404(session, username)
        is_blocked = await block_user(session, current_user, target)
    except ProfileError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return BlockStatus(is_blocked=is_blocked)


@router.delete("/{username}/block", response_model=BlockStatus)
async def unblock_user_endpoint(
    username: str,
    session: DbSession,
    current_user: ActiveUser,
) -> BlockStatus:
    try:
        target = await get_user_by_username_or_404(session, username)
        is_blocked = await unblock_user(session, current_user, target)
    except ProfileError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return BlockStatus(is_blocked=is_blocked)
