import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  apiFetch,
  type AdminRoomUpdate,
  type GlobalBanItem,
  type RoomPublic,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { profilePath, roomPath } from "../lib/links";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [bans, setBans] = useState<GlobalBanItem[]>([]);
  const [rooms, setRooms] = useState<RoomPublic[]>([]);
  const [roomQuery, setRoomQuery] = useState("");
  const debouncedRoomQuery = useDebouncedValue(roomQuery);
  const [banUsername, setBanUsername] = useState("");
  const [banReason, setBanReason] = useState("");
  const [fetching, setFetching] = useState(true);
  const [banning, setBanning] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<RoomPublic | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);

  const [editTags, setEditTags] = useState("");

  const loadData = useCallback(async (q = "") => {
    const params = new URLSearchParams();
    if (q.trim()) {params.set("q", q.trim());}
    const [banList, roomList] = await Promise.all([
      apiFetch<GlobalBanItem[]>("/admin/bans"),
      apiFetch<RoomPublic[]>(`/admin/rooms?${params}`),
    ]);
    setBans(banList);
    setRooms(roomList);
  }, []);

  useEffect(() => {
    if (!user?.is_global_admin) {return;}
    setFetching(true);
    loadData(debouncedRoomQuery)
      .catch((err: Error) => toast(err.message, "error"))
      .finally(() => setFetching(false));
  }, [debouncedRoomQuery, loadData, toast, user?.is_global_admin]);

  if (loading) {
    return <p className="text-fastwatch-muted">Загрузка...</p>;
  }

  if (!user?.is_global_admin) {
    return <Navigate to="/" replace />;
  }

  const handleBan = async (e: FormEvent) => {
    e.preventDefault();
    const username = banUsername.trim();
    if (!username) {return;}

    setBanning(true);
    try {
      await apiFetch<GlobalBanItem>(`/admin/users/${encodeURIComponent(username)}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason: banReason.trim() || null }),
      });
      setBanUsername("");
      setBanReason("");
      toast(`Пользователь ${username} заблокирован`, "success");
      await loadData(debouncedRoomQuery);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось заблокировать", "error");
    } finally {
      setBanning(false);
    }
  };

  const handleUnban = async (username: string) => {
    try {
      await apiFetch(`/admin/users/${encodeURIComponent(username)}/ban`, {
        method: "DELETE",
      });
      toast(`Пользователь ${username} разблокирован`, "success");
      await loadData(debouncedRoomQuery);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось разблокировать", "error");
    }
  };

  const startEditRoom = (room: RoomPublic) => {
    setEditingRoomId(room.id);
    setEditName(room.name);
    setEditPrivate(room.is_private);
    setEditTags((room.tags ?? []).join(", "));
  };

  const cancelEditRoom = () => {
    setEditingRoomId(null);
  };

  const saveRoom = async (roomId: string) => {
    const tags = editTags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    const payload: AdminRoomUpdate = {
      name: editName.trim() || undefined,
      is_private: editPrivate,
      tags,
    };
    try {
      await apiFetch<RoomPublic>(`/admin/rooms/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast("Комната обновлена", "success");
      setEditingRoomId(null);
      await loadData(debouncedRoomQuery);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось обновить комнату", "error");
    }
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) {return;}
    setDeleting(true);
    try {
      await apiFetch(`/admin/rooms/${roomToDelete.id}`, { method: "DELETE" });
      toast("Комната закрыта", "success");
      setRoomToDelete(null);
      await loadData(debouncedRoomQuery);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось закрыть комнату", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <Link to="/" className="text-sm text-fastwatch-accent hover:underline">
          Назад в лобби
        </Link>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Администрирование</h1>
        <p className="mt-2 text-sm text-fastwatch-muted">
          Глобальная блокировка пользователей и управление любыми комнатами.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-fastwatch-panel p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Заблокировать пользователя</h2>
        <form onSubmit={handleBan} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={banUsername}
            onChange={(e) => setBanUsername(e.target.value)}
            placeholder="Username"
            className="rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm focus:border-fastwatch-accent focus:outline-none"
            required
          />
          <input
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Причина (необязательно)"
            className="rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm focus:border-fastwatch-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={banning}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {banning ? "..." : "Заблокировать"}
          </button>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-fastwatch-muted">Активные блокировки</h3>
          {fetching ? (
            <p className="mt-3 text-sm text-fastwatch-muted">Загрузка...</p>
          ) : bans.length === 0 ? (
            <p className="mt-3 text-sm text-fastwatch-muted">Нет заблокированных пользователей</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10 rounded-lg border border-white/10">
              {bans.map((ban) => (
                <li key={ban.user_id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link to={profilePath(ban.username)} className="font-medium text-fastwatch-accent hover:underline">
                      {ban.username}
                    </Link>
                    <p className="text-xs text-fastwatch-muted">
                      {ban.reason || "Без указания причины"}
                      {ban.banned_by_username ? ` · заблокировал ${ban.banned_by_username}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnban(ban.username)}
                    className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium transition hover:bg-white/5"
                  >
                    Разблокировать
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-fastwatch-panel p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold">Комнаты</h2>
          <input
            value={roomQuery}
            onChange={(e) => setRoomQuery(e.target.value)}
            placeholder="Поиск по названию"
            className="w-full rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm focus:border-fastwatch-accent focus:outline-none sm:max-w-xs"
          />
        </div>

        {fetching ? (
          <p className="mt-4 text-sm text-fastwatch-muted">Загрузка...</p>
        ) : rooms.length === 0 ? (
          <p className="mt-4 text-sm text-fastwatch-muted">Комнаты не найдены</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 rounded-lg border border-white/10">
            {rooms.map((room) => (
              <li key={room.id} className="px-4 py-4">
                {editingRoomId === room.id ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm focus:border-fastwatch-accent focus:outline-none"
                    />
                    <input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Теги: кино, музыка"
                      className="w-full rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm focus:border-fastwatch-accent focus:outline-none"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editPrivate}
                        onChange={(e) => setEditPrivate(e.target.checked)}
                      />
                      Скрытая комната
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveRoom(room.id)}
                        className="rounded-lg bg-fastwatch-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-fastwatch-accentDark"
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditRoom}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/5"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link to={roomPath(room.id)} className="font-medium hover:text-fastwatch-accent">
                        {room.name}
                      </Link>
                      <p className="text-xs text-fastwatch-muted">
                        {room.is_private ? "Скрытая" : "Открытая"} · админ {room.admin.username} · онлайн {room.online_count}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditRoom(room)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/5"
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoomToDelete(room)}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/10"
                      >
                        Закрыть
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-fastwatch-panel p-6">
            <h3 className="text-lg font-semibold">Закрыть комнату?</h3>
            <p className="mt-2 text-sm text-fastwatch-muted">
              Комната «{roomToDelete.name}» будет удалена без возможности восстановления.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteRoom}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "..." : "Закрыть"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
