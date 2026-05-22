import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  apiFetch,
  ensureGuestSession,
  loadGuestSession,
  saveGuestSession,
  type GuestSession,
  type UserPublic,
} from "../api/client";

interface AuthContextValue {
  user: UserPublic | null;
  guest: GuestSession | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  enterAsGuest: () => Promise<void>;
  refreshMe: () => Promise<UserPublic | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_EVENT = "fastwatch:auth-changed";
const AUTH_STORAGE_KEY = "fastwatch_auth_changed_at";

function notifyAuthChanged() {
  localStorage.setItem(AUTH_STORAGE_KEY, String(Date.now()));
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [guest, setGuest] = useState<GuestSession | null>(loadGuestSession);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const me = await apiFetch<UserPublic>("/auth/me");
      setUser(me);
      setGuest(null);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const me = await refreshMe();
        if (cancelled) return;
        if (!me) {
          const session = await ensureGuestSession();
          if (!cancelled) setGuest(session);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initAuth().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  useEffect(() => {
    let cancelled = false;

    const syncAuth = async () => {
      const me = await refreshMe();
      if (cancelled) return;
      if (!me) {
        const session = await ensureGuestSession();
        if (!cancelled) setGuest(session);
      }
    };

    const onAuthChanged = () => {
      syncAuth().catch(() => undefined);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_STORAGE_KEY) onAuthChanged();
    };

    window.addEventListener(AUTH_EVENT, onAuthChanged);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshMe]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiFetch<{ user: UserPublic }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(res.user);
    setGuest(null);
    notifyAuthChanged();
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await apiFetch<{ user: UserPublic }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    setUser(res.user);
    setGuest(null);
    notifyAuthChanged();
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setGuest(await ensureGuestSession());
      notifyAuthChanged();
    }
  }, []);

  const enterAsGuest = useCallback(async () => {
    const session = await ensureGuestSession();
    setGuest(session);
    setUser(null);
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    notifyAuthChanged();
  }, []);

  const value = useMemo(
    () => ({
      user,
      guest,
      loading,
      login,
      register,
      logout,
      enterAsGuest,
      refreshMe,
    }),
    [user, guest, loading, login, register, logout, enterAsGuest, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { saveGuestSession };
