import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, User, clearToken, getToken, setToken } from './api';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const r = await api.me();
      setUser(r.user);
    } catch {
      clearToken();
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const login = async (identifier: string, password: string) => {
    const r = await api.login(identifier, password);
    setToken(r.token); // backup; server also sets httpOnly cookie
    setUser(r.user);
  };
  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
    clearToken(); setUser(null);
  };
  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
