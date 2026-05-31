from fastapi import Response

from app.core.config import get_settings


def set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure_effective,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.jwt_cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure_effective,
        samesite="lax",
    )
    response.delete_cookie(
        key=settings.ws_session_cookie_name,
        path="/ws/",
        httponly=True,
        secure=settings.cookie_secure_effective,
        samesite="lax",
    )


def set_ws_session_cookie(response: Response, ws_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.ws_session_cookie_name,
        value=ws_token,
        httponly=True,
        secure=settings.cookie_secure_effective,
        samesite="lax",
        max_age=settings.ws_session_ttl_seconds,
        path="/ws/",
    )
