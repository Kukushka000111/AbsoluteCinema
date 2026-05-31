import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  apiFetch,
  type ProfilePublic,
  type RoomPublic,
  type WatchHistoryEntry,
} from "../api/client";
import RoomCard from "../components/room/RoomCard";
import { formatDateTime, formatMemberSince, VISIBILITY_LABELS } from "../lib/profileFormat";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { joinRoomById } from "../lib/joinRoom";
import { editProfilePath, roomPath } from "../lib/links";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  const [myRooms, setMyRooms] = useState<RoomPublic[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!username) {return;}
    const data = await apiFetch<ProfilePublic>(`/profile/${encodeURIComponent(username)}`);
    setProfile(data);
    if (data.is_own_profile) {
      const [rooms, history] = await Promise.all([
        apiFetch<RoomPublic[]>("/rooms/mine"),
        apiFetch<WatchHistoryEntry[]>("/profile/me/watch-history"),
      ]);
      setMyRooms(rooms);
      setWatchHistory(history);
    } else {
      setMyRooms([]);
      setWatchHistory([]);
    }
  }, [username]);

  useEffect(() => {
    if (!username) {return;}
    setLoading(true);
    setError(null);
    loadProfile()
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Пользователь не найден");
        } else {
          setError(err instanceof Error ? err.message : "Ошибка загрузки профиля");
        }
      })
      .finally(() => setLoading(false));
  }, [loadProfile, username]);

  const handleFollow = async () => {
    if (!profile || !user) {
      navigate("/login");
      return;
    }
    setFollowLoading(true);
    try {
      const method = profile.is_following ? "DELETE" : "POST";
      const result = await apiFetch<{ is_following: boolean; followers_count: number }>(
        `/profile/${encodeURIComponent(profile.username)}/follow`,
        { method },
      );
      setProfile((prev) =>
        prev
          ? { ...prev, is_following: result.is_following, followers_count: result.followers_count }
          : prev,
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ошибка подписки", "error");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!profile || !user) {
      navigate("/login");
      return;
    }
    setBlockLoading(true);
    try {
      const method = profile.is_blocked ? "DELETE" : "POST";
      const result = await apiFetch<{ is_blocked: boolean }>(
        `/profile/${encodeURIComponent(profile.username)}/block`,
        { method },
      );
      setProfile((prev) => (prev ? { ...prev, is_blocked: result.is_blocked } : prev));
      toast(
        result.is_blocked
          ? `${profile.username} заблокирован — не сможет войти в ваши комнаты`
          : "Пользователь разблокирован",
        "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ошибка блокировки", "error");
    } finally {
      setBlockLoading(false);
    }
  };

  const handleJoin = async (roomId: string) => {
    try {
      await joinRoomById(roomId, Boolean(user));
      navigate(roomPath(roomId));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось войти в комнату", "error");
    }
  };

  if (loading) {
    return <p className="text-fastwatch-muted">Загрузка профиля...</p>;
  }

  if (error || !profile) {
    return (
      <div className="rounded-xl border border-white/10 bg-fastwatch-panel p-8 text-center">
        <p className="text-lg text-fastwatch-muted">{error ?? "Профиль недоступен"}</p>
        <Link to="/" className="mt-4 inline-block text-fastwatch-accent hover:underline">
          На главную
        </Link>
      </div>
    );
  }

  const hasLinks =
    profile.can_view_full &&
    (profile.links.telegram || profile.links.vk || profile.links.twitch);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-fastwatch-panel p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{profile.username}</h1>
            <p className="mt-1 text-sm text-fastwatch-muted">
              На сайте с {formatMemberSince(profile.created_at)}
            </p>
            <p className="mt-2 text-xs text-fastwatch-muted">
              {profile.followers_count} подписчиков · {profile.following_count} подписок
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.is_own_profile ? (
              <Link
                to={editProfilePath()}
                className="rounded-lg bg-fastwatch-accent px-4 py-2 text-sm font-medium text-white hover:bg-fastwatch-accentDark"
              >
                Редактировать
              </Link>
            ) : user ? (
              <>
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={handleFollow}
                  className="rounded-lg border border-fastwatch-accent/50 px-4 py-2 text-sm font-medium text-fastwatch-accent hover:bg-fastwatch-accent/10 disabled:opacity-50"
                >
                  {profile.is_following ? "Отписаться" : "Подписаться"}
                </button>
                <button
                  type="button"
                  disabled={blockLoading}
                  onClick={handleBlock}
                  className="rounded-lg border border-orange-400/40 px-4 py-2 text-sm font-medium text-orange-200 hover:bg-orange-400/10 disabled:opacity-50"
                >
                  {profile.is_blocked ? "Разблокировать" : "Заблокировать"}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {!profile.can_view_full && (
          <p className="mt-4 rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3 text-sm text-fastwatch-muted">
            {profile.profile_visibility === "hidden"
              ? "Профиль скрыт. Виден только ник."
              : "Полный профиль доступен только подписчикам."}
          </p>
        )}

        {profile.can_view_full && profile.bio && (
          <p className="mt-4 text-sm leading-relaxed text-white/90">{profile.bio}</p>
        )}

        {profile.can_view_full && profile.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-fastwatch-accent/20 px-3 py-1 text-xs font-medium text-fastwatch-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {profile.can_view_full && profile.watching_now && (
          <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-green-200/80">
              Сейчас смотрю
            </p>
            <Link
              to={roomPath(profile.watching_now.room_id)}
              className="mt-1 inline-block font-medium text-green-100 hover:underline"
            >
              {profile.watching_now.room_name}
            </Link>
          </div>
        )}

        {hasLinks && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.links.telegram && (
              <SocialLink href={profile.links.telegram} label="Telegram" />
            )}
            {profile.links.vk && <SocialLink href={profile.links.vk} label="VK" />}
            {profile.links.twitch && (
              <SocialLink href={profile.links.twitch} label="Twitch" />
            )}
          </div>
        )}
      </section>

      {profile.can_view_full && profile.recent_rooms.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Недавняя активность</h2>
          <ul className="space-y-2">
            {profile.recent_rooms.map((visit) => (
              <li
                key={`${visit.room_id}-${visit.visited_at}`}
                className="flex flex-col gap-1 rounded-lg border border-white/10 bg-fastwatch-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm">
                  Был в комнате{" "}
                  <Link to={roomPath(visit.room_id)} className="font-medium text-fastwatch-accent hover:underline">
                    {visit.room_name}
                  </Link>
                </span>
                <span className="text-xs text-fastwatch-muted">{formatDateTime(visit.visited_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.is_own_profile && myRooms.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Мои комнаты</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myRooms.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={handleJoin} showHistoryLink />
            ))}
          </div>
        </section>
      )}

      {profile.is_own_profile && watchHistory.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">История просмотров</h2>
          <p className="mb-4 text-sm text-fastwatch-muted">Только вы видите эту историю.</p>
          <ul className="space-y-2">
            {watchHistory.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-white/10 bg-fastwatch-panel px-4 py-3"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {entry.title || entry.video_url}
                    </p>
                    <p className="text-xs text-fastwatch-muted">
                      Комната:{" "}
                      <Link to={roomPath(entry.room_id)} className="text-fastwatch-accent hover:underline">
                        {entry.room_name}
                      </Link>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-fastwatch-muted">
                    {formatDateTime(entry.started_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.is_own_profile && (
        <p className="text-xs text-fastwatch-muted">
          Приватность профиля: {VISIBILITY_LABELS[profile.profile_visibility] ?? profile.profile_visibility}
        </p>
      )}
    </div>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-fastwatch-muted transition hover:border-fastwatch-accent/50 hover:text-white"
    >
      {label}
    </a>
  );
}
