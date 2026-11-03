import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
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
  Screen,
  Segmented,
} from '../../components/ui';
import { api } from '../../lib/api';
import {
  daysAgoISO,
  formatDate,
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

type ReportTab = 'trial' | 'income' | 'inventory' | 'sales';
type RangeKey = '7d' | '30d' | 'month';

export default function ReportsScreen() {
  const { business } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<ReportTab>('trial');
  const [range, setRange] = useState<RangeKey>('month');
  const end = todayISO();
  const start = useMemo(() => {
    if (range === '7d') return daysAgoISO(6);
    if (range === '30d') return daysAgoISO(29);
    return startOfMonthISO();
  }, [range]);

  const currency = business?.currency ?? 'LSL';

  const trial = useQuery({
    queryKey: ['report-trial', business?.id],
    queryFn: () => api.reports.trialBalance(business!.id),
    enabled: Boolean(business) && tab === 'trial',
  });
  const income = useQuery({
    queryKey: ['report-income', business?.id, start, end],
    queryFn: () => api.reports.incomeStatement(business!.id, start, end),
    enabled: Boolean(business) && tab === 'income',
  });
  const inventory = useQuery({
    queryKey: ['report-inventory', business?.id],
    queryFn: () => api.reports.inventoryValuation(business!.id),
    enabled: Boolean(business) && tab === 'inventory',
  });
  const sales = useQuery({
    queryKey: ['report-sales', business?.id, start, end],
    queryFn: () => api.reports.salesSummary(business!.id, start, end),
    enabled: Boolean(business) && tab === 'sales',
  });

  const active = { trial, income, inventory, sales }[tab];
  const refreshing = active.isRefetching;
  const refresh = () => active.refetch();

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header title={t('reports')} subtitle={t('reportsSubtitle')} />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { label: t('trial'), value: 'trial' },
          { label: t('income'), value: 'income' },
          { label: t('inventory'), value: 'inventory' },
          { label: t('sales'), value: 'sales' },
        ]}
      />

      {tab === 'income' || tab === 'sales' ? (
        <View style={styles.rangeRow}>
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { label: t('sevenDays'), value: '7d' },
              { label: t('thirtyDays'), value: '30d' },
              { label: t('thisMonth'), value: 'month' },
            ]}
            style={styles.flex}
          />
        </View>
      ) : null}

      {tab === 'trial' ? (
        trial.isLoading ? (
          <LoadingView />
        ) : trial.isError ? (
          <ErrorState message={trial.error.message} onRetry={() => trial.refetch()} />
        ) : trial.data ? (
          <>
            <Reveal>
              <Card style={styles.balanceCard}>
                <View style={styles.flex}>
                  <Text style={styles.balanceLabel}>{t('trialBalance')}</Text>
                  <Text style={styles.balanceValue}>
                    {formatMoney(trial.data.total_debit, currency)}
                  </Text>
                  <Text style={styles.balanceCaption}>
                    {trial.data.accounts.length} accounts · debits equal credits
                  </Text>
                </View>
                <Badge
                  label={trial.data.balanced ? 'Balanced' : 'Out of balance'}
                  tone={trial.data.balanced ? 'success' : 'danger'}
                  icon={trial.data.balanced ? 'checkmark-circle' : 'alert-circle'}
                />
              </Card>
            </Reveal>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHead, styles.flex]}>Account</Text>
              <Text style={styles.tableHeadAmount}>Debit</Text>
              <Text style={styles.tableHeadAmount}>Credit</Text>
            </View>

            <Card padded={false}>
              {trial.data.accounts
                .filter(
                  (row) => toNumber(row.debit) !== 0 || toNumber(row.credit) !== 0,
                )
                .map((row, index, list) => (
                  <View
                    key={row.account_id}
                    style={[styles.tableRow, index < list.length - 1 && styles.tableBorder]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.accountName} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Text style={styles.accountMeta}>
                        {row.code} · {titleCase(row.type)}
                      </Text>
                    </View>
                    <Text style={styles.amount}>
                      {toNumber(row.debit) ? formatMoney(row.debit, currency) : '—'}
                    </Text>
                    <Text style={styles.amount}>
                      {toNumber(row.credit) ? formatMoney(row.credit, currency) : '—'}
                    </Text>
                  </View>
                ))}
              {trial.data.accounts.every(
                (row) => toNumber(row.debit) === 0 && toNumber(row.credit) === 0,
              ) ? (
                <EmptyState
                  compact
                  icon="book-outline"
                  title="No entries yet"
                  body="Journal entries from sales and expenses will show up here."
                />
              ) : null}
            </Card>
          </>
        ) : null
      ) : null}

      {tab === 'income' ? (
        income.isLoading ? (
          <LoadingView />
        ) : income.isError ? (
          <ErrorState message={income.error.message} onRetry={() => income.refetch()} />
        ) : income.data ? (
          <>
            <Reveal>
              <Card style={styles.netCard}>
                <Text style={styles.netLabel}>Net income</Text>
                <Text
                  style={[
                    styles.netValue,
                    { color: toNumber(income.data.net_income) >= 0 ? colors.success : colors.danger },
                  ]}
                >
                  {formatMoney(income.data.net_income, currency)}
                </Text>
                <Text style={styles.netCaption}>
                  {formatDate(income.data.start_date)} to {formatDate(income.data.end_date, true)}
                </Text>
              </Card>
            </Reveal>

            <Text style={styles.groupTitle}>{t('revenue')}</Text>
            <Card padded={false}>
              {income.data.revenue.length ? (
                income.data.revenue.map((line, index, list) => (
                  <View
                    key={line.code}
                    style={[styles.lineRow, index < list.length - 1 && styles.tableBorder]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.accountName}>{line.name}</Text>
                      <Text style={styles.accountMeta}>{line.code}</Text>
                    </View>
                    <Text style={styles.amount}>{formatMoney(line.amount, currency)}</Text>
                  </View>
                ))
              ) : (
                <EmptyState compact icon="trending-up-outline" title="No revenue in this period" />
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total revenue</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(income.data.total_revenue, currency)}
                </Text>
              </View>
            </Card>

            <Text style={styles.groupTitle}>{t('expenses')}</Text>
            <Card padded={false}>
              {income.data.expenses.length ? (
                income.data.expenses.map((line, index, list) => (
                  <View
                    key={line.code}
                    style={[styles.lineRow, index < list.length - 1 && styles.tableBorder]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.accountName}>{line.name}</Text>
                      <Text style={styles.accountMeta}>{line.code}</Text>
                    </View>
                    <Text style={styles.amount}>{formatMoney(line.amount, currency)}</Text>
                  </View>
                ))
              ) : (
                <EmptyState compact icon="receipt-outline" title="No expenses in this period" />
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total expenses</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(income.data.total_expenses, currency)}
                </Text>
              </View>
            </Card>
          </>
        ) : null
      ) : null}

      {tab === 'inventory' ? (
        inventory.isLoading ? (
          <LoadingView />
        ) : inventory.isError ? (
          <ErrorState message={inventory.error.message} onRetry={() => inventory.refetch()} />
        ) : inventory.data ? (
          <>
            <Reveal>
              <Card style={styles.netCard}>
                <Text style={styles.netLabel}>Inventory value</Text>
                <Text style={styles.netValue}>
                  {formatMoney(inventory.data.total_value, currency)}
                </Text>
                <Text style={styles.netCaption}>
                  {formatNumber(inventory.data.total_units, 2)} units on hand
                </Text>
              </Card>
            </Reveal>

            <Card padded={false}>
              {inventory.data.items.length ? (
                inventory.data.items.map((item, index, list) => (
                  <View
                    key={item.product_id}
                    style={[styles.lineRow, index < list.length - 1 && styles.tableBorder]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.accountName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.accountMeta}>
                        {item.sku} · {formatNumber(item.quantity, 2)} ×{' '}
                        {formatMoney(item.cost_price, currency)}
                      </Text>
                    </View>
                    <Text style={styles.amount}>{formatMoney(item.value, currency)}</Text>
                  </View>
                ))
              ) : (
                <EmptyState
                  compact
                  icon="cube-outline"
                  title="No stock to value"
                  body="Add products to see your inventory value."
                />
              )}
            </Card>
          </>
        ) : null
      ) : null}

      {tab === 'sales' ? (
        sales.isLoading ? (
          <LoadingView />
        ) : sales.isError ? (
          <ErrorState message={sales.error.message} onRetry={() => sales.refetch()} />
        ) : sales.data ? (
          <>
            <Reveal>
              <Card style={styles.netCard}>
                <Text style={styles.netLabel}>Gross revenue</Text>
                <Text style={styles.netValue}>{formatMoney(sales.data.gross_revenue, currency)}</Text>
                <Text style={styles.netCaption}>
                  {sales.data.completed_sales} completed · {sales.data.refunded_sales} refunded
                </Text>
              </Card>
            </Reveal>

            <View style={styles.kpiGrid}>
              <Card style={styles.kpi}>
                <Text style={styles.kpiLabel}>Net revenue</Text>
                <Text style={styles.kpiValue}>{formatMoney(sales.data.net_revenue, currency)}</Text>
              </Card>
              <Card style={styles.kpi}>
                <Text style={styles.kpiLabel}>Total sales</Text>
                <Text style={styles.kpiValue}>{formatNumber(sales.data.total_sales)}</Text>
              </Card>
              <Card style={styles.kpi}>
                <Text style={styles.kpiLabel}>Discounts</Text>
                <Text style={styles.kpiValue}>{formatMoney(sales.data.discounts, currency)}</Text>
              </Card>
              <Card style={styles.kpi}>
                <Text style={styles.kpiLabel}>Tax collected</Text>
                <Text style={styles.kpiValue}>
                  {formatMoney(sales.data.tax_collected, currency)}
                </Text>
              </Card>
            </View>

            <View style={styles.note}>
              <Ionicons name="information-circle-outline" size={17} color={colors.inkMuted} />
              <Text style={styles.noteText}>
                Net revenue is sales before tax, after discounts. Refunded sales are excluded.
              </Text>
            </View>
          </>
        ) : null
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rangeRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  balanceLabel: {
    ...type.small,
    color: colors.inkSoft,
  },
  balanceValue: {
    ...type.title,
    color: colors.ink,
    fontSize: 25,
    marginTop: 2,
  },
  balanceCaption: {
    ...type.small,
    color: colors.inkMuted,
    marginTop: 2,
    fontSize: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  tableHead: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tableHeadAmount: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    width: 78,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tableBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  accountName: {
    ...type.small,
    color: colors.ink,
    fontWeight: '600',
  },
  accountMeta: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
    fontWeight: '500',
    marginTop: 2,
  },
  amount: {
    ...type.small,
    color: colors.ink,
    width: 78,
    textAlign: 'right',
    fontSize: 12,
  },
  netCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.primaryMist,
    alignItems: 'flex-start',
    gap: 3,
  },
  netLabel: {
    ...type.small,
    color: colors.inkSoft,
  },
  netValue: {
    ...type.display,
    color: colors.ink,
    fontSize: 34,
  },
  netCaption: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
  },
  groupTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 15,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.primaryMist,
  },
  totalLabel: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  totalValue: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 15,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  kpi: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 3,
  },
  kpiLabel: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
  },
  kpiValue: {
    ...type.heading,
    color: colors.ink,
    fontSize: 18,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  noteText: {
    ...type.small,
    color: colors.inkMuted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
