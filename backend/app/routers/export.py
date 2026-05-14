import datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload
from .. import models
from ..database import get_db

router = APIRouter(prefix="/export", tags=["export"])

ERSTE_HEADER = "4120414|1"

ELIXIR_ENCODINGS = {"cp852", "windows-1250", "utf-8"}
VALID_FORMATS = {"erste", "elixir"}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _fmt_amount_comma(amount: Decimal) -> str:
    """Polish decimal comma format used by Erste and Elixir VAT fields."""
    return f"{amount:.2f}".replace(".", ",")


def _build_title(base: str, suffix: Optional[str]) -> str:
    combined = f"{base} {suffix}" if suffix else base
    return combined[:140]


def _safe_label(label: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in label)


# ---------------------------------------------------------------------------
# Erste format (.txt, Windows-1250, pipe-separated)
# ---------------------------------------------------------------------------

def _erste_date(d) -> str:
    return d.strftime("%d-%m-%Y") if d else ""


def _build_erste_line(transfer_type: int, own_nrb: str, item: models.BatchItem) -> str:
    r = item.recipient
    amount_str = _fmt_amount_comma(item.amount)
    date_str = _erste_date(item.execution_date)

    if transfer_type == 6:
        vat_str = _fmt_amount_comma(item.vat_amount or Decimal("0"))
        title = f"/VAT/{vat_str}/IDC/{r.nip or ''}/INV/{item.invoice_number or ''}/TXT/{_build_title(item.title, r.title_suffix)}"
        return f"6|{own_nrb}|{r.account_nrb}|{r.name}|{r.address}|{amount_str}|{r.payment_method}|{title}|{date_str}|"

    title = _build_title(item.title, r.title_suffix)
    return f"{transfer_type}|{own_nrb}|{r.account_nrb}|{r.name}|{r.address}|{amount_str}|{r.payment_method}|{title}|{date_str}|"


def _generate_erste(batch: models.Batch, own_nrb: str) -> str:
    lines = [ERSTE_HEADER]
    for item in batch.items:
        lines.append(_build_erste_line(item.recipient.transfer_type, own_nrb, item))
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Elixir-0 format (.pli, comma-separated, quoted fields, CRLF)
# ---------------------------------------------------------------------------

def _elixir_date(d) -> str:
    return d.strftime("%Y%m%d") if d else datetime.date.today().strftime("%Y%m%d")


def _elixir_amount_cents(amount: Decimal) -> str:
    return str(round(amount * 100))


def _split_subfields(text: str, width: int = 35, max_parts: int = 4) -> str:
    """Break text into pipe-separated subfields of up to `width` chars each."""
    parts = []
    while text and len(parts) < max_parts:
        parts.append(text[:width])
        text = text[width:]
    return "|".join(parts)


def _elixir_counterparty(name: str, address: str) -> str:
    """Build up to 4 pipe-separated subfields of 35 chars: name parts then address parts."""
    parts: list[str] = [name[:35]]
    if len(name) > 35:
        parts.append(name[35:70])
    if address:
        parts.append(address[:35])
        if len(address) > 35:
            parts.append(address[35:70])
    return "|".join(parts[:4])


def _elixir_classification(transfer_type: int, payment_method: str) -> str:
    if transfer_type == 6:
        return "43" if payment_method == "8" else "53"
    return "41" if payment_method == "8" else "51"


def _build_elixir_line(own_nrb: str, item: models.BatchItem) -> str:
    r = item.recipient
    tx_type = 110
    classification = _elixir_classification(r.transfer_type, r.payment_method)
    date_str = _elixir_date(item.execution_date)
    amount_str = _elixir_amount_cents(item.amount)
    counterparty = _elixir_counterparty(r.name, r.address)
    full_title = _build_title(item.title, r.title_suffix)

    if r.transfer_type == 6:
        vat_str = _fmt_amount_comma(item.vat_amount or Decimal("0"))
        title_str = f"/VAT/{vat_str}/IDC/{r.nip or ''}/INV/{item.invoice_number or ''}/TXT/{full_title}"
    else:
        title_str = full_title

    title_field = _split_subfields(title_str)

    return (
        f'{tx_type},{date_str},{amount_str},,0,'
        f'"{own_nrb}","{r.account_nrb}","","{counterparty}",0,,'
        f'"{title_field}","","","{classification}",""'
    )


def _generate_elixir(batch: models.Batch, own_nrb: str) -> str:
    lines = [_build_elixir_line(own_nrb, item) for item in batch.items]
    return "\r\n".join(lines) + "\r\n"


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/{batch_id}")
def export_batch(
    batch_id: int,
    format: str = Query("erste"),
    encoding: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    if format not in VALID_FORMATS:
        raise HTTPException(status_code=422, detail=f"Invalid format '{format}'. Choose: erste, elixir")

    resolved_encoding = encoding or ("cp852" if format == "elixir" else "windows-1250")
    if format == "elixir" and resolved_encoding not in ELIXIR_ENCODINGS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid encoding '{resolved_encoding}'. Choose: cp852, windows-1250, utf-8",
        )

    batch = (
        db.query(models.Batch)
        .options(selectinload(models.Batch.items).selectinload(models.BatchItem.recipient))
        .filter(models.Batch.id == batch_id)
        .first()
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    own_nrb_row = db.get(models.Setting, "own_account_nrb")
    if not own_nrb_row or not own_nrb_row.value:
        raise HTTPException(status_code=422, detail="Own account NRB is not configured in settings")

    own_nrb = own_nrb_row.value
    label = _safe_label(batch.label)

    if format == "elixir":
        content = _generate_elixir(batch, own_nrb)
        encoded = content.encode(resolved_encoding)
        filename = f"przelewy_{label}.pli"
        media_type = f"text/plain; charset={resolved_encoding}"
    else:
        content = _generate_erste(batch, own_nrb)
        encoded = content.encode("windows-1250")
        filename = f"przelewy_{label}.txt"
        media_type = "text/plain; charset=windows-1250"

    return Response(
        content=encoded,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
