import { Redirect, Stack, useSegments } from 'expo-router';
import React from 'react';

import { LoadingScreen } from '../../components/ui';
import { TourOverlay } from '../../components/TourOverlay';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useUiMode } from '../../providers/UiModeProvider';

export default function AppLayout() {
  const { booting, user } = useAuth();
  const { isSimple } = useUiMode();
  const segments = useSegments();
  const advancedRoutes = ['analytics', 'reports', 'bookkeeping', 'sales-history', 'reminders', 'team', 'tax', 'stock', 'sell'];
  const onAdvancedRoute = isSimple && segments.some((segment) => advancedRoutes.includes(segment));

  if (booting) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (onAdvancedRoute) return <Redirect href="/(app)/(tabs)" />;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="bookkeeping" />
        <Stack.Screen name="sales-history" />
        <Stack.Screen name="reminders" />
        <Stack.Screen name="team" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/personal" />
        <Stack.Screen name="settings/business" />
        <Stack.Screen name="settings/security" />
        <Stack.Screen name="sale/[id]" />
        <Stack.Screen name="product-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="business-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="expense-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="journal-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reminder-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="member-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <TourOverlay userId={user.id} />
    </>
  );
}
