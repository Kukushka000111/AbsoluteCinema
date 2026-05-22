import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { joinRoomById } from "../lib/joinRoom";
import { roomPath } from "../lib/links";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, guest, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");

  const joinById = async (e: FormEvent) => {
    e.preventDefault();
    const id = roomId.trim();
    if (!id) return;

    try {
      await joinRoomById(id, Boolean(user));
      setRoomId("");
      navigate(roomPath(id));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось войти в комнату", "error");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-fastwatch-bg text-white">
      <header className="border-b border-fastwatch-accent/20 bg-gradient-to-b from-fastwatch-panel to-fastwatch-bg px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-fastwatch-accent font-bold text-white">
                B
              </div>
              <span className="hidden font-bold tracking-tight sm:inline">AbsoluteCinema</span>
            </Link>

            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
              <form onSubmit={joinById} className="flex min-w-0 gap-2 lg:w-[360px]">
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="ID комнаты"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm font-mono focus:border-fastwatch-accent focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-fastwatch-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-fastwatch-accentDark"
                >
                  Найти
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link to="/rooms" className="text-fastwatch-muted transition hover:text-white">
                  Открытые комнаты
                </Link>
                {!user && (
                  <>
                    <Link to="/login" className="text-fastwatch-muted transition hover:text-white">
                      Вход
                    </Link>
                    <Link to="/register" className="text-fastwatch-muted transition hover:text-white">
                      Регистрация
                    </Link>
                  </>
                )}
                <span className="text-xs text-fastwatch-muted sm:text-sm">
                  {user ? user.username : guest?.display_name ?? "Гость"}
                </span>
                {user && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg bg-fastwatch-accent/80 px-3 py-1.5 text-xs font-medium transition hover:bg-fastwatch-accent sm:text-sm"
                  >
                    Выход
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
