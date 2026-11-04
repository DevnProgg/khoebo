import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BusinessSwitcher } from '../../../components/BusinessSwitcher';
import { Card, EmptyState, ErrorState, Header, LoadingView, Screen, Segmented } from '../../../components/ui';
import { api } from '../../../lib/api';
import { daysAgoISO, formatMoney, startOfMonthISO, todayISO, toNumber } from '../../../lib/format';
import { CURRENCY_CODE, colors, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useLanguage } from '../../../providers/LanguageProvider';

type Range = 'today' | 'week' | 'month';

export default function SimpleHomeScreen() {
  const { business, user } = useAuth();
  const { t } = useLanguage();
  const [range, setRange] = useState<Range>('today');
  const end = todayISO();
  const start = useMemo(() => range === 'today' ? end : range === 'week' ? daysAgoISO(6) : startOfMonthISO(), [end, range]);
  const overview = useQuery({
    queryKey: ['simple-overview', business?.id, start, end],
    queryFn: () => api.analytics.overview(business!.id, start, end),
    enabled: Boolean(business),
  });

  if (!business) return <Screen bottomTab><EmptyState icon="storefront-outline" title={t('createBusinessFirst')} /></Screen>;
  if (overview.isLoading) return <Screen bottomTab><LoadingView label={t('readingNumbers')} /></Screen>;
  if (overview.isError) return <Screen bottomTab><ErrorState message={overview.error.message} onRetry={() => overview.refetch()} /></Screen>;
  const data = overview.data;
  if (!data) return null;
  const made = toNumber(data.revenue) - toNumber(data.expenses);

  return (
    <Screen bottomTab refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <Header title={`Hi, ${user?.full_name?.split(' ')[0] ?? ''}`} subtitle={t('everythingInOnePlace')} showBack={false} />
      <BusinessSwitcher />
      <Segmented value={range} onChange={setRange} options={[{ label: t('today'), value: 'today' }, { label: t('sevenDays'), value: 'week' }, { label: t('month'), value: 'month' }]} />
      <View style={styles.grid}>
        <Card style={styles.card}><Text style={styles.label}>{t('moneyIn')}</Text><Text style={styles.value}>{formatMoney(data.revenue, CURRENCY_CODE)}</Text></Card>
        <Card style={styles.card}><Text style={styles.label}>{t('moneyOut')}</Text><Text style={styles.value}>{formatMoney(data.expenses, CURRENCY_CODE)}</Text></Card>
        <Card style={[styles.card, styles.made]}><Text style={styles.label}>{t('whatMade')}</Text><Text style={styles.value}>{formatMoney(made, CURRENCY_CODE)}</Text></Card>
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
});
