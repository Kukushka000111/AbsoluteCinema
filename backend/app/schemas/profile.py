from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.room import RoomHistoryItem

ProfileVisibility = Literal["public", "hidden"]


class ProfileLinks(BaseModel):
    telegram: str | None = None
    vk: str | None = None


class WatchingNow(BaseModel):
    room_id: str
    room_name: str


class RecentRoomVisit(BaseModel):
    room_id: str
    room_name: str
    visited_at: datetime


class ProfilePublic(BaseModel):
    username: str
    created_at: datetime
    bio: str | None = None
    tags: list[str] = Field(default_factory=list)
    links: ProfileLinks = Field(default_factory=ProfileLinks)
    profile_visibility: ProfileVisibility
    is_own_profile: bool = False
    can_view_full: bool = True
    watching_now: WatchingNow | None = None
    recent_rooms: list[RecentRoomVisit] = Field(default_factory=list)


class ProfileMe(BaseModel):
    id: str
    username: str
    email: str | None
    bio: str | None = None
    tags: list[str] = Field(default_factory=list)
    links: ProfileLinks = Field(default_factory=ProfileLinks)
    profile_visibility: ProfileVisibility
    created_at: datetime
    watching_now: WatchingNow | None = None


class ProfileUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = None
    link_telegram: str | None = Field(default=None, max_length=255)
    link_vk: str | None = Field(default=None, max_length=255)
    profile_visibility: ProfileVisibility | None = None
    email: str | None = Field(default=None, max_length=255)


class WatchHistoryEntry(RoomHistoryItem):
    room_id: str
    room_name: str
