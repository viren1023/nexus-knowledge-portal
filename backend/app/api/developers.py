from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.developer import Developer
from app.schemas import DeveloperCreate, DeveloperResponse

router = APIRouter(prefix="/api/developers", tags=["Developers"])

@router.post("", response_model=DeveloperResponse)
async def create_developer(developer: DeveloperCreate, db: Session = Depends(get_db)):
    db_dev = Developer(**developer.model_dump())
    db.add(db_dev)
    db.commit()
    db.refresh(db_dev)
    return db_dev

@router.get("", response_model=List[DeveloperResponse])
async def get_developers(db: Session = Depends(get_db)):
    return db.query(Developer).all()

@router.get("/{dev_id}", response_model=DeveloperResponse)
async def get_developer(dev_id: UUID, db: Session = Depends(get_db)):
    db_dev = db.query(Developer).filter(Developer.id == dev_id).first()
    if not db_dev:
        raise HTTPException(status_code=404, detail="Developer not found")
    return db_dev
