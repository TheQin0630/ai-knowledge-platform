from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.cache import redis_client
from app.core.config import settings
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    await redis_client.ping()
    yield
    await redis_client.aclose()


app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG, lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/v1")
