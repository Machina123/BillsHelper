"""add unique constraint on account_nrb

Revision ID: 5764fce12420
Revises: a8f3d2c1b0e9
Create Date: 2026-05-14

"""
from typing import Sequence, Union

from alembic import op

revision: str = "5764fce12420"
down_revision: Union[str, None] = "a8f3d2c1b0e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("recipients") as batch_op:
        batch_op.create_unique_constraint("uq_recipients_account_nrb", ["account_nrb"])


def downgrade() -> None:
    with op.batch_alter_table("recipients") as batch_op:
        batch_op.drop_constraint("uq_recipients_account_nrb", type_="unique")
