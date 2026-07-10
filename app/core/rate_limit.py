from fastapi import HTTPException, Request, status

from app.core.cache import redis_client
from app.core.config import settings


async def rate_limit_dependency(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    route = request.url.path
    key = f"rl:{ip}:{route}"

    current = await redis_client.incr(key)
    if current == 1:
        await redis_client.expire(key, 60)

    if current > settings.RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests, please try again later.",
        )
