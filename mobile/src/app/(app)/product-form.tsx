import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  LoadingView,
  Reveal,
  Screen,
  TextField,
} from '../../components/ui';
import { useBusinessRole } from '../../hooks/useBusinessRole';
import { api } from '../../lib/api';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';

function numberOrZero(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ProductFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { business } = useAuth();
  const { canManage } = useBusinessRole();
  const editing = Boolean(id);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [lowStock, setLowStock] = useState('');
  const [ready, setReady] = useState(!id);

  const product = useQuery({
    queryKey: ['product', business?.id, id],
    queryFn: () => api.products.get(business!.id, id!),
    enabled: Boolean(business && id),
  });

  useEffect(() => {
    if (!product.data || ready) return;
    const item = product.data;
    setSku(item.sku);
    setName(item.name);
    setDescription(item.description ?? '');
    setUnitPrice(String(item.unit_price ?? 0));
    setCostPrice(String(item.cost_price ?? 0));
    setStock(String(item.stock_quantity ?? 0));
    setLowStock(String(item.low_stock_threshold ?? 0));
    setReady(true);
  }, [product.data, ready]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products', business?.id] }),
      queryClient.invalidateQueries({ queryKey: ['products-low', business?.id] }),
      queryClient.invalidateQueries({ queryKey: ['overview'] }),
      queryClient.invalidateQueries({ queryKey: ['report-inventory', business?.id] }),
    ]);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!business) throw new Error('Choose a business first.');
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        unit_price: numberOrZero(unitPrice),
        cost_price: numberOrZero(costPrice),
        low_stock_threshold: numberOrZero(lowStock),
      };
      if (id) return api.products.update(business.id, id, payload);
      return api.products.create(business.id, {
        ...payload,
        sku: sku.trim(),
        stock_quantity: numberOrZero(stock),
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast.show(editing ? 'Product updated' : 'Product added');
      router.back();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const archive = useMutation({
    mutationFn: () => api.products.deactivate(business!.id, id!),
    onSuccess: async () => {
      await invalidate();
      toast.show('Product archived');
      router.back();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const confirmArchive = () => {
    Alert.alert(
      'Archive product?',
      'It will disappear from the selling screen but its history stays intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: () => archive.mutate() },
      ],
    );
  };

  const submit = () => {
    if (!name.trim()) {
      toast.show('Give the product a name.', 'error');
      return;
    }
    if (!editing && !sku.trim()) {
      toast.show('Add a SKU to identify this product.', 'error');
      return;
    }
    if (numberOrZero(unitPrice) < 0 || numberOrZero(costPrice) < 0) {
      toast.show('Prices cannot be negative.', 'error');
      return;
    }
    save.mutate();
  };

  if (!business) {
    return (
      <Screen>
        <Header title={editing ? 'Edit product' : 'New product'} />
        <EmptyState icon="storefront-outline" title="Create a business first" />
      </Screen>
    );
  }

  if (!canManage) {
    return (
      <Screen>
        <Header title={editing ? 'Edit product' : 'New product'} />
        <EmptyState
          icon="lock-closed-outline"
          title="Owner or admin only"
          body="Ask an owner or admin to manage products."
        />
      </Screen>
    );
  }

  if (editing && product.isLoading && !ready) {
    return (
      <Screen>
        <Header title="Edit product" />
        <LoadingView />
      </Screen>
    );
  }

  if (editing && product.isError) {
    return (
      <Screen>
        <Header title="Edit product" />
        <ErrorState message={product.error.message} onRetry={() => product.refetch()} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Header
          title={editing ? 'Edit product' : 'New product'}
          subtitle={editing ? name || 'Update the details' : 'Add something you sell.'}
        />

        <Reveal>
          <Card style={styles.preview}>
            <View style={styles.previewIcon}>
              <Ionicons name="cube-outline" size={26} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.previewName} numberOfLines={1}>
                {name.trim() || 'Product name'}
              </Text>
              <Text style={styles.previewMeta}>
                {sku.trim() || 'SKU'} · LSL {numberOrZero(unitPrice).toFixed(2)}
              </Text>
            </View>
          </Card>
        </Reveal>

        <View style={styles.form}>
          <TextField
            label="Product name"
            placeholder="e.g. Chicken pie"
            value={name}
            onChangeText={setName}
            icon="pricetag-outline"
            autoCapitalize="sentences"
          />
          <TextField
            label="SKU"
            placeholder="e.g. PIE-001"
            value={sku}
            onChangeText={setSku}
            icon="barcode-outline"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!editing}
          />
          {editing ? (
            <Text style={styles.helper}>
              SKU cannot be changed after the product is created.
            </Text>
          ) : null}
          <TextField
            label="Description"
            placeholder="Optional details about this product"
            value={description}
            onChangeText={setDescription}
            icon="document-text-outline"
            multiline
          />

          <View style={styles.row}>
            <TextField
              label="Selling price (LSL)"
              placeholder="0.00"
              value={unitPrice}
              onChangeText={setUnitPrice}
              icon="cash-outline"
              keyboardType="decimal-pad"
              containerStyle={styles.flex}
            />
            <TextField
              label="Cost price (LSL)"
              placeholder="0.00"
              value={costPrice}
              onChangeText={setCostPrice}
              icon="wallet-outline"
              keyboardType="decimal-pad"
              containerStyle={styles.flex}
            />
          </View>

          <View style={styles.row}>
            {!editing ? (
              <TextField
                label="Opening stock"
                placeholder="0"
                value={stock}
                onChangeText={setStock}
                icon="layers-outline"
                keyboardType="decimal-pad"
                containerStyle={styles.flex}
              />
            ) : null}
            <TextField
              label="Low stock alert at"
              placeholder="0"
              value={lowStock}
              onChangeText={setLowStock}
              icon="alert-circle-outline"
              keyboardType="decimal-pad"
              containerStyle={styles.flex}
            />
          </View>

          {editing ? (
            <Card style={styles.stockNote}>
              <Ionicons name="swap-vertical-outline" size={18} color={colors.primary} />
              <Text style={styles.stockNoteText}>
                Current stock: {String(product.data?.stock_quantity ?? 0)}. Use Adjust stock on the
                Stock screen to change it and keep a clean history.
              </Text>
            </Card>
          ) : null}

          <Button
            title={editing ? 'Save changes' : 'Add product'}
            icon={editing ? 'checkmark-circle-outline' : 'add-circle-outline'}
            onPress={submit}
            loading={save.isPending}
            disabled={save.isPending}
          />

          {editing ? (
            <Button
              title="Archive product"
              variant="danger"
              icon="archive-outline"
              onPress={confirmArchive}
              loading={archive.isPending}
              disabled={archive.isPending}
            />
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  previewIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 16,
  },
  previewMeta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  helper: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginLeft: 4,
    marginTop: -4,
  },
  stockNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryMist,
  },
  stockNoteText: {
    ...type.small,
    color: colors.inkSoft,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
