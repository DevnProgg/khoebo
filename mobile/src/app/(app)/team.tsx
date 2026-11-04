import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  ActionSheet,
  Avatar,
  Badge,
  Card,
  ErrorState,
  Header,
  IconButton,
  LoadingView,
  MenuRow,
  Reveal,
  Screen,
  SectionHeader,
} from '../../components/ui';
import { useBusinessRole } from '../../hooks/useBusinessRole';
import { api } from '../../lib/api';
import { titleCase } from '../../lib/format';
import { colors, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import { useLanguage } from '../../providers/LanguageProvider';
import type { Member, MemberRole } from '../../lib/types';

export default function TeamScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { business, user } = useAuth();
  const { t } = useLanguage();
  const roleInfo = useBusinessRole();
  const [selected, setSelected] = useState<Member | null>(null);

  const members = useQuery({
    queryKey: ['members', business?.id],
    queryFn: () => api.businesses.members(business!.id),
    enabled: Boolean(business),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['members', business?.id] });

  const changeRole = useMutation({
    mutationFn: ({ member, role }: { member: Member; role: MemberRole }) =>
      api.businesses.updateMember(business!.id, member.user_id, role),
    onSuccess: async () => {
      await invalidate();
      setSelected(null);
      toast.show('Member role updated');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: (member: Member) =>
      api.businesses.removeMember(business!.id, member.user_id),
    onSuccess: async () => {
      await invalidate();
      setSelected(null);
      toast.show('Member removed');
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const confirmRemove = (member: Member) => {
    Alert.alert(
      'Remove member?',
      `${member.full_name} will lose access to ${business?.name ?? 'this business'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => remove.mutate(member),
        },
      ],
    );
  };

  const actions = selected
    ? [
        ...(roleInfo.isOwner && selected.role === 'member'
          ? [
              {
                label: 'Make admin',
                icon: 'shield-checkmark-outline' as const,
                onPress: () =>
                  changeRole.mutate({ member: selected, role: 'admin' }),
              },
            ]
          : []),
        ...(roleInfo.isOwner && selected.role === 'admin'
          ? [
              {
                label: 'Make member',
                icon: 'person-outline' as const,
                onPress: () =>
                  changeRole.mutate({ member: selected, role: 'member' }),
              },
            ]
          : []),
        ...(selected.role !== 'owner' &&
        (roleInfo.isOwner || (roleInfo.role === 'admin' && selected.role === 'member'))
          ? [
              {
                label: 'Remove member',
                icon: 'person-remove-outline' as const,
                destructive: true,
                onPress: () => confirmRemove(selected),
              },
            ]
          : []),
      ]
    : [];

  return (
    <Screen refreshing={members.isRefetching} onRefresh={() => members.refetch()}>
      <Header
        title={t('team')}
        subtitle={t('teamSubtitle')}
        right={
          roleInfo.canManage ? (
            <IconButton
              icon="person-add-outline"
              tone="primary"
              onPress={() => router.push('/(app)/member-form')}
              accessibilityLabel={t('addMember')}
            />
          ) : undefined
        }
      />

      <Reveal>
        <Card style={styles.businessCard}>
          <View style={styles.businessIcon}>
            <Ionicons name="storefront" size={22} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.businessName}>{business?.name}</Text>
            <Text style={styles.businessMeta}>
              {members.data?.length ?? 0} {t('members').toLowerCase()}
            </Text>
          </View>
          {roleInfo.role ? <Badge label={titleCase(roleInfo.role)} tone="primary" /> : null}
        </Card>
      </Reveal>

      <SectionHeader title={t('members')} />

      {members.isLoading ? (
        <LoadingView />
      ) : members.isError ? (
        <ErrorState message={members.error.message} onRetry={() => members.refetch()} />
      ) : (
        <Card padded={false}>
          {(members.data ?? []).map((member, index, list) => {
            const isSelf = member.user_id === user?.id;
            const canAct =
              !isSelf &&
              roleInfo.canManage &&
              (roleInfo.isOwner || member.role === 'member');
            return (
              <View
                key={member.user_id}
                style={[styles.memberRow, index < list.length - 1 && styles.memberBorder]}
              >
                <Avatar name={member.full_name} size={44} tone={isSelf ? 'primary' : 'light'} />
                <View style={styles.flex}>
                  <View style={styles.nameRow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.full_name}
                    </Text>
                    {isSelf ? <Badge label={t('you')} tone="neutral" /> : null}
                  </View>
                  <Text style={styles.memberEmail} numberOfLines={1}>
                    {member.email ?? member.phone_number}
                  </Text>
                </View>
                <Badge
                  label={titleCase(member.role)}
                  tone={member.role === 'owner' ? 'primary' : 'neutral'}
                />
                {canAct ? (
                  <IconButton
                    icon="ellipsis-horizontal"
                    size={18}
                    onPress={() => setSelected(member)}
                  />
                ) : null}
              </View>
            );
          })}
        </Card>
      )}

      <SectionHeader title="Roles at a glance" />
      <Card padded={false}>
        <MenuRow
          icon="person-outline"
          title="Member"
          subtitle="Sell, view stock and record expenses"
          right={<View />}
        />
        <MenuRow
          icon="shield-outline"
          title="Admin"
          subtitle="Manage products, books, reports and members"
          right={<View />}
        />
        <MenuRow
          icon="key-outline"
          title="Owner"
          subtitle="Full control, including roles and business settings"
          right={<View />}
          last
        />
      </Card>

      {roleInfo.canManage ? (
        <Card style={styles.inviteCard}>
          <View style={styles.inviteIcon}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.inviteTitle}>Add someone to the team</Text>
            <Text style={styles.inviteBody}>
              They need a Khoebo account with the email you invite.
            </Text>
          </View>
          <IconButton
            icon="arrow-forward"
            tone="primary"
            onPress={() => router.push('/(app)/member-form')}
          />
        </Card>
      ) : null}

      <ActionSheet
        visible={Boolean(selected)}
        title={selected?.full_name}
        onClose={() => setSelected(null)}
        actions={actions}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  businessIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessName: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 16,
  },
  businessMeta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  memberBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
    flexShrink: 1,
  },
  memberEmail: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 1,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceAlt,
  },
  inviteIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  inviteBody: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 1,
  },
});
