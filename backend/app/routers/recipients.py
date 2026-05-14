from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/recipients", tags=["recipients"])


@router.get("", response_model=list[schemas.RecipientOut])
def list_recipients(db: Session = Depends(get_db)):
    return db.query(models.Recipient).order_by(models.Recipient.name).all()


@router.post("", response_model=schemas.RecipientOut, status_code=201)
def create_recipient(data: schemas.RecipientCreate, db: Session = Depends(get_db)):
    recipient = models.Recipient(**data.model_dump())
    db.add(recipient)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A recipient with this account NRB already exists")
    db.refresh(recipient)
    return recipient


@router.put("/{recipient_id}", response_model=schemas.RecipientOut)
def update_recipient(recipient_id: int, data: schemas.RecipientUpdate, db: Session = Depends(get_db)):
    recipient = db.get(models.Recipient, recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    for field, value in data.model_dump().items():
        setattr(recipient, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A recipient with this account NRB already exists")
    db.refresh(recipient)
    return recipient


@router.delete("/{recipient_id}", status_code=204)
def delete_recipient(recipient_id: int, db: Session = Depends(get_db)):
    recipient = db.get(models.Recipient, recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    db.delete(recipient)
    db.commit()
