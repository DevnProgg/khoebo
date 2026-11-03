import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Header,
  Reveal,
  Screen,
  TextField,
} from '../../components/ui';
import { api } from '../../lib/api';
import { daysAgoISO, formatDate, todayISO } from '../../lib/format';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import type { PaymentMethod } from '../../lib/types';

const paymentMethods: { value: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'cash', label: 'Cash', icon: 'cash-outline' },
  { value: 'card', label: 'Card', icon: 'card-outline' },
  { value: 'transfer', label: 'Transfer', icon: 'swap-horizontal-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export default function ExpenseFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { business } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [accountId, setAccountId] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ['accounts', business?.id],
    queryFn: () => api.accounting.accounts(business!.id),
    enabled: Boolean(business),
  });

  const expenseAccounts = (accounts.data ?? []).filter((account) => account.type === 'expense');

  const save = useMutation({
    mutationFn: () =>
      api.accounting.createExpense(business!.id, {
        description: description.trim(),
        amount: Number(amount.replace(',', '.')),
        expense_date: date,
        payment_method: paymentMethod,
        account_id: accountId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['journal-entries', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
        queryClient.invalidateQueries({ queryKey: ['report-income', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['report-trial', business?.id] }),
      ]);
      toast.show('Expense recorded');
      router.back();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = () => {
    if (!description.trim()) {
      toast.show('Describe what you spent on.', 'error');
      return;
    }
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      toast.show('Enter an amount greater than zero.', 'error');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
      toast.show('Use a date like 2026-01-31.', 'error');
      return;
    }
    save.mutate();
  };

  if (!business) {
    return (
      <Screen>
        <Header title="Record expense" />
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
        <Header title="Record expense" subtitle="Keep every cost visible." />

        <Reveal>
          <Card style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="receipt-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.heroLabel}>Amount</Text>
              <Text style={styles.heroAmount}>
                {business.currency} {amount ? Number(amount.replace(',', '.')).toFixed(2) : '0.00'}
              </Text>
              <Text style={styles.heroMeta}>{description.trim() || 'What was it for?'}</Text>
            </View>
          </Card>
        </Reveal>

        <View style={styles.form}>
          <TextField
            label="Description"
            placeholder="e.g. Electricity bill"
            value={description}
            onChangeText={setDescription}
            icon="document-text-outline"
            autoCapitalize="sentences"
          />
          <TextField
            label={`Amount (${business.currency})`}
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            icon="cash-outline"
            keyboardType="decimal-pad"
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
            <Chip
              label="Today"
              selected={date === todayISO()}
              onPress={() => setDate(todayISO())}
            />
            <Chip
              label="Yesterday"
              selected={date === daysAgoISO(1)}
              onPress={() => setDate(daysAgoISO(1))}
            />
            <Chip
              label="2 days ago"
              selected={date === daysAgoISO(2)}
              onPress={() => setDate(daysAgoISO(2))}
            />
          </View>
          <Text style={styles.helper}>Recording for {formatDate(date, true)}</Text>

          <View style={styles.section}>
            <Text style={styles.label}>Paid with</Text>
            <View style={styles.chips}>
              {paymentMethods.map((method) => (
                <Chip
                  key={method.value}
                  label={method.label}
                  icon={method.icon}
                  selected={paymentMethod === method.value}
                  onPress={() => setPaymentMethod(method.value)}
                />
              ))}
            </View>
          </View>

          {expenseAccounts.length ? (
            <View style={styles.section}>
              <Text style={styles.label}>Expense category</Text>
              <View style={styles.chips}>
                <Chip
                  label="Default"
                  selected={!accountId}
                  onPress={() => setAccountId(null)}
                />
                {expenseAccounts.map((account) => (
                  <Chip
                    key={account.id}
                    label={account.name}
                    selected={accountId === account.id}
                    onPress={() => setAccountId(account.id)}
                  />
                ))}
              </View>
              <Text style={styles.helper}>
                Categories keep your income statement meaningful.
              </Text>
            </View>
          ) : null}

          <Card style={styles.note}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={styles.noteText}>
              Khoebo records the journal entry for you, so your books stay balanced.
            </Text>
          </Card>

          <Button
            title="Save expense"
            icon="checkmark-circle-outline"
            onPress={submit}
            loading={save.isPending}
            disabled={save.isPending}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
  },
  heroAmount: {
    ...type.title,
    color: colors.ink,
    fontSize: 24,
    marginTop: 1,
  },
  heroMeta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 1,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    ...type.small,
    color: colors.inkSoft,
    fontWeight: '600',
    marginLeft: 4,
  },
  helper: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginLeft: 4,
    marginTop: -4,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryMist,
  },
  noteText: {
    ...type.small,
    color: colors.inkSoft,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
