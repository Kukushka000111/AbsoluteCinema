import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.redis_client import get_redis
from app.models.room import Room
from app.services.redis_room_service import get_online_count
from app.services.room_service import force_delete_room
from app.services.ws_control_service import notify_room_closed

logger = logging.getLogger(__name__)


async def touch_room_activity(session: AsyncSession, room: Room) -> None:
    room.last_activity_at = datetime.now(UTC)
    await session.flush()


async def purge_inactive_rooms(session: AsyncSession, *, inactive_seconds: int) -> int:
    redis = get_redis()
    cutoff = datetime.now(UTC) - timedelta(seconds=inactive_seconds)

    result = await session.execute(
        select(Room).where(Room.last_activity_at < cutoff)
    )
    rooms = list(result.scalars())

    deleted = 0
    for room in rooms:
        online = await get_online_count(redis, room.id)
        if online > 0:
            continue
        await force_delete_room(session, redis, room)
        await notify_room_closed(redis, room.id, reason="inactive")
        deleted += 1

    if deleted:
        logger.info("Purged %s inactive room(s)", deleted)
    return deleted


async def inactive_room_cleanup_loop() -> None:
    settings = get_settings()
    interval = max(settings.room_cleanup_interval_seconds, 60)
    ttl = max(settings.room_inactivity_ttl_seconds, 300)

    while True:
        try:
            async with async_session_factory() as session:
                await purge_inactive_rooms(session, inactive_seconds=ttl)
                await session.commit()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Inactive room cleanup failed")
        await asyncio.sleep(interval)


def start_inactive_room_cleanup() -> asyncio.Task:
    return asyncio.create_task(inactive_room_cleanup_loop())
