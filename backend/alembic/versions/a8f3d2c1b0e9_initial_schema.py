"""initial schema

Revision ID: a8f3d2c1b0e9
Revises:
Create Date: 2026-05-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a8f3d2c1b0e9"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recipients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("address", sa.String(60), nullable=False),
        sa.Column("account_nrb", sa.String(26), nullable=False),
        sa.Column("transfer_type", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("payment_method", sa.String(1), nullable=False, server_default="1"),
        sa.Column("short_name", sa.String(20), nullable=True),
        sa.Column("nip", sa.String(10), nullable=True),
        sa.Column("title_suffix", sa.String(140), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_recipients_id", "recipients", ["id"])

    op.create_table(
        "batches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_batches_id", "batches", ["id"])

    op.create_table(
        "batch_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(13, 2), nullable=False),
        sa.Column("invoice_number", sa.String(35), nullable=True),
        sa.Column("title", sa.String(140), nullable=False),
        sa.Column("execution_date", sa.Date(), nullable=True),
        sa.Column("vat_amount", sa.Numeric(13, 2), nullable=True),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["recipients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_batch_items_id", "batch_items", ["id"])

    op.create_table(
        "settings",
        sa.Column("key", sa.String(50), nullable=False),
        sa.Column("value", sa.String(200), nullable=True),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("settings")
    op.drop_index("ix_batch_items_id", table_name="batch_items")
    op.drop_table("batch_items")
    op.drop_index("ix_batches_id", table_name="batches")
    op.drop_table("batches")
    op.drop_index("ix_recipients_id", table_name="recipients")
    op.drop_table("recipients")
