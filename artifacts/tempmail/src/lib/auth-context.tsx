import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiFetch } from "./api-fetch";

type User = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  plan: "free" | "pro";
  role: string;
  createdAt: string;
};

type AuthState = {
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  register: () => Promise<{ code: string }>;
  login: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  isLoaded: false,
  isSignedIn: false,
  register: async () => ({ code: "" }),
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const u = await apiFetch<User>("/api/auth/me");
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const register = useCallback(async () => {
    const result = await apiFetch<{ ok: boolean; code: string }>("/api/auth/register", {
      method: "POST",
    });
    await refresh();
    return { code: result.code };
  }, [refresh]);

  const login = useCallback(async (code: string) => {
    await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoaded, isSignedIn: !!user, register, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useUser() {
  const { user, isLoaded, isSignedIn } = useContext(AuthContext);
  return { user, isLoaded, isSignedIn };
}
