import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, softShadow, spacing, type } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { ActionSheet, ScalePressable, type SheetAction } from './ui';

export function BusinessSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { businesses, business, selectBusiness } = useAuth();
  const [open, setOpen] = useState(false);

  const actions: SheetAction[] = [
    ...businesses.map((item) => ({
      label: item.name,
      icon: (item.id === business?.id ? 'checkmark-circle' : 'storefront-outline') as keyof typeof Ionicons.glyphMap,
      onPress: () => {
        void selectBusiness(item.id);
      },
    })),
    {
      label: 'New business',
      icon: 'add-circle-outline',
      onPress: () => router.push('/(app)/business-form?mode=create'),
    },
  ];

  return (
    <>
      <ScalePressable
        onPress={() => setOpen(true)}
        haptic={false}
        style={[styles.pill, compact && styles.pillCompact]}
        accessibilityLabel="Switch business"
      >
        <View style={styles.icon}>
          <Ionicons name="storefront" size={16} color={colors.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {business?.name ?? 'No business yet'}
          </Text>
          {!compact ? <Text style={styles.hint}>Tap to switch</Text> : null}
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.inkMuted} />
      </ScalePressable>

      <ActionSheet
        visible={open}
        title="Your businesses"
        actions={actions}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    maxWidth: 280,
    ...softShadow,
  },
  pillCompact: {
    paddingVertical: 5,
    maxWidth: 210,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flexShrink: 1,
  },
  name: {
    ...type.small,
    color: colors.ink,
    fontWeight: '700',
  },
  hint: {
    ...type.tiny,
    color: colors.inkMuted,
    fontSize: 10,
    letterSpacing: 0,
    fontWeight: '500',
  },
});
