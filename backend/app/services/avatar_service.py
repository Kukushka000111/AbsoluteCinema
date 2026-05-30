import uuid
from pathlib import Path

from fastapi import UploadFile

from app.models.user import User

MAX_AVATAR_BYTES = 2 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
IMAGE_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"RIFF", "image/webp"),
]


class AvatarError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _detect_image_type(data: bytes) -> str | None:
    for signature, mime in IMAGE_SIGNATURES:
        if mime == "image/webp":
            if data[:4] == b"RIFF" and len(data) >= 12 and data[8:12] == b"WEBP":
                return mime
            continue
        if data.startswith(signature):
            return mime
    return None


async def save_user_avatar(user: User, upload: UploadFile) -> str:
    content_type = (upload.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise AvatarError("Разрешены только JPEG, PNG, WebP и GIF")

    data = await upload.read()
    if not data:
        raise AvatarError("Файл пустой")
    if len(data) > MAX_AVATAR_BYTES:
        raise AvatarError("Максимальный размер файла — 2 МБ")

    detected = _detect_image_type(data)
    if detected is None or detected not in ALLOWED_IMAGE_TYPES:
        raise AvatarError("Файл не является допустимым изображением")

    ext = ALLOWED_IMAGE_TYPES[detected]
    avatars_dir = Path(__file__).resolve().parents[2] / "static" / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)

    for old in avatars_dir.glob(f"{user.id}.*"):
        old.unlink(missing_ok=True)

    filename = f"{user.id}{ext}"
    target = avatars_dir / filename
    target.write_bytes(data)

    return f"/static/avatars/{filename}"
