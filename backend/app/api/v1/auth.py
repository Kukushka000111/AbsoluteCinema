from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.security import create_access_token
from app.schemas.auth import (
    AuthAvailabilityResponse,
    AuthResponse,
    GuestSessionResponse,
    LoginRequest,
    RegisterRequest,
    UserPublic,
)
from app.services.auth_service import (
    AuthError,
    authenticate_user,
    check_registration_availability,
    register_user,
)
from app.utils.slug import generate_guest_display_name, generate_guest_id

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
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


def _clear_auth_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.jwt_cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure_effective,
        samesite="lax",
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, response: Response, session: DbSession) -> AuthResponse:
    try:
        user = await register_user(session, payload.username, payload.email, payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc

    token = create_access_token(user.id, user.username)
    _set_auth_cookie(response, token)
    return AuthResponse(user=UserPublic.model_validate(user), message="registered")


@router.get("/availability", response_model=AuthAvailabilityResponse)
async def check_availability(
    session: DbSession,
    username: str | None = Query(default=None),
    email: str | None = Query(default=None),
) -> AuthAvailabilityResponse:
    data = await check_registration_availability(session, username=username, email=email)
    return AuthAvailabilityResponse.model_validate(data)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, response: Response, session: DbSession) -> AuthResponse:
    try:
        user = await authenticate_user(session, payload.username, payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message) from exc

    token = create_access_token(user.id, user.username)
    _set_auth_cookie(response, token)
    return AuthResponse(user=UserPublic.model_validate(user), message="logged_in")


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    _clear_auth_cookie(response)
    return {"message": "logged_out"}


@router.get("/me", response_model=UserPublic)
async def me(current_user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(current_user)


@router.post("/guest", response_model=GuestSessionResponse)
async def create_guest_session() -> GuestSessionResponse:
    """Гость не сохраняется в PostgreSQL; id и имя — для localStorage на фронте."""
    return GuestSessionResponse(
        guest_id=generate_guest_id(),
        display_name=generate_guest_display_name(),
    )
