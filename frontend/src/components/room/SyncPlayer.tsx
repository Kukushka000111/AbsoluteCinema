import { useCallback, useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import type { PlayerState } from "../../types/room";
import { getDriftSeconds, getEffectiveTime } from "../../types/room";

type Props = {
  isAdmin: boolean;
  playerState: PlayerState;
  onAdminPlay: (t: number) => void;
  onAdminPause: (t: number) => void;
  onAdminSeek: (t: number) => void;
  onSyncRequest?: () => void;
  onEnded?: () => void;
};

export default function SyncPlayer({
  isAdmin,
  playerState,
  onAdminPlay,
  onAdminPause,
  onAdminSeek,
  onSyncRequest,
  onEnded,
}: Props) {
  const playerRef = useRef<ReactPlayer>(null);
  const [localPlaying, setLocalPlaying] = useState(playerState.is_playing);
  const [drift, setDrift] = useState(0);
  const seekingRef = useRef(false);

  const url = playerState.video_url || "";

  useEffect(() => {
    if (isAdmin) {
      setLocalPlaying(playerState.is_playing);
    }
  }, [isAdmin, playerState.is_playing, playerState.updated_at]);

  useEffect(() => {
    if (isAdmin) return;
    const target = getEffectiveTime(playerState);
    const player = playerRef.current;
    if (!player || !url) return;
    seekingRef.current = true;
    player.seekTo(target, "seconds");
    setLocalPlaying(playerState.is_playing);
    setTimeout(() => {
      seekingRef.current = false;
    }, 300);
  }, [
    isAdmin,
    playerState.updated_at,
    playerState.is_playing,
    playerState.current_time,
    playerState.video_url,
    url,
  ]);

  useEffect(() => {
    if (isAdmin) return;
    const id = window.setInterval(() => {
      const internal = playerRef.current?.getCurrentTime() ?? 0;
      setDrift(getDriftSeconds(internal, playerState));
    }, 500);
    return () => window.clearInterval(id);
  }, [isAdmin, playerState]);

  const driftColor =
    drift <= 2 ? "text-emerald-400" : "text-yellow-400";

  const handleProgress = useCallback(() => {
    if (isAdmin || seekingRef.current) return;
  }, [isAdmin]);

  return (
    <div className="flex h-full flex-col">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {url ? (
          <ReactPlayer
            key={url}
            ref={playerRef}
            url={url}
            width="100%"
            height="100%"
            playing={isAdmin ? localPlaying : playerState.is_playing}
            controls={isAdmin}
            onPlay={() => {
              if (!isAdmin) return;
              setLocalPlaying(true);
              onAdminPlay(playerRef.current?.getCurrentTime() ?? 0);
            }}
            onPause={() => {
              if (!isAdmin) return;
              setLocalPlaying(false);
              onAdminPause(playerRef.current?.getCurrentTime() ?? 0);
            }}
            onSeek={(t) => {
              if (!isAdmin) return;
              onAdminSeek(t);
            }}
            onProgress={handleProgress}
            onEnded={() => {
              if (isAdmin) onEnded?.();
            }}
            config={{ youtube: { playerVars: { modestbranding: 1 } } }}
          />
        ) : (
          <div className="flex h-full min-h-[280px] items-center justify-center text-fastwatch-muted">
            {isAdmin ? "Добавьте видео в плейлист или укажите URL" : "Ожидание видео от админа"}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {!isAdmin && (
          <>
            <span className={driftColor}>
              Рассинхрон: {drift.toFixed(1)} с {drift <= 2 ? "✓" : "!"}
            </span>
            <button
              type="button"
              onClick={() => {
                const t = getEffectiveTime(playerState);
                seekingRef.current = true;
                playerRef.current?.seekTo(t, "seconds");
                setLocalPlaying(playerState.is_playing);
                setTimeout(() => {
                  seekingRef.current = false;
                }, 300);
                onSyncRequest?.();
              }}
              className="rounded-lg border border-white/20 px-3 py-1 hover:bg-white/5"
            >
              Синхронизироваться с админом
            </button>
          </>
        )}
        {isAdmin && (
          <span className="text-fastwatch-muted">Вы управляете воспроизведением для всех</span>
        )}
      </div>
    </div>
  );
}
