from app.core.redis_keys import (
    room_banned_key,
    room_channel_key,
    room_queue_main_key,
    room_state_key,
    ws_session_key,
)


def test_redis_key_patterns() -> None:
    room_id = "abc12345"
    assert room_state_key(room_id) == "room:abc12345:state"
    assert room_queue_main_key(room_id) == "room:abc12345:queue:main"
    assert room_channel_key(room_id) == "room:abc12345:channel"
    assert room_banned_key(room_id) == "room:abc12345:banned"
    assert ws_session_key("tok") == "ws:session:tok"
