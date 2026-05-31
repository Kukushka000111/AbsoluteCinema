def normalize_telegram_link(value: str | None) -> str | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    if raw.startswith("t.me/"):
        return f"https://{raw}"
    username = raw.lstrip("@")
    if not username:
        return None
    return f"https://t.me/{username}"


def normalize_vk_link(value: str | None) -> str | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    if raw.startswith("vk.com/") or raw.startswith("m.vk.com/"):
        return f"https://{raw}"
    path = raw.lstrip("@")
    if not path:
        return None
    return f"https://vk.com/{path}"
