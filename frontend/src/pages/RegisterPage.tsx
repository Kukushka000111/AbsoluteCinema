import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-fastwatch-accent/20 bg-fastwatch-panel p-8 sm:p-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">Регистрация</h2>
            <p className="mt-2 text-fastwatch-muted">Создайте новый аккаунт</p>
          </div>
          <p className="text-sm text-fastwatch-muted bg-fastwatch-bg p-3 rounded-lg mb-6">
            💡 Имя: латиница и подчёркивание, мин. 3 символа. Пароль: мин. 6 символов.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Имя пользователя</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                pattern="[a-zA-Z0-9_]+"
                className="w-full rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3 focus:border-fastwatch-accent focus:outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                minLength={6}
                className="w-full rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3 focus:border-fastwatch-accent focus:outline-none transition"
                required
              />
            </div>
            {error && <p className="text-sm text-fastwatch-accent bg-fastwatch-accent/10 p-3 rounded-lg">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-fastwatch-accent hover:bg-fastwatch-accentDark disabled:opacity-50 py-3 font-bold text-white transition mt-6"
            >
              {loading ? "Загрузка..." : "Зарегистрироваться"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-fastwatch-muted">
            Уже есть аккаунт? <Link to="/login" className="text-fastwatch-accent hover:underline font-medium">Войдите</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
