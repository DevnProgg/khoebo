import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, tabBarSpace, type } from '../lib/theme';

const DISMISS_KEY = 'khoebo_install_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const ENGAGEMENT_MS = 30 * 1000;
const icon = require('../../assets/icon.png');

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform?: string };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type PwaContextValue = {
  canInstall: boolean;
  isInstalled: boolean;
  showInstallSheet: () => void;
  updateAvailable: boolean;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function isAppleMobileBrowser(): boolean {
  if (typeof window === 'undefined' || isStandalone()) return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const iPad = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
  const iPhone = /iPhone|iPod/.test(nav.userAgent);
  if (!iPad && !iPhone) return false;
  return /Safari/.test(nav.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(nav.userAgent);
}

function wasRecentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = Number(window.localStorage?.getItem(DISMISS_KEY));
  if (!stored || Date.now() - stored > COOLDOWN_MS) return false;
  return true;
}

function isSuppressedPath(pathname: string): boolean {
  if (pathname.startsWith('/(auth)')) return true;
  if (['/login', '/register', '/welcome'].includes(pathname)) return true;
  return ['/sell', '/sale/', '-form', '/journal', '/expense'].some((part) => pathname.includes(part));
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const updating = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let active = true;
    setIsInstalled(isStandalone());
    setIsApple(isAppleMobileBrowser());
    setDismissed(wasRecentlyDismissed());

    const engagementTimer = window.setTimeout(() => {
      if (active) setEngaged(true);
    }, ENGAGEMENT_MS);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowSheet(false);
    };
    const onControllerChange = () => {
      if (updating.current) window.location.reload();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    if ('serviceWorker' in window.navigator) {
      window.navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      window.navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
        if (!active) return;
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (active && installing.state === 'installed' && window.navigator.serviceWorker.controller) {
              setWaitingWorker(installing);
              setUpdateAvailable(true);
            }
          });
        });
      }).catch(() => undefined);
    }

    return () => {
      active = false;
      window.clearTimeout(engagementTimer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
      if ('serviceWorker' in window.navigator) {
        window.navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, []);

  const canInstall = !isInstalled && (deferredPrompt !== null || isApple);
  const eligible =
    engaged && canInstall && !dismissed && !isSuppressedPath(pathname);

  useEffect(() => {
    if (eligible) setShowSheet(true);
  }, [eligible]);

  const rememberDismissal = () => {
    setDismissed(true);
    setShowSheet(false);
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(DISMISS_KEY, String(Date.now()));
    }
  };

  const dismiss = () => rememberDismissal();

  const install = async () => {
    const event = deferredPrompt;
    if (!event) {
      setShowSheet(false);
      return;
    }
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') rememberDismissal();
    } catch {
      setShowSheet(false);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const applyUpdate = () => {
    if (!waitingWorker) return;
    updating.current = true;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  const showInstallSheet = () => {
    if (canInstall) setShowSheet(true);
  };

  const value = { canInstall, isInstalled, showInstallSheet, updateAvailable, applyUpdate };

  return (
    <PwaContext.Provider value={value}>
      {children}
      {updateAvailable ? <UpdateBar onPress={applyUpdate} /> : null}
      {showSheet && canInstall ? (
        <InstallSheet
          platform={isApple ? 'ios' : 'chromium'}
          onInstall={() => void install()}
          onDismiss={dismiss}
        />
      ) : null}
    </PwaContext.Provider>
  );
}

function UpdateBar({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.updateBar, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.updateTitle}>Update available</Text>
      <Text style={styles.updateBody}>Refresh when you are ready to use the latest version.</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.updateButton}>
        <Text style={styles.updateButtonText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

function InstallSheet({
  platform,
  onInstall,
  onDismiss,
}: {
  platform: 'ios' | 'chromium';
  onInstall: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(40));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const close = (action: () => void) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 24, duration: 160, useNativeDriver: true }),
    ]).start(action);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close(onDismiss);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Modal transparent animationType="none" onRequestClose={() => close(onDismiss)}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close install invitation"
          onPress={() => close(onDismiss)}
          style={styles.backdrop}
        />
        <Animated.View
          accessibilityRole="dialog"
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { marginBottom: tabBarSpace, paddingBottom: insets.bottom + spacing.lg },
            { opacity, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.brandRow}>
            <Image source={icon} style={styles.icon} contentFit="contain" accessibilityLabel="Khoebo" />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>Khoebo</Text>
              <Text style={styles.brandTag}>Business, simplified</Text>
            </View>
          </View>
          {platform === 'chromium' ? (
            <>
              <Text style={styles.title}>Take Khoebo with you.</Text>
              <Text style={styles.body}>
                Get quicker access to your business operations by installing Khoebo on your device.
              </Text>
              <Pressable accessibilityRole="button" onPress={onInstall} style={styles.primaryButton}>
                <Ionicons name="download-outline" size={18} color={colors.white} />
                <Text style={styles.primaryButtonText}>Install Khoebo</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Install Khoebo on your iPhone</Text>
              <Text style={styles.body}>Add Khoebo to your Home Screen for quicker access.</Text>
              <View style={styles.steps}>
                <InstallStep number="1" icon="share-outline" text="Tap the Share button in your browser." />
                <InstallStep number="2" icon="apps-outline" text="Select Add to Home Screen." />
                <InstallStep number="3" icon="add-circle-outline" text="Tap Add to complete installation." />
              </View>
            </>
          )}
          <Pressable accessibilityRole="button" onPress={() => close(onDismiss)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              {platform === 'chromium' ? 'Maybe later' : 'Got it'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function InstallStep({ number, icon: stepIcon, text }: { number: string; icon: 'share-outline' | 'apps-outline' | 'add-circle-outline'; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepMarker}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <Ionicons name={stepIcon} size={19} color={colors.primary} />
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

export function usePwa(): PwaContextValue {
  const context = useContext(PwaContext);
  if (!context) throw new Error('usePwa must be used within PwaProvider');
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    marginHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    ...shadow,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  brandCopy: {
    flex: 1,
  },
  brandName: {
    ...type.heading,
    color: colors.ink,
  },
  brandTag: {
    ...type.small,
    color: colors.inkMuted,
  },
  title: {
    ...type.title,
    color: colors.ink,
    fontSize: 23,
  },
  body: {
    ...type.body,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...type.bodyStrong,
    color: colors.white,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  secondaryButtonText: {
    ...type.small,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  steps: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  stepMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  stepNumber: {
    ...type.tiny,
    color: colors.primaryDark,
  },
  stepText: {
    ...type.small,
    color: colors.ink,
    flex: 1,
  },
  updateBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.ink,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  updateTitle: {
    ...type.bodyStrong,
    color: colors.white,
  },
  updateBody: {
    ...type.small,
    color: '#D8CFC8',
    marginTop: 2,
  },
  updateButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  updateButtonText: {
    ...type.small,
    color: colors.white,
    fontWeight: '700',
  },
});
