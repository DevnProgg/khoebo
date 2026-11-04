import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../lib/api';
import type { UiMode } from '../lib/types';
import { useAuth } from './AuthProvider';

const UI_MODE_KEY = 'khoebo_ui_mode';

interface UiModeContextValue {
  mode: UiMode;
  setMode: (mode: UiMode) => Promise<void>;
  isSimple: boolean;
  isAdvanced: boolean;
}

const UiModeContext = createContext<UiModeContextValue | null>(null);

export function UiModeProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser } = useAuth();
  const [mode, setModeState] = useState<UiMode>('simple');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(UI_MODE_KEY).then((stored) => {
      if (active && (stored === 'simple' || stored === 'advanced')) setModeState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setModeState(user.ui_mode ?? 'simple');
    void AsyncStorage.setItem(UI_MODE_KEY, user.ui_mode ?? 'simple');
  }, [user]);

  const setMode = useCallback(async (next: UiMode) => {
    setModeState(next);
    await AsyncStorage.setItem(UI_MODE_KEY, next);
    try {
      const updated = await api.auth.updateProfile({ ui_mode: next });
      updateUser(updated);
    } catch {
      // Keep the cached choice while offline; the next profile refresh reconciles it.
    }
  }, [updateUser]);

  const value = useMemo(() => ({
    mode,
    setMode,
    isSimple: mode === 'simple',
    isAdvanced: mode === 'advanced',
  }), [mode, setMode]);

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>;
}

export function useUiMode(): UiModeContextValue {
  const context = useContext(UiModeContext);
  if (!context) throw new Error('useUiMode must be used within UiModeProvider');
  return context;
}