import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  Header,
  Screen,
  TextField,
} from '../../components/ui';
import { useBusinessRole } from '../../hooks/useBusinessRole';
import { api } from '../../lib/api';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import type { MemberRole } from '../../lib/types';

export default function MemberFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { business } = useAuth();
  const { canManage, isOwner } = useBusinessRole();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('member');

  const add = useMutation({
    mutationFn: () =>
      api.businesses.addMember(business!.id, { email: email.trim(), role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members', business?.id] });
      toast.show('Member added');
      router.back();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = () => {
    if (!email.trim()) {
      toast.show('Enter the member email address.', 'error');
      return;
    }
    add.mutate();
  };

  if (!business) {
    return (
      <Screen>
        <Header title="Add member" />
        <EmptyState icon="storefront-outline" title="Create a business first" />
      </Screen>
    );
  }

  if (!canManage) {
    return (
      <Screen>
        <Header title="Add member" />
        <EmptyState
          icon="lock-closed-outline"
          title="Owner or admin only"
          body="Ask a business owner or admin to invite new members."
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Header title="Add member" subtitle={`Invite someone to ${business.name}.`} />

        <View style={styles.form}>
          <TextField
            label="Email address"
            placeholder="teammate@business.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            icon="mail-outline"
          />

          <View style={styles.section}>
            <Text style={styles.label}>Role</Text>
            <View style={styles.chips}>
              <Chip
                label="Member"
                icon="person-outline"
                selected={role === 'member'}
                onPress={() => setRole('member')}
              />
              {isOwner ? (
                <Chip
                  label="Admin"
                  icon="shield-outline"
                  selected={role === 'admin'}
                  onPress={() => setRole('admin')}
                />
              ) : null}
            </View>
            <Card style={styles.note}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.noteText}>
                {role === 'admin'
                  ? 'Admins can manage products, books, reports and other members.'
                  : 'Members can sell, view stock and record expenses.'}
              </Text>
            </Card>
          </View>

          <Card style={styles.note}>
            <Ionicons name="person-add-outline" size={18} color={colors.primary} />
            <Text style={styles.noteText}>
              The person needs an existing Khoebo account with this email address.
            </Text>
          </Card>

          <Button
            title="Add member"
            icon="person-add-outline"
            onPress={submit}
            loading={add.isPending}
            disabled={add.isPending}
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
    gap: spacing.sm,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  noteText: {
    ...type.small,
    color: colors.inkSoft,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
