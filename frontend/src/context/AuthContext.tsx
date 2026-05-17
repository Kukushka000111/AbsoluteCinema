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
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  enterAsGuest: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [guest, setGuest] = useState<GuestSession | null>(loadGuestSession);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const me = await apiFetch<UserPublic>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiFetch<{ user: UserPublic }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(res.user);
    setGuest(null);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiFetch<{ user: UserPublic }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(res.user);
    setGuest(null);
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const enterAsGuest = useCallback(async () => {
    const session = await ensureGuestSession();
    setGuest(session);
    setUser(null);
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
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
