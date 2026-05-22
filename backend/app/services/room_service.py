import uuid

from sqlalchemy import func, select
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.room import Room
from app.models.room_history import RoomHistory
from app.models.user import User
from redis.asyncio import Redis

from app.services.redis_room_service import delete_room_redis, get_online_count, hydrate_room_redis
from app.utils.slug import generate_room_id


class RoomError(Exception):
    def __init__(self, message: str, code: str = "room_error", status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


async def _generate_unique_room_id(session: AsyncSession) -> str:
    for _ in range(20):
        candidate = generate_room_id()
        exists = await session.execute(select(Room.id).where(Room.id == candidate))
        if exists.scalar_one_or_none() is None:
            return candidate
    raise RoomError("Не удалось сгенерировать id комнаты", "slug_generation_failed", 500)


async def create_room(
    session: AsyncSession,
    redis: Redis,
    *,
    admin: User,
    name: str | None,
    is_private: bool,
    tags: list[str],
) -> Room:
    room_id = await _generate_unique_room_id(session)
    normalized_tags = [t.strip().lower() for t in tags if t.strip()][:10]
    room_name = name.strip() if name and name.strip() else f"Комната {room_id}"

    room = Room(
        id=room_id,
        name=room_name,
        admin_id=admin.id,
        is_private=is_private,
        tags=normalized_tags,
    )
    session.add(room)
    await session.flush()

    await hydrate_room_redis(redis, room.id)
    await session.refresh(room, attribute_names=["admin"])
    return room


async def get_room_by_id(session: AsyncSession, room_id: str) -> Room | None:
    result = await session.execute(
        select(Room).options(selectinload(Room.admin)).where(Room.id == room_id)
    )
    return result.scalar_one_or_none()


async def get_room_or_404(session: AsyncSession, room_id: str) -> Room:
    room = await get_room_by_id(session, room_id)
    if room is None:
        raise RoomError("Комната не найдена", "not_found", 404)
    return room


async def update_room(
    session: AsyncSession,
    room: Room,
    admin: User,
    *,
    name: str | None,
    is_private: bool | None,
    tags: list[str] | None,
) -> Room:
    if room.admin_id != admin.id:
        raise RoomError("Только админ может изменять комнату", "forbidden", 403)

    if name is not None:
        room.name = name.strip()
    if is_private is not None:
        room.is_private = is_private
    if tags is not None:
        room.tags = [t.strip().lower() for t in tags if t.strip()][:10]

    await session.flush()
    await session.refresh(room, attribute_names=["admin"])
    return room


async def delete_room(
    session: AsyncSession,
    redis: Redis,
    room: Room,
    admin: User,
) -> None:
    if room.admin_id != admin.id:
        raise RoomError("Только админ может удалить комнату", "forbidden", 403)

    await delete_room_redis(redis, room.id)
    await session.delete(room)


async def list_public_rooms(
    session: AsyncSession,
    redis: Redis,
    *,
    q: str | None,
    tag_list: list[str] | None,
    limit: int,
    offset: int,
) -> tuple[list[Room], int]:
    stmt = (
        select(Room)
        .options(selectinload(Room.admin))
        .where(Room.is_private.is_(False))
        .order_by(Room.created_at.desc())
    )
    count_stmt = select(func.count()).select_from(Room).where(Room.is_private.is_(False))

    if q:
        value = q.strip().lower()
        pattern = f"%{value}%"
        search_condition = or_(Room.name.ilike(pattern), Room.tags.contains([value]))
        stmt = stmt.where(search_condition)
        count_stmt = count_stmt.where(search_condition)

    if tag_list:
        for tag in tag_list:
            stmt = stmt.where(Room.tags.contains([tag]))
            count_stmt = count_stmt.where(Room.tags.contains([tag]))

    total = (await session.execute(count_stmt)).scalar_one()
    result = await session.execute(stmt.limit(limit).offset(offset))
    rooms = list(result.scalars().all())

    return rooms, total


async def list_admin_rooms(session: AsyncSession, admin_id: uuid.UUID) -> list[Room]:
    result = await session.execute(
        select(Room)
        .options(selectinload(Room.admin))
        .where(Room.admin_id == admin_id)
        .order_by(Room.created_at.desc())
    )
    return list(result.scalars().all())


async def get_room_history(session: AsyncSession, room_id: str) -> list[RoomHistory]:
    result = await session.execute(
        select(RoomHistory)
        .where(RoomHistory.room_id == room_id)
        .order_by(RoomHistory.started_at.desc())
    )
    return list(result.scalars().all())


async def build_room_public(room: Room, redis: Redis) -> dict:
    online = await get_online_count(redis, room.id)
    return {
        "id": room.id,
        "name": room.name,
        "is_private": room.is_private,
        "tags": room.tags or [],
        "created_at": room.created_at,
        "admin": room.admin,
        "online_count": online,
    }
