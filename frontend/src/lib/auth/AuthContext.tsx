import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PlatformUser } from "../api/types";
import {
  platformBootstrap,
  platformLogin,
  platformLogout,
} from "./platformAuth";
import { onSessionExpired } from "./tokenStore";

type AuthState = {
  user: PlatformUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const bootstrapped = await platformBootstrap();
    setUser(bootstrapped);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    return onSessionExpired(() => setUser(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await platformLogin(email, password);
    if (!result.ok) return result.message;
    if (result.user.role === "tenant_admin" || result.user.role === "admin") {
      await platformLogout();
      return "This app is for regular platform users only.";
    }
    setUser(result.user);
    return null;
  }, []);

  const logout = useCallback(async () => {
    await platformLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
