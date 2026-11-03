import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { LoadingScreen } from '../../components/ui';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';

export default function AuthLayout() {
  const { booting, user } = useAuth();

  if (booting) return <LoadingScreen />;
  if (user) return <Redirect href="/(app)/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade_from_bottom',
      }}
    />
  );
}
