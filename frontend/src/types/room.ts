export interface PlayerState {
  video_url: string;
  is_playing: boolean;
  current_time: number;
  updated_at: number;
}

export interface QueueItem {
  url: string;
  title: string;
}

export interface Participant {
  id: string;
  display_name: string;
  role: string;
  is_guest: boolean;
  username?: string;
  is_muted?: boolean;
}

export interface RoomSession {
  roomId: string;
  participantId: string;
  displayName: string;
  isAdmin: boolean;
  isGuest: boolean;
  wsToken: string;
  playerState: PlayerState;
}

export interface UserChatMessage {
  kind: "user";
  text: string;
  display_name: string;
  participant_id: string;
  username?: string;
  sent_at: number;
}

export interface SystemChatMessage {
  kind: "system";
  text: string;
  event?: string;
  sent_at: number;
}

export type ChatMessage = UserChatMessage | SystemChatMessage;

export function parseChatHistory(items: unknown[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") {continue;}
    const item = raw as Record<string, unknown>;
    const sentAt = Number(item.sent_at ?? 0);
    if (item.kind === "system") {
      result.push({
        kind: "system",
        text: String(item.text ?? ""),
        event: item.event ? String(item.event) : undefined,
        sent_at: sentAt,
      });
      continue;
    }
    result.push({
      kind: "user",
      text: String(item.text ?? ""),
      display_name: String(item.display_name ?? ""),
      participant_id: String(item.participant_id ?? ""),
      username: item.username ? String(item.username) : undefined,
      sent_at: sentAt,
    });
  }
  return result;
}

export function getEffectiveTime(state: PlayerState): number {
  if (!state.is_playing) {return state.current_time;}
  return state.current_time + (Date.now() / 1000 - state.updated_at);
}

export function getDriftSeconds(local: number, state: PlayerState): number {
  return Math.abs(local - getEffectiveTime(state));
}
