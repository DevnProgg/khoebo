import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MiniBars, TopProducts } from '../../components/Charts';
import {
  Badge,
  Card,
  ErrorState,
  Header,
  LoadingView,
  ProgressBar,
  Reveal,
  Screen,
  SectionHeader,
  Segmented,
} from '../../components/ui';
import { api } from '../../lib/api';
import {
  daysAgoISO,
  formatMoney,
  formatNumber,
  startOfMonthISO,
  titleCase,
  todayISO,
  toNumber,
} from '../../lib/format';
import { colors, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useLanguage } from '../../providers/LanguageProvider';

type RangeKey = 'today' | '7d' | '30d' | 'month';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { business } = useAuth();
  const { t } = useLanguage();
  const [range, setRange] = useState<RangeKey>('month');
  const end = todayISO();
  const start = useMemo(() => {
    if (range === 'today') return end;
    if (range === '7d') return daysAgoISO(6);
    if (range === '30d') return daysAgoISO(29);
    return startOfMonthISO();
  }, [end, range]);

  const overview = useQuery({
    queryKey: ['overview', business?.id, start, end],
    queryFn: () => api.analytics.overview(business!.id, start, end),
    enabled: Boolean(business),
  });

  const currency = business?.currency ?? 'LSL';
  const data = overview.data;
  const payments = Object.entries(data?.revenue_by_payment_method ?? {});
  const paymentTotal = payments.reduce((sum, [, value]) => sum + toNumber(value), 0);
  const netProfit = toNumber(data?.net_profit);

  return (
    <Screen refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <Header title={t('analytics')} subtitle={t('analyticsSubtitle')} />

      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { label: t('today'), value: 'today' },
          { label: t('sevenDays'), value: '7d' },
          { label: t('thirtyDays'), value: '30d' },
          { label: t('month'), value: 'month' },
        ]}
      />

      {overview.isLoading ? (
        <LoadingView label={t('readingNumbers')} />
      ) : overview.isError ? (
        <ErrorState message={overview.error.message} onRetry={() => overview.refetch()} />
      ) : data ? (
        <>
          <View style={styles.kpiGrid}>
            <Reveal style={styles.kpiSlot}>
              <Card style={styles.kpi}>
                <View style={[styles.kpiIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.kpiLabel}>{t('revenue')}</Text>
                <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(data.revenue, currency)}
                </Text>
              </Card>
            </Reveal>
            <Reveal delay={40} style={styles.kpiSlot}>
              <Card style={styles.kpi}>
                <View
                  style={[
                    styles.kpiIcon,
                    { backgroundColor: netProfit >= 0 ? colors.successSoft : colors.dangerSoft },
                  ]}
                >
                  <Ionicons
                    name={netProfit >= 0 ? 'arrow-up-outline' : 'arrow-down-outline'}
                    size={18}
                    color={netProfit >= 0 ? colors.success : colors.danger}
                  />
                </View>
                <Text style={styles.kpiLabel}>{t('netProfit')}</Text>
                <Text
                  style={[styles.kpiValue, { color: netProfit >= 0 ? colors.ink : colors.danger }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatMoney(data.net_profit, currency)}
                </Text>
              </Card>
            </Reveal>
            <Reveal delay={80} style={styles.kpiSlot}>
              <Card style={styles.kpi}>
                <View style={[styles.kpiIcon, { backgroundColor: colors.primaryMist }]}>
                  <Ionicons name="cart-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.kpiLabel}>{t('sales')}</Text>
                <Text style={styles.kpiValue}>{formatNumber(data.sales_count)}</Text>
              </Card>
            </Reveal>
            <Reveal delay={120} style={styles.kpiSlot}>
              <Card style={styles.kpi}>
                <View style={[styles.kpiIcon, { backgroundColor: colors.primaryMist }]}>
                  <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.kpiLabel}>{t('averageSale')}</Text>
                <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(data.average_sale_value, currency)}
                </Text>
              </Card>
            </Reveal>
          </View>

          <SectionHeader title={t('revenueTrend')} />
          <Card>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartValue}>{formatMoney(data.revenue, currency)}</Text>
                <Text style={styles.chartCaption}>
                  {start === end ? 'Today' : `${start} to ${end}`}
                </Text>
              </View>
              <Badge label={`${data.sales_count} ${t('sales').toLowerCase()}`} tone="primary" />
            </View>
            <View style={styles.chart}>
              <MiniBars
                data={data.revenue_by_day}
                height={120}
                color={colors.primary}
                trackColor={colors.primarySoft}
                showLabels={range === 'today' || range === '7d'}
              />
            </View>
          </Card>

          <SectionHeader title={t('topProducts')} />
          <Card>
            {data.top_products.length ? (
              <TopProducts products={data.top_products} currency={currency} />
            ) : (
              <Text style={styles.muted}>{t('noProductSales')}</Text>
            )}
          </Card>

          <SectionHeader title={t('paymentMix')} />
          <Card>
            {payments.length ? (
              <View style={styles.payments}>
                {payments.map(([method, value]) => (
                  <View key={method} style={styles.paymentRow}>
                    <View style={styles.paymentTop}>
                      <Text style={styles.paymentLabel}>{titleCase(method)}</Text>
                      <Text style={styles.paymentValue}>
                        {formatMoney(value, currency)} ·{' '}
                        {paymentTotal ? Math.round((toNumber(value) / paymentTotal) * 100) : 0}%
                      </Text>
                    </View>
                    <ProgressBar value={toNumber(value)} max={paymentTotal || 1} height={6} />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Payments will appear here after your first sale.</Text>
            )}
          </Card>

          <SectionHeader title="Inventory" />
          <Card style={styles.inventoryCard} onPress={() => router.push('/(app)/(tabs)/stock')}>
            <View style={styles.inventoryRow}>
              <View style={styles.inventoryIcon}>
                <Ionicons name="cube-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.inventoryLabel}>{t('stockOnHand')}</Text>
                <Text style={styles.inventoryValue}>
                  {formatMoney(data.inventory_value, currency)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
            </View>
            <View style={styles.inventoryFooter}>
              <View style={styles.flex}>
                <Text style={styles.inventoryLabel}>Low stock items</Text>
                <Text style={styles.inventorySub}>
                  {data.low_stock_count
                    ? `${data.low_stock_count} need restocking`
                    : 'Everything is well stocked'}
                </Text>
              </View>
              <Badge
                label={String(data.low_stock_count)}
                tone={data.low_stock_count ? 'warning' : 'success'}
              />
            </View>
          </Card>

          <SectionHeader title="Also this period" />
          <View style={styles.miniGrid}>
            <Card style={styles.miniCard}>
              <Text style={styles.miniLabel}>Discounts</Text>
              <Text style={styles.miniValue}>{formatMoney(data.total_discounts, currency, true)}</Text>
            </Card>
            <Card style={styles.miniCard}>
              <Text style={styles.miniLabel}>Tax collected</Text>
              <Text style={styles.miniValue}>
                {formatMoney(data.total_tax_collected, currency, true)}
              </Text>
            </Card>
            <Card style={styles.miniCard}>
              <Text style={styles.miniLabel}>Cost of goods</Text>
              <Text style={styles.miniValue}>
                {formatMoney(data.cost_of_goods_sold, currency, true)}
              </Text>
            </Card>
            <Card style={styles.miniCard}>
              <Text style={styles.miniLabel}>{t('expenses')}</Text>
              <Text style={styles.miniValue}>{formatMoney(data.expenses, currency, true)}</Text>
            </Card>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  kpiSlot: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  kpi: {
    gap: spacing.sm,
    minHeight: 124,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
  },
  kpiValue: {
    ...type.heading,
    color: colors.ink,
    fontSize: 21,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chartValue: {
    ...type.title,
    color: colors.ink,
    fontSize: 24,
  },
  chartCaption: {
    ...type.small,
    color: colors.inkMuted,
    marginTop: 2,
  },
  chart: {
    marginTop: spacing.xl,
  },
  muted: {
    ...type.small,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  payments: {
    gap: spacing.lg,
  },
  paymentRow: {
    gap: spacing.sm,
  },
  paymentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  paymentLabel: {
    ...type.small,
    color: colors.ink,
    fontWeight: '600',
  },
  paymentValue: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
  },
  inventoryCard: {
    gap: spacing.lg,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inventoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inventoryLabel: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
  },
  inventoryValue: {
    ...type.heading,
    color: colors.ink,
    fontSize: 18,
  },
  inventorySub: {
    ...type.small,
    color: colors.ink,
    marginTop: 2,
  },
  inventoryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  miniCard: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 3,
  },
  miniLabel: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
  },
  miniValue: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 16,
  },
  rank: {
    backgroundColor: colors.primarySoft,
  },
});
