import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, ErrorState, Header, LoadingView, Screen } from '../../../components/ui';
import { api } from '../../../lib/api';
import { formatDate, formatMoney } from '../../../lib/format';
import { CURRENCY_CODE, colors, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useLanguage } from '../../../providers/LanguageProvider';

export default function MyRecordsScreen() {
  const router = useRouter();
  const { business } = useAuth();
  const { t } = useLanguage();
  const sales = useQuery({
    queryKey: ['sales', business?.id, 'simple'],
    queryFn: () => api.sales.list(business!.id, { limit: 50 }),
    enabled: Boolean(business),
  });
  const expenses = useQuery({
    queryKey: ['expenses', business?.id, 'simple'],
    queryFn: () => api.accounting.expenses(business!.id, { limit: 50 }),
    enabled: Boolean(business),
  });

  if (!business) {
    return (
      <Screen bottomTab>
        <EmptyState
          icon="storefront-outline"
          title={t('createBusinessFirst')}
          body={t('startRecordingRecords')}
          actionLabel={t('createBusiness')}
          onAction={() => router.push('/(app)/business-form?mode=create')}
        />
      </Screen>
    );
  }
  if (sales.isLoading || expenses.isLoading) return <Screen bottomTab><LoadingView label={t('readingNumbers')} /></Screen>;
  if (sales.isError || expenses.isError) return <Screen bottomTab><ErrorState message={(sales.error ?? expenses.error)?.message ?? 'Could not load records'} onRetry={() => { void sales.refetch(); void expenses.refetch(); }} /></Screen>;
  const records = [
    ...(sales.data ?? []).map((sale) => ({ id: sale.id, date: sale.effective_date, label: t('moneyIn'), amount: sale.total, tone: colors.success })),
    ...(expenses.data ?? []).map((expense) => ({ id: expense.id, date: expense.effective_date, label: t('moneyOut'), amount: expense.amount, tone: colors.danger })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen bottomTab>
      <Header title={t('records')} subtitle={t('modeSimpleBody')} showBack={false} />
      {!records.length ? <EmptyState icon="list-outline" title={t('noSalesYet')} /> : records.map((record) => (
        <Card key={`${record.id}-${record.label}`} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: record.tone }]} />
          <View style={styles.flex}>
            <Text style={styles.label}>{record.label}</Text>
            <Text style={styles.date}>{formatDate(record.date, true)}</Text>
          </View>
          <Text style={[styles.amount, { color: record.tone }]}>{formatMoney(record.amount, CURRENCY_CODE, true)}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { ...type.bodyStrong, color: colors.ink },
  date: { ...type.tiny, color: colors.inkMuted, marginTop: 2 },
  amount: { ...type.bodyStrong },
});