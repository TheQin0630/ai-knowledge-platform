from fastapi import APIRouter

from app.api.v1.endpoints import auth, categories, comments, posts

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(posts.router)
api_router.include_router(comments.router)
