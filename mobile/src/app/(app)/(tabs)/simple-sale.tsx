import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button, Card, EmptyState, Header, Screen, TextField } from '../../../components/ui';
import { api } from '../../../lib/api';
import { todayISO } from '../../../lib/format';
import { colors, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import { useToast } from '../../../providers/ToastProvider';

export default function SimpleSaleScreen() {
  const { business } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [items, setItems] = useState('');
  const [date, setDate] = useState(todayISO());

  const save = useMutation({
    mutationFn: () => api.sales.quick(business!.id, {
      amount: Number(amount.replace(',', '.')),
      items_text: items.trim() || undefined,
      effective_date: date,
      idempotency_key: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['overview', business?.id] });
      await queryClient.invalidateQueries({ queryKey: ['sales', business?.id] });
      toast.show(t('saleSaved'));
      router.replace('/(app)/(tabs)');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = () => {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      toast.show(`${t('amount')} must be greater than zero.`, 'error');
      return;
    }
    const detail = items.trim() || t('moneyIn');
    Alert.alert(t('confirmSale'), `${detail}\nLSL ${value.toFixed(2)}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('save'), onPress: () => save.mutate() },
    ]);
  };

  if (!business) {
    return (
      <Screen bottomTab>
        <EmptyState
          icon="storefront-outline"
          title={t('createBusinessFirst')}
          body={t('startRecordingSales')}
          actionLabel={t('createBusiness')}
          onAction={() => router.push('/(app)/business-form?mode=create')}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen bottomTab>
        <Header title={t('recordSale')} subtitle={t('modeSimpleBody')} showBack={false} />
        <Card style={styles.amountCard}>
          <Text style={styles.amountLabel}>{t('amount')}</Text>
          <Text style={styles.currency}>LSL</Text>
          <TextField value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" containerStyle={styles.amountField} />
        </Card>
        <TextField label={t('quickItems')} value={items} onChangeText={setItems} placeholder="Boss 2, Noodles 2, Coke 3" icon="cart-outline" />
        <TextField label={t('effectiveDate')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" icon="calendar-outline" />
        <Button title={t('save')} icon="checkmark" onPress={submit} loading={save.isPending} disabled={save.isPending} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  amountCard: { alignItems: 'center', backgroundColor: colors.primaryMist, gap: spacing.xs, paddingVertical: spacing.xl },
  amountLabel: { ...type.small, color: colors.inkSoft },
  currency: { ...type.tiny, color: colors.primary, fontWeight: '800' },
  amountField: { width: '100%' },
});