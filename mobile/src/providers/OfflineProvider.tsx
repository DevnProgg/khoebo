import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { queryClient } from '../lib/query';
import { flushOfflineQueue } from '../lib/api';
import { getQueuedRequestCount } from '../lib/offline';
import { colors, spacing, tabBarSpace, type } from '../lib/theme';
import { useLanguage } from './LanguageProvider';

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const wasOnline = useRef(true);

  useEffect(() => {
    let active = true;
    const sync = async (state?: NetInfoState) => {
      const online = state?.isConnected === true && state.isInternetReachable !== false;
      if (active) setIsOnline(online);
      if (!online && wasOnline.current && active) setDismissed(false);
      wasOnline.current = online;
      if (!online) {
        if (active) setPendingCount(await getQueuedRequestCount());
        return;
      }
      await flushOfflineQueue();
      if (active) {
        setPendingCount(await getQueuedRequestCount());
        await queryClient.invalidateQueries();
      }
    };

    void NetInfo.fetch().then((state) => sync(state));
    const unsubscribe = NetInfo.addEventListener((state) => void sync(state));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ isOnline, pendingCount }), [isOnline, pendingCount]);
  return (
    <OfflineContext.Provider value={value}>
      {children}
      {!isOnline && !dismissed ? (
        <OfflineBanner pendingCount={pendingCount} onDismiss={() => setDismissed(true)} />
      ) : null}
    </OfflineContext.Provider>
  );
}

function OfflineBanner({
  pendingCount,
  onDismiss,
}: {
  pendingCount: number;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.banner}>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('offline')}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {t('offlineMessage')}
          {pendingCount ? ` ${pendingCount} ${t('pendingChanges')}.` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('dismiss')}
        hitSlop={8}
        style={styles.close}
      >
        <Ionicons name="close" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: tabBarSpace + spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.ink,
    opacity: 0.96,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    ...type.bodyStrong,
    color: colors.white,
  },
  message: {
    ...type.small,
    color: colors.white,
    marginTop: 2,
  },
  close: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
});

export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext);
  if (!context) throw new Error('useOffline must be used within OfflineProvider');
  return context;
}