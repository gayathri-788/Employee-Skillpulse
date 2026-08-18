'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, ApiError, API_BASE_URL } from './api';
import { useToast } from './toast-context';

export type Role = 'admin' | 'employee' | '';

interface LoginResponse {
  access_token: string;
  role: Role;
  username: string;
}

interface AuthContextValue {
  token: string;
  role: Role;
  username: string;
  isReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  authedFetch: <T = unknown>(endpoint: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface StoredAuth {
  token: string;
  role: Role;
  username: string;
}

const EMPTY_AUTH: StoredAuth = { token: '', role: '', username: '' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ token, role, username }, setAuth] = useState<StoredAuth>(EMPTY_AUTH);
  const [isReady, setIsReady] = useState(false);
  const { showToast } = useToast();

  // localStorage only exists client-side; read it once after mount to sync React state
  // with that external store (justified case for setState-in-effect, see React docs on
  // synchronizing with external systems).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setAuth({
      token: localStorage.getItem('token') || '',
      role: (localStorage.getItem('role') as Role) || '',
      username: localStorage.getItem('username') || '',
    });
    setIsReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const logout = useCallback(() => {
    fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' }).catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    setAuth(EMPTY_AUTH);
  }, []);

  const login = useCallback(async (usernameInput: string, password: string) => {
    const data = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: usernameInput, password }),
    });
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('username', data.username);
    setAuth({ token: data.access_token, role: data.role, username: data.username });
  }, []);

  const authedFetch = useCallback(
    async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiFetch<T>(endpoint, options, token);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && !endpoint.includes('/api/auth/login')) {
          showToast('Session expired. Please log in again.', 'warning');
          logout();
        }
        throw err;
      }
    },
    [token, logout, showToast]
  );

  return (
    <AuthContext.Provider value={{ token, role, username, isReady, login, logout, authedFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
