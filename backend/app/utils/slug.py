import secrets
import string

ROOM_ID_ALPHABET = string.ascii_lowercase + string.digits
ROOM_ID_LENGTH = 8
GUEST_NAME_PREFIX = "Guest_"


def generate_room_id() -> str:
    return "".join(secrets.choice(ROOM_ID_ALPHABET) for _ in range(ROOM_ID_LENGTH))


def generate_guest_display_name() -> str:
    suffix = "".join(secrets.choice(string.digits) for _ in range(4))
    return f"{GUEST_NAME_PREFIX}{suffix}"


def generate_guest_id() -> str:
    return secrets.token_urlsafe(16)
