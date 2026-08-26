import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../services/api/auth.api';
import { setAccessToken, setUnauthorizedHandler } from '../services/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
  }, [clearSession]);

  // On app load, try to silently refresh a session from the httpOnly cookie.
  useEffect(() => {
    (async () => {
      try {
        const { accessToken } = await authApi.refresh();
        setAccessToken(accessToken);
        const profile = await authApi.me();
        setUser(profile);
      } catch {
        clearSession();
      } finally {
        setInitializing(false);
      }
    })();
  }, [clearSession]);

  async function signup(form) {
    const { user, accessToken } = await authApi.signup(form);
    setAccessToken(accessToken);
    setUser(user);
  }

  async function login(form) {
    const { user, accessToken } = await authApi.login(form);
    setAccessToken(accessToken);
    setUser(user);
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }

  return (
    <AuthContext.Provider value={{ user, initializing, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
