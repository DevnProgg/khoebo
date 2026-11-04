import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, EmptyState, Header, Screen, TextField } from '../../../components/ui';
import { api } from '../../../lib/api';
import { todayISO } from '../../../lib/format';
import { spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import { useToast } from '../../../providers/ToastProvider';

const categories = ['Stock', 'Transport', 'Rent', 'Airtime/Data', 'Other'];

export default function MoneyOutScreen() {
  const router = useRouter();
  const { business } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState(todayISO());

  const save = useMutation({
    mutationFn: () => api.accounting.createExpense(business!.id, {
      amount: Number(amount.replace(',', '.')),
      description: `${category}: ${note.trim() || category}`,
      expense_date: date,
      effective_date: date,
      payment_method: 'cash',
      idempotency_key: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['overview', business?.id] });
      await queryClient.invalidateQueries({ queryKey: ['expenses', business?.id] });
      toast.show(t('expenseSaved'));
      setAmount('');
      setNote('');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = () => {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      toast.show(`${t('amount')} must be greater than zero.`, 'error');
      return;
    }
    save.mutate();
  };

  if (!business) {
    return (
      <Screen bottomTab>
        <EmptyState
          icon="storefront-outline"
          title={t('createBusinessFirst')}
          body={t('startRecordingExpenses')}
          actionLabel={t('createBusiness')}
          onAction={() => router.push('/(app)/business-form?mode=create')}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen bottomTab>
        <Header title={t('moneyOut')} subtitle={t('modeSimpleBody')} showBack={false} />
        <TextField label={t('amount')} value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" icon="cash-outline" />
        <TextField label={t('note')} value={note} onChangeText={setNote} placeholder={t('note')} icon="document-text-outline" />
        <Text style={styles.label}>{t('category')}</Text>
        <View style={styles.chips}>
          {categories.map((option) => <Chip key={option} label={option} selected={category === option} onPress={() => setCategory(option)} />)}
        </View>
        <TextField label={t('effectiveDate')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" icon="calendar-outline" />
        <Button title={t('save')} icon="checkmark" onPress={submit} loading={save.isPending} disabled={save.isPending} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  label: { ...type.small, color: '#59685F', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});