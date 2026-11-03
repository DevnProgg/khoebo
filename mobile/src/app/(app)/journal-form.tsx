import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  LoadingView,
  Reveal,
  ScalePressable,
  Screen,
  TextField,
} from '../../components/ui';
import { api } from '../../lib/api';
import { daysAgoISO, formatMoney, titleCase, todayISO } from '../../lib/format';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';

interface DraftLine {
  key: string;
  accountId: string | null;
  debit: string;
  credit: string;
  description: string;
}

function amount(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

let lineCounter = 0;

function newLine(): DraftLine {
  lineCounter += 1;
  return {
    key: `line-${lineCounter}`,
    accountId: null,
    debit: '',
    credit: '',
    description: '',
  };
}

export default function JournalFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { business } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine(), newLine()]);
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ['accounts', business?.id],
    queryFn: () => api.accounting.accounts(business!.id),
    enabled: Boolean(business),
  });

  const sortedAccounts = useMemo(
    () => [...(accounts.data ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
    [accounts.data],
  );

  const byId = useMemo(
    () => new Map((accounts.data ?? []).map((account) => [account.id, account])),
    [accounts.data],
  );

  const totals = useMemo(
    () => ({
      debit: lines.reduce((sum, line) => sum + amount(line.debit), 0),
      credit: lines.reduce((sum, line) => sum + amount(line.credit), 0),
    }),
    [lines],
  );

  const balanced = Math.abs(totals.debit - totals.credit) < 0.005;
  const pickerLine = lines.find((line) => line.key === pickerKey);

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const save = useMutation({
    mutationFn: () => {
      if (!business) throw new Error('Choose a business first.');
      return api.accounting.createJournalEntry(business.id, {
        entry_date: date,
        memo: memo.trim(),
        lines: lines.map((line) => ({
          account_id: line.accountId!,
          debit: amount(line.debit),
          credit: amount(line.credit),
          description: line.description.trim() || null,
        })),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['journal-entries', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
        queryClient.invalidateQueries({ queryKey: ['report-trial', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['report-income', business?.id] }),
      ]);
      toast.show('Journal entry posted');
      router.back();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = () => {
    if (!memo.trim()) {
      toast.show('Add a memo for this entry.', 'error');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
      toast.show('Use a date like 2026-01-31.', 'error');
      return;
    }
    if (lines.length < 2) {
      toast.show('A journal entry needs at least two lines.', 'error');
      return;
    }
    for (const line of lines) {
      if (!line.accountId) {
        toast.show('Choose an account for every line.', 'error');
        return;
      }
      const debit = amount(line.debit);
      const credit = amount(line.credit);
      if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        toast.show('Each line needs either a debit or a credit, not both.', 'error');
        return;
      }
    }
    if (!balanced) {
      toast.show('Debits and credits must match before posting.', 'error');
      return;
    }
    save.mutate();
  };

  if (!business) {
    return (
      <Screen>
        <Header title="Journal entry" />
        <EmptyState icon="storefront-outline" title="Create a business first" />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Header title="Journal entry" subtitle="Post a balanced movement by hand." />

        <Reveal>
          <Card style={styles.balance}>
            <View style={styles.balanceRow}>
              <View style={styles.flex}>
                <Text style={styles.balanceLabel}>Debits</Text>
                <Text style={styles.balanceValue}>
                  {formatMoney(totals.debit, business.currency)}
                </Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.flex}>
                <Text style={styles.balanceLabel}>Credits</Text>
                <Text style={styles.balanceValue}>
                  {formatMoney(totals.credit, business.currency)}
                </Text>
              </View>
            </View>
            <Badge
              label={balanced ? 'Balanced' : 'Out of balance'}
              tone={balanced ? 'success' : 'warning'}
              icon={balanced ? 'checkmark-circle' : 'alert-circle'}
            />
          </Card>
        </Reveal>

        <View style={styles.form}>
          <TextField
            label="Memo"
            placeholder="e.g. Owner capital contribution"
            value={memo}
            onChangeText={setMemo}
            icon="document-text-outline"
            autoCapitalize="sentences"
          />
          <TextField
            label="Date"
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
            icon="calendar-outline"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.chips}>
            <Chip label="Today" selected={date === todayISO()} onPress={() => setDate(todayISO())} />
            <Chip
              label="Yesterday"
              selected={date === daysAgoISO(1)}
              onPress={() => setDate(daysAgoISO(1))}
            />
          </View>
        </View>

        <View style={styles.linesHeader}>
          <Text style={styles.linesTitle}>Lines</Text>
          <Button
            title="Add line"
            variant="ghost"
            icon="add"
            small
            onPress={() => setLines((current) => [...current, newLine()])}
          />
        </View>

        {accounts.isLoading ? (
          <LoadingView label="Loading accounts" />
        ) : accounts.isError ? (
          <ErrorState message={accounts.error.message} onRetry={() => accounts.refetch()} />
        ) : (
          <View style={styles.lines}>
            {lines.map((line, index) => {
              const account = line.accountId ? byId.get(line.accountId) : null;
              return (
                <Card key={line.key} style={styles.line}>
                  <View style={styles.lineHeader}>
                    <Text style={styles.lineNumber}>Line {index + 1}</Text>
                    {lines.length > 2 ? (
                      <IconButton
                        icon="close"
                        size={16}
                        onPress={() =>
                          setLines((current) => current.filter((item) => item.key !== line.key))
                        }
                        accessibilityLabel="Remove line"
                      />
                    ) : null}
                  </View>

                  <ScalePressable
                    onPress={() => setPickerKey(line.key)}
                    haptic={false}
                    style={[styles.accountPicker, !account && styles.accountPickerEmpty]}
                  >
                    <View style={styles.accountIcon}>
                      <Ionicons
                        name="albums-outline"
                        size={18}
                        color={account ? colors.primary : colors.inkMuted}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text
                        style={[styles.accountName, !account && styles.accountPlaceholder]}
                        numberOfLines={1}
                      >
                        {account ? `${account.code} · ${account.name}` : 'Choose account'}
                      </Text>
                      {account ? (
                        <Text style={styles.accountType}>{titleCase(account.type)}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-down" size={17} color={colors.inkMuted} />
                  </ScalePressable>

                  <View style={styles.amountRow}>
                    <TextField
                      label="Debit"
                      placeholder="0.00"
                      value={line.debit}
                      onChangeText={(value) =>
                        updateLine(line.key, { debit: value, credit: '' })
                      }
                      keyboardType="decimal-pad"
                      containerStyle={styles.flex}
                    />
                    <TextField
                      label="Credit"
                      placeholder="0.00"
                      value={line.credit}
                      onChangeText={(value) =>
                        updateLine(line.key, { credit: value, debit: '' })
                      }
                      keyboardType="decimal-pad"
                      containerStyle={styles.flex}
                    />
                  </View>

                  <TextField
                    label="Line note"
                    placeholder="Optional"
                    value={line.description}
                    onChangeText={(value) => updateLine(line.key, { description: value })}
                  />
                </Card>
              );
            })}
          </View>
        )}

        <Card style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.noteText}>
            Every entry must balance. The trial balance and income statement update as soon as you
            post.
          </Text>
        </Card>

        <Button
          title="Post entry"
          icon="checkmark-circle-outline"
          onPress={submit}
          loading={save.isPending}
          disabled={save.isPending || !accounts.data?.length}
          style={styles.submit}
        />
      </Screen>

      <Modal
        visible={Boolean(pickerKey)}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerKey(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setPickerKey(null)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Choose account</Text>
            <ScrollView style={styles.accountList} showsVerticalScrollIndicator={false}>
              {sortedAccounts.map((account, index) => {
                const selected = pickerLine?.accountId === account.id;
                return (
                  <ScalePressable
                    key={account.id}
                    haptic={false}
                    onPress={() => {
                      if (pickerLine) {
                        updateLine(pickerLine.key, { accountId: account.id });
                      }
                      setPickerKey(null);
                    }}
                    style={[
                      styles.accountRow,
                      index < sortedAccounts.length - 1 && styles.accountRowBorder,
                    ]}
                  >
                    <View style={[styles.codeBadge, selected && styles.codeBadgeSelected]}>
                      <Text style={[styles.codeText, selected && styles.codeTextSelected]}>
                        {account.code}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.rowName}>{account.name}</Text>
                      <Text style={styles.rowType}>{titleCase(account.type)}</Text>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </ScalePressable>
                );
              })}
            </ScrollView>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setPickerKey(null)}
              style={styles.sheetCancel}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  balance: {
    gap: spacing.md,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
  },
  balanceValue: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 18,
    marginTop: 2,
  },
  balanceDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.line,
    marginHorizontal: spacing.lg,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  linesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  linesTitle: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.ink,
  },
  lines: {
    gap: spacing.md,
  },
  line: {
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -4,
  },
  lineNumber: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  accountPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  accountPickerEmpty: {
    borderStyle: 'dashed',
  },
  accountIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 13,
  },
  accountPlaceholder: {
    color: colors.inkMuted,
    fontWeight: '600',
  },
  accountType: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
    marginTop: 1,
  },
  amountRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryMist,
    marginTop: spacing.lg,
  },
  noteText: {
    ...type.small,
    color: colors.inkSoft,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  submit: {
    marginTop: spacing.lg,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '78%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...type.bodyStrong,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  accountList: {
    flexGrow: 0,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  accountRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  codeBadge: {
    minWidth: 46,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryMist,
    alignItems: 'center',
  },
  codeBadgeSelected: {
    backgroundColor: colors.primary,
  },
  codeText: {
    ...type.tiny,
    color: colors.inkSoft,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  codeTextSelected: {
    color: colors.white,
  },
  rowName: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 13,
  },
  rowType: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
    marginTop: 1,
  },
  sheetCancel: {
    marginTop: spacing.md,
  },
});
