import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  LoadingView,
  Reveal,
  ScalePressable,
  Screen,
  SectionHeader,
  Segmented,
} from '../../components/ui';
import { useBusinessRole } from '../../hooks/useBusinessRole';
import { api } from '../../lib/api';
import { formatDate, formatMoney, relativeDay, titleCase, toNumber } from '../../lib/format';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import type { Account, JournalEntry } from '../../lib/types';

type Tab = 'journal' | 'expenses';

export default function BookkeepingScreen() {
  const router = useRouter();
  const { business } = useAuth();
  const { canManage } = useBusinessRole();
  const [tab, setTab] = useState<Tab>('journal');
  const [expanded, setExpanded] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ['accounts', business?.id],
    queryFn: () => api.accounting.accounts(business!.id),
    enabled: Boolean(business),
  });
  const journal = useQuery({
    queryKey: ['journal-entries', business?.id],
    queryFn: () => api.accounting.journalEntries(business!.id, { limit: 100 }),
    enabled: Boolean(business),
  });
  const expenses = useQuery({
    queryKey: ['expenses', business?.id],
    queryFn: () => api.accounting.expenses(business!.id, { limit: 100 }),
    enabled: Boolean(business),
  });

  const currency = business?.currency ?? 'USD';
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    (accounts.data ?? []).forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts.data]);

  const totalExpenses = (expenses.data ?? []).reduce(
    (sum, expense) => sum + toNumber(expense.amount),
    0,
  );
  const active = tab === 'journal' ? journal : expenses;
  const refreshing = active.isRefetching;
  const refresh = () => active.refetch();

  const entryTotal = (entry: JournalEntry) =>
    entry.lines.reduce((sum, line) => sum + toNumber(line.debit), 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header
        title="Bookkeeping"
        subtitle="Every transaction, neatly recorded."
        right={
          canManage ? (
            <IconButton
              icon="add"
              tone="primary"
              onPress={() =>
                router.push(tab === 'journal' ? '/(app)/journal-form' : '/(app)/expense-form')
              }
              accessibilityLabel={tab === 'journal' ? 'New journal entry' : 'Add expense'}
            />
          ) : undefined
        }
      />

      <Segmented
        value={tab}
        onChange={(value) => {
          setTab(value);
          setExpanded(null);
        }}
        options={[
          { label: 'Journal', value: 'journal' },
          { label: 'Expenses', value: 'expenses' },
        ]}
      />

      <Reveal>
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="book-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.summaryLabel}>Entries</Text>
            <Text style={styles.summaryValue}>{journal.data?.length ?? '—'}</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="receipt-outline" size={18} color={colors.warning} />
            </View>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryValue}>
              {expenses.data ? formatMoney(totalExpenses, currency, true) : '—'}
            </Text>
          </Card>
        </View>
      </Reveal>

      {tab === 'journal' ? (
        <>
          <SectionHeader title="Journal entries" />
          {journal.isLoading ? (
            <LoadingView />
          ) : journal.isError ? (
            <ErrorState message={journal.error.message} onRetry={() => journal.refetch()} />
          ) : journal.data?.length ? (
            <View style={styles.list}>
              {journal.data.map((entry, index) => {
                const open = expanded === entry.id;
                return (
                  <Animated.View
                    key={entry.id}
                    entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(300)}
                  >
                    <Pressable
                      onPress={() => setExpanded(open ? null : entry.id)}
                      style={styles.entry}
                    >
                      <View style={styles.entryTop}>
                        <View style={styles.entryDate}>
                          <Text style={styles.entryDay}>{formatDate(entry.entry_date).split(' ')[1]}</Text>
                          <Text style={styles.entryMonth}>
                            {formatDate(entry.entry_date).split(' ')[0]}
                          </Text>
                        </View>
                        <View style={styles.flex}>
                          <Text style={styles.entryMemo} numberOfLines={1}>
                            {entry.memo}
                          </Text>
                          <Text style={styles.entryMeta}>
                            {relativeDay(entry.entry_date)} · {entry.lines.length} lines
                            {entry.reference_type ? ` · ${titleCase(entry.reference_type)}` : ''}
                          </Text>
                        </View>
                        <View style={styles.entryRight}>
                          <Text style={styles.entryAmount}>
                            {formatMoney(entryTotal(entry), currency)}
                          </Text>
                          <Ionicons
                            name={open ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.inkMuted}
                          />
                        </View>
                      </View>
                      {open ? (
                        <View style={styles.lines}>
                          {entry.lines.map((line) => {
                            const account = accountMap.get(line.account_id);
                            return (
                              <View key={line.id} style={styles.lineRow}>
                                <View style={styles.flex}>
                                  <Text style={styles.lineAccount} numberOfLines={1}>
                                    {account?.name ?? 'Account'}
                                  </Text>
                                  <Text style={styles.lineCode}>{account?.code ?? '—'}</Text>
                                </View>
                                <Text style={styles.lineDebit}>
                                  {toNumber(line.debit)
                                    ? `Dr ${formatMoney(line.debit, currency)}`
                                    : ''}
                                </Text>
                                <Text style={styles.lineCredit}>
                                  {toNumber(line.credit)
                                    ? `Cr ${formatMoney(line.credit, currency)}`
                                    : ''}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon="book-outline"
              title="No journal entries yet"
              body="Sales and expenses post automatically. You can also add an entry by hand."
              actionLabel={canManage ? 'New journal entry' : undefined}
              onAction={canManage ? () => router.push('/(app)/journal-form') : undefined}
            />
          )}
        </>
      ) : (
        <>
          <SectionHeader title="Expenses" />
          {expenses.isLoading ? (
            <LoadingView />
          ) : expenses.isError ? (
            <ErrorState message={expenses.error.message} onRetry={() => expenses.refetch()} />
          ) : expenses.data?.length ? (
            <Card padded={false}>
              {expenses.data.map((expense, index, list) => (
                <ScalePressable
                  key={expense.id}
                  haptic={false}
                  style={[styles.expenseRow, index < list.length - 1 && styles.expenseBorder]}
                >
                  <View style={styles.expenseIcon}>
                    <Ionicons name="arrow-up-outline" size={18} color={colors.warning} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.expenseTitle} numberOfLines={1}>
                      {expense.description}
                    </Text>
                    <Text style={styles.expenseMeta}>
                      {formatDate(expense.expense_date)} · {titleCase(expense.payment_method)}
                    </Text>
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount}>
                      {formatMoney(expense.amount, currency)}
                    </Text>
                    <Badge label="Expense" tone="warning" />
                  </View>
                </ScalePressable>
              ))}
            </Card>
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No expenses yet"
              body="Record rent, transport, supplies and other costs here."
              actionLabel={canManage ? 'Add expense' : undefined}
              onAction={canManage ? () => router.push('/(app)/expense-form') : undefined}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    gap: 3,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
  },
  summaryValue: {
    ...type.heading,
    color: colors.ink,
    fontSize: 19,
  },
  list: {
    gap: spacing.md,
  },
  entry: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  entryDate: {
    width: 42,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryDay: {
    ...type.bodyStrong,
    color: colors.primary,
    fontSize: 16,
    lineHeight: 19,
  },
  entryMonth: {
    ...type.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 9,
  },
  entryMemo: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  entryMeta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 2,
  },
  entryRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  entryAmount: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 13,
  },
  lines: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  lineAccount: {
    ...type.small,
    color: colors.ink,
    fontWeight: '600',
    fontSize: 12,
  },
  lineCode: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
    fontSize: 10,
  },
  lineDebit: {
    ...type.tiny,
    color: colors.success,
    letterSpacing: 0,
    width: 84,
    textAlign: 'right',
  },
  lineCredit: {
    ...type.tiny,
    color: colors.danger,
    letterSpacing: 0,
    width: 84,
    textAlign: 'right',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  expenseBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  expenseMeta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  expenseAmount: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
});
