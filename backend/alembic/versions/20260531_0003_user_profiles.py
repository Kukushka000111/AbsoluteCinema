"""user profiles, follows, room visits

Revision ID: 20260531_0003
Revises: 20260522_0002
Create Date: 2026-05-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260531_0003"
down_revision: Union[str, None] = "20260522_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.String(length=500), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String(length=50)),
            nullable=False,
            server_default="{}",
        ),
    )
    op.add_column(
        "users", sa.Column("link_telegram", sa.String(length=255), nullable=True)
    )
    op.add_column("users", sa.Column("link_vk", sa.String(length=255), nullable=True))
    op.add_column(
        "users", sa.Column("link_twitch", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column(
            "profile_visibility",
            sa.String(length=20),
            nullable=False,
            server_default="public",
        ),
    )

    op.create_table(
        "user_follows",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("follower_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("following_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["follower_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["following_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("follower_id", "following_id", name="uq_user_follows_pair"),
    )
    op.create_index("ix_user_follows_follower_id", "user_follows", ["follower_id"])
    op.create_index("ix_user_follows_following_id", "user_follows", ["following_id"])

    op.create_table(
        "user_room_visits",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("room_id", sa.String(length=50), nullable=False),
        sa.Column(
            "last_visited_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "room_id"),
    )
    op.create_index("ix_user_room_visits_last_visited_at", "user_room_visits", ["last_visited_at"])


def downgrade() -> None:
    op.drop_index("ix_user_room_visits_last_visited_at", table_name="user_room_visits")
    op.drop_table("user_room_visits")
    op.drop_index("ix_user_follows_following_id", table_name="user_follows")
    op.drop_index("ix_user_follows_follower_id", table_name="user_follows")
    op.drop_table("user_follows")
    op.drop_column("users", "profile_visibility")
    op.drop_column("users", "link_twitch")
    op.drop_column("users", "link_vk")
    op.drop_column("users", "link_telegram")
    op.drop_column("users", "tags")
    op.drop_column("users", "bio")
