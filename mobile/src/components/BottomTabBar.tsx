import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { useLanguage } from '../providers/LanguageProvider';
import { tapHaptic } from './ui';

const tabs: Record<string, { key: 'home' | 'sell' | 'stock' | 'tax' | 'more'; active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { key: 'home', active: 'home', inactive: 'home-outline' },
  sell: { key: 'sell', active: 'cart', inactive: 'cart-outline' },
  stock: { key: 'stock', active: 'cube', inactive: 'cube-outline' },
  tax: { key: 'tax', active: 'receipt', inactive: 'receipt-outline' },
  more: { key: 'more', active: 'grid', inactive: 'grid-outline' },
};

export function BottomTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const config = tabs[route.name] ?? {
            key: 'more' as const,
            active: 'ellipse' as const,
            inactive: 'ellipse-outline' as const,
          };
          const active = state.index === index;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={active ? { selected: true } : {}}
              accessibilityLabel={t(config.key)}
              onPress={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!active && !event.defaultPrevented) {
                  tapHaptic();
                  navigateToTab(route.key);
                }
              }}
              onLongPress={() =>
                emitter.emit({ type: 'tabLongPress', target: route.key })
              }
              style={styles.tab}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                {active ? (
                  <Animated.View entering={FadeIn.duration(180)}>
                    <Ionicons name={config.active} size={21} color={colors.primary} />
                  </Animated.View>
                ) : (
                  <Ionicons name={config.inactive} size={21} color={colors.inkMuted} />
                )}
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>{t(config.key)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 66,
    paddingHorizontal: spacing.sm,
    ...shadow,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 7,
  },
  iconWrap: {
    width: 42,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primarySoft,
  },
  label: {
    ...type.tiny,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
