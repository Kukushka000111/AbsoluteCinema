import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, type AuthAvailability } from "../api/client";
import GuestOnlyGate from "../components/GuestOnlyGate";
import { useAuth } from "../context/AuthContext";

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [availability, setAvailability] = useState<AuthAvailability | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const usernameLocalError = useMemo(() => {
    const value = username.trim();
    if (!value) {return null;}
    if (value.length < 3) {return "Минимум 3 символа";}
    if (!USERNAME_RE.test(value)) {return "Только латиница, цифры и _";}
    return null;
  }, [username]);

  const emailLocalError = useMemo(() => {
    const value = email.trim();
    if (!value) {return null;}
    if (!EMAIL_RE.test(value)) {return "Некорректная почта";}
    return null;
  }, [email]);

  useEffect(() => {
    const usernameReady = username.trim() && !usernameLocalError;
    const emailReady = email.trim() && !emailLocalError;

    setAvailability(null);
    if (!usernameReady && !emailReady) {return;}

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (usernameReady) {params.set("username", username.trim());}
      if (emailReady) {params.set("email", email.trim());}

      setChecking(true);
      apiFetch<AuthAvailability>(`/auth/availability?${params}`, {
        signal: controller.signal,
      })
        .then(setAvailability)
        .catch((err) => {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            setError(err instanceof Error ? err.message : "Не удалось проверить данные");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {setChecking(false);}
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [username, email, usernameLocalError, emailLocalError]);

  const usernameError =
    usernameLocalError ||
    availability?.username_message ||
    null;
  const emailError = emailLocalError || availability?.email_message || null;
  const passwordError =
    password && password.length < 6 ? "Минимум 6 символов" : null;
  const repeatError =
    passwordRepeat && password !== passwordRepeat ? "Пароли не совпадают" : null;

  const canSubmit =
    username.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    password === passwordRepeat &&
    !usernameError &&
    !emailError &&
    !checking &&
    !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {return;}
    setError(null);
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GuestOnlyGate page="register">
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-fastwatch-accent/20 bg-fastwatch-panel p-8 sm:p-10">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold">Регистрация</h2>
            <p className="mt-2 text-fastwatch-muted">Создайте аккаунт</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <FieldErrorInput
              label="Логин"
              value={username}
              onChange={setUsername}
              placeholder="username"
              error={username ? usernameError : null}
              success={Boolean(username && !usernameError && availability)}
              autoComplete="username"
            />

            <FieldErrorInput
              label="Почта"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="mail@example.com"
              error={email ? emailError : null}
              success={Boolean(email && !emailError && availability)}
              autoComplete="email"
            />

            <PasswordInput
              label="Пароль"
              value={password}
              onChange={setPassword}
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              error={passwordError}
              autoComplete="new-password"
            />

            <PasswordInput
              label="Повтор пароля"
              value={passwordRepeat}
              onChange={setPasswordRepeat}
              visible={showRepeat}
              onToggle={() => setShowRepeat((value) => !value)}
              error={repeatError}
              autoComplete="new-password"
            />

            {checking && <p className="text-xs text-fastwatch-muted">Проверяем логин и почту...</p>}
            {error && <p className="rounded-lg bg-fastwatch-accent/10 p-3 text-sm text-fastwatch-accent">{error}</p>}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-6 w-full rounded-lg bg-fastwatch-accent py-3 font-bold text-white transition hover:bg-fastwatch-accentDark disabled:opacity-50"
            >
              {loading ? "Загрузка..." : "Зарегистрироваться"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-fastwatch-muted">
            Уже есть аккаунт?{" "}
            <Link to="/login" className="font-medium text-fastwatch-accent hover:underline">
              Войдите
            </Link>
          </p>
        </div>
      </div>
    </div>
    </GuestOnlyGate>
  );
}

function FieldErrorInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  success,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error: string | null;
  success: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full rounded-lg border bg-fastwatch-bg px-4 py-3 transition focus:outline-none ${
          error
            ? "border-red-500/70 focus:border-red-400"
            : success
              ? "border-emerald-500/60 focus:border-emerald-400"
              : "border-white/10 focus:border-fastwatch-accent"
        }`}
        required
      />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      {success && <p className="mt-1 text-xs text-emerald-300">Свободно</p>}
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle,
  error,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  error: string | null;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <div className="flex overflow-hidden rounded-lg border border-white/10 bg-fastwatch-bg focus-within:border-fastwatch-accent">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••"
          minLength={6}
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 focus:outline-none"
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="w-12 border-l border-white/10 text-sm text-fastwatch-muted transition hover:bg-white/5 hover:text-white"
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          title={visible ? "Скрыть пароль" : "Показать пароль"}
        >
          {visible ? "◌" : "◉"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
