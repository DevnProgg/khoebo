import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow } from '../lib/theme';

const logo = require('../../assets/logo.jpg');

export function Logo({
  width = 168,
  style,
  plain = false,
}: {
  width?: number;
  style?: StyleProp<ViewStyle>;
  plain?: boolean;
}) {
  return (
    <View
      style={[
        styles.frame,
        { width, height: width * 0.56, borderRadius: plain ? 0 : radius.lg },
        plain && styles.plain,
        style,
      ]}
    >
      <Image
        source={logo}
        style={{ width: width * 0.86, height: width * 0.48 }}
        contentFit="contain"
        transition={200}
        accessibilityLabel="Khoebo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    ...shadow,
  },
  plain: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
});
