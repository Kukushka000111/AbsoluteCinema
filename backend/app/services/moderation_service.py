import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.room_ban import RoomBan
from app.models.user import User
from app.services.redis_room_service import cache_banned_user
from app.services.room_service import RoomError, get_room_or_404
from redis.asyncio import Redis


async def ban_user_in_room(
    session: AsyncSession,
    redis: Redis,
    *,
    room_id: str,
    target_user_id: uuid.UUID,
    admin_id: uuid.UUID | None = None,
    verify_admin: bool = True,
) -> RoomBan:
    room = await get_room_or_404(session, room_id)
    if verify_admin:
        if admin_id is None or room.admin_id != admin_id:
            raise RoomError("Только админ может банить", "forbidden", 403)

    user_exists = await session.execute(select(User.id).where(User.id == target_user_id))
    if user_exists.scalar_one_or_none() is None:
        raise RoomError("Пользователь не найден", "not_found", 404)

    existing = await session.execute(
        select(RoomBan).where(
            RoomBan.room_id == room_id,
            RoomBan.user_id == target_user_id,
        )
    )
    ban = existing.scalar_one_or_none()
    if ban is None:
        ban = RoomBan(room_id=room_id, user_id=target_user_id)
        session.add(ban)
        await session.flush()
        await session.refresh(ban)

    await cache_banned_user(redis, room_id, str(target_user_id))
    return ban
