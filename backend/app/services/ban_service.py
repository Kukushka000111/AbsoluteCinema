import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.room_ban import RoomBan


async def is_user_banned(
    session: AsyncSession,
    room_id: str,
    user_id: uuid.UUID,
) -> bool:
    result = await session.execute(
        select(RoomBan.id).where(
            RoomBan.room_id == room_id,
            RoomBan.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None
