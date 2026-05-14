from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/settings", tags=["settings"])

SETTINGS_KEYS = ("own_account_nrb",)


@router.get("", response_model=schemas.SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(models.Setting).filter(models.Setting.key.in_(SETTINGS_KEYS)).all()
    data = {row.key: row.value for row in rows}
    return schemas.SettingsOut(**data)


@router.put("", response_model=schemas.SettingsOut)
def update_settings(data: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in data.model_dump().items():
        row = db.get(models.Setting, key)
        if value is None:
            if row:
                db.delete(row)
        else:
            if row:
                row.value = value
            else:
                db.add(models.Setting(key=key, value=value))
    db.commit()
    return get_settings(db)
