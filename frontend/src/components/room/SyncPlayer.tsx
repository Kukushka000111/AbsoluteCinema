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

type RutubeMessage = {
  type?: string;
  data?: {
    state?: string;
    time?: number;
  };
};

const RUTUBE_HOSTS = new Set(["rutube.ru", "www.rutube.ru"]);

function getRutubeEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (!RUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) {return null;}

    const parts = parsed.pathname.split("/").filter(Boolean);
    const isEmbed = parts[0] === "play" && parts[1] === "embed" && parts[2];
    const isPublicVideo = (parts[0] === "video" || parts[0] === "shorts") && parts[1];
    const isPrivateVideo = parts[0] === "video" && parts[1] === "private" && parts[2];
    const videoId = isEmbed ? parts[2] : isPrivateVideo ? parts[2] : isPublicVideo ? parts[1] : "";

    if (!/^[a-zA-Z0-9_-]+$/.test(videoId)) {return null;}

    const privateAccessSuffix = isPrivateVideo && parsed.search ? "/" : "";
    return `https://rutube.ru/play/embed/${videoId}${privateAccessSuffix}${parsed.search}`;
  } catch {
    return null;
  }
}

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
  const rutubeRef = useRef<HTMLIFrameElement>(null);
  const rutubeTimeRef = useRef(0);
  const rutubeReadyRef = useRef(false);
  const [localPlaying, setLocalPlaying] = useState(playerState.is_playing);
  const [drift, setDrift] = useState(0);
  const seekingRef = useRef(false);

  const url = playerState.video_url || "";
  const rutubeEmbedUrl = getRutubeEmbedUrl(url);

  const sendRutubeCommand = useCallback((type: string, data: Record<string, unknown> = {}) => {
    rutubeRef.current?.contentWindow?.postMessage(JSON.stringify({ type, data }), "https://rutube.ru");
  }, []);

  const syncWithAdmin = useCallback(() => {
    if (isAdmin) return;
    const t = getEffectiveTime(playerState);
    seekingRef.current = true;
    if (rutubeEmbedUrl) {
      sendRutubeCommand("player:setCurrentTime", { time: t });
      sendRutubeCommand(playerState.is_playing ? "player:play" : "player:pause");
    } else {
      playerRef.current?.seekTo(t, "seconds");
    }
    setLocalPlaying(playerState.is_playing);
    setTimeout(() => {
      seekingRef.current = false;
    }, 300);
    onSyncRequest?.();
  }, [isAdmin, playerState, rutubeEmbedUrl, sendRutubeCommand, onSyncRequest]);

  useEffect(() => {
    if (isAdmin) {
      setLocalPlaying(playerState.is_playing);
    }
  }, [isAdmin, playerState.is_playing, playerState.updated_at]);

  useEffect(() => {
    rutubeTimeRef.current = 0;
    rutubeReadyRef.current = false;
  }, [rutubeEmbedUrl]);

  useEffect(() => {
    if (isAdmin) {return;}
    const target = getEffectiveTime(playerState);
    if (!url) {return;}
    seekingRef.current = true;
    if (rutubeEmbedUrl) {
      sendRutubeCommand("player:setCurrentTime", { time: target });
      sendRutubeCommand(playerState.is_playing ? "player:play" : "player:pause");
    } else {
      const player = playerRef.current;
      if (!player) {return;}
      player.seekTo(target, "seconds");
    }
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
    rutubeEmbedUrl,
    sendRutubeCommand,
    url,
  ]);

  useEffect(() => {
    if (!rutubeEmbedUrl) {return;}

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://rutube.ru") {return;}

      let message: RutubeMessage;
      try {
        message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (message.type === "player:ready") {
        rutubeReadyRef.current = true;
        const target = getEffectiveTime(playerState);
        sendRutubeCommand("player:setCurrentTime", { time: target });
        sendRutubeCommand((isAdmin ? localPlaying : playerState.is_playing) ? "player:play" : "player:pause");
        return;
      }

      if (message.type === "player:currentTime" && typeof message.data?.time === "number") {
        const prevTime = rutubeTimeRef.current;
        const newTime = message.data.time;
        rutubeTimeRef.current = newTime;
        
        if (!isAdmin && !seekingRef.current) {
          if (Math.abs(newTime - prevTime) > 2) {
            const adminTime = getEffectiveTime(playerState);
            if (Math.abs(newTime - adminTime) > 2) {
              syncWithAdmin();
            }
          }
        }
        return;
      }

      if (message.type === "player:playComplete") {
        if (isAdmin) {onEnded?.();}
        return;
      }

      if (message.type === "player:changeState") {
        if (seekingRef.current) return;

        if (isAdmin) {
          const currentTime = rutubeTimeRef.current;
          if (message.data?.state === "playing") {
            setLocalPlaying(true);
            onAdminPlay(currentTime);
          }
          if (message.data?.state === "paused") {
            setLocalPlaying(false);
            onAdminPause(currentTime);
          }
          if (message.data?.state === "stopped") {
            onAdminPause(currentTime);
          }
        } else {
          const isPlayingEvent = message.data?.state === "playing";
          if (isPlayingEvent !== playerState.is_playing) {
            syncWithAdmin();
          }
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    isAdmin,
    localPlaying,
    onAdminPause,
    onAdminPlay,
    onEnded,
    playerState,
    rutubeEmbedUrl,
    sendRutubeCommand,
    syncWithAdmin,
  ]);

  useEffect(() => {
    if (!isAdmin || !rutubeEmbedUrl || !rutubeReadyRef.current) {return;}
    sendRutubeCommand(localPlaying ? "player:play" : "player:pause");
  }, [isAdmin, localPlaying, rutubeEmbedUrl, sendRutubeCommand]);

  useEffect(() => {
    if (isAdmin) {return;}
    const id = window.setInterval(() => {
      const internal = rutubeEmbedUrl ? rutubeTimeRef.current : playerRef.current?.getCurrentTime() ?? 0;
      setDrift(getDriftSeconds(internal, playerState));
    }, 500);
    return () => window.clearInterval(id);
  }, [isAdmin, playerState, rutubeEmbedUrl]);

  const syncButtonClass =
    drift <= 1
      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
      : "border-yellow-400/60 bg-yellow-500/15 text-yellow-100 hover:bg-yellow-500/25";

  const handleProgress = useCallback(() => {
    if (isAdmin || seekingRef.current) {return;}
  }, [isAdmin]);

  return (
    <div className="flex h-full flex-col">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {rutubeEmbedUrl ? (
          <>
            <iframe
              key={rutubeEmbedUrl}
              ref={rutubeRef}
              src={rutubeEmbedUrl}
              title="RUTUBE video player"
              width="100%"
              height="100%"
              allow="clipboard-write; autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </>
        ) : url ? (
          <ReactPlayer
            key={url}
            ref={playerRef}
            url={url}
            width="100%"
            height="100%"
            playing={isAdmin ? localPlaying : playerState.is_playing}
            controls={true}
            onPlay={() => {
              if (isAdmin) {
                setLocalPlaying(true);
                onAdminPlay(playerRef.current?.getCurrentTime() ?? 0);
              } else {
                if (!playerState.is_playing) syncWithAdmin();
              }
            }}
            onPause={() => {
              if (isAdmin) {
                setLocalPlaying(false);
                onAdminPause(playerRef.current?.getCurrentTime() ?? 0);
              } else {
                if (playerState.is_playing) syncWithAdmin();
              }
            }}
            onSeek={(t) => {
              if (isAdmin) {
                onAdminSeek(t);
              } else {
                const adminTime = getEffectiveTime(playerState);
                if (Math.abs(t - adminTime) > 2) syncWithAdmin();
              }
            }}
            onProgress={handleProgress}
            onEnded={() => {
              if (isAdmin) {onEnded?.();}
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
          <button
            type="button"
            onClick={syncWithAdmin}
            className={`rounded-lg border px-3 py-1 transition ${syncButtonClass}`}
          >
            Синхронизироваться с админом
          </button>
        )}
      </div>
    </div>
  );
}