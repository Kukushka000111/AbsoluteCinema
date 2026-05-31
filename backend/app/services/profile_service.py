import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.redis_keys import user_presence_key
from app.models.room import Room
from app.models.room_history import RoomHistory
from app.models.user import (
    PROFILE_VISIBILITY_HIDDEN,
    PROFILE_VISIBILITY_PUBLIC,
    PROFILE_VISIBILITY_SUBSCRIBERS,
    User,
)
from app.models.user_block import UserBlock
from app.models.user_follow import UserFollow
from app.models.user_room_visit import UserRoomVisit
from app.services.auth_service import check_registration_availability
from redis.asyncio import Redis


class ProfileError(Exception):
    def __init__(self, message: str, code: str = "profile_error", status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


async def get_user_by_username(session: AsyncSession, username: str) -> User | None:
    result = await session.execute(
        select(User).where(func.lower(User.username) == username.strip().lower())
    )
    return result.scalar_one_or_none()


async def get_user_by_username_or_404(session: AsyncSession, username: str) -> User:
    user = await get_user_by_username(session, username)
    if user is None:
        raise ProfileError("Пользователь не найден", "not_found", 404)
    return user


async def is_following(
    session: AsyncSession, follower_id: uuid.UUID, following_id: uuid.UUID
) -> bool:
    if follower_id == following_id:
        return False
    result = await session.execute(
        select(UserFollow.id).where(
            UserFollow.follower_id == follower_id,
            UserFollow.following_id == following_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def count_followers(session: AsyncSession, user_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count()).select_from(UserFollow).where(UserFollow.following_id == user_id)
    )
    return int(result.scalar_one())


async def count_following(session: AsyncSession, user_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == user_id)
    )
    return int(result.scalar_one())


async def _can_view_full_profile_async(
    session: AsyncSession,
    user: User,
    *,
    viewer: User | None,
) -> bool:
    if viewer is not None and viewer.id == user.id:
        return True
    if user.profile_visibility == PROFILE_VISIBILITY_PUBLIC:
        return True
    if user.profile_visibility == PROFILE_VISIBILITY_HIDDEN:
        return False
    if user.profile_visibility == PROFILE_VISIBILITY_SUBSCRIBERS:
        if viewer is None:
            return False
        return await is_following(session, viewer.id, user.id)
    return False


def _profile_links(user: User) -> dict:
    return {
        "telegram": user.link_telegram,
        "vk": user.link_vk,
        "twitch": user.link_twitch,
    }


async def get_user_presence(redis: Redis, user_id: uuid.UUID) -> dict | None:
    raw = await redis.get(user_presence_key(str(user_id)))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def set_user_presence(
    redis: Redis,
    user_id: uuid.UUID,
    *,
    room_id: str,
    room_name: str,
) -> None:
    payload = {
        "room_id": room_id,
        "room_name": room_name,
        "updated_at": datetime.now(UTC).isoformat(),
    }
    await redis.set(user_presence_key(str(user_id)), json.dumps(payload), ex=86400)


async def clear_user_presence(redis: Redis, user_id: uuid.UUID) -> None:
    await redis.delete(user_presence_key(str(user_id)))


async def record_room_visit(
    session: AsyncSession,
    user_id: uuid.UUID,
    room_id: str,
) -> None:
    stmt = (
        insert(UserRoomVisit)
        .values(user_id=user_id, room_id=room_id, last_visited_at=func.now())
        .on_conflict_do_update(
            index_elements=[UserRoomVisit.user_id, UserRoomVisit.room_id],
            set_={"last_visited_at": func.now()},
        )
    )
    await session.execute(stmt)


async def get_recent_room_visits(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    limit: int = 8,
) -> list[dict]:
    result = await session.execute(
        select(UserRoomVisit, Room.name)
        .join(Room, Room.id == UserRoomVisit.room_id)
        .where(UserRoomVisit.user_id == user_id)
        .order_by(UserRoomVisit.last_visited_at.desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "room_id": visit.room_id,
            "room_name": room_name,
            "visited_at": visit.last_visited_at,
        }
        for visit, room_name in rows
    ]


async def get_user_watch_history(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    limit: int = 50,
) -> list[dict]:
    visited_subq = select(UserRoomVisit.room_id).where(UserRoomVisit.user_id == user_id)
    owned_subq = select(Room.id).where(Room.admin_id == user_id)

    result = await session.execute(
        select(RoomHistory, Room.name)
        .join(Room, Room.id == RoomHistory.room_id)
        .where(RoomHistory.room_id.in_(visited_subq.union(owned_subq)))
        .order_by(RoomHistory.started_at.desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "id": str(entry.id),
            "room_id": entry.room_id,
            "room_name": room_name,
            "video_url": entry.video_url,
            "title": entry.title,
            "started_at": entry.started_at,
        }
        for entry, room_name in rows
    ]


async def build_profile_me(
    session: AsyncSession,
    redis: Redis,
    user: User,
) -> dict:
    presence = await get_user_presence(redis, user.id)
    watching_now = None
    if presence:
        watching_now = {
            "room_id": presence["room_id"],
            "room_name": presence["room_name"],
        }

    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "bio": user.bio,
        "tags": user.tags or [],
        "links": _profile_links(user),
        "profile_visibility": user.profile_visibility,
        "created_at": user.created_at,
        "followers_count": await count_followers(session, user.id),
        "following_count": await count_following(session, user.id),
        "watching_now": watching_now,
    }


async def build_public_profile(
    session: AsyncSession,
    redis: Redis,
    user: User,
    *,
    viewer: User | None,
) -> dict:
    is_own = viewer is not None and viewer.id == user.id
    can_view_full = await _can_view_full_profile_async(session, user, viewer=viewer)
    following = False
    blocked = False
    if viewer is not None and not is_own:
        following = await is_following(session, viewer.id, user.id)
        blocked = await is_user_blocked_by(session, viewer.id, user.id)

    presence = await get_user_presence(redis, user.id) if can_view_full else None
    watching_now = None
    if presence:
        watching_now = {
            "room_id": presence["room_id"],
            "room_name": presence["room_name"],
        }

    recent_rooms: list[dict] = []
    if can_view_full:
        recent_rooms = await get_recent_room_visits(session, user.id)

    return {
        "username": user.username,
        "created_at": user.created_at,
        "bio": user.bio if can_view_full else None,
        "tags": (user.tags or []) if can_view_full else [],
        "links": _profile_links(user) if can_view_full else {"telegram": None, "vk": None, "twitch": None},
        "profile_visibility": user.profile_visibility,
        "is_own_profile": is_own,
        "is_following": following,
        "is_blocked": blocked,
        "followers_count": await count_followers(session, user.id),
        "following_count": await count_following(session, user.id),
        "can_view_full": can_view_full,
        "watching_now": watching_now,
        "recent_rooms": recent_rooms,
    }


async def update_profile(
    session: AsyncSession,
    user: User,
    *,
    bio: str | None = None,
    tags: list[str] | None = None,
    link_telegram: str | None = None,
    link_vk: str | None = None,
    link_twitch: str | None = None,
    profile_visibility: str | None = None,
    email: str | None = None,
) -> User:
    if bio is not None:
        user.bio = bio.strip() or None
    if tags is not None:
        user.tags = [t.strip().lower() for t in tags if t.strip()][:10]
    if link_telegram is not None:
        user.link_telegram = link_telegram.strip() or None
    if link_vk is not None:
        user.link_vk = link_vk.strip() or None
    if link_twitch is not None:
        user.link_twitch = link_twitch.strip() or None
    if profile_visibility is not None:
        if profile_visibility not in {
            PROFILE_VISIBILITY_PUBLIC,
            PROFILE_VISIBILITY_SUBSCRIBERS,
            PROFILE_VISIBILITY_HIDDEN,
        }:
            raise ProfileError("Некорректный уровень приватности", "invalid_visibility")
        user.profile_visibility = profile_visibility
    if email is not None:
        value = email.strip().lower()
        if value != (user.email or ""):
            availability = await check_registration_availability(session, email=value)
            if not availability["email_valid"]:
                raise ProfileError(str(availability["email_message"]), "invalid_email")
            if not availability["email_available"]:
                existing = await session.execute(
                    select(User.id).where(
                        func.lower(User.email) == value,
                        User.id != user.id,
                    )
                )
                if existing.scalar_one_or_none():
                    raise ProfileError("Почта уже занята", "email_taken")
            user.email = value or None

    await session.flush()
    await session.refresh(user)
    return user


async def follow_user(
    session: AsyncSession,
    follower: User,
    target: User,
) -> tuple[bool, int]:
    if follower.id == target.id:
        raise ProfileError("Нельзя подписаться на себя", "self_follow")
    existing = await session.execute(
        select(UserFollow).where(
            UserFollow.follower_id == follower.id,
            UserFollow.following_id == target.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return True, await count_followers(session, target.id)

    session.add(UserFollow(follower_id=follower.id, following_id=target.id))
    await session.flush()
    return True, await count_followers(session, target.id)


async def unfollow_user(
    session: AsyncSession,
    follower: User,
    target: User,
) -> tuple[bool, int]:
    result = await session.execute(
        select(UserFollow).where(
            UserFollow.follower_id == follower.id,
            UserFollow.following_id == target.id,
        )
    )
    link = result.scalar_one_or_none()
    if link is not None:
        await session.delete(link)
        await session.flush()
    return False, await count_followers(session, target.id)


async def is_user_blocked_by(
    session: AsyncSession, blocker_id: uuid.UUID, blocked_id: uuid.UUID
) -> bool:
    result = await session.execute(
        select(UserBlock.id).where(
            UserBlock.blocker_id == blocker_id,
            UserBlock.blocked_id == blocked_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def is_blocked_from_room_admin(
    session: AsyncSession, admin_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    if admin_id == user_id:
        return False
    return await is_user_blocked_by(session, admin_id, user_id)


async def block_user(
    session: AsyncSession,
    blocker: User,
    target: User,
) -> bool:
    if blocker.id == target.id:
        raise ProfileError("Нельзя заблокировать себя", "self_block")
    existing = await session.execute(
        select(UserBlock).where(
            UserBlock.blocker_id == blocker.id,
            UserBlock.blocked_id == target.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return True
    session.add(UserBlock(blocker_id=blocker.id, blocked_id=target.id))
    await session.flush()
    return True


async def unblock_user(
    session: AsyncSession,
    blocker: User,
    target: User,
) -> bool:
    result = await session.execute(
        select(UserBlock).where(
            UserBlock.blocker_id == blocker.id,
            UserBlock.blocked_id == target.id,
        )
    )
    link = result.scalar_one_or_none()
    if link is not None:
        await session.delete(link)
        await session.flush()
    return False


async def get_profile_relations_batch(
    session: AsyncSession,
    viewer: User,
    usernames: list[str],
) -> dict[str, dict[str, bool]]:
    normalized = [name.strip() for name in usernames if name.strip()]
    if not normalized:
        return {}

    result = await session.execute(
        select(User).where(
            func.lower(User.username).in_([name.lower() for name in normalized])
        )
    )
    users_by_key = {user.username.lower(): user for user in result.scalars()}
    target_ids = [user.id for user in users_by_key.values() if user.id != viewer.id]
    if not target_ids:
        return {}

    following_result = await session.execute(
        select(UserFollow.following_id).where(
            UserFollow.follower_id == viewer.id,
            UserFollow.following_id.in_(target_ids),
        )
    )
    following_ids = {row[0] for row in following_result.all()}

    blocked_result = await session.execute(
        select(UserBlock.blocked_id).where(
            UserBlock.blocker_id == viewer.id,
            UserBlock.blocked_id.in_(target_ids),
        )
    )
    blocked_ids = {row[0] for row in blocked_result.all()}

    relations: dict[str, dict[str, bool]] = {}
    for user in users_by_key.values():
        if user.id == viewer.id:
            continue
        relations[user.username] = {
            "is_following": user.id in following_ids,
            "is_blocked": user.id in blocked_ids,
        }
    return relations
