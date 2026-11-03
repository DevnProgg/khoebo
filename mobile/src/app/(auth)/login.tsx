import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Logo } from '../../components/Brand';
import { Button, Header, Screen, TextField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { colors, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    Keyboard.dismiss();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentContainerStyle={styles.content}>
        <Header
          title=""
          showBack
          onBack={() => router.replace('/(auth)/welcome')}
          right={null}
        />

        <View style={styles.brand}>
          <Logo width={128} />
        </View>

        <View style={styles.heading}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to pick up where you left off.</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Email"
            icon="mail-outline"
            placeholder="you@business.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <TextField
            label="Password"
            icon="lock-closed-outline"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secure
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="done"
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            title="Sign in"
            onPress={submit}
            loading={loading}
            disabled={loading}
            icon="arrow-forward"
            style={styles.submit}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Khoebo?</Text>
          <Pressable onPress={() => router.replace('/(auth)/register')} hitSlop={8}>
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
  },
  brand: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  heading: {
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  subtitle: {
    ...type.body,
    color: colors.inkSoft,
  },
  form: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  submit: {
    marginTop: spacing.sm,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: spacing.md,
    padding: spacing.md,
  },
  errorText: {
    ...type.small,
    color: colors.danger,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  footerText: {
    ...type.small,
    color: colors.inkSoft,
  },
  link: {
    ...type.small,
    color: colors.primary,
    fontWeight: '700',
  },
});
