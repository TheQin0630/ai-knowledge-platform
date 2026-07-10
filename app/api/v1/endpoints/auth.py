import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, oauth2_scheme
from app.core.cache import redis_client
from app.core.config import settings
from app.core.rate_limit import rate_limit_dependency
from app.core.security import ALGORITHM
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import CurrentUser, LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=CurrentUser, dependencies=[Depends(rate_limit_dependency)])
async def register(payload: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.username == payload.username))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    user = User(username=payload.username, password_hash=get_password_hash(payload.password), role=payload.role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return CurrentUser(id=user.id, username=user.username, role=user.role)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit_dependency)])
async def login(payload: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    sid = uuid.uuid4().hex
    await redis_client.set(f"session:{sid}", str(user.id), ex=60 * 60 * 24)

    token = create_access_token(subject=str(user.id), extra={"role": user.role.value, "sid": sid})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=CurrentUser)
async def me(user: Annotated[User, Depends(get_current_user)]):
    return CurrentUser(id=user.id, username=user.username, role=user.role)


@router.post("/logout")
async def logout(token: Annotated[str, Depends(oauth2_scheme)]):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        sid = payload.get("sid")
        if not sid:
            raise ValueError("missing sid")
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    await redis_client.delete(f"session:{sid}")
    return {"message": "Logged out"}
