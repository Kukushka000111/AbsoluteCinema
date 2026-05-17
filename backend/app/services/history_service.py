from sqlalchemy.ext.asyncio import AsyncSession

from app.models.room_history import RoomHistory
from app.services.room_service import get_room_or_404


async def record_video_started(
    session: AsyncSession,
    room_id: str,
    video_url: str,
    title: str | None = None,
) -> RoomHistory:
    await get_room_or_404(session, room_id)
    entry = RoomHistory(
        room_id=room_id,
        video_url=video_url,
        title=(title or "").strip() or None,
    )
    session.add(entry)
    await session.flush()
    await session.refresh(entry)
    return entry
