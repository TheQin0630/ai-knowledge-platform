from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import SessionLocal, engine
from app.models.base import Base
from app.models.user import User, UserRole


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        exists_admin = await session.execute(select(User).where(User.username == "admin"))
        if exists_admin.scalar_one_or_none() is None:
            session.add(
                User(username="admin", password_hash=get_password_hash("admin123"), role=UserRole.admin)
            )
            await session.commit()
