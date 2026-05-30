import time
from typing import Any

from fastapi import WebSocket

from app.core.redis_client import get_redis
from app.services.redis_room_service import (
    add_to_queue,
    append_chat_message,
    approve_suggestion,
    get_chat_history,
    get_player_state,
    get_queues,
    is_banned_in_redis,
    is_participant_muted,
    list_participants,
    mute_participant,
    pop_next_main,
    publish_room_event,
    remove_from_queue,
    remove_participant,
    reorder_main_queue,
    set_player_state,
    unmute_participant,
)
from app.ws import messages as M
from app.ws.connection_manager import manager
from app.ws.internal_client import persist_ban, record_video_history


class WsHandlerContext:
    def __init__(self, session: dict[str, Any], room_id: str, websocket: WebSocket):
        self.session = session
        self.room_id = room_id
        self.websocket = websocket
        self.participant_id: str = session["participant_id"]
        self.display_name: str = session["display_name"]
        self.is_admin: bool = bool(session.get("is_admin"))
        self.is_guest: bool = bool(session.get("is_guest"))
        self.username: str | None = session.get("username")


async def _broadcast(
    room_id: str, msg_type: str, payload: dict, *, sender_id: str | None = None
) -> None:
    redis = get_redis()
    message = {"type": msg_type, "payload": payload, "sender_id": sender_id}
    await publish_room_event(redis, room_id, message)


async def broadcast_system(
    room_id: str,
    text: str,
    *,
    event: str | None = None,
    actor_display_name: str | None = None,
) -> None:
    payload = {
        "text": text,
        "event": event,
        "actor_display_name": actor_display_name,
        "sent_at": time.time(),
    }
    redis = get_redis()
    await append_chat_message(redis, room_id, {"kind": "system", **payload})
    await _broadcast(room_id, M.SYSTEM_MESSAGE, payload)


async def broadcast_room_update(
    room_id: str,
    *,
    name: str,
    is_private: bool,
    tags: list[str],
) -> None:
    await _broadcast(
        room_id,
        M.ROOM_UPDATE,
        {"name": name, "is_private": is_private, "tags": tags},
    )


async def _send_error(ctx: WsHandlerContext, detail: str) -> None:
    await ctx.websocket.send_json({"type": M.ERROR, "payload": {"detail": detail}})


async def _broadcast_participants(room_id: str) -> None:
    redis = get_redis()
    participants = await list_participants(redis, room_id)
    await _broadcast(room_id, M.PARTICIPANTS_UPDATE, {"participants": participants})


async def handle_player_state(ctx: WsHandlerContext, payload: dict[str, Any]) -> None:
    if not ctx.is_admin:
        await _send_error(ctx, "Только админ управляет плеером")
        return

    redis = get_redis()
    action = payload.get("action", "")
    current = await get_player_state(redis, ctx.room_id)
    prev_url = current.get("video_url", "")

    if action == M.ACTION_PLAY:
        state = await set_player_state(
            redis,
            ctx.room_id,
            is_playing=True,
            current_time=float(payload.get("current_time", current["current_time"])),
        )
    elif action == M.ACTION_PAUSE:
        state = await set_player_state(
            redis,
            ctx.room_id,
            is_playing=False,
            current_time=float(payload.get("current_time", current["current_time"])),
        )
    elif action == M.ACTION_SEEK:
        state = await set_player_state(
            redis,
            ctx.room_id,
            current_time=float(payload.get("current_time", 0)),
            is_playing=current.get("is_playing", False),
        )
    elif action == M.ACTION_SET_VIDEO:
        url = str(payload.get("video_url", "")).strip()
        title = payload.get("title")
        state = await set_player_state(
            redis,
            ctx.room_id,
            video_url=url,
            is_playing=True,
            current_time=0.0,
        )
        if url and url != prev_url:
            title_str = str(title).strip() if title else ""
            label = title_str or url
            await broadcast_system(
                ctx.room_id,
                f"{ctx.display_name} изменил видео на «{label}»",
                event="video_changed",
                actor_display_name=ctx.display_name,
            )
            await record_video_history(ctx.room_id, url, title)
    elif action == M.ACTION_GATHER_ALL:
        state = await set_player_state(
            redis,
            ctx.room_id,
            is_playing=current.get("is_playing", False),
            current_time=float(payload.get("current_time", current["current_time"])),
        )
    else:
        await _send_error(ctx, f"Неизвестное действие плеера: {action}")
        return

    await _broadcast(
        ctx.room_id,
        M.PLAYER_STATE,
        {"action": action, **state},
        sender_id=ctx.participant_id,
    )


async def handle_chat(ctx: WsHandlerContext, payload: dict[str, Any]) -> None:
    redis = get_redis()
    if await is_participant_muted(redis, ctx.room_id, ctx.participant_id):
        await _send_error(ctx, "Вы замучены и не можете писать в чат")
        return

    text = str(payload.get("text", "")).strip()
    if not text or len(text) > 2000:
        await _send_error(ctx, "Пустое или слишком длинное сообщение")
        return

    message_payload: dict[str, Any] = {
        "text": text,
        "display_name": ctx.display_name,
        "participant_id": ctx.participant_id,
        "sent_at": time.time(),
    }
    if ctx.username:
        message_payload["username"] = ctx.username

    await append_chat_message(redis, ctx.room_id, {"kind": "user", **message_payload})

    await _broadcast(
        ctx.room_id,
        M.CHAT_MESSAGE,
        message_payload,
        sender_id=ctx.participant_id,
    )


async def handle_queue(ctx: WsHandlerContext, payload: dict[str, Any]) -> None:
    redis = get_redis()
    action = payload.get("action", "")

    if action == M.QUEUE_ADD_SUGG:
        if ctx.is_admin:
            await _send_error(ctx, "Админ добавляет в основной плейлист")
            return
        url = str(payload.get("url", "")).strip()
        if not url:
            await _send_error(ctx, "URL обязателен")
            return
        await add_to_queue(redis, ctx.room_id, "sugg", url, payload.get("title"))
    elif action == M.QUEUE_ADD_MAIN:
        if not ctx.is_admin:
            await _send_error(ctx, "Только админ")
            return
        url = str(payload.get("url", "")).strip()
        if not url:
            await _send_error(ctx, "URL обязателен")
            return
        await add_to_queue(redis, ctx.room_id, "main", url, payload.get("title"))
    elif action == M.QUEUE_APPROVE:
        if not ctx.is_admin:
            await _send_error(ctx, "Только админ")
            return
        await approve_suggestion(redis, ctx.room_id, int(payload.get("index", 0)))
    elif action == M.QUEUE_REMOVE:
        if not ctx.is_admin:
            await _send_error(ctx, "Только админ")
            return
        queue = payload.get("queue", "main")
        if queue not in {"main", "sugg"}:
            await _send_error(ctx, "Некорректная очередь")
            return
        await remove_from_queue(redis, ctx.room_id, queue, int(payload.get("index", 0)))
    elif action == M.QUEUE_REORDER_MAIN:
        if not ctx.is_admin:
            await _send_error(ctx, "Только админ")
            return
        items = payload.get("items", [])
        await reorder_main_queue(redis, ctx.room_id, items)
    else:
        await _send_error(ctx, f"Неизвестное действие очереди: {action}")
        return

    queues = await get_queues(redis, ctx.room_id)
    await _broadcast(
        ctx.room_id,
        M.QUEUE_UPDATE,
        {"queues": queues},
        sender_id=ctx.participant_id,
    )


async def handle_moderation(ctx: WsHandlerContext, payload: dict[str, Any]) -> None:
    if not ctx.is_admin:
        await _send_error(ctx, "Только админ")
        return

    redis = get_redis()
    action = payload.get("action", "")
    target_id = str(payload.get("target_id", ""))

    if action == M.MOD_GATHER_ALL:
        current = await get_player_state(redis, ctx.room_id)
        state = await set_player_state(
            redis,
            ctx.room_id,
            is_playing=current.get("is_playing", False),
            current_time=float(payload.get("current_time", current["current_time"])),
        )
        await _broadcast(
            ctx.room_id,
            M.PLAYER_STATE,
            {"action": M.ACTION_GATHER_ALL, **state},
            sender_id=ctx.participant_id,
        )
        return

    if not target_id:
        await _send_error(ctx, "target_id обязателен")
        return

    if action == M.MOD_KICK:
        participants = await list_participants(redis, ctx.room_id)
        target = next((p for p in participants if p.get("id") == target_id), None)
        target_name = target.get("display_name", "Участник") if target else "Участник"
        await remove_participant(redis, ctx.room_id, target_id)
        await manager.send_json(
            ctx.room_id,
            target_id,
            {"type": M.KICKED, "payload": {"reason": "kicked_by_admin"}},
        )
        await manager.close_participant(ctx.room_id, target_id, reason="kicked")
        await broadcast_system(
            ctx.room_id,
            f"{ctx.display_name} исключил {target_name} из комнаты",
            event="user_kicked",
            actor_display_name=ctx.display_name,
        )
        await _broadcast_participants(ctx.room_id)
        return

    if action == M.MOD_BAN:
        participants = await list_participants(redis, ctx.room_id)
        target = next((p for p in participants if p.get("id") == target_id), None)
        if target is None:
            await _send_error(ctx, "Участник не найден")
            return
        if target.get("is_guest"):
            await _send_error(ctx, "Гостей нельзя банить по user_id — используйте кик")
            return

        ok = await persist_ban(ctx.room_id, target_id)
        if not ok:
            await _send_error(ctx, "Не удалось сохранить бан")
            return

        target_name = target.get("display_name", "Участник")
        await remove_participant(redis, ctx.room_id, target_id)
        await manager.send_json(
            ctx.room_id,
            target_id,
            {"type": M.BANNED, "payload": {"reason": "banned_by_admin"}},
        )
        await manager.close_participant(ctx.room_id, target_id, reason="banned")
        await broadcast_system(
            ctx.room_id,
            f"{ctx.display_name} забанил {target_name} в комнате",
            event="user_banned",
            actor_display_name=ctx.display_name,
        )
        await _broadcast_participants(ctx.room_id)
        return

    if action == M.MOD_MUTE:
        participants = await list_participants(redis, ctx.room_id)
        target = next((p for p in participants if p.get("id") == target_id), None)
        if target is None:
            await _send_error(ctx, "Участник не найден")
            return
        await mute_participant(redis, ctx.room_id, target_id)
        target_name = target.get("display_name", "Участник")
        await broadcast_system(
            ctx.room_id,
            f"{ctx.display_name} замутил {target_name}",
            event="user_muted",
            actor_display_name=ctx.display_name,
        )
        await _broadcast_participants(ctx.room_id)
        return

    if action == M.MOD_UNMUTE:
        await unmute_participant(redis, ctx.room_id, target_id)
        await _broadcast_participants(ctx.room_id)
        return

    await _send_error(ctx, f"Неизвестное действие модерации: {action}")


async def handle_message(ctx: WsHandlerContext, data: dict[str, Any]) -> None:
    msg_type = data.get("type")
    payload = data.get("payload") or {}

    if msg_type == M.PLAYER_STATE:
        await handle_player_state(ctx, payload)
    elif msg_type == M.CHAT_MESSAGE:
        await handle_chat(ctx, payload)
    elif msg_type == M.QUEUE_UPDATE:
        await handle_queue(ctx, payload)
    elif msg_type == M.ROOM_MODERATION:
        await handle_moderation(ctx, payload)
    else:
        await _send_error(ctx, f"Неизвестный тип сообщения: {msg_type}")


async def send_initial_state(ctx: WsHandlerContext) -> None:
    redis = get_redis()
    state = await get_player_state(redis, ctx.room_id)
    queues = await get_queues(redis, ctx.room_id)
    participants = await list_participants(redis, ctx.room_id)
    chat_history = await get_chat_history(redis, ctx.room_id)

    await ctx.websocket.send_json(
        {
            "type": M.CONNECTED,
            "payload": {
                "room_id": ctx.room_id,
                "participant_id": ctx.participant_id,
                "display_name": ctx.display_name,
                "is_admin": ctx.is_admin,
                "player_state": state,
                "queues": queues,
                "participants": participants,
                "chat_history": chat_history,
            },
        }
    )


async def send_sync_signal(room_id: str) -> None:
    redis = get_redis()
    state = await get_player_state(redis, room_id)
    await _broadcast(
        room_id,
        M.PLAYER_STATE,
        {"action": M.ACTION_GATHER_ALL, **state},
    )
