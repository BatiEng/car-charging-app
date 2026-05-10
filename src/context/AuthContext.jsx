import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { me, login as apiLogin, logout as apiLogout, getToken, clearToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialise from localStorage so UI shows instantly on refresh
  const [user,    setUser]    = useState(() => {
    try {
      const cached = localStorage.getItem('ev_user');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // On mount: if a token exists, verify it with the server
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    me()
      .then(u => { setUser(u); localStorage.setItem('ev_user', JSON.stringify(u)); })
      .catch(() => { clearToken(); localStorage.removeItem('ev_user'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await apiLogin(email, password); // also calls setToken internally
    setUser(u);
    localStorage.setItem('ev_user', JSON.stringify(u));
    return u;
  }, []);

  const logout = useCallback(async () => {
    apiLogout();
    clearToken();
    localStorage.removeItem('ev_user');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await me();
      setUser(u);
      localStorage.setItem('ev_user', JSON.stringify(u));
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
