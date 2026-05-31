"""room last activity timestamp

Revision ID: 20260603_0006
Revises: 20260602_0005
Create Date: 2026-06-03

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260603_0006"
down_revision: Union[str, None] = "20260602_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rooms",
        sa.Column(
            "last_activity_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.execute("UPDATE rooms SET last_activity_at = created_at")
    op.create_index("ix_rooms_last_activity_at", "rooms", ["last_activity_at"])


def downgrade() -> None:
    op.drop_index("ix_rooms_last_activity_at", table_name="rooms")
    op.drop_column("rooms", "last_activity_at")
