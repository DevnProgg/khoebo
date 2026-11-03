import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '../../components/Brand';
import { Button } from '../../components/ui';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useLanguage } from '../../providers/LanguageProvider';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const features: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { icon: 'cart-outline', label: t('sales') },
    { icon: 'cube-outline', label: t('stock') },
    { icon: 'bar-chart-outline', label: t('insights') },
    { icon: 'book-outline', label: t('books') },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.primarySoft, colors.background, colors.background]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blobOne} />
      <View style={styles.blobTwo} />

      <SafeAreaView style={styles.safe}>
        <Animated.View entering={FadeInDown.duration(550)} style={styles.logoWrap}>
          <Logo width={188} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120).duration(600)} style={styles.hero}>
          <View style={styles.eyebrow}>
            <View style={styles.dot} />
            <Text style={styles.eyebrowText}>{t('businessSimplified')}</Text>
          </View>
          <Text style={styles.title}>{t('knowYourNumbers')}{'\n'}{t('growWithConfidence')}</Text>
          <Text style={styles.subtitle}>{t('welcomeSubtitle')}</Text>

          <View style={styles.features}>
            {features.map((feature) => (
              <View key={feature.label} style={styles.feature}>
                <Ionicons name={feature.icon} size={16} color={colors.primary} />
                <Text style={styles.featureText}>{feature.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(240).duration(600)} style={styles.actions}>
          <Button title={t('getStarted')} icon="arrow-forward" onPress={() => router.push('/(auth)/register')} />
          <Button
            title={t('alreadyHaveAccount')}
            variant="secondary"
            onPress={() => router.push('/(auth)/login')}
          />
          <Text style={styles.footnote}>{t('madeForSmallBusinesses')}</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'space-between',
  },
  blobOne: {
    position: 'absolute',
    top: -90,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.primarySoft,
    opacity: 0.85,
  },
  blobTwo: {
    position: 'absolute',
    top: 150,
    left: -110,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#FFE8D9',
    opacity: 0.5,
  },
  logoWrap: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  hero: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  eyebrowText: {
    ...type.tiny,
    color: colors.primary,
    letterSpacing: 1.4,
  },
  title: {
    ...type.display,
    fontSize: 38,
    lineHeight: 44,
    color: colors.ink,
  },
  subtitle: {
    ...type.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSoft,
    maxWidth: 340,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  featureText: {
    ...type.small,
    color: colors.ink,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  footnote: {
    ...type.small,
    color: colors.inkMuted,
    textAlign: 'center',
    fontSize: 12,
  },
});
