import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  Badge,
  Card,
  Header,
  MenuRow,
  Reveal,
  Screen,
  SectionHeader,
} from '../../../components/ui';
import { useBusinessRole } from '../../../hooks/useBusinessRole';
import { titleCase } from '../../../lib/format';
import { colors, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useLanguage } from '../../../providers/LanguageProvider';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, business, signOut } = useAuth();
  const { role } = useBusinessRole();
  const { language, setLanguage, t } = useLanguage();

  return (
    <Screen>
      <Header title={t('settings')} subtitle={t('settingsSubtitle')} />

      <Reveal>
        <Card style={styles.profile}>
          <Avatar name={user?.full_name ?? 'K'} size={58} />
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.full_name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email ?? user?.phone_number}
            </Text>
            <View style={styles.badges}>
              {role ? <Badge label={titleCase(role)} tone="primary" /> : null}
              {business ? <Badge label={business.name} tone="neutral" /> : null}
            </View>
          </View>
          <Ionicons name="person-circle-outline" size={24} color={colors.inkMuted} />
        </Card>
      </Reveal>

      <SectionHeader title={t('account')} />
      <Card padded={false}>
        <MenuRow
          icon="person-outline"
          title={t('personalInformation')}
          subtitle={t('personalInformationSubtitle')}
          onPress={() => router.push('/(app)/settings/personal')}
        />
        <MenuRow
          icon="lock-closed-outline"
          title={t('passwordSecurity')}
          subtitle={t('passwordSecuritySubtitle')}
          onPress={() => router.push('/(app)/settings/security')}
          last
        />
      </Card>

      <SectionHeader title={t('business')} />
      <Card padded={false}>
        <MenuRow
          icon="storefront-outline"
          title={t('businessProfile')}
          subtitle={business ? `${business.name} · LSL` : t('noBusinessSelected')}
          onPress={() => router.push('/(app)/settings/business')}
        />
        <MenuRow
          icon="people-outline"
          title={t('teamRoles')}
          subtitle={t('teamRolesSubtitle')}
          onPress={() => router.push('/(app)/team')}
          last
        />
      </Card>

      <SectionHeader title={t('support')} />
      <Card padded={false}>
        <MenuRow
          icon="help-circle-outline"
          title={t('aboutKhoebo')}
          subtitle={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`}
          onPress={() =>
            Alert.alert(
              'Khoebo',
              'Simple, connected business management. Sell, track stock and keep clean books.',
            )
          }
          last
        />
      </Card>

      <SectionHeader title={t('language')} />
      <Card style={styles.languageCard}>
        <View style={styles.flex}>
          <Text style={styles.languageTitle}>{t('language')}</Text>
          <Text style={styles.languageBody}>{t('languageSubtitle')}</Text>
        </View>
        <View style={styles.languageOptions}>
          {(['en', 'st'] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: language === option }}
              onPress={() => void setLanguage(option)}
              style={[styles.languageOption, language === option && styles.languageOptionSelected]}
            >
              <Text style={[styles.languageOptionText, language === option && styles.languageOptionTextSelected]}>
                {option === 'en' ? t('english') : t('sesotho')}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={styles.signOut} onPress={() => void signOut()}>
        <View style={styles.signOutIcon}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.signOutTitle}>{t('signOut')}</Text>
          <Text style={styles.signOutBody}>{t('signOutBody')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      </Card>

      <Text style={styles.footer}>Khoebo · v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    ...type.heading,
    color: colors.ink,
    fontSize: 18,
  },
  email: {
    ...type.small,
    color: colors.inkSoft,
    marginTop: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: colors.dangerSoft,
    borderColor: '#F6D4D4',
  },
  languageCard: {
    gap: spacing.md,
  },
  languageTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  languageBody: {
    ...type.small,
    color: colors.inkMuted,
    marginTop: 1,
  },
  languageOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  languageOption: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
  },
  languageOptionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  languageOptionText: {
    ...type.small,
    color: colors.inkSoft,
  },
  languageOptionTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  signOutIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutTitle: {
    ...type.bodyStrong,
    color: colors.danger,
    fontSize: 14,
  },
  signOutBody: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 1,
  },
  footer: {
    ...type.tiny,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
    letterSpacing: 0,
  },
});
