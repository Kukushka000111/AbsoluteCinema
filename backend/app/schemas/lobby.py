from pydantic import BaseModel, Field

from app.schemas.room import RoomPublic


class LobbyListResponse(BaseModel):
    items: list[RoomPublic]
    total: int
    limit: int
    offset: int


class LobbyQueryParams(BaseModel):
    q: str | None = None
    tags: str | None = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
