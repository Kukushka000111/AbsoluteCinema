import asyncio
import json
import logging

from app.core.redis_client import get_redis
from app.core.redis_keys import room_channel_key
from app.ws.connection_manager import manager

logger = logging.getLogger(__name__)


async def run_pubsub_listener() -> None:
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.psubscribe("room:*:channel")

    try:
        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            try:
                channel = message["channel"]
                if isinstance(channel, bytes):
                    channel = channel.decode()
                # room:{id}:channel
                room_id = channel.split(":")[1]
                raw = message["data"]
                if isinstance(raw, bytes):
                    raw = raw.decode()
                payload = json.loads(raw)
                await manager.broadcast(room_id, payload)
            except Exception:
                logger.exception("Pub/Sub message handling failed")
    finally:
        await pubsub.punsubscribe("room:*:channel")
        await pubsub.aclose()


def start_pubsub_listener() -> asyncio.Task:
    return asyncio.create_task(run_pubsub_listener())
