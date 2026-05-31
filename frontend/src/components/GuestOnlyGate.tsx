import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminPath, profilePath } from "../lib/links";

type Props = {
  page: "login" | "register";
};

export default function GuestOnlyGate({ page, children }: Props & { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-fastwatch-muted">Загрузка...</p>;
  }

  if (user) {
    const pageLabel = page === "login" ? "входа" : "регистрации";
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-fastwatch-accent/30 bg-fastwatch-panel p-8 text-center shadow-xl">
          <p className="text-sm font-medium uppercase tracking-wide text-fastwatch-muted">
            Вы уже вошли
          </p>
          <h2 className="mt-2 text-2xl font-bold">{user.username}</h2>
          <p className="mt-3 text-sm text-fastwatch-muted">
            Страница {pageLabel} доступна только гостям. Выйдите из аккаунта или перейдите на главную.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="rounded-lg bg-fastwatch-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-fastwatch-accentDark"
            >
              На главную
            </Link>
            <Link
              to={profilePath(user.username)}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/5"
            >
              Мой профиль
            </Link>
            {user.is_global_admin && (
              <Link
                to={adminPath()}
                className="rounded-lg border border-amber-400/40 px-5 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/10"
              >
                Админ-панель
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return children;
}
