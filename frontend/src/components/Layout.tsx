import { FormEvent, useEffect, useRef, useState } from "react";
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const joinById = async (e: FormEvent) => {
    e.preventDefault();
    const id = roomId.trim();
    if (!id) {return;}

    try {
      await joinRoomById(id, Boolean(user));
      setRoomId("");
      navigate(roomPath(id));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось войти в комнату", "error");
    }
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (!isUserMenuOpen) {return;}

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isUserMenuOpen]);

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
                {user ? (
                  <div ref={userMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsUserMenuOpen((open) => !open)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:border-fastwatch-accent/60 hover:bg-white/10 sm:text-sm"
                      aria-haspopup="menu"
                      aria-expanded={isUserMenuOpen}
                    >
                      <span>{user.username}</span>
                      <span className={`text-[10px] text-fastwatch-muted transition ${isUserMenuOpen ? "rotate-180" : ""}`}>
                        ▼
                      </span>
                    </button>

                    {isUserMenuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-white/10 bg-fastwatch-panel py-1 shadow-xl shadow-black/30"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className="block w-full px-3 py-2 text-left text-sm text-red-200 transition hover:bg-red-500/10 hover:text-red-100"
                        >
                          Выход
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-fastwatch-muted sm:text-sm">
                    {guest?.display_name ?? "Гость"}
                  </span>
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
