import { useAuth } from "../context/AuthContext";

export default function BannedOverlay() {
  const { user, logout } = useAuth();

  if (!user?.is_globally_banned) {
    return null;
  }

  const reason = user.global_ban_reason?.trim() || "Обратитесь к администрации сайта.";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-fastwatch-bg p-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-fastwatch-panel p-8 text-center shadow-2xl shadow-red-900/20">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl">
          ⛔
        </div>
        <h1 className="text-2xl font-bold text-red-100">Аккаунт заблокирован</h1>
        <p className="mt-3 text-sm text-fastwatch-muted">
          Доступ к сайту ограничен. Вы не можете создавать комнаты, участвовать в просмотрах
          и выполнять другие действия.
        </p>
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {reason}
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-6 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
