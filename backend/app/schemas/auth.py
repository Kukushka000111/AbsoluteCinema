import uuid

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserPublic(BaseModel):
    id: uuid.UUID
    username: str
    avatar_url: str

    model_config = {"from_attributes": True}


class GuestSessionResponse(BaseModel):
    guest_id: str
    display_name: str


class AuthResponse(BaseModel):
    user: UserPublic
    message: str = "ok"
