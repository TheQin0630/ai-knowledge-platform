from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rate_limit import rate_limit_dependency
from app.db.session import get_db
from app.models.category import Category
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostRead

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostRead)
async def create_post(
    payload: PostCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    _: Annotated[None, Depends(rate_limit_dependency)],
):
    if payload.category_id is not None:
        category = await db.get(Category, payload.category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    post = Post(
        title=payload.title,
        content=payload.content,
        category_id=payload.category_id,
        author_id=user.id,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@router.get("", response_model=list[PostRead])
async def list_posts(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(rate_limit_dependency)],
):
    result = await db.execute(select(Post).order_by(Post.id.desc()))
    return list(result.scalars().all())


@router.get("/{post_id}", response_model=PostRead)
async def get_post(
    post_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(rate_limit_dependency)],
):
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post
