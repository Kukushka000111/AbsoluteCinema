def room_state_key(room_id: str) -> str:
    return f"room:{room_id}:state"


def room_queue_main_key(room_id: str) -> str:
    return f"room:{room_id}:queue:main"


def room_queue_sugg_key(room_id: str) -> str:
    return f"room:{room_id}:queue:sugg"


def room_users_key(room_id: str) -> str:
    return f"room:{room_id}:users"


def room_redis_pattern(room_id: str) -> str:
    return f"room:{room_id}:*"


def room_channel_key(room_id: str) -> str:
    return f"room:{room_id}:channel"


def room_banned_key(room_id: str) -> str:
    return f"room:{room_id}:banned"


def room_muted_key(room_id: str) -> str:
    return f"room:{room_id}:muted"


def room_chat_key(room_id: str) -> str:
    return f"room:{room_id}:chat"


def ws_session_key(token: str) -> str:
    return f"ws:session:{token}"


def user_presence_key(user_id: str) -> str:
    return f"user:{user_id}:presence"
