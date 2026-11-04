import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BusinessSwitcher } from '../../../components/BusinessSwitcher';
import {
  Button,
  Card,
  ErrorState,
  Header,
  LoadingView,
  Screen,
  Segmented,
  TextField,
} from '../../../components/ui';
import { api } from '../../../lib/api';
import {
  daysAgoISO,
  firstName,
  formatMoney,
  startOfMonthISO,
  todayISO,
  toNumber,
} from '../../../lib/format';
import { CURRENCY_CODE, colors, radius, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useLanguage } from '../../../providers/LanguageProvider';

type Range = 'today' | 'week' | 'month';

export default function SimpleHomeScreen() {
  const router = useRouter();
  const { business, businesses, user, createBusiness } = useAuth();
  const { t } = useLanguage();
  const [range, setRange] = useState<Range>('today');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const creatingRef = useRef(false);

  const defaultBusinessName = user?.full_name?.trim()
    ? `${firstName(user.full_name)}'s Business`
    : 'My Business';

  // Automatically provision initial business for simple UI if none exists
  useEffect(() => {
    if (!business && businesses.length === 0 && !creatingRef.current && !createError) {
      creatingRef.current = true;
      setIsCreating(true);
      createBusiness({ name: defaultBusinessName, currency: 'LSL' })
        .catch((err) => {
          setCreateError(err instanceof Error ? err.message : 'Could not set up business');
        })
        .finally(() => {
          setIsCreating(false);
        });
    }
  }, [business, businesses.length, createBusiness, defaultBusinessName, createError]);

  const end = todayISO();
  const start = useMemo(
    () => (range === 'today' ? end : range === 'week' ? daysAgoISO(6) : startOfMonthISO()),
    [end, range],
  );

  const overview = useQuery({
    queryKey: ['simple-overview', business?.id, start, end],
    queryFn: () => api.analytics.overview(business!.id, start, end),
    enabled: Boolean(business),
  });

  const handleManualCreate = async () => {
    const name = customName.trim() || defaultBusinessName;
    setIsCreating(true);
    setCreateError(null);
    try {
      await createBusiness({ name, currency: 'LSL' });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create business');
    } finally {
      setIsCreating(false);
    }
  };

  if (isCreating) {
    return (
      <Screen bottomTab>
        <LoadingView label={t('settingUpBusiness')} />
      </Screen>
    );
  }

  if (!business) {
    return (
      <Screen bottomTab>
        <Header
          title={`Hi, ${firstName(user?.full_name)}`}
          subtitle={t('everythingInOnePlace')}
          showBack={false}
        />
        <Card style={styles.setupCard}>
          <View style={styles.setupIcon}>
            <Ionicons name="storefront" size={28} color={colors.primary} />
          </View>
          <Text style={styles.setupTitle}>{t('createBusinessFirst')}</Text>
          <Text style={styles.setupBody}>{t('setupBusinessBody')}</Text>
          <TextField
            label={t('businessName')}
            placeholder={defaultBusinessName}
            value={customName}
            onChangeText={setCustomName}
            icon="storefront-outline"
            autoCapitalize="words"
          />
          {createError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{createError}</Text>
            </View>
          ) : null}
          <Button
            title={t('createBusiness')}
            icon="arrow-forward"
            onPress={handleManualCreate}
            loading={isCreating}
            disabled={isCreating}
          />
        </Card>
      </Screen>
    );
  }

  if (overview.isLoading || !overview.data) {
    return (
      <Screen bottomTab>
        <LoadingView label={t('readingNumbers')} />
      </Screen>
    );
  }

  if (overview.isError) {
    return (
      <Screen bottomTab>
        <ErrorState message={overview.error.message} onRetry={() => overview.refetch()} />
      </Screen>
    );
  }

  const data = overview.data;
  const made = toNumber(data.revenue) - toNumber(data.expenses);

  return (
    <Screen bottomTab refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <Header
        title={`Hi, ${firstName(user?.full_name)}`}
        subtitle={t('everythingInOnePlace')}
        showBack={false}
      />
      <BusinessSwitcher />
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { label: t('today'), value: 'today' },
          { label: t('sevenDays'), value: 'week' },
          { label: t('month'), value: 'month' },
        ]}
      />
      <View style={styles.grid}>
        <Card style={styles.card}>
          <Text style={styles.label}>{t('moneyIn')}</Text>
          <Text style={styles.value}>{formatMoney(data.revenue, CURRENCY_CODE)}</Text>
        </Card>
        <Card style={styles.card}>
          <Text style={styles.label}>{t('moneyOut')}</Text>
          <Text style={styles.value}>{formatMoney(data.expenses, CURRENCY_CODE)}</Text>
        </Card>
        <Card style={[styles.card, styles.made]}>
          <Text style={styles.label}>{t('whatMade')}</Text>
          <Text style={styles.value}>{formatMoney(made, CURRENCY_CODE)}</Text>
        </Card>
      </View>

      <View style={styles.actions}>
        <Button
          title={t('recordSale')}
          icon="add-circle"
          onPress={() => router.push('/(app)/(tabs)/simple-sale')}
          style={styles.actionBtn}
        />
        <Button
          title={t('moneyOut')}
          icon="arrow-up-circle"
          variant="secondary"
          onPress={() => router.push('/(app)/(tabs)/money-out')}
          style={styles.actionBtn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md, marginTop: spacing.lg },
  card: { gap: spacing.sm },
  made: { backgroundColor: colors.primaryMist },
  label: { ...type.small, color: colors.inkSoft },
  value: { ...type.title, color: colors.ink },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
  setupCard: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'stretch',
    marginTop: spacing.md,
  },
  setupIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  setupTitle: {
    ...type.title,
    color: colors.ink,
    textAlign: 'center',
  },
  setupBody: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  errorText: {
    ...type.small,
    color: colors.danger,
    textAlign: 'center',
  },
});
