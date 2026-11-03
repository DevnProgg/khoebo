import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Header,
  LoadingView,
  Reveal,
  ScalePressable,
  Screen,
  SectionHeader,
  Segmented,
  TextField,
} from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime, formatMoney, toNumber, titleCase } from '../../lib/format';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useLanguage } from '../../providers/LanguageProvider';
import type { SaleStatus } from '../../lib/types';

type Filter = 'all' | SaleStatus;

export default function SalesHistoryScreen() {
  const router = useRouter();
  const { business } = useAuth();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const sales = useQuery({
    queryKey: ['sales', business?.id, filter],
    queryFn: () =>
      api.sales.list(business!.id, {
        limit: 200,
        ...(filter === 'all' ? {} : { status: filter }),
      }),
    enabled: Boolean(business),
  });

  const currency = business?.currency ?? 'LSL';
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = sales.data ?? [];
    if (!term) return list;
    return list.filter(
      (sale) =>
        sale.reference.toLowerCase().includes(term) ||
        (sale.customer_name ?? '').toLowerCase().includes(term),
    );
  }, [sales.data, search]);

  const completed = (sales.data ?? []).filter((sale) => sale.status === 'completed');
  const revenue = completed.reduce((sum, sale) => sum + toNumber(sale.total), 0);

  return (
    <Screen refreshing={sales.isRefetching} onRefresh={() => sales.refetch()}>
      <Header title={t('salesHistory')} subtitle={t('salesHistorySubtitle')} />

      <Reveal>
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('completed')}</Text>
            <Text style={styles.summaryValue}>{completed.length}</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('revenue')}</Text>
            <Text style={styles.summaryValue}>{formatMoney(revenue, currency, true)}</Text>
          </Card>
        </View>
      </Reveal>

      <View style={styles.filters}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { label: t('all'), value: 'all' },
            { label: t('completed'), value: 'completed' },
            { label: t('refunded'), value: 'refunded' },
          ]}
          style={styles.flex}
        />
      </View>

      <View style={styles.search}>
        <TextField
          icon="search-outline"
          placeholder={t('searchReference')}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <SectionHeader title={`${filtered.length} ${filtered.length === 1 ? t('sale') : t('salesPlural')}`} />

      {sales.isLoading ? (
        <LoadingView />
      ) : sales.isError ? (
        <ErrorState message={sales.error.message} onRetry={() => sales.refetch()} />
      ) : filtered.length ? (
        <View style={styles.list}>
          {filtered.map((sale) => (
            <ScalePressable
              key={sale.id}
              onPress={() => router.push(`/(app)/sale/${sale.id}` as never)}
              style={styles.row}
            >
              <View
                style={[
                  styles.icon,
                  sale.status !== 'completed' && { backgroundColor: colors.warningSoft },
                ]}
              >
                <Ionicons
                  name={sale.status === 'completed' ? 'receipt-outline' : 'return-down-back-outline'}
                  size={19}
                  color={sale.status === 'completed' ? colors.primary : colors.warning}
                />
              </View>
              <View style={styles.flex}>
                <View style={styles.rowTop}>
                  <Text style={styles.ref}>{sale.reference}</Text>
                  <Text style={styles.amount}>{formatMoney(sale.total, currency)}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.meta} numberOfLines={1}>
                    {sale.customer_name || 'Walk-in'} · {titleCase(sale.payment_method)} ·{' '}
                    {formatDateTime(sale.created_at)}
                  </Text>
                  <Badge
                    label={sale.status === 'completed' ? t('paid') : titleCase(sale.status)}
                    tone={sale.status === 'completed' ? 'success' : 'warning'}
                  />
                </View>
              </View>
            </ScalePressable>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="receipt-outline"
          title={search ? t('noMatchingSales') : t('noSalesHere')}
          body={
            search
              ? 'Try a different reference or customer name.'
              : 'Sales you record will appear here with their receipts.'
          }
          actionLabel={!search ? t('makeSale') : undefined}
          onAction={!search ? () => router.push('/(app)/(tabs)/sell') : undefined}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    gap: 3,
  },
  summaryLabel: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
  },
  summaryValue: {
    ...type.heading,
    color: colors.ink,
    fontSize: 20,
  },
  filters: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  search: {
    marginTop: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ref: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  amount: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 3,
  },
  meta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 11,
    flex: 1,
  },
});
