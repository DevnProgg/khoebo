import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  ScalePressable,
  Screen,
  TextField,
  styles as uiStyles,
} from '../../../components/ui';
import { api, type SaleInput } from '../../../lib/api';
import { formatMoney, formatNumber, toNumber } from '../../../lib/format';
import { colors, radius, shadow, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import type { PaymentMethod, Product, Sale } from '../../../lib/types';

interface CartLine {
  product: Product;
  quantity: number;
}

const paymentMethods: { label: string; value: PaymentMethod; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Cash', value: 'cash', icon: 'cash-outline' },
  { label: 'Card', value: 'card', icon: 'card-outline' },
  { label: 'Transfer', value: 'transfer', icon: 'swap-horizontal-outline' },
  { label: 'Other', value: 'other', icon: 'ellipsis-horizontal-outline' },
];

export default function SellScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { business } = useAuth();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState<Sale | null>(null);

  const products = useQuery({
    queryKey: ['products', business?.id],
    queryFn: () => api.products.list(business!.id),
    enabled: Boolean(business),
  });

  const currency = business?.currency ?? 'LSL';
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = products.data ?? [];
    if (!term) return list;
    return list.filter(
      (product) =>
        product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term),
    );
  }, [products.data, search]);

  const subtotal = cart.reduce(
    (sum, line) => sum + toNumber(line.product.unit_price) * line.quantity,
    0,
  );
  const discountValue = Math.min(Math.max(Number.parseFloat(discount) || 0, 0), subtotal);
  const taxValue = Math.max(0, ((subtotal - discountValue) * (Number.parseFloat(taxRate) || 0)) / 100);
  const total = subtotal - discountValue + taxValue;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const addToCart = (product: Product) => {
    const stock = toNumber(product.stock_quantity);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        if (existing.quantity >= stock) {
          toast.show('No more stock available for this item.', 'error');
          return current;
        }
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) => {
          if (line.product.id !== productId) return line;
          const stock = toNumber(line.product.stock_quantity);
          const next = Math.min(line.quantity + delta, stock);
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0),
    );
  };

  const resetForm = () => {
    setCustomerName('');
    setDiscount('');
    setTaxRate('');
    setNotes('');
    setPayment('cash');
  };

  const sale = useMutation({
    mutationFn: (payload: SaleInput) => api.sales.create(business!.id, payload),
    onSuccess: async (created) => {
      setCart([]);
      setReviewOpen(false);
      resetForm();
      setCompleted(created);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
        queryClient.invalidateQueries({ queryKey: ['sales-recent', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['sales', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['products-low', business?.id] }),
      ]);
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const completeSale = () => {
    if (!cart.length) return;
    sale.mutate({
      items: cart.map((line) => ({
        product_id: line.product.id,
        quantity: line.quantity,
        unit_price: toNumber(line.product.unit_price),
      })),
      customer_name: customerName.trim() || null,
      discount_amount: discountValue,
      tax_rate: Number.parseFloat(taxRate) || 0,
      payment_method: payment,
      notes: notes.trim() || null,
    });
  };

  if (!business) {
    return (
      <Screen bottomTab>
        <EmptyState
          icon="storefront-outline"
          title="Create a business first"
          body="Once your business is set up, products and sales will live here."
          actionLabel="Create business"
          onAction={() => router.push('/(app)/business-form?mode=create')}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={uiStyles.flex}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>Sell</Text>
          <Text style={styles.subtitle}>Tap a product to add it to the cart.</Text>
        </View>
        <IconButton
          icon="time-outline"
          onPress={() => router.push('/(app)/sales-history')}
          accessibilityLabel="Sales history"
        />
      </View>

      <View style={styles.searchWrap}>
        <TextField
          icon="search-outline"
          placeholder="Search products or SKU"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          containerStyle={styles.searchField}
        />
      </View>

      {products.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : products.isError ? (
        <ErrorState message={products.error.message} onRetry={() => products.refetch()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columns}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshing={products.isRefetching}
          onRefresh={() => products.refetch()}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title={search ? 'No products found' : 'No products yet'}
              body={
                search
                  ? 'Try a different name or SKU.'
                  : 'Add your first product to start selling.'
              }
              actionLabel={search ? undefined : 'Add product'}
              onAction={search ? undefined : () => router.push('/(app)/product-form')}
            />
          }
          renderItem={({ item, index }) => {
            const stock = toNumber(item.stock_quantity);
            const inCart = cart.find((line) => line.product.id === item.id);
            const outOfStock = stock <= 0;
            return (
              <Animated.View
                entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}
                style={styles.productSlot}
              >
                <ScalePressable
                  onPress={() => addToCart(item)}
                  disabled={outOfStock}
                  style={[
                    styles.productCard,
                    inCart && styles.productCardActive,
                    outOfStock && styles.productCardDisabled,
                  ]}
                >
                  <View style={styles.productTop}>
                    <View style={styles.productIcon}>
                      <Ionicons
                        name="pricetag-outline"
                        size={16}
                        color={outOfStock ? colors.inkMuted : colors.primary}
                      />
                    </View>
                    {inCart ? (
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>{inCart.quantity}</Text>
                      </View>
                    ) : (
                      <Ionicons
                        name={outOfStock ? 'close-circle-outline' : 'add-circle'}
                        size={21}
                        color={outOfStock ? colors.inkMuted : colors.primary}
                      />
                    )}
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productSku} numberOfLines={1}>
                    {item.sku}
                  </Text>
                  <View style={styles.productBottom}>
                    <Text style={styles.productPrice}>
                      {formatMoney(item.unit_price, currency)}
                    </Text>
                    <Text style={[styles.productStock, outOfStock && styles.outOfStock]}>
                      {outOfStock ? 'Out' : `${formatNumber(stock, stock % 1 ? 2 : 0)} left`}
                    </Text>
                  </View>
                </ScalePressable>
              </Animated.View>
            );
          }}
        />
      )}

      <View style={styles.cartBar}>
        <View style={styles.cartSummary}>
          <View style={styles.cartIcon}>
            <Ionicons name="bag-handle" size={18} color={colors.primary} />
            {itemCount ? (
              <View style={styles.cartCount}>
                <Text style={styles.cartCountText}>{itemCount > 99 ? '99+' : itemCount}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.flex}>
            <Text style={styles.cartLabel}>
              {itemCount ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'Cart is empty'}
            </Text>
            <Text style={styles.cartTotal}>{formatMoney(total, currency)}</Text>
          </View>
        </View>
        <Button
          title="Review"
          small
          icon="arrow-forward"
          disabled={!cart.length}
          onPress={() => setReviewOpen(true)}
          style={styles.reviewButton}
        />
      </View>

      <Modal
        visible={reviewOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReviewOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setReviewOpen(false)} />
          <View style={[styles.reviewSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Review sale</Text>
                <Text style={styles.sheetSubtitle}>{itemCount} items in this order</Text>
              </View>
              <IconButton icon="close" onPress={() => setReviewOpen(false)} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.reviewContent}
            >
              <View style={styles.linesCard}>
                {cart.map((line, index) => (
                  <View
                    key={line.product.id}
                    style={[styles.line, index < cart.length - 1 && styles.lineBorder]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.lineName} numberOfLines={1}>
                        {line.product.name}
                      </Text>
                      <Text style={styles.linePrice}>
                        {formatMoney(line.product.unit_price, currency)} each
                      </Text>
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={() => changeQuantity(line.product.id, -1)}
                        hitSlop={8}
                        style={styles.stepperButton}
                      >
                        <Ionicons name="remove" size={16} color={colors.ink} />
                      </Pressable>
                      <Text style={styles.stepperValue}>{line.quantity}</Text>
                      <Pressable
                        onPress={() => changeQuantity(line.product.id, 1)}
                        hitSlop={8}
                        style={styles.stepperButton}
                      >
                        <Ionicons name="add" size={16} color={colors.ink} />
                      </Pressable>
                    </View>
                    <Text style={styles.lineTotal}>
                      {formatMoney(toNumber(line.product.unit_price) * line.quantity, currency)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.form}>
                <TextField
                  label="Customer name"
                  placeholder="Walk-in customer"
                  value={customerName}
                  onChangeText={setCustomerName}
                  icon="person-outline"
                />
                <View style={styles.twoCols}>
                  <TextField
                    label="Discount"
                    placeholder="0.00"
                    value={discount}
                    onChangeText={setDiscount}
                    keyboardType="decimal-pad"
                    icon="pricetag-outline"
                    containerStyle={styles.flex}
                  />
                  <TextField
                    label="Tax rate %"
                    placeholder="0"
                    value={taxRate}
                    onChangeText={setTaxRate}
                    keyboardType="decimal-pad"
                    icon="pie-chart-outline"
                    containerStyle={styles.flex}
                  />
                </View>

                <View style={styles.paymentWrap}>
                  <Text style={styles.fieldLabel}>Payment method</Text>
                  <View style={styles.chips}>
                    {paymentMethods.map((method) => (
                      <Chip
                        key={method.value}
                        label={method.label}
                        icon={method.icon}
                        selected={payment === method.value}
                        onPress={() => setPayment(method.value)}
                      />
                    ))}
                  </View>
                </View>

                <TextField
                  label="Notes"
                  placeholder="Optional note"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </View>

              <View style={styles.totals}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{formatMoney(subtotal, currency)}</Text>
                </View>
                {discountValue > 0 ? (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Discount</Text>
                    <Text style={styles.totalValue}>-{formatMoney(discountValue, currency)}</Text>
                  </View>
                ) : null}
                {taxValue > 0 ? (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Tax</Text>
                    <Text style={styles.totalValue}>{formatMoney(taxValue, currency)}</Text>
                  </View>
                ) : null}
                <View style={[styles.totalRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Total</Text>
                  <Text style={styles.grandTotal}>{formatMoney(total, currency)}</Text>
                </View>
              </View>

              <Button
                title={`Complete sale · ${formatMoney(total, currency)}`}
                icon="checkmark-circle-outline"
                onPress={completeSale}
                loading={sale.isPending}
                disabled={sale.isPending || !cart.length}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(completed)} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <Animated.View entering={FadeIn.duration(220)} style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={38} color={colors.white} />
            </View>
            <Text style={styles.successTitle}>Sale complete</Text>
            <Text style={styles.successAmount}>
              {formatMoney(completed?.total, currency)}
            </Text>
            <Text style={styles.successRef}>{completed?.reference}</Text>
            <View style={styles.successActions}>
              <Button
                title="New sale"
                onPress={() => setCompleted(null)}
                style={styles.flex}
              />
              <Button
                title="View receipt"
                variant="secondary"
                onPress={() => {
                  const saleId = completed?.id;
                  setCompleted(null);
                  if (saleId) router.push(`/(app)/sale/${saleId}` as never);
                }}
                style={styles.flex}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
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
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchField: {
    gap: 0,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 108,
    gap: spacing.md,
  },
  columns: {
    gap: spacing.md,
  },
  productSlot: {
    flex: 1,
  },
  productCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 152,
    gap: 2,
  },
  productCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMist,
  },
  productCardDisabled: {
    opacity: 0.5,
  },
  productTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  productIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  qtyBadgeText: {
    ...type.tiny,
    color: colors.white,
    fontWeight: '800',
  },
  productName: {
    ...type.bodyStrong,
    fontSize: 14,
    color: colors.ink,
    minHeight: 38,
  },
  productSku: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
    fontWeight: '500',
  },
  productBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
  productPrice: {
    ...type.bodyStrong,
    color: colors.primary,
    fontSize: 14,
  },
  productStock: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
    fontWeight: '500',
  },
  outOfStock: {
    color: colors.danger,
  },
  cartBar: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    ...shadow,
  },
  cartSummary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cartIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.white,
  },
  cartLabel: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
  },
  cartTotal: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.ink,
  },
  reviewButton: {
    minWidth: 116,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay,
  },
  reviewSheet: {
    maxHeight: '92%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
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
    justifyContent: 'space-between',
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
    marginTop: 1,
  },
  reviewContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  linesCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  lineBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  lineName: {
    ...type.small,
    color: colors.ink,
    fontWeight: '600',
  },
  linePrice: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
    fontWeight: '500',
    marginTop: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  stepperButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    ...type.small,
    color: colors.ink,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  lineTotal: {
    ...type.small,
    color: colors.ink,
    fontWeight: '700',
    minWidth: 65,
    textAlign: 'right',
  },
  form: {
    gap: spacing.lg,
  },
  twoCols: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  paymentWrap: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...type.small,
    color: colors.inkSoft,
    fontWeight: '600',
    marginLeft: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  totals: {
    backgroundColor: colors.primaryMist,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...type.small,
    color: colors.inkSoft,
  },
  totalValue: {
    ...type.small,
    color: colors.ink,
    fontWeight: '600',
  },
  grandTotalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  grandTotalLabel: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 16,
  },
  grandTotal: {
    ...type.heading,
    color: colors.primary,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  successCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow,
  },
  successIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  successTitle: {
    ...type.heading,
    color: colors.ink,
  },
  successAmount: {
    ...type.display,
    color: colors.primary,
    fontSize: 32,
  },
  successRef: {
    ...type.small,
    color: colors.inkMuted,
  },
  successActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
