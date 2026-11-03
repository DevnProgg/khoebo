import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../providers/LanguageProvider';
import { colors, radius, spacing, type } from '../lib/theme';

const TOUR_KEY_PREFIX = 'khoebo_tour_completed:';

type TourStep = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

export function TourOverlay({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  const steps = useMemo<TourStep[]>(
    () => [
      { icon: 'home-outline', title: t('tourHomeTitle'), body: t('tourHomeBody') },
      { icon: 'cart-outline', title: t('tourSellTitle'), body: t('tourSellBody') },
      { icon: 'cube-outline', title: t('tourStockTitle'), body: t('tourStockBody') },
      { icon: 'grid-outline', title: t('tourMoreTitle'), body: t('tourMoreBody') },
      { icon: 'cloud-done-outline', title: t('tourOfflineTitle'), body: t('tourOfflineBody') },
    ],
    [t],
  );

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(`${TOUR_KEY_PREFIX}${userId}`).then((completed) => {
      if (active && completed !== 'true') setVisible(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const close = async () => {
    setVisible(false);
    await AsyncStorage.setItem(`${TOUR_KEY_PREFIX}${userId}`, 'true');
  };

  const current = steps[step];
  if (!current) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void close()}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.iconWrap}>
              <Ionicons name={current.icon} size={28} color={colors.primary} />
            </View>
            <Pressable
              onPress={() => void close()}
              accessibilityRole="button"
              accessibilityLabel={t('tourSkip')}
              hitSlop={10}
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>{t('tourSkip')}</Text>
            </Pressable>
          </View>

          <Text style={styles.stepCount}>{step + 1} / {steps.length}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          <View style={styles.dots}>
            {steps.map((item, index) => (
              <View key={item.title} style={[styles.dot, index === step && styles.dotActive]} />
            ))}
          </View>

          <Pressable
            onPress={() => (step === steps.length - 1 ? void close() : setStep((currentStep) => currentStep + 1))}
            accessibilityRole="button"
            style={styles.nextButton}
          >
            <Text style={styles.nextText}>
              {step === steps.length - 1 ? t('tourDone') : t('tourNext')}
            </Text>
            <Ionicons
              name={step === steps.length - 1 ? 'checkmark' : 'arrow-forward'}
              size={18}
              color={colors.white}
            />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.overlay,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    shadowColor: colors.black,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  skipText: {
    ...type.small,
    color: colors.inkMuted,
  },
  stepCount: {
    ...type.tiny,
    color: colors.primary,
    marginTop: spacing.xl,
    letterSpacing: 0.8,
  },
  title: {
    ...type.title,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  body: {
    ...type.body,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    lineHeight: 23,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lineStrong,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  nextButton: {
    minHeight: 48,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  nextText: {
    ...type.bodyStrong,
    color: colors.white,
  },
});
