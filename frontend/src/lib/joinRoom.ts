import {
  apiFetch,
  ensureGuestSession,
  loadGuestSession,
  type JoinRoomResponse,
} from "../api/client";
import { saveRoomSession } from "./roomSession";

export async function joinRoomById(roomId: string, authenticated: boolean): Promise<void> {
  const id = roomId.trim();
  if (!id) {return;}

  const guest = authenticated ? null : loadGuestSession() ?? (await ensureGuestSession());
  const join = await apiFetch<JoinRoomResponse>(`/rooms/${id}/join`, {
    method: "POST",
    body: JSON.stringify(
      guest
        ? { guest_id: guest.guest_id, guest_display_name: guest.display_name }
        : {},
    ),
  });
  saveRoomSession(id, join);
}
