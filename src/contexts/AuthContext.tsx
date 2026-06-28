import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Linking } from 'react-native';
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

  const applyToken = useCallback((t: string) => {
    setAuthToken(t);
    setToken(t);
    setEmail(jwtEmail(t));
    setName(jwtName(t));
  }, []);

  // Load persisted token on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (stored && !jwtExpired(stored)) {
          applyToken(stored);
        } else if (stored) {
          AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [applyToken]);

  // Handle Microsoft SSO deep-link callback: lorikeet://auth/callback?token=<jwt>
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (!url.startsWith('lorikeet://auth/callback')) return;
      const tokenMatch = url.match(/[?&]token=([^&]+)/);
      if (!tokenMatch) return;
      const t = decodeURIComponent(tokenMatch[1]);
      if (jwtExpired(t)) return;
      AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
      applyToken(t);
    };

    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); }).catch(() => {});
    return () => sub.remove();
  }, [applyToken]);

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
    applyToken(data.token);
  }, [applyToken]);

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
