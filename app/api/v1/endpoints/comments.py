from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rate_limit import rate_limit_dependency
from app.db.session import get_db
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentRead

router = APIRouter(prefix="/posts/{post_id}/comments", tags=["comments"])


@router.post("", response_model=CommentRead)
async def create_comment(
    post_id: int,
    payload: CommentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    _: Annotated[None, Depends(rate_limit_dependency)],
):
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    comment = Comment(content=payload.content, post_id=post_id, author_id=user.id)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.get("", response_model=list[CommentRead])
async def list_comments(
    post_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[None, Depends(rate_limit_dependency)],
):
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    result = await db.execute(select(Comment).where(Comment.post_id == post_id).order_by(Comment.id.desc()))
    return list(result.scalars().all())
