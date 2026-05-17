import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.user import User


class AuthError(Exception):
    def __init__(self, message: str, code: str = "auth_error"):
        self.message = message
        self.code = code
        super().__init__(message)


async def register_user(
    session: AsyncSession,
    username: str,
    password: str,
) -> User:
    existing = await session.execute(select(User.id).where(User.username == username))
    if existing.scalar_one_or_none():
        raise AuthError("Имя пользователя уже занято", "username_taken")

    settings = get_settings()
    user = User(
        username=username,
        password_hash=hash_password(password),
        avatar_url=settings.default_avatar_url,
    )
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user


async def authenticate_user(
    session: AsyncSession,
    username: str,
    password: str,
) -> User:
    result = await session.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Неверное имя пользователя или пароль", "invalid_credentials")
    return user


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
