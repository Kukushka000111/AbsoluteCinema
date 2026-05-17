import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-2xl font-semibold">Регистрация</h2>
      <p className="mt-1 text-sm text-fastwatch-muted">
        Латиница, цифры и подчёркивание. Минимум 6 символов в пароле.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Имя пользователя"
          pattern="[a-zA-Z0-9_]+"
          className="w-full rounded-lg border border-white/10 bg-fastwatch-panel px-4 py-2"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          minLength={6}
          className="w-full rounded-lg border border-white/10 bg-fastwatch-panel px-4 py-2"
          required
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-fastwatch-accent py-2 font-medium hover:opacity-90"
        >
          Зарегистрироваться
        </button>
      </form>
      <p className="mt-4 text-sm text-fastwatch-muted">
        Уже есть аккаунт? <Link to="/login" className="text-fastwatch-accent">Вход</Link>
      </p>
    </div>
  );
}
