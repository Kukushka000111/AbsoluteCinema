from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, dict[str, set[WebSocket]]] = {}

    async def connect(self, room_id: str, participant_id: str, websocket: WebSocket) -> None:
        room = self._connections.setdefault(room_id, {})
        room.setdefault(participant_id, set()).add(websocket)

    async def disconnect(
        self,
        room_id: str,
        participant_id: str,
        websocket: WebSocket | None = None,
    ) -> None:
        room = self._connections.get(room_id)
        if not room:
            return
        sockets = room.get(participant_id)
        if not sockets:
            return
        if websocket is None:
            room.pop(participant_id, None)
        else:
            sockets.discard(websocket)
            if not sockets:
                room.pop(participant_id, None)
        if not room:
            self._connections.pop(room_id, None)

    def has_participant(self, room_id: str, participant_id: str) -> bool:
        return bool(self._connections.get(room_id, {}).get(participant_id))

    def get(self, room_id: str, participant_id: str) -> set[WebSocket]:
        return set(self._connections.get(room_id, {}).get(participant_id, set()))

    def room_participant_ids(self, room_id: str) -> list[str]:
        return list(self._connections.get(room_id, {}).keys())

    async def send_json(self, room_id: str, participant_id: str, data: dict) -> None:
        for ws in self.get(room_id, participant_id):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    async def broadcast(
        self,
        room_id: str,
        data: dict,
        *,
        exclude: str | None = None,
    ) -> None:
        for pid, sockets in list(self._connections.get(room_id, {}).items()):
            if exclude and pid == exclude:
                continue
            for ws in list(sockets):
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
        for ws in self.get(room_id, participant_id):
            try:
                await ws.close(code=code, reason=reason)
            except Exception:
                pass
        await self.disconnect(room_id, participant_id)


manager = ConnectionManager()
