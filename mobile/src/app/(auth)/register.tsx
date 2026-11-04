import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Header, Screen, TextField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { colors, spacing, type } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    Keyboard.dismiss();
    setError(null);
    if (!fullName.trim()) {
      setError('Tell us your name.');
      return;
    }
    const trimmedEmail = email.trim();
    const trimmedPhone = phoneNumber.trim();
    if (!trimmedEmail && !trimmedPhone) {
      setError('Add your email or phone number.');
      return;
    }
    if (trimmedEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    if (trimmedPhone && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
      setError('Enter a valid phone number.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Use at least 8 characters, including a letter and a number.');
      return;
    }
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register({
        fullName,
        email: trimmedEmail || undefined,
        phoneNumber: trimmedPhone || undefined,
        password,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.');
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
          title="Create your account"
          showBack
          onBack={() => router.replace('/(auth)/welcome')}
        />

        <View style={styles.heading}>
          <Text style={styles.title}>{"Let's get you set up."}</Text>
          <Text style={styles.subtitle}>
            One account. All of your businesses, stock, sales and books in one place.
          </Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Full name"
            icon="person-outline"
            placeholder="Your name"
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            textContentType="name"
          />
          <TextField
            label="Email or business email"
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
            label="Phone number"
            icon="call-outline"
            placeholder="+266 5800 0000"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={15} color={colors.inkMuted} />
            <Text style={styles.hintText}>
              Add at least one contact: an email or a phone number.
            </Text>
          </View>
          <TextField
            label="Password"
            icon="lock-closed-outline"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TextField
            label="Confirm password"
            icon="shield-checkmark-outline"
            placeholder="Repeat your password"
            value={confirm}
            onChangeText={setConfirm}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={submit}
            returnKeyType="done"
          />

          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={15} color={colors.inkMuted} />
            <Text style={styles.hintText}>
              At least 8 characters, including a letter and a number.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            title="Create account"
            onPress={submit}
            loading={loading}
            disabled={loading}
            icon="sparkles-outline"
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
            <Text style={styles.link}>Sign in</Text>
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
  heading: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  subtitle: {
    ...type.body,
    color: colors.inkSoft,
    lineHeight: 23,
  },
  form: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  hintText: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    flex: 1,
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
