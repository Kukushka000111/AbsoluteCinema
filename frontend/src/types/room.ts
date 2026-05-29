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

export interface ChatMessage {
  text: string;
  display_name: string;
  participant_id: string;
  sent_at: number;
}

export function getEffectiveTime(state: PlayerState): number {
  if (!state.is_playing) {return state.current_time;}
  return state.current_time + (Date.now() / 1000 - state.updated_at);
}

export function getDriftSeconds(local: number, state: PlayerState): number {
  return Math.abs(local - getEffectiveTime(state));
}
