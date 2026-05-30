"""global admin and global bans

Revision ID: 20260602_0005
Revises: 20260601_0004
Create Date: 2026-06-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260602_0005"
down_revision: Union[str, None] = "20260601_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_global_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "global_bans",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("banned_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column(
            "banned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["banned_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index("ix_global_bans_banned_at", "global_bans", ["banned_at"])


def downgrade() -> None:
    op.drop_index("ix_global_bans_banned_at", table_name="global_bans")
    op.drop_table("global_bans")
    op.drop_column("users", "is_global_admin")
