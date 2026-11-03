import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  Header,
  IconButton,
  LoadingView,
  Reveal,
  Screen,
  SectionHeader,
} from '../../../components/ui';
import { useBusinessRole } from '../../../hooks/useBusinessRole';
import { api } from '../../../lib/api';
import { formatDateTime, formatMoney, formatNumber, titleCase, toNumber } from '../../../lib/format';
import { colors, radius, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { business } = useAuth();
  const { canManage } = useBusinessRole();

  const sale = useQuery({
    queryKey: ['sale', business?.id, id],
    queryFn: () => api.sales.get(business!.id, id),
    enabled: Boolean(business && id),
  });

  const currency = business?.currency ?? 'LSL';
  const data = sale.data;

  const refund = useMutation({
    mutationFn: () => api.sales.refund(business!.id, id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sale', business?.id, id] }),
        queryClient.invalidateQueries({ queryKey: ['sales', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['sales-recent', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
        queryClient.invalidateQueries({ queryKey: ['products', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['products-low', business?.id] }),
      ]);
      toast.show('Sale refunded');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const shareReceipt = async () => {
    if (!data) return;
    const lines = data.items
      .map(
        (item) =>
          `${item.product_name} × ${formatNumber(item.quantity, 2)}  ${formatMoney(
            item.line_total,
            currency,
          )}`,
      )
      .join('\n');
    await Share.share({
      message: `${business?.name ?? 'Khoebo'}\nSale ${data.reference}\n${formatDateTime(
        data.created_at,
      )}\n\n${lines}\n\nTotal: ${formatMoney(data.total, currency)}`,
    }).catch(() => undefined);
  };

  const confirmRefund = () => {
    Alert.alert(
      'Refund this sale?',
      'Stock will be returned and the accounting entries reversed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: () => refund.mutate(),
        },
      ],
    );
  };

  if (sale.isLoading) {
    return (
      <Screen>
        <Header title="Sale" />
        <LoadingView label="Loading receipt" />
      </Screen>
    );
  }

  if (sale.isError || !data) {
    return (
      <Screen>
        <Header title="Sale" />
        <ErrorState
          message={sale.error?.message ?? 'This sale could not be found.'}
          onRetry={() => sale.refetch()}
        />
      </Screen>
    );
  }

  const paid = data.status === 'completed';

  return (
    <Screen refreshing={sale.isRefetching} onRefresh={() => sale.refetch()}>
      <Header
        title="Receipt"
        subtitle={data.reference}
        right={<IconButton icon="share-outline" onPress={shareReceipt} accessibilityLabel="Share receipt" />}
      />

      <Reveal>
        <Card style={styles.hero}>
          <View style={[styles.statusIcon, !paid && styles.statusIconRefunded]}>
            <Ionicons
              name={paid ? 'checkmark' : 'return-down-back'}
              size={28}
              color={colors.white}
            />
          </View>
          <Text style={styles.heroAmount}>{formatMoney(data.total, currency)}</Text>
          <Badge
            label={paid ? 'Paid' : titleCase(data.status)}
            tone={paid ? 'success' : 'warning'}
            icon={paid ? 'checkmark-circle' : 'alert-circle'}
          />
          <Text style={styles.heroDate}>{formatDateTime(data.created_at)}</Text>
        </Card>
      </Reveal>

      <View style={styles.metaGrid}>
        <Card style={styles.metaCard}>
          <Text style={styles.metaLabel}>Customer</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {data.customer_name || 'Walk-in'}
          </Text>
        </Card>
        <Card style={styles.metaCard}>
          <Text style={styles.metaLabel}>Payment</Text>
          <Text style={styles.metaValue}>{titleCase(data.payment_method)}</Text>
        </Card>
      </View>

      <SectionHeader title={`${data.items.length} ${data.items.length === 1 ? 'item' : 'items'}`} />
      <Card padded={false}>
        {data.items.map((item, index) => (
          <View
            key={item.id}
            style={[styles.itemRow, index < data.items.length - 1 && styles.itemBorder]}
          >
            <View style={styles.qty}>
              <Text style={styles.qtyText}>{formatNumber(item.quantity, 2)}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.product_name}
              </Text>
              <Text style={styles.itemMeta}>
                {formatMoney(item.unit_price, currency)} each
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatMoney(item.line_total, currency)}</Text>
          </View>
        ))}
      </Card>

      <SectionHeader title="Summary" />
      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatMoney(data.subtotal, currency)}</Text>
        </View>
        {toNumber(data.discount_amount) > 0 ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount</Text>
            <Text style={styles.summaryValue}>-{formatMoney(data.discount_amount, currency)}</Text>
          </View>
        ) : null}
        {toNumber(data.tax_amount) > 0 ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax ({formatNumber(data.tax_rate, 2)}%)</Text>
            <Text style={styles.summaryValue}>{formatMoney(data.tax_amount, currency)}</Text>
          </View>
        ) : null}
        <Divider style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(data.total, currency)}</Text>
        </View>
      </Card>

      {data.notes ? (
        <Card style={styles.notes}>
          <Text style={styles.metaLabel}>Notes</Text>
          <Text style={styles.notesText}>{data.notes}</Text>
        </Card>
      ) : null}

      {data.refunded_at ? (
        <View style={styles.refundNote}>
          <Ionicons name="information-circle-outline" size={17} color={colors.warning} />
          <Text style={styles.refundText}>
            Refunded on {formatDateTime(data.refunded_at)}.
          </Text>
        </View>
      ) : null}

      {paid && canManage ? (
        <Button
          title="Refund sale"
          variant="danger"
          icon="return-down-back-outline"
          onPress={confirmRefund}
          loading={refund.isPending}
          disabled={refund.isPending}
          style={styles.refundButton}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surfaceAlt,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statusIconRefunded: {
    backgroundColor: colors.warning,
  },
  heroAmount: {
    ...type.display,
    color: colors.ink,
    fontSize: 36,
  },
  heroDate: {
    ...type.small,
    color: colors.inkMuted,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metaCard: {
    flex: 1,
    gap: 2,
  },
  metaLabel: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
  },
  metaValue: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  qty: {
    minWidth: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryMist,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  qtyText: {
    ...type.small,
    color: colors.primary,
    fontWeight: '800',
  },
  itemName: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  itemMeta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 1,
  },
  itemTotal: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  summary: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...type.small,
    color: colors.inkSoft,
  },
  summaryValue: {
    ...type.small,
    color: colors.ink,
    fontWeight: '600',
  },
  divider: {
    marginVertical: spacing.sm,
  },
  totalLabel: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 16,
  },
  totalValue: {
    ...type.heading,
    color: colors.primary,
  },
  notes: {
    marginTop: spacing.lg,
    gap: 4,
  },
  notesText: {
    ...type.body,
    color: colors.inkSoft,
  },
  refundNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  refundText: {
    ...type.small,
    color: colors.warning,
    flex: 1,
  },
  refundButton: {
    marginTop: spacing.xxl,
  },
});
