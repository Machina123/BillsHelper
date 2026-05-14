from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("", response_model=list[schemas.BatchSummary])
def list_batches(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Batch, func.count(models.BatchItem.id).label("item_count"))
        .outerjoin(models.BatchItem, models.BatchItem.batch_id == models.Batch.id)
        .group_by(models.Batch.id)
        .order_by(models.Batch.created_at.desc())
        .all()
    )
    return [
        schemas.BatchSummary(id=b.id, label=b.label, created_at=b.created_at, item_count=count)
        for b, count in rows
    ]


@router.post("", response_model=schemas.BatchOut, status_code=201)
def create_batch(data: schemas.BatchCreate, db: Session = Depends(get_db)):
    if not data.items:
        raise HTTPException(status_code=422, detail="Batch must contain at least one item")

    batch = models.Batch(label=data.label)
    db.add(batch)
    db.flush()

    for item_data in data.items:
        recipient = db.get(models.Recipient, item_data.recipient_id)
        if not recipient:
            raise HTTPException(status_code=404, detail=f"Recipient {item_data.recipient_id} not found")
        item = models.BatchItem(batch_id=batch.id, **item_data.model_dump())
        db.add(item)

    db.commit()
    db.refresh(batch)

    batch = (
        db.query(models.Batch)
        .options(selectinload(models.Batch.items).selectinload(models.BatchItem.recipient))
        .filter(models.Batch.id == batch.id)
        .one()
    )
    return batch


@router.get("/{batch_id}", response_model=schemas.BatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = (
        db.query(models.Batch)
        .options(selectinload(models.Batch.items).selectinload(models.BatchItem.recipient))
        .filter(models.Batch.id == batch_id)
        .first()
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.delete("/{batch_id}", status_code=204)
def delete_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(models.Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    db.commit()
