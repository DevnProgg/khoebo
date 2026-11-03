import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  Header,
  Reveal,
  Screen,
  TextField,
} from '../../../components/ui';
import { api } from '../../../lib/api';
import { colors, radius, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? '');

  const save = useMutation({
    mutationFn: () => api.auth.updateProfile({ full_name: fullName.trim() }),
    onSuccess: (updated) => {
      updateUser(updated);
      toast.show('Profile updated');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = () => {
    if (!fullName.trim()) {
      toast.show('Your name cannot be empty.', 'error');
      return;
    }
    save.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Header title="Personal information" subtitle="How you appear in Khoebo." />

        <Reveal>
          <Card style={styles.profile}>
            <Avatar name={fullName || 'K'} size={64} />
            <Text style={styles.name}>{fullName || 'Your name'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </Card>
        </Reveal>

        <View style={styles.form}>
          <TextField
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            icon="person-outline"
            autoComplete="name"
            textContentType="name"
          />

          <View style={styles.readonly}>
            <View style={styles.readonlyIcon}>
              <Ionicons name="mail-outline" size={18} color={colors.inkMuted} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.readonlyLabel}>Email address</Text>
              <Text style={styles.readonlyValue}>{user?.email}</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={16} color={colors.inkMuted} />
          </View>
          <Text style={styles.helper}>
            Your email is used to sign in and cannot be changed here.
          </Text>

          <Button
            title="Save changes"
            icon="checkmark-circle-outline"
            onPress={submit}
            loading={save.isPending}
            disabled={save.isPending || fullName.trim() === user?.full_name}
          />

          <Card style={styles.linkCard} onPress={() => router.push('/(app)/settings/security')}>
            <View style={styles.linkIcon}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.linkTitle}>Change your password</Text>
              <Text style={styles.linkBody}>Keep your account secure.</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.inkMuted} />
          </Card>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxl,
  },
  name: {
    ...type.heading,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  email: {
    ...type.small,
    color: colors.inkMuted,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  readonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  readonlyIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readonlyLabel: {
    ...type.tiny,
    color: colors.inkMuted,
    letterSpacing: 0,
  },
  readonlyValue: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
    marginTop: 1,
  },
  helper: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: -4,
    marginLeft: 4,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  linkBody: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 1,
  },
});
