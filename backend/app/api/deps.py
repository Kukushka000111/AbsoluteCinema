import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db_session
from app.core.redis_client import get_redis as _get_redis
from app.core.security import decode_access_token
from app.models.user import User
from app.services.auth_service import get_user_by_id
from redis.asyncio import Redis

DbSession = Annotated[AsyncSession, Depends(get_db_session)]
async def get_redis_dep() -> Redis:
    return _get_redis()


RedisDep = Annotated[Redis, Depends(get_redis_dep)]


@dataclass
class AuthContext:
    user: User | None
    is_guest: bool
    guest_id: str | None = None
    guest_display_name: str | None = None

    @property
    def is_authenticated(self) -> bool:
        return self.user is not None


async def get_optional_auth(request: Request, session: DbSession) -> AuthContext:
    settings = get_settings()
    token = request.cookies.get(settings.jwt_cookie_name)
    if token is None:
        return AuthContext(user=None, is_guest=True)

    payload = decode_access_token(token)
    if payload is None:
        return AuthContext(user=None, is_guest=True)

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return AuthContext(user=None, is_guest=True)

    user = await get_user_by_id(session, user_id)
    if user is None:
        return AuthContext(user=None, is_guest=True)

    return AuthContext(user=user, is_guest=False)


async def get_current_user(
    auth: Annotated[AuthContext, Depends(get_optional_auth)],
) -> User:
    if auth.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
        )
    return auth.user


OptionalAuth = Annotated[AuthContext, Depends(get_optional_auth)]
CurrentUser = Annotated[User, Depends(get_current_user)]
