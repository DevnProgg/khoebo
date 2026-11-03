import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  IconButton,
  Reveal,
  ScalePressable,
  Screen,
  SectionHeader,
  TextField,
} from '../../../components/ui';
import { useBusinessRole } from '../../../hooks/useBusinessRole';
import { titleCase } from '../../../lib/format';
import { colors, radius, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';

export default function BusinessSettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const {
    business,
    businesses,
    updateBusiness,
    deleteBusiness,
    selectBusiness,
  } = useAuth();
  const { role, isOwner, canManage } = useBusinessRole();
  const [name, setName] = useState(business?.name ?? '');
  const currency = 'LSL';
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(business?.name ?? '');
  }, [business?.id, business?.name, business?.currency]);

  const dirty =
    business && (name.trim() !== business.name || currency.toUpperCase() !== business.currency);

  const save = async () => {
    if (!business) return;
    if (!name.trim()) {
      toast.show('Business name cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateBusiness(business.id, {
        name: name.trim(),
        currency,
      });
      toast.show('Business updated');
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not save changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!business) return;
    Alert.alert(
      'Delete business?',
      `This permanently removes ${business.name}, including its sales, stock, books and team. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteBusiness(business.id)
              .then(() => toast.show('Business deleted'))
              .catch((error: Error) => toast.show(error.message, 'error'));
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Header title="Business profile" subtitle="The details behind your business." />

        {business ? (
          <>
            <Reveal>
              <Card style={styles.hero}>
                <View style={styles.heroIcon}>
                  <Ionicons name="storefront" size={26} color={colors.primary} />
                </View>
                <Text style={styles.heroName}>{business.name}</Text>
                <Text style={styles.heroMeta}>
                  {business.currency} · {titleCase(role ?? 'member')}
                </Text>
                <View style={styles.slug}>
                  <Ionicons name="link-outline" size={13} color={colors.inkMuted} />
                  <Text style={styles.slugText}>{business.slug}</Text>
                </View>
              </Card>
            </Reveal>

            <SectionHeader title="Business details" />
            {canManage ? (
              <View style={styles.form}>
                <TextField
                  label="Business name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Your business"
                  icon="storefront-outline"
                />
                <View style={styles.currencyWrap}>
                  <TextField
                    label="Currency code"
                    value={currency}
                    editable={false}
                    icon="cash-outline"
                  />
                </View>
                <Button
                  title="Save changes"
                  icon="checkmark-circle-outline"
                  onPress={save}
                  loading={saving}
                  disabled={!dirty || saving}
                />
              </View>
            ) : (
              <Card>
                <Text style={styles.readonlyLabel}>Name</Text>
                <Text style={styles.readonlyValue}>{business.name}</Text>
                <Text style={[styles.readonlyLabel, { marginTop: spacing.md }]}>Currency</Text>
                <Text style={styles.readonlyValue}>{business.currency}</Text>
                <View style={styles.note}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.inkMuted} />
                  <Text style={styles.noteText}>
                    Only owners and admins can edit business details.
                  </Text>
                </View>
              </Card>
            )}
          </>
        ) : (
          <EmptyState
            icon="storefront-outline"
            title="No business yet"
            body="Create your first business to start selling and keeping books."
            actionLabel="Create business"
            onAction={() => router.push('/(app)/business-form?mode=create')}
          />
        )}

        <SectionHeader title="Your businesses" />
        <Card padded={false}>
          {businesses.map((item, index) => (
            <ScalePressable
              key={item.id}
              onPress={() => void selectBusiness(item.id)}
              haptic={false}
              style={[styles.businessRow, index < businesses.length - 1 && styles.rowBorder]}
            >
              <View
                style={[styles.businessIcon, item.id === business?.id && styles.businessIconActive]}
              >
                <Ionicons
                  name="storefront-outline"
                  size={18}
                  color={item.id === business?.id ? colors.primary : colors.inkMuted}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.businessName}>{item.name}</Text>
                <Text style={styles.businessMeta}>{item.currency}</Text>
              </View>
              {item.id === business?.id ? (
                <Badge label="Active" tone="primary" icon="checkmark" />
              ) : (
                <Text style={styles.switchText}>Switch</Text>
              )}
            </ScalePressable>
          ))}
          {!businesses.length ? (
            <EmptyState compact icon="storefront-outline" title="No businesses" />
          ) : null}
        </Card>

        <View style={styles.addRow}>
          <Button
            title="Create another business"
            variant="secondary"
            icon="add"
            onPress={() => router.push('/(app)/business-form?mode=create')}
            style={styles.flex}
          />
          <IconButton
            icon="people-outline"
            onPress={() => router.push('/(app)/team')}
            accessibilityLabel="Team"
          />
        </View>

        {business && isOwner ? (
          <>
            <SectionHeader title="Danger zone" />
            <Card style={styles.danger}>
              <View style={styles.dangerIcon}>
                <Ionicons name="warning-outline" size={20} color={colors.danger} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.dangerTitle}>Delete this business</Text>
                <Text style={styles.dangerBody}>
                  Removes all sales, products, books and members. This cannot be undone.
                </Text>
              </View>
            </Card>
            <Button
              title="Delete business"
              variant="danger"
              icon="trash-outline"
              onPress={confirmDelete}
              style={styles.deleteButton}
            />
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surfaceAlt,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroName: {
    ...type.title,
    color: colors.ink,
    fontSize: 23,
    textAlign: 'center',
  },
  heroMeta: {
    ...type.small,
    color: colors.inkSoft,
  },
  slug: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  slugText: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
  },
  form: {
    gap: spacing.lg,
  },
  currencyWrap: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  readonlyLabel: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
  },
  readonlyValue: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 15,
    marginTop: 1,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  noteText: {
    ...type.small,
    color: colors.inkMuted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  businessIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessIconActive: {
    backgroundColor: colors.primarySoft,
  },
  businessName: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  businessMeta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 1,
  },
  switchText: {
    ...type.small,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  danger: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderColor: '#F6D4D4',
  },
  dangerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: {
    ...type.bodyStrong,
    color: colors.danger,
    fontSize: 14,
  },
  dangerBody: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
  deleteButton: {
    marginTop: spacing.md,
  },
});
