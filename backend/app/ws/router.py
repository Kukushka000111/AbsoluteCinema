from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.redis_client import get_redis
from app.services.redis_room_service import (
    get_ws_session,
    hydrate_room_redis,
    is_banned_in_redis,
    remove_participant,
)
from app.ws.connection_manager import manager
from app.ws.handlers import (
    WsHandlerContext,
    _broadcast_participants,
    handle_message,
    send_initial_state,
)

router = APIRouter()


@router.websocket("/ws/rooms/{room_id}")
async def room_websocket(websocket: WebSocket, room_id: str, token: str | None = None) -> None:
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="missing_token")
        return

    redis = get_redis()
    session = await get_ws_session(redis, token)
    if session is None or session.get("room_id") != room_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="invalid_token")
        return

    participant_id = session["participant_id"]
    if not session.get("is_guest") and await is_banned_in_redis(redis, room_id, participant_id):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="banned")
        return

    await hydrate_room_redis(redis, room_id)
    await websocket.accept()
    await manager.connect(room_id, participant_id, websocket)

    ctx = WsHandlerContext(session, room_id, websocket)

    try:
        await send_initial_state(ctx)
        while True:
            data = await websocket.receive_json()
            await handle_message(ctx, data)
    except WebSocketDisconnect:
        pass
    finally:
        await remove_participant(redis, room_id, participant_id)
        await manager.disconnect(room_id, participant_id)
        await _broadcast_participants(room_id)
