import { Tabs } from 'expo-router';
import React from 'react';

import { BottomTabBar } from '../../../components/BottomTabBar';
import { useLanguage } from '../../../providers/LanguageProvider';

export default function TabsLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home') }} />
      <Tabs.Screen name="sell" options={{ title: t('sell') }} />
      <Tabs.Screen name="stock" options={{ title: t('stock') }} />
      <Tabs.Screen name="more" options={{ title: t('more') }} />
    </Tabs>
  );
}
