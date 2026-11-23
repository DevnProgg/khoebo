import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  LoadingView,
  MenuRow,
  Screen,
  SectionHeader,
  Segmented,
} from '../../components/ui';
import { api } from '../../lib/api';
import type { ExportFormat } from '../../lib/export-file';
import { daysAgoISO, startOfMonthISO, todayISO } from '../../lib/format';
import { spacing } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useLanguage } from '../../providers/LanguageProvider';
import { useToast } from '../../providers/ToastProvider';

type Period = 'all' | '30d' | 'month';

export default function ExportScreen() {
  const { business } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [dataset, setDataset] = useState('all');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [period, setPeriod] = useState<Period>('all');

  const datasets = useQuery({
    queryKey: ['export-datasets', business?.id],
    queryFn: () => api.exports.datasets(business!.id),
    enabled: Boolean(business),
  });

  const download = useMutation({
    mutationFn: () => {
      const end = period === 'all' ? undefined : todayISO();
      const start =
        period === 'all'
          ? undefined
          : period === '30d'
            ? daysAgoISO(29)
            : startOfMonthISO();
      return api.exports.download(business!.id, dataset, format, start, end);
    },
    onSuccess: () => toast.show(t('exportReady'), 'success'),
    onError: (error: Error) => toast.show(error.message || t('exportFailed'), 'error'),
  });

  return (
    <Screen>
      <Header title={t('dataExport')} subtitle={t('dataExportSubtitle')} />

      <SectionHeader title={t('exportDataset')} />
      {datasets.isLoading ? (
        <LoadingView />
      ) : datasets.isError ? (
        <ErrorState message={datasets.error.message} onRetry={() => datasets.refetch()} />
      ) : datasets.data?.datasets.length ? (
        <Card padded={false}>
          {datasets.data.datasets.map((item, index, list) => (
            <MenuRow
              key={item.id}
              icon={item.id === dataset ? 'checkmark-circle' : 'ellipse-outline'}
              title={item.title}
              onPress={() => setDataset(item.id)}
              last={index === list.length - 1}
            />
          ))}
        </Card>
      ) : (
        <EmptyState compact icon="document-outline" title={t('exportDataset')} />
      )}

      <SectionHeader title={t('exportFormat')} />
      <Segmented
        value={format}
        onChange={setFormat}
        options={[
          { label: 'PDF', value: 'pdf' },
          { label: 'Excel (.xlsx)', value: 'xlsx' },
        ]}
      />

      <SectionHeader title={t('exportPeriod')} />
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { label: t('exportAllTime'), value: 'all' },
          { label: t('thirtyDays'), value: '30d' },
          { label: t('thisMonth'), value: 'month' },
        ]}
      />

      <View style={styles.action}>
        <Button
          title={download.isPending ? t('exportPreparing') : t('exportDownload')}
          icon="download-outline"
          loading={download.isPending}
          disabled={!business || !datasets.data}
          onPress={() => download.mutate()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: spacing.xl,
  },
});
