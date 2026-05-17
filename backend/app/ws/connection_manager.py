from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, participant_id: str, websocket: WebSocket) -> None:
        self._connections.setdefault(room_id, {})[participant_id] = websocket

    async def disconnect(self, room_id: str, participant_id: str) -> None:
        room = self._connections.get(room_id)
        if not room:
            return
        room.pop(participant_id, None)
        if not room:
            self._connections.pop(room_id, None)

    def get(self, room_id: str, participant_id: str) -> WebSocket | None:
        return self._connections.get(room_id, {}).get(participant_id)

    def room_participant_ids(self, room_id: str) -> list[str]:
        return list(self._connections.get(room_id, {}).keys())

    async def send_json(self, room_id: str, participant_id: str, data: dict) -> None:
        ws = self.get(room_id, participant_id)
        if ws is not None:
            await ws.send_json(data)

    async def broadcast(
        self,
        room_id: str,
        data: dict,
        *,
        exclude: str | None = None,
    ) -> None:
        for pid, ws in list(self._connections.get(room_id, {}).items()):
            if exclude and pid == exclude:
                continue
            try:
                await ws.send_json(data)
            except Exception:
                pass

    async def close_participant(
        self,
        room_id: str,
        participant_id: str,
        *,
        code: int = 4000,
        reason: str = "kicked",
    ) -> None:
        ws = self.get(room_id, participant_id)
        if ws is not None:
            try:
                await ws.close(code=code, reason=reason)
            except Exception:
                pass
        await self.disconnect(room_id, participant_id)


manager = ConnectionManager()
