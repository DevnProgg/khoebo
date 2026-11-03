import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  Badge,
  Card,
  Header,
  MenuRow,
  Reveal,
  Screen,
  SectionHeader,
} from '../../../components/ui';
import { useBusinessRole } from '../../../hooks/useBusinessRole';
import { titleCase } from '../../../lib/format';
import { colors, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, business, signOut } = useAuth();
  const { role } = useBusinessRole();

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen>
      <Header title="Settings" subtitle="Make Khoebo feel like yours." />

      <Reveal>
        <Card style={styles.profile}>
          <Avatar name={user?.full_name ?? 'K'} size={58} />
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.full_name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email}
            </Text>
            <View style={styles.badges}>
              {role ? <Badge label={titleCase(role)} tone="primary" /> : null}
              {business ? <Badge label={business.name} tone="neutral" /> : null}
            </View>
          </View>
          <Ionicons name="person-circle-outline" size={24} color={colors.inkMuted} />
        </Card>
      </Reveal>

      <SectionHeader title="Account" />
      <Card padded={false}>
        <MenuRow
          icon="person-outline"
          title="Personal information"
          subtitle="Your name and account email"
          onPress={() => router.push('/(app)/settings/personal')}
        />
        <MenuRow
          icon="lock-closed-outline"
          title="Password & security"
          subtitle="Change your password"
          onPress={() => router.push('/(app)/settings/security')}
          last
        />
      </Card>

      <SectionHeader title="Business" />
      <Card padded={false}>
        <MenuRow
          icon="storefront-outline"
          title="Business profile"
          subtitle={business ? `${business.name} · ${business.currency}` : 'No business selected'}
          onPress={() => router.push('/(app)/settings/business')}
        />
        <MenuRow
          icon="people-outline"
          title="Team & roles"
          subtitle="Manage who has access"
          onPress={() => router.push('/(app)/team')}
          last
        />
      </Card>

      <SectionHeader title="Support" />
      <Card padded={false}>
        <MenuRow
          icon="help-circle-outline"
          title="About Khoebo"
          subtitle={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`}
          onPress={() =>
            Alert.alert(
              'Khoebo',
              'Simple, connected business management. Sell, track stock and keep clean books.',
            )
          }
          last
        />
      </Card>

      <Card style={styles.signOut} onPress={confirmSignOut}>
        <View style={styles.signOutIcon}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.signOutTitle}>Sign out</Text>
          <Text style={styles.signOutBody}>Your data stays safe and ready for next time.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      </Card>

      <Text style={styles.footer}>Khoebo · v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    ...type.heading,
    color: colors.ink,
    fontSize: 18,
  },
  email: {
    ...type.small,
    color: colors.inkSoft,
    marginTop: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: colors.dangerSoft,
    borderColor: '#F6D4D4',
  },
  signOutIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutTitle: {
    ...type.bodyStrong,
    color: colors.danger,
    fontSize: 14,
  },
  signOutBody: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 1,
  },
  footer: {
    ...type.tiny,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
    letterSpacing: 0,
  },
});
