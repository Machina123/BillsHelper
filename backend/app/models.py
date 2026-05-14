from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from .database import Base


class Recipient(Base):
    __tablename__ = "recipients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), nullable=False)
    address = Column(String(60), nullable=False)
    account_nrb = Column(String(26), nullable=False, unique=True)
    transfer_type = Column(Integer, nullable=False, default=1)
    payment_method = Column(String(1), nullable=False, default="1")
    short_name = Column(String(20), nullable=True)
    nip = Column(String(10), nullable=True)
    title_suffix = Column(String(140), nullable=True)

    batch_items = relationship("BatchItem", back_populates="recipient")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=func.now())

    items = relationship("BatchItem", back_populates="batch", cascade="all, delete-orphan")


class BatchItem(Base):
    __tablename__ = "batch_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("recipients.id"), nullable=False)
    amount = Column(Numeric(13, 2), nullable=False)
    invoice_number = Column(String(35), nullable=True)
    title = Column(String(140), nullable=False)
    execution_date = Column(Date, nullable=True)
    vat_amount = Column(Numeric(13, 2), nullable=True)

    batch = relationship("Batch", back_populates="items")
    recipient = relationship("Recipient", back_populates="batch_items")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(50), primary_key=True)
    value = Column(String(200), nullable=True)
