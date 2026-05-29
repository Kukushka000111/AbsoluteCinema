import json
import secrets
import time
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings
from app.core.redis_keys import (
    room_banned_key,
    room_channel_key,
    room_queue_main_key,
    room_queue_sugg_key,
    room_redis_pattern,
    room_state_key,
    room_users_key,
    ws_session_key,
)


def _participant_payload(
    participant_id: str,
    display_name: str,
    role: str,
    is_guest: bool,
) -> str:
    return json.dumps(
        {
            "id": participant_id,
            "display_name": display_name,
            "role": role,
            "is_guest": is_guest,
        },
        ensure_ascii=False,
    )


def _queue_item(url: str, title: str | None = None) -> str:
    return json.dumps({"url": url, "title": title or ""}, ensure_ascii=False)


def _parse_queue_item(raw: str) -> dict[str, str]:
    try:
        data = json.loads(raw)
        return {"url": data.get("url", ""), "title": data.get("title", "")}
    except json.JSONDecodeError:
        return {"url": raw, "title": ""}


async def publish_room_event(
    redis: Redis, room_id: str, message: dict[str, Any]
) -> None:
    await redis.publish(
        room_channel_key(room_id), json.dumps(message, ensure_ascii=False)
    )


async def hydrate_room_redis(redis: Redis, room_id: str) -> None:
    state_key = room_state_key(room_id)
    if await redis.exists(state_key):
        return

    now = time.time()
    await redis.hset(
        state_key,
        mapping={
            "video_url": "",
            "is_playing": "0",
            "current_time": "0",
            "updated_at": str(now),
        },
    )


async def get_player_state(redis: Redis, room_id: str) -> dict[str, Any]:
    raw = await redis.hgetall(room_state_key(room_id))
    if not raw:
        now = time.time()
        return {
            "video_url": "",
            "is_playing": False,
            "current_time": 0.0,
            "updated_at": now,
        }
    return {
        "video_url": raw.get("video_url", ""),
        "is_playing": raw.get("is_playing", "0") in {"1", "true", "True"},
        "current_time": float(raw.get("current_time", 0) or 0),
        "updated_at": float(raw.get("updated_at", 0) or 0),
    }


async def set_player_state(
    redis: Redis,
    room_id: str,
    *,
    video_url: str | None = None,
    is_playing: bool | None = None,
    current_time: float | None = None,
) -> dict[str, Any]:
    now = time.time()
    mapping: dict[str, str] = {"updated_at": str(now)}
    if video_url is not None:
        mapping["video_url"] = video_url
    if is_playing is not None:
        mapping["is_playing"] = "1" if is_playing else "0"
    if current_time is not None:
        mapping["current_time"] = str(current_time)

    await redis.hset(room_state_key(room_id), mapping=mapping)
    return await get_player_state(redis, room_id)


async def add_participant(
    redis: Redis,
    room_id: str,
    participant_id: str,
    display_name: str,
    *,
    role: str,
    is_guest: bool,
) -> None:
    await remove_participant(redis, room_id, participant_id)
    await redis.sadd(
        room_users_key(room_id),
        _participant_payload(participant_id, display_name, role, is_guest),
    )


async def remove_participant(redis: Redis, room_id: str, participant_id: str) -> None:
    members = await redis.smembers(room_users_key(room_id))
    for member in members:
        try:
            data = json.loads(member)
        except json.JSONDecodeError:
            continue
        if data.get("id") == participant_id:
            await redis.srem(room_users_key(room_id), member)
            break


async def list_participants(redis: Redis, room_id: str) -> list[dict[str, Any]]:
    members = await redis.smembers(room_users_key(room_id))
    result: list[dict[str, Any]] = []
    for member in members:
        try:
            result.append(json.loads(member))
        except json.JSONDecodeError:
            continue
    return result


async def get_online_count(redis: Redis, room_id: str) -> int:
    return await redis.scard(room_users_key(room_id))


async def clear_all_online_participants(redis: Redis) -> None:
    keys = []
    async for key in redis.scan_iter(match="room:*:users"):
        keys.append(key)
    if keys:
        await redis.delete(*keys)


async def delete_room_redis(redis: Redis, room_id: str) -> None:
    keys = []
    async for key in redis.scan_iter(match=room_redis_pattern(room_id)):
        keys.append(key)
    if keys:
        await redis.delete(*keys)


async def get_queue(redis: Redis, room_id: str, queue: str) -> list[dict[str, str]]:
    key = (
        room_queue_main_key(room_id)
        if queue == "main"
        else room_queue_sugg_key(room_id)
    )
    items = await redis.lrange(key, 0, -1)
    return [_parse_queue_item(item) for item in items]


async def get_queues(redis: Redis, room_id: str) -> dict[str, list[dict[str, str]]]:
    return {
        "main": await get_queue(redis, room_id, "main"),
        "sugg": await get_queue(redis, room_id, "sugg"),
    }


async def add_to_queue(
    redis: Redis,
    room_id: str,
    queue: str,
    url: str,
    title: str | None,
) -> list[dict[str, str]]:
    key = (
        room_queue_main_key(room_id)
        if queue == "main"
        else room_queue_sugg_key(room_id)
    )
    await redis.rpush(key, _queue_item(url, title))
    return await get_queue(redis, room_id, queue)


async def remove_from_queue(
    redis: Redis, room_id: str, queue: str, index: int
) -> list[dict[str, str]]:
    key = (
        room_queue_main_key(room_id)
        if queue == "main"
        else room_queue_sugg_key(room_id)
    )
    placeholder = "__deleted__"
    await redis.lset(key, index, placeholder)
    await redis.lrem(key, 1, placeholder)
    return await get_queue(redis, room_id, queue)


async def reorder_main_queue(
    redis: Redis, room_id: str, items: list[dict[str, str]]
) -> list[dict[str, str]]:
    key = room_queue_main_key(room_id)
    await redis.delete(key)
    if items:
        await redis.rpush(key, *[_queue_item(i["url"], i.get("title")) for i in items])
    return await get_queue(redis, room_id, "main")


async def approve_suggestion(
    redis: Redis, room_id: str, index: int
) -> dict[str, list[dict[str, str]]]:
    sugg_key = room_queue_sugg_key(room_id)
    raw = await redis.lindex(sugg_key, index)
    if not raw:
        return await get_queues(redis, room_id)

    item = _parse_queue_item(raw)
    await remove_from_queue(redis, room_id, "sugg", index)
    await add_to_queue(redis, room_id, "main", item["url"], item.get("title"))
    return await get_queues(redis, room_id)


async def pop_next_main(redis: Redis, room_id: str) -> dict[str, str] | None:
    key = room_queue_main_key(room_id)
    raw = await redis.lpop(key)
    if not raw:
        return None
    return _parse_queue_item(raw)


async def cache_banned_user(redis: Redis, room_id: str, user_id: str) -> None:
    await redis.sadd(room_banned_key(room_id), user_id)


async def is_banned_in_redis(redis: Redis, room_id: str, user_id: str) -> bool:
    return bool(await redis.sismember(room_banned_key(room_id), user_id))


async def create_ws_session(
    redis: Redis,
    *,
    room_id: str,
    participant_id: str,
    display_name: str,
    role: str,
    is_admin: bool,
    is_guest: bool,
) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    payload = {
        "room_id": room_id,
        "participant_id": participant_id,
        "display_name": display_name,
        "role": role,
        "is_admin": is_admin,
        "is_guest": is_guest,
    }
    await redis.set(
        ws_session_key(token),
        json.dumps(payload, ensure_ascii=False),
        ex=settings.ws_session_ttl_seconds,
    )
    return token


async def get_ws_session(redis: Redis, token: str) -> dict[str, Any] | None:
    raw = await redis.get(ws_session_key(token))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def delete_ws_session(redis: Redis, token: str) -> None:
    await redis.delete(ws_session_key(token))
