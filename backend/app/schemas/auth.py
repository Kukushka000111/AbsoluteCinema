import uuid
from re import compile as compile_regex

from pydantic import BaseModel, Field, field_validator

EMAIL_RE = compile_regex(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_RE.match(normalized):
            raise ValueError("Некорректная почта")
        return normalized


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


class AuthAvailabilityResponse(BaseModel):
    username_valid: bool = True
    username_available: bool = True
    username_message: str | None = None
    email_valid: bool = True
    email_available: bool = True
    email_message: str | None = None
