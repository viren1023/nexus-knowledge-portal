from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.database import get_db
from app.models.developer import Developer
from app.utils.auth import create_token

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: str

class LoginResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    token: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    # Find user by email
    user = db.query(Developer).filter(Developer.email == request.email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Generate JWT token
    token = create_token(str(user.id), user.email, user.role)
    
    return {
        "user_id": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "token": token
    }

@router.get("/users", response_model=List[UserResponse])
async def get_users(db: Session = Depends(get_db)):
    """Get all users for the login UI"""
    users = db.query(Developer).all()
    return [
        {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
        for user in users
    ]
