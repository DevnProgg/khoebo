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
import {
  formatMoney,
  formatNumber,
  generateCashShortcuts,
  roundMoney,
  titleCase,
  toNumber,
} from '../../../lib/format';
import { CURRENCY_CODE, colors, radius, shadow, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import type { PaymentMethod, Product, Sale } from '../../../lib/types';

interface CartLine {
  product: Product;
  quantity: number;
}

export default function SellScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { business } = useAuth();
  const { t } = useLanguage();
  const paymentMethods = [
    { label: t('cash'), value: 'cash' as PaymentMethod, icon: 'cash-outline' as const },
    { label: t('card'), value: 'card' as PaymentMethod, icon: 'card-outline' as const },
    { label: t('transfer'), value: 'transfer' as PaymentMethod, icon: 'swap-horizontal-outline' as const },
    { label: t('other'), value: 'other' as PaymentMethod, icon: 'ellipsis-horizontal-outline' as const },
  ];
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState<Sale | null>(null);

  const products = useQuery({
    queryKey: ['products', business?.id],
    queryFn: () => api.products.list(business!.id),
    enabled: Boolean(business),
  });

  const currency = CURRENCY_CODE;
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
  const roundedTotal = roundMoney(total);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const cashShortcuts = useMemo(() => generateCashShortcuts(roundedTotal), [roundedTotal]);

  const isCash = payment === 'cash';
  const parsedReceived = amountReceived.trim() === '' ? null : Number.parseFloat(amountReceived);
  const receivedValue =
    parsedReceived !== null && Number.isFinite(parsedReceived) ? roundMoney(parsedReceived) : null;

  const cashStatus = useMemo(() => {
    if (!isCash) return 'valid';
    if (receivedValue === null) return 'unentered';
    if (receivedValue < roundedTotal) return 'insufficient';
    if (receivedValue === roundedTotal) return 'exact';
    return 'change';
  }, [isCash, receivedValue, roundedTotal]);

  const changeDue =
    receivedValue !== null && receivedValue >= roundedTotal
      ? roundMoney(receivedValue - roundedTotal)
      : 0;
  const remainingBalance =
    receivedValue !== null && receivedValue < roundedTotal
      ? roundMoney(roundedTotal - receivedValue)
      : roundedTotal;

  const onSelectShortcut = (amount: number) => {
    setAmountReceived(amount.toFixed(amount % 1 === 0 ? 0 : 2));
    Haptics.selectionAsync().catch(() => undefined);
  };

  const addToCart = (product: Product) => {
    const stock = toNumber(product.stock_quantity);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        if (existing.quantity >= stock) {
          toast.show(t('noMoreStock'), 'error');
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
    setAmountReceived('');
    setShowMoreOptions(false);
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
    if (isCash) {
      if (receivedValue === null || receivedValue < roundedTotal) {
        toast.show(t('insufficientCash'), 'error');
        return;
      }
    }
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
      amount_paid: isCash ? (receivedValue ?? roundedTotal) : roundedTotal,
      notes: notes.trim() || null,
    });
  };

  if (!business) {
    return (
      <Screen bottomTab>
        <EmptyState
          icon="storefront-outline"
          title={t('createBusinessFirst')}
          body={t('stockSubtitle')}
          actionLabel={t('createBusiness')}
          onAction={() => router.push('/(app)/business-form?mode=create')}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={uiStyles.flex}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>{t('sell')}</Text>
          <Text style={styles.subtitle}>{t('sellSubtitle')}</Text>
        </View>
        <IconButton
          icon="time-outline"
          onPress={() => router.push('/(app)/sales-history')}
          accessibilityLabel={t('salesHistory')}
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
                  <Text style={styles.grandTotalLabel}>Total due</Text>
                  <Text style={styles.grandTotal}>{formatMoney(total, currency)}</Text>
                </View>
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

              {isCash ? (
                <View style={styles.cashSection}>
                  <TextField
                    label={t('amountReceived')}
                    placeholder={formatMoney(roundedTotal, currency)}
                    value={amountReceived}
                    onChangeText={setAmountReceived}
                    keyboardType="decimal-pad"
                    icon="cash-outline"
                  />

                  {cashShortcuts.length > 0 ? (
                    <View style={styles.shortcutsWrap}>
                      {cashShortcuts.map((amount, idx) => {
                        const isExact = idx === 0;
                        const isSelected =
                          receivedValue !== null && roundMoney(amount) === receivedValue;
                        return (
                          <Pressable
                            key={amount}
                            onPress={() => onSelectShortcut(amount)}
                            style={[
                              styles.shortcutChip,
                              isSelected && styles.shortcutChipSelected,
                              isExact && styles.shortcutChipExact,
                            ]}
                          >
                            <Text
                              style={[
                                styles.shortcutText,
                                isSelected && styles.shortcutTextSelected,
                                isExact && styles.shortcutTextExact,
                              ]}
                            >
                              {isExact
                                ? `${t('exactAmount')}: ${formatMoney(amount, currency)}`
                                : formatMoney(amount, currency)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  {cashStatus === 'change' ? (
                    <View style={[styles.feedbackBox, styles.feedbackBoxSuccess]}>
                      <View style={styles.feedbackRow}>
                        <View style={styles.flex}>
                          <Text style={styles.feedbackLabelSuccess}>{t('changeDue')}</Text>
                          <Text style={styles.feedbackAmountSuccess}>
                            {formatMoney(changeDue, currency)}
                          </Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                      </View>
                    </View>
                  ) : cashStatus === 'exact' ? (
                    <View style={[styles.feedbackBox, styles.feedbackBoxSuccess]}>
                      <View style={styles.feedbackRow}>
                        <View style={styles.flex}>
                          <Text style={styles.feedbackLabelSuccess}>{t('changeDue')}</Text>
                          <Text style={styles.feedbackAmountSuccess}>
                            {formatMoney(0, currency)} · {t('paidInFull')}
                          </Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                      </View>
                    </View>
                  ) : cashStatus === 'insufficient' ? (
                    <View style={[styles.feedbackBox, styles.feedbackBoxWarning]}>
                      <View style={styles.feedbackRow}>
                        <View style={styles.flex}>
                          <Text style={styles.feedbackLabelWarning}>{t('remainingBalance')}</Text>
                          <Text style={styles.feedbackAmountWarning}>
                            {formatMoney(remainingBalance, currency)}
                          </Text>
                          <Text style={styles.feedbackSubtextWarning}>
                            {t('insufficientCash')}
                          </Text>
                        </View>
                        <Ionicons name="alert-circle" size={28} color={colors.danger} />
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.feedbackBox, styles.feedbackBoxNeutral]}>
                      <Text style={styles.feedbackNeutralText}>
                        Enter cash received from customer or select a quick shortcut.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.feedbackBox, styles.feedbackBoxNeutral]}>
                  <View style={styles.feedbackRow}>
                    <View style={styles.flex}>
                      <Text style={styles.feedbackNeutralTitle}>
                        {titleCase(payment)} payment
                      </Text>
                      <Text style={styles.feedbackNeutralText}>
                        Charge {formatMoney(roundedTotal, currency)} directly via {payment}.
                      </Text>
                    </View>
                    <Ionicons name="card-outline" size={24} color={colors.primary} />
                  </View>
                </View>
              )}

              <View style={styles.moreOptionsWrap}>
                <Pressable
                  onPress={() => setShowMoreOptions((prev) => !prev)}
                  style={styles.moreOptionsToggle}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showMoreOptions ? 'chevron-up-circle-outline' : 'add-circle-outline'}
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.moreOptionsToggleText}>
                    {showMoreOptions ? t('hideOptions') : t('moreOptions')}
                  </Text>
                </Pressable>

                {showMoreOptions ? (
                  <Animated.View entering={FadeInDown.duration(200)} style={styles.form}>
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
                    <TextField
                      label="Notes"
                      placeholder="Optional note"
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                    />
                  </Animated.View>
                ) : null}
              </View>

              <Button
                title={`Complete sale · ${formatMoney(total, currency)}`}
                icon="checkmark-circle-outline"
                onPress={completeSale}
                loading={sale.isPending}
                disabled={
                  sale.isPending ||
                  !cart.length ||
                  (isCash && (receivedValue === null || receivedValue < roundedTotal))
                }
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

            {completed?.payment_method === 'cash' ? (
              <View style={styles.successBreakdown}>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Total due</Text>
                  <Text style={styles.successValue}>
                    {formatMoney(completed.total, currency)}
                  </Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Cash received</Text>
                  <Text style={styles.successValue}>
                    {formatMoney(completed.amount_paid ?? completed.total, currency)}
                  </Text>
                </View>
                <View style={[styles.successRow, styles.successChangeRow]}>
                  <Text style={styles.successChangeLabel}>Change</Text>
                  <Text style={styles.successChangeValue}>
                    {formatMoney(completed.change_given ?? 0, currency)}
                  </Text>
                </View>
              </View>
            ) : completed ? (
              <View style={styles.successBreakdown}>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Payment</Text>
                  <Text style={styles.successValue}>
                    {titleCase(completed.payment_method)}
                  </Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Amount paid</Text>
                  <Text style={styles.successValue}>
                    {formatMoney(completed.amount_paid ?? completed.total, currency)}
                  </Text>
                </View>
              </View>
            ) : null}

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
  cashSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  shortcutsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  shortcutChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
  },
  shortcutChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  shortcutChipExact: {
    borderColor: colors.primary,
  },
  shortcutText: {
    ...type.small,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  shortcutTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  shortcutTextExact: {
    color: colors.primary,
    fontWeight: '700',
  },
  feedbackBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  feedbackBoxSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  feedbackBoxWarning: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  feedbackBoxNeutral: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  feedbackLabelSuccess: {
    ...type.tiny,
    color: colors.success,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedbackAmountSuccess: {
    ...type.heading,
    color: colors.success,
    fontSize: 22,
    marginTop: 2,
  },
  feedbackLabelWarning: {
    ...type.tiny,
    color: colors.danger,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedbackAmountWarning: {
    ...type.heading,
    color: colors.danger,
    fontSize: 22,
    marginTop: 2,
  },
  feedbackSubtextWarning: {
    ...type.tiny,
    color: colors.danger,
    marginTop: 2,
  },
  feedbackNeutralTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  feedbackNeutralText: {
    ...type.small,
    color: colors.inkMuted,
  },
  moreOptionsWrap: {
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  moreOptionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  moreOptionsToggleText: {
    ...type.small,
    color: colors.primary,
    fontWeight: '600',
  },
  successBreakdown: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    gap: spacing.xs,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successLabel: {
    ...type.small,
    color: colors.inkSoft,
  },
  successValue: {
    ...type.small,
    color: colors.ink,
    fontWeight: '600',
  },
  successChangeRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: spacing.xs,
    marginTop: 2,
  },
  successChangeLabel: {
    ...type.bodyStrong,
    color: colors.success,
  },
  successChangeValue: {
    ...type.heading,
    color: colors.success,
    fontSize: 18,
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
