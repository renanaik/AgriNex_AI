from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from database import get_db
from auth import decode_access_token
from models import User


def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate the Bearer token, returning the authenticated User."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization[len("Bearer "):]
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user
