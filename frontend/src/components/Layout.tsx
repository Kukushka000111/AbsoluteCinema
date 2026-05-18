import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, guest, logout, enterAsGuest } = useAuth();

  return (
    <div className="min-h-screen bg-fastwatch-bg text-white">
      <header className="border-b border-fastwatch-accent/20 bg-gradient-to-b from-fastwatch-panel to-fastwatch-bg px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-fastwatch-accent flex items-center justify-center font-bold text-white">B</div>
              <span className="font-bold tracking-tight hidden sm:inline">AbsoluteCinema</span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              {!user && !guest && (
                <>
                  <Link to="/login" className="text-fastwatch-muted hover:text-white transition">
                    Вход
                  </Link>
                  <Link to="/register" className="text-fastwatch-muted hover:text-white transition">
                    Регистрация
                  </Link>
                  <button
                    type="button"
                    onClick={() => enterAsGuest()}
                    className="rounded-lg border border-fastwatch-accent/30 px-3 py-1.5 text-fastwatch-muted hover:text-white hover:bg-fastwatch-accent/10 transition"
                  >
                    Как гость
                  </button>
                </>
              )}
              {(user || guest) && (
                <>
                  <span className="text-fastwatch-muted text-xs sm:text-sm">
                    {user ? user.username : guest?.display_name}
                  </span>
                  {user && (
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="rounded-lg bg-fastwatch-accent/80 hover:bg-fastwatch-accent px-3 py-1.5 text-xs sm:text-sm font-medium transition"
                    >
                      Выход
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
