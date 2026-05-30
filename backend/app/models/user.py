import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

PROFILE_VISIBILITY_PUBLIC = "public"
PROFILE_VISIBILITY_SUBSCRIBERS = "subscribers"
PROFILE_VISIBILITY_HIDDEN = "hidden"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    username: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str] = mapped_column(String(512), nullable=False)
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), nullable=False, default=list, server_default="{}"
    )
    link_telegram: Mapped[str | None] = mapped_column(String(255), nullable=True)
    link_vk: Mapped[str | None] = mapped_column(String(255), nullable=True)
    link_twitch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, default=PROFILE_VISIBILITY_PUBLIC, server_default="public"
    )
    is_global_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    owned_rooms: Mapped[list["Room"]] = relationship(
        "Room",
        back_populates="admin",
        foreign_keys="Room.admin_id",
    )
    room_bans: Mapped[list["RoomBan"]] = relationship("RoomBan", back_populates="user")
    following_links: Mapped[list["UserFollow"]] = relationship(
        "UserFollow",
        foreign_keys="UserFollow.follower_id",
        back_populates="follower",
    )
    follower_links: Mapped[list["UserFollow"]] = relationship(
        "UserFollow",
        foreign_keys="UserFollow.following_id",
        back_populates="following",
    )
    room_visits: Mapped[list["UserRoomVisit"]] = relationship(
        "UserRoomVisit",
        back_populates="user",
    )
    blocking_links: Mapped[list["UserBlock"]] = relationship(
        "UserBlock",
        foreign_keys="UserBlock.blocker_id",
        back_populates="blocker",
    )
    blocked_by_links: Mapped[list["UserBlock"]] = relationship(
        "UserBlock",
        foreign_keys="UserBlock.blocked_id",
        back_populates="blocked",
    )
    global_ban: Mapped["GlobalBan | None"] = relationship(
        "GlobalBan",
        foreign_keys="GlobalBan.user_id",
        back_populates="user",
        uselist=False,
    )
