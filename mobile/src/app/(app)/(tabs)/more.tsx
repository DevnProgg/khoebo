import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BusinessSwitcher } from '../../../components/BusinessSwitcher';
import {
  Avatar,
  Badge,
  Card,
  MenuRow,
  Reveal,
  Screen,
  SectionHeader,
  ScalePressable,
} from '../../../components/ui';
import { useBusinessRole } from '../../../hooks/useBusinessRole';
import { titleCase } from '../../../lib/format';
import { colors, radius, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useLanguage } from '../../../providers/LanguageProvider';

export default function MoreScreen() {
  const router = useRouter();
  const { user, business, businesses, signOut } = useAuth();
  const { role, canManage } = useBusinessRole();
  const { t } = useLanguage();

  return (
    <Screen bottomTab>
      <View style={styles.header}>
        <Text style={styles.title}>{t('more')}</Text>
        <Badge label="Khoebo" tone="primary" icon="sparkles" />
      </View>

      <Reveal>
        <Card style={styles.profileCard}>
          <Avatar name={user?.full_name ?? 'K'} size={62} />
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.full_name}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {user?.email}
            </Text>
            <View style={styles.profileBadges}>
              {role ? <Badge label={titleCase(role)} tone="primary" /> : null}
              {business ? (
                <Badge
                  label={`${businesses.length} ${businesses.length === 1 ? t('businessCount') : t('businessesCount')}`}
                  tone="neutral"
                />
              ) : null}
            </View>
          </View>
        </Card>
      </Reveal>

      {!business ? (
        <Reveal delay={40}>
          <Card style={styles.setupCard}>
            <View style={styles.setupIcon}>
              <Ionicons name="storefront-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.setupTitle}>{t('noBusinessYet')}</Text>
              <Text style={styles.setupBody}>{t('createBusinessFirst')}</Text>
            </View>
            <ScalePressable
              onPress={() => router.push('/(app)/business-form?mode=create')}
              style={styles.setupButton}
            >
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </ScalePressable>
          </Card>
        </Reveal>
      ) : null}

      <View style={styles.switcher}>
        <BusinessSwitcher />
      </View>

      <SectionHeader title={t('insights')} />
      <Card padded={false}>
        <MenuRow
          icon="bar-chart-outline"
          title={t('analytics')}
          subtitle={t('insightsSubtitle')}
          onPress={() => router.push('/(app)/analytics')}
        />
        <MenuRow
          icon="document-text-outline"
          title={t('reports')}
          subtitle={t('reportsSubtitleShort')}
          onPress={() => router.push('/(app)/reports')}
        />
        <MenuRow
          icon="receipt-outline"
          title={t('salesHistory')}
          subtitle={t('salesHistoryShort')}
          onPress={() => router.push('/(app)/sales-history')}
          last
        />
      </Card>

      <SectionHeader title={t('operations')} />
      <Card padded={false}>
        <MenuRow
          icon="book-outline"
          title={t('bookkeeping')}
          subtitle={t('bookkeepingSubtitleShort')}
          onPress={() => router.push('/(app)/bookkeeping')}
        />
        <MenuRow
          icon="alarm-outline"
          title={t('reminders')}
          subtitle={t('remindersSubtitleShort')}
          onPress={() => router.push('/(app)/reminders')}
        />
        <MenuRow
          icon="people-outline"
          title={t('team')}
          subtitle={canManage ? t('manageMembers') : t('seeTeam')}
          onPress={() => router.push('/(app)/team')}
          last
        />
      </Card>

      <SectionHeader title="Account" />
      <Card padded={false}>
        <MenuRow
          icon="settings-outline"
          title="Settings"
          subtitle={t('personalBusinessSecurity')}
          onPress={() => router.push('/(app)/settings')}
        />
        <MenuRow
          icon="help-circle-outline"
          title="About Khoebo"
          subtitle={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`}
          onPress={() =>
            Alert.alert(
              'Khoebo',
              t('aboutDescription'),
            )
          }
        />
        <MenuRow
          icon="log-out-outline"
          title={t('signOut')}
          tone="danger"
          onPress={() => void signOut()}
          right={<View />}
          last
        />
      </Card>

      <Text style={styles.footer}>Khoebo · {t('madeForSmallBusinessesShort')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    ...type.heading,
    color: colors.ink,
    fontSize: 19,
  },
  profileEmail: {
    ...type.small,
    color: colors.inkSoft,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.primaryMist,
  },
  setupIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  setupBody: {
    ...type.small,
    color: colors.inkSoft,
  },
  setupButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcher: {
    marginTop: spacing.lg,
    flexDirection: 'row',
  },
  footer: {
    ...type.tiny,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
    letterSpacing: 0,
  },
});
