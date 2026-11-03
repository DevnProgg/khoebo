import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Header,
  Reveal,
  Screen,
  TextField,
} from '../../components/ui';
import { colors, radius, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';

export default function BusinessFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const { createBusiness } = useAuth();
  const [name, setName] = useState('');
  const currency = 'LSL';

  const create = useMutation({
    mutationFn: () =>
      createBusiness({ name: name.trim(), currency: currency.toUpperCase() }),
    onSuccess: (business) => {
      toast.show(`${business.name} is ready`);
      router.back();
    },
    onError: (error: Error) => toast.show(error.message, 'error'),
  });

  const submit = () => {
    if (!name.trim()) {
      toast.show('Give your business a name.', 'error');
      return;
    }
    create.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Header title="New business" subtitle="You can add the rest later." />

        <Reveal>
          <Card style={styles.hero}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroLetter}>{name.trim().charAt(0).toUpperCase() || 'K'}</Text>
            </View>
            <Text style={styles.heroTitle}>{name.trim() || 'Your business'}</Text>
            <Text style={styles.heroMeta}>
              {currency.toUpperCase()} · Ready to sell and keep books
            </Text>
          </Card>
        </Reveal>

        <View style={styles.form}>
          <TextField
            label="Business name"
            placeholder="e.g. Mama's Kitchen"
            value={name}
            onChangeText={setName}
            icon="storefront-outline"
            autoCapitalize="words"
            autoFocus
            returnKeyType="next"
          />

          <View style={styles.currency}>
            <TextField
              label="Currency"
              value={currency}
              icon="cash-outline"
              editable={false}
            />
            <Text style={styles.helper}>
              Sales, stock values and reports use Lesotho loti (LSL).
            </Text>
          </View>

          <Card style={styles.note}>
            <Text style={styles.noteBullet}>· Your chart of accounts is created automatically.</Text>
            <Text style={styles.noteBullet}>· Invite your team whenever you are ready.</Text>
            <Text style={styles.noteBullet}>· Switch between businesses from any screen.</Text>
          </Card>

          <Button
            title="Create business"
            icon="arrow-forward"
            onPress={submit}
            loading={create.isPending}
            disabled={create.isPending || !name.trim()}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surfaceAlt,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroLetter: {
    ...type.title,
    color: colors.white,
    fontSize: 28,
  },
  heroTitle: {
    ...type.title,
    color: colors.ink,
    fontSize: 22,
    textAlign: 'center',
  },
  heroMeta: {
    ...type.small,
    color: colors.inkSoft,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  currency: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  helper: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginLeft: 4,
  },
  note: {
    gap: spacing.sm,
    backgroundColor: colors.primaryMist,
  },
  noteBullet: {
    ...type.small,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
});
