import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.global_ban import GlobalBan
from app.models.user import User


class GlobalBanError(Exception):
    def __init__(self, message: str, code: str = "ban_error", status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


async def get_global_ban(session: AsyncSession, user_id: uuid.UUID) -> GlobalBan | None:
    result = await session.execute(
        select(GlobalBan)
        .options(selectinload(GlobalBan.banned_by))
        .where(GlobalBan.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def is_globally_banned(session: AsyncSession, user_id: uuid.UUID) -> bool:
    ban = await get_global_ban(session, user_id)
    return ban is not None


async def ban_user_globally(
    session: AsyncSession,
    *,
    target: User,
    banned_by: User,
    reason: str | None = None,
) -> GlobalBan:
    if target.is_global_admin:
        raise GlobalBanError("Нельзя заблокировать глобального администратора", "forbidden", 403)
    if target.id == banned_by.id:
        raise GlobalBanError("Нельзя заблокировать себя", "self_ban", 400)

    existing = await get_global_ban(session, target.id)
    if existing is not None:
        existing.reason = reason.strip() if reason and reason.strip() else existing.reason
        existing.banned_by_id = banned_by.id
        await session.flush()
        await session.refresh(existing, attribute_names=["banned_by", "user"])
        return existing

    ban = GlobalBan(
        user_id=target.id,
        banned_by_id=banned_by.id,
        reason=reason.strip() if reason and reason.strip() else None,
    )
    session.add(ban)
    await session.flush()
    await session.refresh(ban, attribute_names=["banned_by", "user"])
    return ban


async def unban_user_globally(session: AsyncSession, target: User) -> None:
    ban = await get_global_ban(session, target.id)
    if ban is None:
        raise GlobalBanError("Пользователь не заблокирован", "not_banned", 404)
    await session.delete(ban)


async def list_global_bans(session: AsyncSession) -> list[GlobalBan]:
    result = await session.execute(
        select(GlobalBan)
        .options(selectinload(GlobalBan.user), selectinload(GlobalBan.banned_by))
        .order_by(GlobalBan.banned_at.desc())
    )
    return list(result.scalars().all())


def user_to_public_dict(user: User, ban: GlobalBan | None = None) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "is_global_admin": bool(user.is_global_admin),
        "is_globally_banned": ban is not None,
        "global_ban_reason": ban.reason if ban else None,
    }


async def build_user_public(session: AsyncSession, user: User) -> dict:
    ban = await get_global_ban(session, user.id)
    return user_to_public_dict(user, ban)


def can_manage_room(user: User, room) -> bool:
    return bool(user.is_global_admin) or room.admin_id == user.id


async def promote_configured_global_admins(session: AsyncSession) -> None:
    usernames = get_settings().global_admin_username_list
    if not usernames:
        return

    result = await session.execute(select(User).where(User.username.in_(usernames)))
    for user in result.scalars():
        if not user.is_global_admin:
            user.is_global_admin = True
    await session.commit()


def is_configured_global_admin(username: str) -> bool:
    normalized = username.strip().lower()
    return normalized in {
        name.strip().lower()
        for name in get_settings().global_admin_username_list
    }


async def sync_global_admin_for_user(session: AsyncSession, user: User) -> User:
    """Назначает is_global_admin, если username указан в GLOBAL_ADMIN_USERNAMES."""
    if is_configured_global_admin(user.username) and not user.is_global_admin:
        user.is_global_admin = True
        await session.flush()
        await session.refresh(user)
    return user
