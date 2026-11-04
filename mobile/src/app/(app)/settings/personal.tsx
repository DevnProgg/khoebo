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
import { useLanguage } from '../../../providers/LanguageProvider';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState(user?.full_name ?? '');

  const save = useMutation({
    mutationFn: () => api.auth.updateProfile({ full_name: fullName.trim() }),
    onSuccess: (updated) => {
      updateUser(updated);
      toast.show(t('profileUpdated'));
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = () => {
    if (!fullName.trim()) {
      toast.show(t('nameCannotBeEmpty'), 'error');
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
        <Header title={t('personalInformation')} subtitle={t('personalInformationSubtitleFull')} />

        <Reveal>
          <Card style={styles.profile}>
            <Avatar name={fullName || 'K'} size={64} />
            <Text style={styles.name}>{fullName || t('yourName')}</Text>
            <Text style={styles.email}>{user?.email ?? user?.phone_number}</Text>
          </Card>
        </Reveal>

        <View style={styles.form}>
          <TextField
            label={t('fullName')}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t('yourName')}
            icon="person-outline"
            autoComplete="name"
            textContentType="name"
          />

          {user?.email ? (
            <View style={styles.readonly}>
              <View style={styles.readonlyIcon}>
                <Ionicons name="mail-outline" size={18} color={colors.inkMuted} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.readonlyLabel}>{t('emailAddress')}</Text>
                <Text style={styles.readonlyValue}>{user.email}</Text>
              </View>
              <Ionicons name="lock-closed-outline" size={16} color={colors.inkMuted} />
            </View>
          ) : null}
          {user?.phone_number ? (
            <View style={styles.readonly}>
              <View style={styles.readonlyIcon}>
                <Ionicons name="call-outline" size={18} color={colors.inkMuted} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.readonlyLabel}>{t('phoneNumber')}</Text>
                <Text style={styles.readonlyValue}>{user.phone_number}</Text>
              </View>
              <Ionicons name="lock-closed-outline" size={16} color={colors.inkMuted} />
            </View>
          ) : null}
          <Text style={styles.helper}>
            {t('emailLocked')}
          </Text>

          <Button
            title={t('saveChanges')}
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
              <Text style={styles.linkTitle}>{t('changePassword')}</Text>
              <Text style={styles.linkBody}>{t('keepAccountSecure')}</Text>
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
