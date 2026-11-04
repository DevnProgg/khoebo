import { Tabs } from 'expo-router';
import React from 'react';

import { BottomTabBar } from '../../../components/BottomTabBar';
import { useLanguage } from '../../../providers/LanguageProvider';
import { useUiMode } from '../../../providers/UiModeProvider';

export default function TabsLayout() {
  const { t } = useLanguage();
  const { isSimple } = useUiMode();

  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home') }} />
      {isSimple ? (
        <>
          <Tabs.Screen name="simple-sale" options={{ title: t('recordSale') }} />
          <Tabs.Screen name="money-out" options={{ title: t('moneyOut') }} />
          <Tabs.Screen name="my-records" options={{ title: t('records') }} />
          <Tabs.Screen name="settings" options={{ title: t('settings') }} />
        </>
      ) : (
        <>
          <Tabs.Screen name="sell" options={{ title: t('sell') }} />
          <Tabs.Screen name="stock" options={{ title: t('stock') }} />
          <Tabs.Screen name="tax" options={{ title: t('tax') }} />
          <Tabs.Screen name="more" options={{ title: t('more') }} />
        </>
      )}
    </Tabs>
  );
}
