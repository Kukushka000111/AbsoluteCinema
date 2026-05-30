from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.room import RoomPublic, RoomHistoryItem

ProfileVisibility = Literal["public", "subscribers", "hidden"]


class ProfileLinks(BaseModel):
    telegram: str | None = None
    vk: str | None = None
    twitch: str | None = None


class WatchingNow(BaseModel):
    room_id: str
    room_name: str


class RecentRoomVisit(BaseModel):
    room_id: str
    room_name: str
    visited_at: datetime


class ProfilePublic(BaseModel):
    username: str
    avatar_url: str
    created_at: datetime
    bio: str | None = None
    tags: list[str] = Field(default_factory=list)
    links: ProfileLinks = Field(default_factory=ProfileLinks)
    profile_visibility: ProfileVisibility
    is_own_profile: bool = False
    is_following: bool = False
    is_blocked: bool = False
    followers_count: int = 0
    following_count: int = 0
    can_view_full: bool = True
    watching_now: WatchingNow | None = None
    recent_rooms: list[RecentRoomVisit] = Field(default_factory=list)
    public_rooms: list[RoomPublic] = Field(default_factory=list)


class ProfileMe(BaseModel):
    id: str
    username: str
    email: str | None
    avatar_url: str
    bio: str | None = None
    tags: list[str] = Field(default_factory=list)
    links: ProfileLinks = Field(default_factory=ProfileLinks)
    profile_visibility: ProfileVisibility
    created_at: datetime
    followers_count: int = 0
    following_count: int = 0
    watching_now: WatchingNow | None = None


class ProfileUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = None
    avatar_url: str | None = Field(default=None, max_length=512)
    link_telegram: str | None = Field(default=None, max_length=255)
    link_vk: str | None = Field(default=None, max_length=255)
    link_twitch: str | None = Field(default=None, max_length=255)
    profile_visibility: ProfileVisibility | None = None
    email: str | None = Field(default=None, max_length=255)


class FollowStatus(BaseModel):
    is_following: bool
    followers_count: int


class BlockStatus(BaseModel):
    is_blocked: bool


class WatchHistoryEntry(RoomHistoryItem):
    room_id: str
    room_name: str
