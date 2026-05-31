import json
from typing import Any

from redis.asyncio import Redis

from app.core.redis_keys import ws_control_channel_key


async def publish_ws_control(redis: Redis, message: dict[str, Any]) -> None:
    await redis.publish(
        ws_control_channel_key(), json.dumps(message, ensure_ascii=False)
    )


async def notify_room_closed(
    redis: Redis, room_id: str, *, reason: str = "room_deleted"
) -> None:
    await publish_ws_control(
        redis,
        {"type": "ROOM_CLOSED", "room_id": room_id, "reason": reason},
    )


async def notify_user_globally_banned(
    redis: Redis, user_id: str, *, reason: str | None = None
) -> None:
    await publish_ws_control(
        redis,
        {
            "type": "USER_GLOBALLY_BANNED",
            "user_id": user_id,
            "reason": reason,
        },
    )
