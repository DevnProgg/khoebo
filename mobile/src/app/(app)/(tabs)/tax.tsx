import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BusinessSwitcher } from '../../../components/BusinessSwitcher';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  LoadingView,
  Reveal,
  Screen,
  SectionHeader,
} from '../../../components/ui';
import { useBusinessRole } from '../../../hooks/useBusinessRole';
import { api } from '../../../lib/api';
import { formatDate, formatMoney } from '../../../lib/format';
import { CURRENCY_CODE, colors, radius, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import { useToast } from '../../../providers/ToastProvider';
import type { TaxReturnStatus } from '../../../lib/types';

function currentTaxYear(): { start: string; end: string } {
  const today = new Date();
  const taxYearEnd = today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear();
  return {
    start: `${taxYearEnd - 1}-04-01`,
    end: `${taxYearEnd}-03-31`,
  };
}

function statusTone(status: TaxReturnStatus | string): 'neutral' | 'success' | 'danger' | 'warning' {
  if (status === 'filed' || status === 'approved' || status === 'validated') return 'success';
  if (status === 'flagged') return 'danger';
  return 'neutral';
}

export default function TaxScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { business } = useAuth();
  const { canManage } = useBusinessRole();
  const { t } = useLanguage();
  const period = useMemo(() => currentTaxYear(), []);

  const calculation = useQuery({
    queryKey: ['tax-calculation', business?.id, period.start, period.end],
    queryFn: () => api.tax.calculation(business!.id, 'income_tax', period.start, period.end),
    enabled: Boolean(business),
  });
  const deadlines = useQuery({
    queryKey: ['tax-deadlines', business?.id],
    queryFn: () => api.tax.deadlines(business!.id),
    enabled: Boolean(business),
  });
  const returns = useQuery({
    queryKey: ['tax-returns', business?.id],
    queryFn: () => api.tax.returns(business!.id),
    enabled: Boolean(business),
  });

  const latest = returns.data?.[0];
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tax-calculation', business?.id] }),
      queryClient.invalidateQueries({ queryKey: ['tax-returns', business?.id] }),
    ]);
  };
  const generate = useMutation({
    mutationFn: () => api.tax.generate(business!.id, 'income_tax', period.start, period.end),
    onSuccess: async () => {
      await invalidate();
      toast.show('Tax return generated');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });
  const approve = useMutation({
    mutationFn: () => api.tax.approve(business!.id, latest!.id),
    onSuccess: async () => {
      await invalidate();
      toast.show('Tax return approved');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });
  const handoff = useMutation({
    mutationFn: () => api.tax.handoff(business!.id, latest!.id),
    onSuccess: () => toast.show('Ready for filing in the RSL portal'),
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const openPortal = async () => {
    try {
      const portal = await api.tax.portal(business!.id);
      await Linking.openURL(portal.url);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not open the RSL portal.', 'error');
    }
  };

  if (!business) {
    return (
      <Screen bottomTab>
        <Header title={t('tax')} showBack={false} />
        <EmptyState
          icon="storefront-outline"
          title={t('createBusinessFirst')}
          actionLabel={t('createBusiness')}
          onAction={() => router.push('/(app)/business-form?mode=create')}
        />
      </Screen>
    );
  }

  const busy = calculation.isLoading || deadlines.isLoading || returns.isLoading;
  const calculationError = calculation.error ?? deadlines.error ?? returns.error;
  const liability = calculation.data?.tax_liability;
  const taxValue = liability?.tax ?? liability?.net_vat;

  return (
    <Screen
      bottomTab
      refreshing={calculation.isRefetching || deadlines.isRefetching || returns.isRefetching}
      onRefresh={() => {
        void Promise.all([calculation.refetch(), deadlines.refetch(), returns.refetch()]);
      }}
    >
      <Header title={t('tax')} subtitle={t('taxSubtitle')} showBack={false} />
      <BusinessSwitcher />

      {busy ? (
        <LoadingView label={t('readingNumbers')} />
      ) : calculationError ? (
        <ErrorState message={calculationError.message} onRetry={() => calculation.refetch()} />
      ) : (
        <>
          <Reveal>
            <Card style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroIcon}>
                  <Ionicons name="receipt-outline" size={22} color={colors.primary} />
                </View>
                <Badge
                  label={calculation.data?.status === 'validated' ? t('taxReady') : t('taxNeedsReview')}
                  tone={calculation.data ? statusTone(calculation.data.status) : 'warning'}
                />
              </View>
              <Text style={styles.heroLabel}>{t('taxDue')}</Text>
              <Text style={styles.heroValue}>{formatMoney(taxValue, CURRENCY_CODE)}</Text>
              <Text style={styles.heroMeta}>
                {formatDate(period.start, true)} - {formatDate(period.end, true)}
              </Text>
              {calculation.data?.rule_version ? (
                <Text style={styles.rule}>{t('taxRule')}: {calculation.data.rule_version}</Text>
              ) : null}
            </Card>
          </Reveal>

          {calculation.data?.warnings.length ? (
            <Reveal delay={60}>
              <Card style={styles.warningCard}>
                <View style={styles.warningTitle}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                  <Text style={styles.warningHeading}>{t('taxNeedsReview')}</Text>
                </View>
                {calculation.data.warnings.slice(0, 3).map((warning) => (
                  <Text key={warning.code} style={styles.warningText}>{warning.message}</Text>
                ))}
              </Card>
            </Reveal>
          ) : null}

          {canManage ? (
            latest?.status === 'validated' ? (
              <Button
                title="Approve return"
                icon="checkmark-circle-outline"
                onPress={() => approve.mutate()}
                loading={approve.isPending}
                disabled={approve.isPending}
              />
            ) : latest?.status === 'approved' ? (
              <Button
                title="Prepare RSL handoff"
                icon="arrow-forward-circle-outline"
                onPress={() => handoff.mutate()}
                loading={handoff.isPending}
                disabled={handoff.isPending}
              />
            ) : (
              <Button
                title="Generate current return"
                icon="document-text-outline"
                onPress={() => generate.mutate()}
                loading={generate.isPending}
                disabled={generate.isPending || calculation.data?.status === 'flagged'}
              />
            )
          ) : null}

          <SectionHeader title={t('taxDeadlines')} />
          <View style={styles.list}>
            {(deadlines.data?.deadlines ?? []).slice(0, 3).map((deadline) => (
              <Card key={`${deadline.reporting_start}-${deadline.reporting_end}`} style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{deadline.label}</Text>
                  <Text style={styles.rowMeta}>
                    {deadline.due_date ? `Due ${formatDate(deadline.due_date, true)}` : t('taxNeedsReview')}
                  </Text>
                </View>
                <Badge label={deadline.status} tone={deadline.status === 'overdue' ? 'danger' : 'neutral'} />
              </Card>
            ))}
          </View>

          <SectionHeader title={t('taxReturns')} />
          {latest ? (
            <Card style={styles.returnCard}>
              <View style={styles.returnTop}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{latest.tax_type.replace('_', ' ')}</Text>
                  <Text style={styles.rowMeta}>
                    {latest.reporting_period.start} - {latest.reporting_period.end}
                  </Text>
                </View>
                <Badge label={latest.status} tone={statusTone(latest.status)} />
              </View>
              <Text style={styles.returnRule}>{t('taxRule')}: {latest.rule_version}</Text>
            </Card>
          ) : (
            <EmptyState icon="document-text-outline" title={t('noTaxReturns')} />
          )}

          <Card style={styles.portalCard}>
            <View style={styles.portalIcon}>
              <Ionicons name="open-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{t('openRsl')}</Text>
              <Text style={styles.rowMeta}>{t('manualFiling')}</Text>
            </View>
            <Button title="Open" variant="secondary" small onPress={openPortal} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { backgroundColor: colors.primaryMist, gap: spacing.xs },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { ...type.small, color: colors.inkSoft, marginTop: spacing.sm },
  heroValue: { ...type.display, color: colors.ink },
  heroMeta: { ...type.small, color: colors.inkSoft },
  rule: { ...type.tiny, color: colors.primary, fontWeight: '700', marginTop: spacing.sm },
  warningCard: { backgroundColor: colors.warningSoft, gap: spacing.xs },
  warningTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  warningHeading: { ...type.small, color: colors.warning, fontWeight: '800' },
  warningText: { ...type.small, color: colors.inkSoft },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...type.small, color: colors.ink, fontWeight: '800', textTransform: 'capitalize' },
  rowMeta: { ...type.tiny, color: colors.inkMuted, marginTop: 2 },
  returnCard: { gap: spacing.sm },
  returnTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  returnRule: { ...type.tiny, color: colors.inkMuted },
  portalCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  portalIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
