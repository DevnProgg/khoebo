import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Header, Reveal, Screen, TextField } from '../../../components/ui';
import { api } from '../../../lib/api';
import { colors, radius, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';

const requirements = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'Contains a letter', test: (value: string) => /[A-Za-z]/.test(value) },
  { label: 'Contains a number', test: (value: string) => /\d/.test(value) },
];

export default function SecurityScreen() {
  const toast = useToast();
  const { user, signIn } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const change = useMutation({
    mutationFn: async () => {
      await api.auth.changePassword({ current_password: current, new_password: next });
      if (user?.email) {
        try {
          await signIn(user.email, next);
        } catch {
          toast.show('Password changed. Sign in again on this device.', 'info');
        }
      }
    },
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.show('Password updated');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const valid = requirements.every((requirement) => requirement.test(next));

  const submit = () => {
    if (!current) {
      toast.show('Enter your current password.', 'error');
      return;
    }
    if (!valid) {
      toast.show('Your new password does not meet the requirements.', 'error');
      return;
    }
    if (next !== confirm) {
      toast.show('Those passwords do not match.', 'error');
      return;
    }
    change.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Header title="Password & security" subtitle="Keep your account protected." />

        <Reveal>
          <Card style={styles.iconCard}>
            <View style={styles.bigIcon}>
              <Ionicons name="shield-checkmark-outline" size={30} color={colors.primary} />
            </View>
            <Text style={styles.title}>Choose a strong password</Text>
            <Text style={styles.body}>
              Changing your password signs out other devices where you are logged in.
            </Text>
          </Card>
        </Reveal>

        <View style={styles.form}>
          <TextField
            label="Current password"
            placeholder="Your current password"
            value={current}
            onChangeText={setCurrent}
            secure
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            icon="lock-closed-outline"
          />
          <TextField
            label="New password"
            placeholder="At least 8 characters"
            value={next}
            onChangeText={setNext}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            icon="key-outline"
          />
          <TextField
            label="Confirm new password"
            placeholder="Repeat your new password"
            value={confirm}
            onChangeText={setConfirm}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            icon="shield-checkmark-outline"
          />

          <Card style={styles.requirements}>
            {requirements.map((requirement) => {
              const met = requirement.test(next);
              return (
                <View key={requirement.label} style={styles.requirement}>
                  <Ionicons
                    name={met ? 'checkmark-circle' : 'ellipse-outline'}
                    size={17}
                    color={met ? colors.success : colors.inkMuted}
                  />
                  <Text style={[styles.requirementText, met && styles.requirementMet]}>
                    {requirement.label}
                  </Text>
                </View>
              );
            })}
            {confirm ? (
              <View style={styles.requirement}>
                <Ionicons
                  name={next === confirm ? 'checkmark-circle' : 'close-circle'}
                  size={17}
                  color={next === confirm ? colors.success : colors.danger}
                />
                <Text
                  style={[
                    styles.requirementText,
                    next === confirm ? styles.requirementMet : { color: colors.danger },
                  ]}
                >
                  Passwords match
                </Text>
              </View>
            ) : null}
          </Card>

          <Button
            title="Update password"
            icon="shield-checkmark-outline"
            onPress={submit}
            loading={change.isPending}
            disabled={change.isPending || !current || !valid || next !== confirm}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surfaceAlt,
  },
  bigIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...type.heading,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  body: {
    ...type.small,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 19,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  requirements: {
    backgroundColor: colors.primaryMist,
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requirementText: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
  },
  requirementMet: {
    color: colors.success,
  },
});
