import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, field_validator


def _validate_nrb(digits: str) -> bool:
    """IBAN mod-97 checksum: PL + 26-digit NRB forms a valid IBAN."""
    iban = "PL" + digits
    rearranged = iban[4:] + iban[:4]
    numeric = "".join(
        str(ord(c.upper()) - ord("A") + 10) if c.isalpha() else c
        for c in rearranged
    )
    return int(numeric) % 97 == 1


class RecipientBase(BaseModel):
    name: str
    address: str
    account_nrb: str
    transfer_type: int = 1
    payment_method: str = "1"
    short_name: Optional[str] = None
    nip: Optional[str] = None
    title_suffix: Optional[str] = None

    @field_validator("short_name")
    @classmethod
    def short_name_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 20:
            raise ValueError("Short name must be at most 20 characters")
        return v or None

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        if len(v) > 80:
            raise ValueError("Name must be at most 80 characters")
        return v

    @field_validator("address")
    @classmethod
    def address_length(cls, v: str) -> str:
        if len(v) > 60:
            raise ValueError("Address must be at most 60 characters")
        return v

    @field_validator("account_nrb")
    @classmethod
    def nrb_format(cls, v: str) -> str:
        digits = v.replace(" ", "")
        if not digits.isdigit() or len(digits) != 26:
            raise ValueError("Account NRB must be exactly 26 digits")
        if not _validate_nrb(digits):
            raise ValueError("Account NRB has an invalid checksum")
        return digits

    @field_validator("transfer_type")
    @classmethod
    def valid_transfer_type(cls, v: int) -> int:
        if v not in (1, 2, 3, 4, 5, 6):
            raise ValueError("Invalid transfer type")
        return v

    @field_validator("payment_method")
    @classmethod
    def valid_payment_method(cls, v: str) -> str:
        if v not in ("0", "1", "6", "8", "A"):
            raise ValueError("Invalid payment method")
        return v

    @field_validator("title_suffix")
    @classmethod
    def title_suffix_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 140:
            raise ValueError("Title suffix must be at most 140 characters")
        return v or None

    @field_validator("nip")
    @classmethod
    def nip_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            digits = v.replace("-", "").replace(" ", "")
            if not digits.isdigit() or len(digits) != 10:
                raise ValueError("NIP must be exactly 10 digits")
            return digits
        return v


class RecipientCreate(RecipientBase):
    pass


class RecipientUpdate(RecipientBase):
    pass


class RecipientOut(RecipientBase):
    id: int

    model_config = {"from_attributes": True}


class BatchItemCreate(BaseModel):
    recipient_id: int
    amount: Decimal
    invoice_number: Optional[str] = None
    title: str
    execution_date: Optional[datetime.date] = None
    vat_amount: Optional[Decimal] = None

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str) -> str:
        if len(v) > 140:
            raise ValueError("Title must be at most 140 characters")
        return v

    @field_validator("invoice_number")
    @classmethod
    def invoice_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 35:
            raise ValueError("Invoice number must be at most 35 characters")
        return v


class BatchCreate(BaseModel):
    label: str = Field(..., max_length=100)
    items: list[BatchItemCreate]


class BatchItemOut(BatchItemCreate):
    id: int
    recipient: RecipientOut

    model_config = {"from_attributes": True}


class BatchOut(BaseModel):
    id: int
    label: str
    created_at: datetime.datetime
    items: list[BatchItemOut] = []

    model_config = {"from_attributes": True}


class BatchSummary(BaseModel):
    id: int
    label: str
    created_at: datetime.datetime
    item_count: int

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    own_account_nrb: Optional[str] = None

    @field_validator("own_account_nrb")
    @classmethod
    def nrb_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            digits = v.replace(" ", "")
            if not digits.isdigit() or len(digits) != 26:
                raise ValueError("Account NRB must be exactly 26 digits")
            if not _validate_nrb(digits):
                raise ValueError("Account NRB has an invalid checksum")
            return digits
        return v


class SettingsOut(BaseModel):
    own_account_nrb: Optional[str] = None
