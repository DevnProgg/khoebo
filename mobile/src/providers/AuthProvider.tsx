import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  api,
  clearStoredTokens,
  getRefreshToken,
  loadStoredTokens,
  setUnauthorizedHandler,
  storeTokens,
} from '../lib/api';
import type { Business, User } from '../lib/types';

const ACTIVE_BUSINESS_KEY = 'khoebo_active_business';

interface AuthContextValue {
  booting: boolean;
  user: User | null;
  businesses: Business[];
  business: Business | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshBusinesses: () => Promise<Business[]>;
  createBusiness: (input: { name: string; currency: string }) => Promise<Business>;
  updateBusiness: (businessId: string, input: { name?: string; currency?: string }) => Promise<Business>;
  deleteBusiness: (businessId: string) => Promise<void>;
  selectBusiness: (businessId: string) => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  const business = useMemo(
    () => businesses.find((item) => item.id === activeBusinessId) ?? businesses[0] ?? null,
    [businesses, activeBusinessId],
  );

  const resetSession = useCallback(async () => {
    await clearStoredTokens();
    await AsyncStorage.removeItem(ACTIVE_BUSINESS_KEY);
    setUser(null);
    setBusinesses([]);
    setActiveBusinessId(null);
    queryClient.clear();
  }, [queryClient]);

  const applyBusinesses = useCallback(async (list: Business[], preferredId?: string | null) => {
    setBusinesses(list);
    const stored = await AsyncStorage.getItem(ACTIVE_BUSINESS_KEY);
    const candidate =
      (preferredId && list.some((item) => item.id === preferredId) ? preferredId : null) ??
      (stored && list.some((item) => item.id === stored) ? stored : null) ??
      list[0]?.id ??
      null;
    setActiveBusinessId(candidate);
    if (candidate) await AsyncStorage.setItem(ACTIVE_BUSINESS_KEY, candidate);
    return candidate;
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const hasSession = await loadStoredTokens();
      if (!hasSession) return;
      const [me, list] = await Promise.all([api.auth.me(), api.businesses.list()]);
      setUser(me);
      await applyBusinesses(list);
    } catch {
      void 0;
    } finally {
      setBooting(false);
    }
  }, [applyBusinesses]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void resetSession();
    });
    void bootstrap();
    return () => setUnauthorizedHandler(null);
  }, [bootstrap, resetSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const pair = await api.auth.login({ email: email.trim(), password });
      await storeTokens(pair);
      const [me, list] = await Promise.all([api.auth.me(), api.businesses.list()]);
      queryClient.clear();
      setUser(me);
      await applyBusinesses(list);
    },
    [applyBusinesses, queryClient],
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      await api.auth.register({ full_name: fullName.trim(), email: email.trim(), password });
      await signIn(email, password);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    const refresh = getRefreshToken();
    try {
      if (refresh) await api.auth.logout(refresh);
    } catch {
      void 0;
    }
    await resetSession();
  }, [resetSession]);

  const refreshBusinesses = useCallback(async () => {
    const list = await api.businesses.list();
    await applyBusinesses(list, activeBusinessId);
    return list;
  }, [activeBusinessId, applyBusinesses]);

  const createBusiness = useCallback(
    async (input: { name: string; currency: string }) => {
      const created = await api.businesses.create(input);
      const list = await api.businesses.list();
      await applyBusinesses(list, created.id);
      return created;
    },
    [applyBusinesses],
  );

  const updateBusiness = useCallback(
    async (businessId: string, input: { name?: string; currency?: string }) => {
      const updated = await api.businesses.update(businessId, input);
      setBusinesses((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      return updated;
    },
    [],
  );

  const deleteBusiness = useCallback(
    async (businessId: string) => {
      await api.businesses.remove(businessId);
      const next = businesses.filter((item) => item.id !== businessId);
      const nextId = next[0]?.id ?? null;
      setBusinesses(next);
      setActiveBusinessId(nextId);
      if (nextId) await AsyncStorage.setItem(ACTIVE_BUSINESS_KEY, nextId);
      else await AsyncStorage.removeItem(ACTIVE_BUSINESS_KEY);
    },
    [businesses],
  );

  const selectBusiness = useCallback(async (businessId: string) => {
    setActiveBusinessId(businessId);
    await AsyncStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
  }, []);

  const updateUser = useCallback((next: User) => setUser(next), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      booting,
      user,
      businesses,
      business,
      signIn,
      register,
      signOut,
      refreshBusinesses,
      createBusiness,
      updateBusiness,
      deleteBusiness,
      selectBusiness,
      updateUser,
    }),
    [
      booting,
      user,
      businesses,
      business,
      signIn,
      register,
      signOut,
      refreshBusinesses,
      createBusiness,
      updateBusiness,
      deleteBusiness,
      selectBusiness,
      updateUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
