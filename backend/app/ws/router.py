import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.redis_client import get_redis
from app.services.profile_service import clear_user_presence, set_user_presence
from app.services.redis_room_service import (
    add_participant,
    get_ws_session,
    hydrate_room_redis,
    is_banned_in_redis,
    remove_participant,
)
from app.ws.connection_manager import manager
from app.ws.handlers import (
    WsHandlerContext,
    _broadcast_participants,
    broadcast_system,
    handle_message,
    send_initial_state,
    send_sync_signal,
)
from app.ws.internal_client import record_room_visit

router = APIRouter()


@router.websocket("/ws/rooms/{room_id}")
async def room_websocket(
    websocket: WebSocket, room_id: str, token: str | None = None
) -> None:
    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION, reason="missing_token"
        )
        return

    redis = get_redis()
    session = await get_ws_session(redis, token)
    if session is None or session.get("room_id") != room_id:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION, reason="invalid_token"
        )
        return

    participant_id = session["participant_id"]
    if not session.get("is_guest") and await is_banned_in_redis(
        redis, room_id, participant_id
    ):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="banned")
        return

    await hydrate_room_redis(redis, room_id)
    await websocket.accept()
    await add_participant(
        redis,
        room_id,
        participant_id,
        session["display_name"],
        role=session["role"],
        is_guest=bool(session.get("is_guest")),
        username=session.get("username"),
    )
    await manager.connect(room_id, participant_id, websocket)

    ctx = WsHandlerContext(session, room_id, websocket)

    room_name = str(session.get("room_name") or room_id)
    if not session.get("is_guest"):
        try:
            user_uuid = uuid.UUID(participant_id)
            await set_user_presence(
                redis,
                user_uuid,
                room_id=room_id,
                room_name=room_name,
            )
            await record_room_visit(participant_id, room_id)
        except ValueError:
            pass

    try:
        await send_initial_state(ctx)
        await broadcast_system(
            room_id,
            f"{session['display_name']} присоединился к комнате",
            event="user_joined",
            actor_display_name=session["display_name"],
        )
        await _broadcast_participants(room_id)
        await send_sync_signal(room_id)
        while True:
            data = await websocket.receive_json()
            await handle_message(ctx, data)
    except WebSocketDisconnect:
        pass
    finally:
        display_name = session.get("display_name", "Участник")
        if not session.get("is_guest"):
            try:
                await clear_user_presence(redis, uuid.UUID(participant_id))
            except ValueError:
                pass
        await manager.disconnect(room_id, participant_id, websocket)
        if not manager.has_participant(room_id, participant_id):
            await remove_participant(redis, room_id, participant_id)
            await broadcast_system(
                room_id,
                f"{display_name} покинул комнату",
                event="user_left",
                actor_display_name=display_name,
            )
            await _broadcast_participants(room_id)
