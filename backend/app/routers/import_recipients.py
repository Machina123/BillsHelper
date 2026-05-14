from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .. import models
from ..database import get_db
from ..schemas import _validate_nrb

router = APIRouter(prefix="/recipients", tags=["recipients-import"])

EXPECTED_VERSION = "4120414"
MAX_IMPORT_BYTES = 10 * 1024 * 1024  # 10 MB


class ImportResult(BaseModel):
    added: int
    skipped: int
    errors: list[str]


def _parse_file(content: bytes) -> tuple[list[dict], list[str]]:
    try:
        text = content.decode("windows-1250")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File must be encoded in Windows-1250")

    lines = text.strip().splitlines()
    if not lines:
        raise HTTPException(status_code=422, detail="File is empty")

    if lines[0].strip() != EXPECTED_VERSION:
        raise HTTPException(
            status_code=422,
            detail=f"Unrecognised file version '{lines[0].strip()}' — expected {EXPECTED_VERSION}",
        )

    recipients: list[dict] = []
    errors: list[str] = []

    for line_num, raw in enumerate(lines[1:], start=2):
        line = raw.strip()
        if not line:
            continue

        fields = line.split("|")
        if fields and fields[-1] == "":
            fields = fields[:-1]

        if not fields:
            continue

        recipient_type = fields[0]

        if recipient_type == "1":
            if len(fields) < 8:
                errors.append(f"Line {line_num}: too few fields for a regular recipient (got {len(fields)})")
                continue

            nrb = fields[5].strip()
            if not _validate_nrb(nrb):
                errors.append(f"Line {line_num}: invalid NRB '{nrb}'")
                continue

            # Tytułem is always second-to-last, mobile_auth is always last.
            # Between NRB and Tytułem there may be one or more optional fields (Typ,
            # and potentially extra fields depending on the bank's export version).
            # We identify Typ as the field immediately before Tytułem when it is "0" or "1".
            title_suffix: Optional[str] = fields[-2].strip() or None
            payment_method_candidate = fields[-3].strip() if len(fields) >= 3 else ""
            payment_method = payment_method_candidate if payment_method_candidate in ("0", "1") else "1"

            short_name_raw = fields[2].strip() if len(fields) > 2 else ""
            name_raw = fields[3].strip()
            address_raw = fields[4].strip()

            if len(name_raw) > 80:
                errors.append(f"Line {line_num}: name truncated to 80 chars (was {len(name_raw)})")
            if len(address_raw) > 60:
                errors.append(f"Line {line_num}: address truncated to 60 chars (was {len(address_raw)})")
            if len(short_name_raw) > 20:
                errors.append(f"Line {line_num}: short name truncated to 20 chars (was {len(short_name_raw)})")

            recipients.append({
                "name": name_raw[:80],
                "address": address_raw[:60],
                "account_nrb": nrb,
                "transfer_type": 1,
                "payment_method": payment_method,
                "short_name": short_name_raw[:20] or None,
                "nip": None,
                "title_suffix": title_suffix,
            })

        elif recipient_type == "2":
            if len(fields) < 6:
                errors.append(f"Line {line_num}: too few fields for a tax office recipient (got {len(fields)})")
                continue

            nrb = fields[5].strip()
            if not _validate_nrb(nrb):
                errors.append(f"Line {line_num}: invalid NRB '{nrb}'")
                continue

            short_name_raw = fields[2].strip() if len(fields) > 2 else ""
            name_raw = fields[3].strip()
            address_raw = fields[4].strip()

            if len(name_raw) > 80:
                errors.append(f"Line {line_num}: name truncated to 80 chars (was {len(name_raw)})")
            if len(address_raw) > 60:
                errors.append(f"Line {line_num}: address truncated to 60 chars (was {len(address_raw)})")
            if len(short_name_raw) > 20:
                errors.append(f"Line {line_num}: short name truncated to 20 chars (was {len(short_name_raw)})")

            recipients.append({
                "name": name_raw[:80],
                "address": address_raw[:60],
                "account_nrb": nrb,
                "transfer_type": 3,
                "payment_method": "1",
                "short_name": short_name_raw[:20] or None,
                "nip": None,
                "title_suffix": None,
            })

        else:
            errors.append(f"Line {line_num}: unknown recipient type '{recipient_type}' — skipped")

    return recipients, errors


@router.post("/import", response_model=ImportResult)
def import_recipients(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = file.file.read(MAX_IMPORT_BYTES + 1)
    if len(content) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    parsed, errors = _parse_file(content)

    existing_nrbs = {
        row.account_nrb
        for row in db.query(models.Recipient.account_nrb).all()
    }

    added = 0
    skipped = 0
    for data in parsed:
        if data["account_nrb"] in existing_nrbs:
            skipped += 1
            continue
        db.add(models.Recipient(**data))
        existing_nrbs.add(data["account_nrb"])
        added += 1

    db.commit()
    return ImportResult(added=added, skipped=skipped, errors=errors)
