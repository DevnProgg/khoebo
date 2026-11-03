import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  Header,
  LoadingView,
  Screen,
  TextField,
} from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import type { ReminderFrequency, ReminderType } from '../../lib/types';

const reminderTypes: {
  value: ReminderType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  defaultTitle: string;
}[] = [
  { value: 'custom', label: 'Custom', icon: 'alarm-outline', defaultTitle: '' },
  { value: 'low_stock', label: 'Low stock', icon: 'cube-outline', defaultTitle: 'Restock low items' },
  { value: 'record_sales', label: 'Sales log', icon: 'cart-outline', defaultTitle: "Record today's sales" },
  {
    value: 'inventory_count',
    label: 'Stock count',
    icon: 'clipboard-outline',
    defaultTitle: 'Count inventory',
  },
];

const frequencies: { value: ReminderFrequency; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function tomorrowAtNine() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

export default function ReminderFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { business } = useAuth();
  const editing = Boolean(id);
  const initialized = useRef(false);

  const [reminderType, setReminderType] = useState<ReminderType>('custom');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [frequency, setFrequency] = useState<ReminderFrequency>('once');
  const [nextDue, setNextDue] = useState<Date>(new Date());
  const [isActive, setIsActive] = useState(true);

  const reminders = useQuery({
    queryKey: ['reminders', business?.id],
    queryFn: () => api.reminders.list(business!.id, true),
    enabled: Boolean(business),
  });

  useEffect(() => {
    if (!editing || initialized.current || !reminders.data) return;
    const found = reminders.data.find((item) => item.id === id);
    if (found) {
      setReminderType(found.type);
      setTitle(found.title);
      setMessage(found.message ?? '');
      setFrequency(found.frequency);
      setNextDue(new Date(found.next_due_at));
      setIsActive(found.is_active);
      initialized.current = true;
    }
  }, [editing, id, reminders.data]);

  const save = useMutation({
    mutationFn: async () => {
      const fields = {
        title: title.trim(),
        message: message.trim() || null,
        frequency,
        next_due_at: nextDue.toISOString(),
        is_active: isActive,
      };
      if (editing && id) {
        return api.reminders.update(business!.id, id, fields);
      }
      return api.reminders.create(business!.id, { ...fields, type: reminderType });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reminders-due', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['reminders', business?.id] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
      ]);
      toast.show(editing ? 'Reminder updated' : 'Reminder created');
      router.back();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = () => {
    if (!title.trim()) {
      toast.show('Give your reminder a title.', 'error');
      return;
    }
    save.mutate();
  };

  if (!business) {
    return (
      <Screen>
        <Header title="Reminder" />
        <EmptyState icon="storefront-outline" title="Create a business first" />
      </Screen>
    );
  }

  if (editing && reminders.isLoading) {
    return (
      <Screen>
        <Header title="Edit reminder" />
        <LoadingView />
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
          title={editing ? 'Edit reminder' : 'New reminder'}
          subtitle="A gentle nudge when it matters."
        />

        <View style={styles.form}>
          <View style={styles.section}>
            <Text style={styles.label}>What is it about?</Text>
            <View style={styles.chips}>
              {reminderTypes.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  icon={option.icon}
                  selected={reminderType === option.value}
                  onPress={() => {
                    if (editing) return;
                    setReminderType(option.value);
                    if (!title.trim()) setTitle(option.defaultTitle);
                  }}
                />
              ))}
            </View>
          </View>

          <TextField
            label="Title"
            placeholder="What should we remind you about?"
            value={title}
            onChangeText={setTitle}
            icon="create-outline"
          />
          <TextField
            label="Message"
            placeholder="Optional details"
            value={message}
            onChangeText={setMessage}
            multiline
          />

          <View style={styles.section}>
            <Text style={styles.label}>How often?</Text>
            <View style={styles.chips}>
              {frequencies.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={frequency === option.value}
                  onPress={() => setFrequency(option.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>When?</Text>
            <View style={styles.chips}>
              <Chip
                label="Now"
                icon="flash-outline"
                selected={false}
                onPress={() => setNextDue(new Date())}
              />
              <Chip
                label="In 1 hour"
                icon="time-outline"
                onPress={() => setNextDue(new Date(Date.now() + 3_600_000))}
              />
              <Chip
                label="Tomorrow 9am"
                icon="sunny-outline"
                onPress={() => setNextDue(tomorrowAtNine())}
              />
              <Chip
                label="In 1 week"
                icon="calendar-outline"
                onPress={() => setNextDue(new Date(Date.now() + 7 * 86_400_000))}
              />
            </View>
            <View style={styles.dueBox}>
              <Ionicons name="notifications-outline" size={18} color={colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.dueLabel}>Next reminder</Text>
                <Text style={styles.dueValue}>{formatDateTime(nextDue)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.switchTitle}>Active</Text>
              <Text style={styles.switchBody}>Turn off to pause this reminder.</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: colors.lineStrong, true: colors.primarySoft }}
              thumbColor={isActive ? colors.primary : colors.white}
            />
          </View>

          <Button
            title={editing ? 'Save changes' : 'Create reminder'}
            icon="checkmark-circle-outline"
            onPress={submit}
            loading={save.isPending}
            disabled={save.isPending}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
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
  dueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryMist,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  dueLabel: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
  },
  dueValue: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
    marginTop: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  switchTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  switchBody: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 1,
  },
});
