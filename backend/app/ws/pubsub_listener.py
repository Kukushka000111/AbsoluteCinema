import asyncio
import json
import logging

from app.core.redis_client import get_redis
from app.core.redis_keys import ws_control_channel_key
from app.ws.connection_manager import manager

logger = logging.getLogger(__name__)


async def _handle_ws_control(payload: dict) -> None:
    event_type = payload.get("type")
    if event_type == "ROOM_CLOSED":
        room_id = payload.get("room_id")
        if isinstance(room_id, str):
            await manager.close_room(
                room_id,
                reason=str(payload.get("reason") or "room_closed"),
            )
    elif event_type == "USER_GLOBALLY_BANNED":
        user_id = payload.get("user_id")
        if isinstance(user_id, str):
            await manager.close_user_everywhere(
                user_id,
                reason="globally_banned",
                message=payload.get("reason"),
            )


async def run_pubsub_listener() -> None:
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.psubscribe("room:*:channel")
    await pubsub.subscribe(ws_control_channel_key())

    try:
        async for message in pubsub.listen():
            if message["type"] not in {"pmessage", "message"}:
                continue
            try:
                channel = message["channel"]
                if isinstance(channel, bytes):
                    channel = channel.decode()
                raw = message["data"]
                if isinstance(raw, bytes):
                    raw = raw.decode()
                payload = json.loads(raw)

                if channel == ws_control_channel_key():
                    await _handle_ws_control(payload)
                    continue

                room_id = channel.split(":")[1]
                await manager.broadcast(room_id, payload)
            except Exception:
                logger.exception("Pub/Sub message handling failed")
    finally:
        await pubsub.punsubscribe("room:*:channel")
        await pubsub.unsubscribe(ws_control_channel_key())
        await pubsub.aclose()


def start_pubsub_listener() -> asyncio.Task:
    return asyncio.create_task(run_pubsub_listener())
