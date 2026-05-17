import type { JoinRoomResponse } from "../api/client";
import type { RoomSession } from "../types/room";

const key = (roomId: string) => `fastwatch_room_${roomId}`;

export function saveRoomSession(roomId: string, join: JoinRoomResponse): RoomSession {
  const session: RoomSession = {
    roomId,
    participantId: join.participant_id,
    displayName: join.display_name,
    isAdmin: join.is_admin,
    isGuest: join.is_guest,
    wsToken: join.ws_token,
    playerState: join.player_state,
  };
  sessionStorage.setItem(key(roomId), JSON.stringify(session));
  return session;
}

export function loadRoomSession(roomId: string): RoomSession | null {
  const raw = sessionStorage.getItem(key(roomId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomSession;
  } catch {
    return null;
  }
}

export function updateRoomSessionPlayer(roomId: string, playerState: RoomSession["playerState"]) {
  const s = loadRoomSession(roomId);
  if (!s) return;
  s.playerState = playerState;
  sessionStorage.setItem(key(roomId), JSON.stringify(s));
}
