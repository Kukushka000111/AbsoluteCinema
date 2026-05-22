import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RoomCreate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    is_private: bool = False
    tags: list[str] = Field(default_factory=list, max_length=10)


class RoomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_private: bool | None = None
    tags: list[str] | None = Field(default=None, max_length=10)


class RoomAdminBrief(BaseModel):
    id: uuid.UUID
    username: str
    avatar_url: str

    model_config = {"from_attributes": True}


class RoomPublic(BaseModel):
    id: str
    name: str
    is_private: bool
    tags: list[str]
    created_at: datetime
    admin: RoomAdminBrief
    online_count: int = 0

    model_config = {"from_attributes": True}


class RoomHistoryItem(BaseModel):
    id: uuid.UUID
    video_url: str
    title: str | None
    started_at: datetime

    model_config = {"from_attributes": True}


class PlayerStateSnapshot(BaseModel):
    video_url: str
    is_playing: bool
    current_time: float
    updated_at: float


class JoinRoomRequest(BaseModel):
    guest_id: str | None = None
    guest_display_name: str | None = None


class JoinRoomResponse(BaseModel):
    room: RoomPublic
    player_state: PlayerStateSnapshot
    participant_id: str
    display_name: str
    is_admin: bool
    is_guest: bool
    guest_id: str | None = None
    ws_token: str


class BanUserRequest(BaseModel):
    user_id: uuid.UUID
