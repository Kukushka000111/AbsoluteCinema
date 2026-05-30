import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-fastwatch-accent/20 bg-fastwatch-panel p-8 sm:p-10">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold">Вход</h2>
            <p className="mt-2 text-fastwatch-muted">Войдите в свой аккаунт</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Имя пользователя</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="username"
                className="w-full rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3 transition focus:border-fastwatch-accent focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Пароль</label>
              <div className="flex overflow-hidden rounded-lg border border-white/10 bg-fastwatch-bg focus-within:border-fastwatch-accent">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="w-12 border-l border-white/10 text-sm text-fastwatch-muted transition hover:bg-white/5 hover:text-white"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? "◌" : "◉"}
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-lg bg-fastwatch-accent/10 p-3 text-sm text-fastwatch-accent">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-fastwatch-accent py-3 font-bold text-white transition hover:bg-fastwatch-accentDark disabled:opacity-50"
            >
              {loading ? "Загрузка..." : "Войти"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-fastwatch-muted">
            Нет аккаунта?{" "}
            <Link to="/register" className="font-medium text-fastwatch-accent hover:underline">
              Зарегистрируйтесь
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
