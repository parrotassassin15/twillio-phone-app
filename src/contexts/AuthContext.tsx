import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';
import { setAuthToken } from '../services/authToken';

const STORAGE_KEY = 'lorikeet_auth_token';

type AuthContextValue = {
  token: string | null;
  userEmail: string | null;
  userName: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  token: null,
  userEmail: null,
  userName: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

function jwtExpired(token: string): boolean {
  try {
    const part = token.split('.')[1];
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return Math.floor(Date.now() / 1000) >= (payload.exp ?? 0);
  } catch {
    return true;
  }
}

function jwtEmail(token: string): string | null {
  try {
    const part = token.split('.')[1];
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload.email ?? null;
  } catch {
    return null;
  }
}

function jwtName(token: string): string | null {
  try {
    const part = token.split('.')[1];
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload.name ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken]       = useState<string | null>(null);
  const [userEmail, setEmail]   = useState<string | null>(null);
  const [userName, setName]     = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);

  // Load persisted token on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (stored && !jwtExpired(stored)) {
          setAuthToken(stored);
          setToken(stored);
          setEmail(jwtEmail(stored));
          setName(jwtName(stored));
        } else if (stored) {
          // Expired — clean up
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const fd = new FormData();
    fd.append('action', 'login');
    fd.append('email', email.trim().toLowerCase());
    fd.append('password', password);

    const resp = await fetch(`${Config.BASE_URL}/api/auth`, {
      method: 'POST',
      body: fd,
    });

    const data: { success: boolean; token?: string; error?: string } = await resp.json();

    if (!resp.ok || !data.success || !data.token) {
      throw new Error(data.error ?? 'Login failed');
    }

    await AsyncStorage.setItem(STORAGE_KEY, data.token);
    setAuthToken(data.token);
    setToken(data.token);
    setEmail(jwtEmail(data.token));
    setName(jwtName(data.token));
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    setAuthToken(null);
    setToken(null);
    setEmail(null);
    setName(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, userEmail, userName, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
