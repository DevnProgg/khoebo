import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  ActionSheet,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  LoadingView,
  Screen,
  SectionHeader,
  Segmented,
} from '../../components/ui';
import { api } from '../../lib/api';
import { dueLabel, formatDateTime, titleCase } from '../../lib/format';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import { useLanguage } from '../../providers/LanguageProvider';
import type { Reminder } from '../../lib/types';

type Tab = 'due' | 'all';

const typeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  low_stock: 'cube-outline',
  record_sales: 'cart-outline',
  inventory_count: 'clipboard-outline',
  custom: 'alarm-outline',
};

export default function RemindersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { business } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('due');
  const [selected, setSelected] = useState<Reminder | null>(null);

  const due = useQuery({
    queryKey: ['reminders-due', business?.id],
    queryFn: () => api.reminders.due(business!.id),
    enabled: Boolean(business),
  });
  const all = useQuery({
    queryKey: ['reminders', business?.id],
    queryFn: () => api.reminders.list(business!.id),
    enabled: Boolean(business),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reminders-due', business?.id] }),
      queryClient.invalidateQueries({ queryKey: ['reminders', business?.id] }),
      queryClient.invalidateQueries({ queryKey: ['overview'] }),
    ]);
  };

  const trigger = useMutation({
    mutationFn: (id: string) => api.reminders.trigger(business!.id, id),
    onSuccess: async () => {
      await invalidate();
      setSelected(null);
      toast.show('Reminder completed');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const snooze = useMutation({
    mutationFn: (id: string) => api.reminders.snooze(business!.id, id),
    onSuccess: async () => {
      await invalidate();
      setSelected(null);
      toast.show('Snoozed for a day');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.reminders.remove(business!.id, id),
    onSuccess: async () => {
      await invalidate();
      setSelected(null);
      toast.show('Reminder deleted');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const confirmDelete = (id: string) => {
    Alert.alert('Delete reminder?', 'This reminder will be removed permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  };

  const active = tab === 'due' ? due : all;
  const refreshing = active.isRefetching;
  const refresh = () => active.refetch();

  const dueList = due.data ?? [];
  const allList = all.data ?? [];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header
        title={t('reminders')}
        subtitle={t('remindersSubtitle')}
        right={
          <IconButton
            icon="add"
            tone="primary"
            onPress={() => router.push('/(app)/reminder-form')}
            accessibilityLabel={t('reminders')}
          />
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { label: `${t('due')}${dueList.length ? ` · ${dueList.length}` : ''}`, value: 'due' },
          { label: t('allReminders'), value: 'all' },
        ]}
      />

      {tab === 'due' ? (
        <>
          <SectionHeader title={t('needsAttention')} />
          {due.isLoading ? (
            <LoadingView />
          ) : due.isError ? (
            <ErrorState message={due.error.message} onRetry={() => due.refetch()} />
          ) : dueList.length ? (
            <View style={styles.list}>
              {dueList.map((item, index) => {
                const reminder = item.reminder;
                const context = item.context;
                return (
                  <Animated.View
                    key={reminder.id}
                    entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)}
                  >
                    <Card style={styles.card}>
                      <View style={styles.cardTop}>
                        <View style={[styles.icon, item.overdue && styles.iconOverdue]}>
                          <Ionicons
                            name={typeIcons[reminder.type] ?? 'alarm-outline'}
                            size={20}
                            color={item.overdue ? colors.danger : colors.primary}
                          />
                        </View>
                        <View style={styles.flex}>
                          <Text style={styles.title}>{reminder.title}</Text>
                          <Text style={[styles.due, item.overdue && styles.dueOverdue]}>
                            {dueLabel(reminder.next_due_at)}
                          </Text>
                        </View>
                        {item.overdue ? <Badge label={t('overdue')} tone="danger" /> : null}
                      </View>

                      {reminder.message ? (
                        <Text style={styles.message}>{reminder.message}</Text>
                      ) : null}

                      {context?.low_stock_count ? (
                        <View style={styles.context}>
                          <Ionicons name="cube-outline" size={14} color={colors.warning} />
                          <Text style={styles.contextText}>
                            {context.low_stock_count}{' '}
                            {context.low_stock_count === 1 ? 'item is' : 'items are'} low in stock
                          </Text>
                        </View>
                      ) : null}
                      {context?.sales_recorded_today !== undefined ? (
                        <View style={styles.context}>
                          <Ionicons name="cart-outline" size={14} color={colors.success} />
                          <Text style={styles.contextText}>
                            {context.sales_recorded_today} {t('sales').toLowerCase()} recorded today
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.actions}>
                        <Button
                          title="Done"
                          small
                          icon="checkmark"
                          onPress={() => trigger.mutate(reminder.id)}
                          loading={trigger.isPending && trigger.variables === reminder.id}
                          style={styles.flex}
                        />
                        <Button
                          title="Snooze"
                          small
                          variant="secondary"
                          icon="time-outline"
                          onPress={() => snooze.mutate(reminder.id)}
                          loading={snooze.isPending && snooze.variables === reminder.id}
                          style={styles.flex}
                        />
                        <IconButton
                          icon="ellipsis-horizontal"
                          onPress={() => setSelected(reminder)}
                        />
                      </View>
                    </Card>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon="checkmark-done-outline"
              title="You are all caught up"
              body="Nothing needs your attention right now. We will nudge you when something does."
              actionLabel="Add a reminder"
              onAction={() => router.push('/(app)/reminder-form')}
            />
          )}
        </>
      ) : (
        <>
          <SectionHeader title="Your reminders" />
          {all.isLoading ? (
            <LoadingView />
          ) : all.isError ? (
            <ErrorState message={all.error.message} onRetry={() => all.refetch()} />
          ) : allList.length ? (
            <View style={styles.list}>
              {allList.map((reminder, index) => (
                <Animated.View
                  key={reminder.id}
                  entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(300)}
                >
                  <Card
                    style={styles.allCard}
                    onPress={() => setSelected(reminder)}
                  >
                    <View style={styles.icon}>
                      <Ionicons
                        name={typeIcons[reminder.type] ?? 'alarm-outline'}
                        size={19}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.title} numberOfLines={1}>
                        {reminder.title}
                      </Text>
                      <Text style={styles.allMeta} numberOfLines={1}>
                        {titleCase(reminder.frequency)} · {formatDateTime(reminder.next_due_at)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={colors.inkMuted} />
                  </Card>
                </Animated.View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="alarm-outline"
              title="No reminders yet"
              body="Create reminders for stock counts, sales habits or anything else."
              actionLabel="Add a reminder"
              onAction={() => router.push('/(app)/reminder-form')}
            />
          )}
        </>
      )}

      <ActionSheet
        visible={Boolean(selected)}
        title={selected?.title}
        onClose={() => setSelected(null)}
        actions={[
          {
            label: 'Edit reminder',
            icon: 'create-outline',
            onPress: () =>
              selected && router.push(`/(app)/reminder-form?id=${selected.id}` as never),
          },
          {
            label: 'Mark done',
            icon: 'checkmark-circle-outline',
            onPress: () => selected && trigger.mutate(selected.id),
          },
          {
            label: 'Snooze one day',
            icon: 'time-outline',
            onPress: () => selected && snooze.mutate(selected.id),
          },
          {
            label: 'Delete reminder',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => selected && confirmDelete(selected.id),
          },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOverdue: {
    backgroundColor: colors.dangerSoft,
  },
  title: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 15,
  },
  due: {
    ...type.small,
    color: colors.primary,
    fontSize: 12,
    marginTop: 1,
  },
  dueOverdue: {
    color: colors.danger,
  },
  message: {
    ...type.body,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  contextText: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  allCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  allMeta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
