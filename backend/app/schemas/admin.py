from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.room import RoomPublic, RoomUpdate


class GlobalBanRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class GlobalBanItem(BaseModel):
    user_id: UUID
    username: str
    reason: str | None
    banned_at: datetime
    banned_by_username: str | None = None


class AdminRoomUpdate(RoomUpdate):
    pass
