import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, guest, logout, enterAsGuest } = useAuth();

  return (
    <div className="min-h-screen bg-fastwatch-bg text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            FastWatch <span className="text-fastwatch-accent">| AbsoluteCinema</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link to="/" className="text-fastwatch-muted hover:text-white">
              Лобби
            </Link>
            {!user && (
              <>
                <Link to="/login" className="text-fastwatch-muted hover:text-white">
                  Вход
                </Link>
                <Link to="/register" className="text-fastwatch-muted hover:text-white">
                  Регистрация
                </Link>
              </>
            )}
            {!user && !guest && (
              <button
                type="button"
                onClick={() => enterAsGuest()}
                className="rounded-lg border border-white/20 px-3 py-1 hover:bg-white/5"
              >
                Как гость
              </button>
            )}
            {(user || guest) && (
              <span className="text-fastwatch-muted">
                {user ? user.username : guest?.display_name}
              </span>
            )}
            {user && (
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-lg bg-fastwatch-panel px-3 py-1 hover:bg-white/10"
              >
                Выйти
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
