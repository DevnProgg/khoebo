import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionSheet,
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  ProgressBar,
  ScalePressable,
  Screen,
  SectionHeader,
  TextField,
  styles as uiStyles,
} from '../../../components/ui';
import { useBusinessRole } from '../../../hooks/useBusinessRole';
import { api } from '../../../lib/api';
import { formatMoney, formatNumber, toNumber } from '../../../lib/format';
import { colors, radius, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import type { Product, StockMovementType } from '../../../lib/types';

const movementLabels: Record<StockMovementType, string> = {
  in: 'Stock in',
  out: 'Stock out',
  adjustment: 'Set exact stock',
};

export default function StockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { business } = useAuth();
  const { canManage } = useBusinessRole();
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<StockMovementType>('in');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason] = useState('');

  const products = useQuery({
    queryKey: ['products', business?.id],
    queryFn: () => api.products.list(business!.id),
    enabled: Boolean(business),
  });

  const currency = business?.currency ?? 'LSL';
  const all = useMemo(() => products.data ?? [], [products.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((product) => {
      const matchesTerm =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term);
      const matchesLow =
        !lowOnly || (toNumber(product.low_stock_threshold) > 0 &&
          toNumber(product.stock_quantity) <= toNumber(product.low_stock_threshold));
      return matchesTerm && matchesLow;
    });
  }, [all, lowOnly, search]);

  const lowCount = all.filter(
    (product) =>
      toNumber(product.low_stock_threshold) > 0 &&
      toNumber(product.stock_quantity) <= toNumber(product.low_stock_threshold),
  ).length;
  const totalValue = all.reduce(
    (sum, product) => sum + toNumber(product.stock_quantity) * toNumber(product.cost_price),
    0,
  );
  const totalUnits = all.reduce((sum, product) => sum + toNumber(product.stock_quantity), 0);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products', business?.id] }),
      queryClient.invalidateQueries({ queryKey: ['products-low', business?.id] }),
      queryClient.invalidateQueries({ queryKey: ['overview'] }),
    ]);
  };

  const movement = useMutation({
    mutationFn: ({
      product,
      type,
      amount,
      cost,
      note,
    }: {
      product: Product;
      type: StockMovementType;
      amount: number;
      cost?: number;
      note?: string;
    }) =>
      api.products.addMovement(business!.id, product.id, {
        movement_type: type,
        quantity: amount,
        unit_cost: cost,
        reason: note,
      }),
    onSuccess: async () => {
      await invalidate();
      setAdjusting(null);
      setQuantity('');
      setUnitCost('');
      setReason('');
      toast.show('Stock updated');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const deactivate = useMutation({
    mutationFn: (product: Product) => api.products.deactivate(business!.id, product.id),
    onSuccess: async () => {
      await invalidate();
      toast.show('Product archived');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const openAdjust = (product: Product, type: StockMovementType = 'in') => {
    setSelected(null);
    setAdjusting(product);
    setMovementType(type);
    setQuantity(type === 'adjustment' ? String(toNumber(product.stock_quantity)) : '');
    setUnitCost(String(toNumber(product.cost_price) || ''));
    setReason('');
  };

  const submitMovement = () => {
    if (!adjusting) return;
    const amount = Number.parseFloat(quantity);
    if (!Number.isFinite(amount) || amount < 0 || (movementType !== 'adjustment' && amount <= 0)) {
      toast.show('Enter a valid quantity.', 'error');
      return;
    }
    movement.mutate({
      product: adjusting,
      type: movementType,
      amount,
      cost: unitCost ? Number.parseFloat(unitCost) : undefined,
      note: reason.trim() || undefined,
    });
  };

  const confirmDeactivate = (product: Product) => {
    Alert.alert(
      'Archive product?',
      `${product.name} will no longer appear in your active stock or point of sale. Past sales are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => deactivate.mutate(product),
        },
      ],
    );
  };

  if (!business) {
    return (
      <Screen bottomTab>
        <EmptyState
          icon="storefront-outline"
          title="Create a business first"
          body="Products, stock levels and inventory value will live here."
          actionLabel="Create business"
          onAction={() => router.push('/(app)/business-form?mode=create')}
        />
      </Screen>
    );
  }

  return (
    <Screen bottomTab refreshing={products.isRefetching} onRefresh={() => products.refetch()}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>Stock</Text>
          <Text style={styles.subtitle}>Know what you have, at a glance.</Text>
        </View>
        {canManage ? (
          <IconButton
            icon="add"
            tone="primary"
            onPress={() => router.push('/(app)/product-form')}
            accessibilityLabel="Add product"
          />
        ) : null}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Products</Text>
          <Text style={styles.summaryValue}>{all.length}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Units</Text>
          <Text style={styles.summaryValue}>{formatNumber(totalUnits, totalUnits % 1 ? 2 : 0)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Stock value</Text>
          <Text style={styles.summaryValue}>{formatMoney(totalValue, currency, true)}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextField
          icon="search-outline"
          placeholder="Search stock"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          containerStyle={styles.flex}
        />
      </View>

      <View style={styles.filters}>
        <Chip label="All products" selected={!lowOnly} onPress={() => setLowOnly(false)} />
        <Chip
          label={`Low stock${lowCount ? ` · ${lowCount}` : ''}`}
          selected={lowOnly}
          onPress={() => setLowOnly(true)}
          icon="alert-circle-outline"
        />
      </View>

      <SectionHeader title={lowOnly ? 'Running low' : 'All products'} />

      {products.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : products.isError ? (
        <ErrorState message={products.error.message} onRetry={() => products.refetch()} />
      ) : filtered.length ? (
        <View style={styles.list}>
          {filtered.map((product) => {
            const stock = toNumber(product.stock_quantity);
            const threshold = toNumber(product.low_stock_threshold);
            const low = threshold > 0 && stock <= threshold;
            const ratio = threshold > 0 ? Math.min(1, stock / Math.max(threshold * 3, 1)) : Math.min(1, stock / 20);
            return (
              <ScalePressable
                key={product.id}
                onPress={() => setSelected(product)}
                style={styles.row}
                haptic={false}
              >
                <View style={[styles.rowIcon, low && styles.rowIconLow]}>
                  <Ionicons
                    name={low ? 'alert-circle-outline' : 'cube-outline'}
                    size={20}
                    color={low ? colors.warning : colors.primary}
                  />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={styles.rowPrice}>{formatMoney(product.unit_price, currency)}</Text>
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowSku} numberOfLines={1}>
                      {product.sku}
                    </Text>
                    <Badge
                      label={low ? `${formatNumber(stock, stock % 1 ? 2 : 0)} left` : `${formatNumber(stock, stock % 1 ? 2 : 0)} in stock`}
                      tone={low ? 'warning' : 'neutral'}
                    />
                  </View>
                  <ProgressBar
                    value={ratio * 100}
                    max={100}
                    color={low ? colors.warning : colors.primary}
                    height={4}
                  />
                </View>
                <Ionicons name="ellipsis-vertical" size={17} color={colors.inkMuted} />
              </ScalePressable>
            );
          })}
        </View>
      ) : (
        <EmptyState
          icon="cube-outline"
          title={lowOnly ? 'Nothing is low' : search ? 'No products found' : 'No products yet'}
          body={
            lowOnly
              ? 'Your stock levels look healthy.'
              : search
                ? 'Try a different name or SKU.'
                : 'Add your first product to start tracking stock.'
          }
          actionLabel={!lowOnly && !search && canManage ? 'Add product' : undefined}
          onAction={!lowOnly && !search && canManage ? () => router.push('/(app)/product-form') : undefined}
        />
      )}

      <ActionSheet
        visible={Boolean(selected)}
        title={selected?.name}
        onClose={() => setSelected(null)}
        actions={[
          {
            label: 'Adjust stock',
            icon: 'swap-vertical-outline',
            onPress: () => selected && openAdjust(selected),
          },
          ...(canManage
            ? ([
                {
                  label: 'Edit product',
                  icon: 'create-outline',
                  onPress: () =>
                    selected && router.push(`/(app)/product-form?id=${selected.id}` as never),
                },
                {
                  label: 'Archive product',
                  icon: 'archive-outline',
                  destructive: true,
                  onPress: () => selected && confirmDeactivate(selected),
                },
              ] as const)
            : []),
        ]}
      />

      <Modal
        visible={Boolean(adjusting)}
        transparent
        animationType="slide"
        onRequestClose={() => setAdjusting(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setAdjusting(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                <Text style={styles.sheetTitle}>Adjust stock</Text>
                <Text style={styles.sheetSubtitle}>{adjusting?.name}</Text>
              </View>
              <IconButton icon="close" onPress={() => setAdjusting(null)} />
            </View>

            <View style={styles.sheetContent}>
              <View style={styles.currentStock}>
                <Text style={styles.currentLabel}>Current stock</Text>
                <Text style={styles.currentValue}>
                  {formatNumber(adjusting?.stock_quantity, 2)}
                </Text>
              </View>

              <View style={styles.chips}>
                {(['in', 'out', 'adjustment'] as StockMovementType[]).map((type) => (
                  <Chip
                    key={type}
                    label={movementLabels[type]}
                    selected={movementType === type}
                    onPress={() => {
                      setMovementType(type);
                      setQuantity(
                        type === 'adjustment'
                          ? String(toNumber(adjusting?.stock_quantity))
                          : '',
                      );
                    }}
                  />
                ))}
              </View>

              <TextField
                label={movementType === 'adjustment' ? 'New stock level' : 'Quantity'}
                placeholder="0"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                icon="cube-outline"
              />
              {movementType === 'in' ? (
                <TextField
                  label="Unit cost"
                  placeholder="Optional"
                  value={unitCost}
                  onChangeText={setUnitCost}
                  keyboardType="decimal-pad"
                  icon="cash-outline"
                />
              ) : null}
              <TextField
                label="Reason"
                placeholder="Optional note"
                value={reason}
                onChangeText={setReason}
                icon="create-outline"
              />
              <Button
                title="Save stock change"
                icon="checkmark-circle-outline"
                onPress={submitMovement}
                loading={movement.isPending}
                disabled={movement.isPending}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={uiStyles.flex} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  subtitle: {
    ...type.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryMist,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  summaryLabel: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
  },
  summaryValue: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 17,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.lineStrong,
  },
  searchRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  loading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconLow: {
    backgroundColor: colors.warningSoft,
  },
  rowBody: {
    flex: 1,
    gap: 5,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowName: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
    flex: 1,
  },
  rowPrice: {
    ...type.small,
    color: colors.ink,
    fontWeight: '700',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowSku: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
    fontWeight: '500',
    flex: 1,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '92%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
    marginBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...type.heading,
    color: colors.ink,
  },
  sheetSubtitle: {
    ...type.small,
    color: colors.inkSoft,
  },
  sheetContent: {
    gap: spacing.lg,
  },
  currentStock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryMist,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  currentLabel: {
    ...type.small,
    color: colors.inkSoft,
  },
  currentValue: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
