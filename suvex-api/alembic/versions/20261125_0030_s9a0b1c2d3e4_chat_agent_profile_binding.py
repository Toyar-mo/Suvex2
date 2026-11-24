"""chat_sessions.agent_profile_id: Suvex 2.1 Agent 角色画像执行器绑定。

Revision ID: s9a0b1c2d3e4
Revises: r8f9a0b1c2d3
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "s9a0b1c2d3e4"
down_revision = "r8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column("agent_profile_id", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_sessions", "agent_profile_id")
