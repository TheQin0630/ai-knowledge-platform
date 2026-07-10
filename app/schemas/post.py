from datetime import datetime

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    category_id: int | None = None


class PostRead(BaseModel):
    id: int
    title: str
    content: str
    author_id: int
    category_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
