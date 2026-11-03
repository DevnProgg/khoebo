import { Redirect } from 'expo-router';
import React from 'react';

import { LoadingScreen } from '../components/ui';
import { useAuth } from '../providers/AuthProvider';

export default function Index() {
  const { booting, user } = useAuth();

  if (booting) return <LoadingScreen />;
  return <Redirect href={user ? '/(app)/(tabs)' : '/(auth)/welcome'} />;
}
