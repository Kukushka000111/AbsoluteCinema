import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BannedOverlay from "./BannedOverlay";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { joinRoomById } from "../lib/joinRoom";
import { adminPath, editProfilePath, profilePath, roomPath } from "../lib/links";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, guest, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [roomId, setRoomId] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isRoomRoute = /^\/room\//.test(location.pathname);

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
      <header
        className={`border-b border-fastwatch-accent/20 bg-gradient-to-b from-fastwatch-panel to-fastwatch-bg px-3 sm:px-6 ${
          isRoomRoute ? "py-2 sm:py-3" : "py-4"
        }`}
      >
        <div className={`mx-auto ${isRoomRoute ? "max-w-full" : "max-w-7xl"}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <Link to="/" className="flex shrink-0 items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-fastwatch-accent text-xs font-bold text-white sm:h-8 sm:w-8 sm:text-sm">
                AC
              </div>
              <span className="hidden font-bold tracking-tight sm:inline">AbsoluteCinema</span>
            </Link>

            <div className="flex flex-1 flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-end">
              {!isRoomRoute && (
                <form onSubmit={joinById} className="flex min-w-0 gap-2 lg:w-[360px]">
                  <input
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="ID комнаты"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm font-mono focus:border-fastwatch-accent focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg bg-fastwatch-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-fastwatch-accentDark sm:px-4"
                  >
                    Найти
                  </button>
                </form>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs sm:gap-3 sm:text-sm">
                {!isRoomRoute && (
                  <Link to="/rooms" className="text-fastwatch-muted transition hover:text-white">
                    Открытые комнаты
                  </Link>
                )}
                {!user && !isRoomRoute && (
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
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white transition hover:border-fastwatch-accent/60 hover:bg-white/10 sm:px-3 sm:py-1.5 sm:text-sm"
                      aria-haspopup="menu"
                      aria-expanded={isUserMenuOpen}
                    >
                      <span className="max-w-[8rem] truncate sm:max-w-none">{user.username}</span>
                      <span className={`text-[10px] text-fastwatch-muted transition ${isUserMenuOpen ? "rotate-180" : ""}`}>
                        ▼
                      </span>
                    </button>

                    {isUserMenuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-white/10 bg-fastwatch-panel py-1 shadow-xl shadow-black/30"
                      >
                        <Link
                          to={profilePath(user.username)}
                          role="menuitem"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="block px-3 py-2 text-sm text-white transition hover:bg-white/5"
                        >
                          Мой профиль
                        </Link>
                        <Link
                          to={editProfilePath()}
                          role="menuitem"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="block px-3 py-2 text-sm text-white transition hover:bg-white/5"
                        >
                          Редактировать
                        </Link>
                        {user.is_global_admin && (
                          <Link
                            to={adminPath()}
                            role="menuitem"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="block px-3 py-2 text-sm text-amber-200 transition hover:bg-amber-500/10"
                          >
                            Админ-панель
                          </Link>
                        )}
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
      <main
        className={`mx-auto ${
          isRoomRoute
            ? "max-w-full px-2 py-2 sm:px-4 sm:py-3"
            : "max-w-7xl px-4 py-6 sm:px-6 sm:py-12"
        }`}
      >
        {children}
      </main>
      <BannedOverlay />
    </div>
  );
}
