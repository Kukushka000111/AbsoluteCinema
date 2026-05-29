import uuid
from re import compile as compile_regex

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.user import User

USERNAME_RE = compile_regex(r"^[a-zA-Z0-9_]+$")
EMAIL_RE = compile_regex(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthError(Exception):
    def __init__(self, message: str, code: str = "auth_error"):
        self.message = message
        self.code = code
        super().__init__(message)


async def register_user(
    session: AsyncSession,
    username: str,
    email: str,
    password: str,
) -> User:
    username = username.strip()
    email = email.strip().lower()

    existing = await session.execute(
        select(User.id).where(func.lower(User.username) == username.lower())
    )
    if existing.scalar_one_or_none():
        raise AuthError("Логин уже занят", "username_taken")

    existing_email = await session.execute(
        select(User.id).where(func.lower(User.email) == email)
    )
    if existing_email.scalar_one_or_none():
        raise AuthError("Почта уже занята", "email_taken")

    settings = get_settings()
    user = User(
        username=username,
        email=email,
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


async def check_registration_availability(
    session: AsyncSession,
    *,
    username: str | None = None,
    email: str | None = None,
) -> dict[str, bool | str | None]:
    result: dict[str, bool | str | None] = {
        "username_valid": True,
        "username_available": True,
        "username_message": None,
        "email_valid": True,
        "email_available": True,
        "email_message": None,
    }

    if username is not None:
        value = username.strip()
        if len(value) < 3:
            result.update(username_valid=False, username_message="Минимум 3 символа")
        elif len(value) > 50:
            result.update(username_valid=False, username_message="Максимум 50 символов")
        elif not USERNAME_RE.match(value):
            result.update(
                username_valid=False, username_message="Только латиница, цифры и _"
            )
        else:
            existing = await session.execute(
                select(User.id).where(func.lower(User.username) == value.lower())
            )
            if existing.scalar_one_or_none():
                result.update(
                    username_available=False, username_message="Логин уже занят"
                )

    if email is not None:
        value = email.strip().lower()
        if len(value) > 255:
            result.update(email_valid=False, email_message="Максимум 255 символов")
        elif not EMAIL_RE.match(value):
            result.update(email_valid=False, email_message="Некорректная почта")
        else:
            existing = await session.execute(
                select(User.id).where(func.lower(User.email) == value)
            )
            if existing.scalar_one_or_none():
                result.update(email_available=False, email_message="Почта уже занята")

    return result
