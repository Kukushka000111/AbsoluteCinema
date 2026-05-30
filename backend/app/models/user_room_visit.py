import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRoomVisit(Base):
    __tablename__ = "user_room_visits"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    room_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("rooms.id", ondelete="CASCADE"),
        primary_key=True,
    )
    last_visited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    user: Mapped["User"] = relationship("User", back_populates="room_visits")
    room: Mapped["Room"] = relationship("Room")
