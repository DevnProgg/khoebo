import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { colors, radius, type } from '../lib/theme';
import { formatMoney, toNumber } from '../lib/format';
import type { RevenueByDay } from '../lib/types';

export function MiniBars({
  data,
  height = 54,
  color = colors.white,
  trackColor = 'rgba(255,255,255,0.28)',
  showLabels = false,
}: {
  data: RevenueByDay[];
  height?: number;
  color?: string;
  trackColor?: string;
  showLabels?: boolean;
}) {
  const values = data.length ? data.slice(-10) : [];
  const max = Math.max(...values.map((item) => toNumber(item.revenue)), 1);

  if (!values.length) {
    return (
      <View style={[styles.emptyBars, { height }]}>
        {Array.from({ length: 8 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              { height: 6 + ((index * 7) % 22), backgroundColor: trackColor },
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.barsWrap}>
      <View style={[styles.bars, { height }]}>
        {values.map((item, index) => {
          const value = toNumber(item.revenue);
          const scaled = Math.max(4, (value / max) * height);
          const isLast = index === values.length - 1;
          return (
            <View key={`${item.date}-${index}`} style={styles.barSlot}>
              <Animated.View
                entering={FadeInUp.delay(index * 40).duration(360)}
                style={[
                  styles.bar,
                  {
                    height: scaled,
                    backgroundColor: isLast ? color : trackColor,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      {showLabels ? (
        <View style={styles.labels}>
          {values.map((item, index) => {
            const date = new Date(`${item.date}T00:00:00`);
            return (
              <Text key={`${item.date}-label-${index}`} style={styles.label}>
                {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </Text>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function TopProducts({
  products,
  currency,
}: {
  products: { product_id: string; product_name: string; quantity_sold: string | number; revenue: string | number }[];
  currency: string;
}) {
  const max = Math.max(...products.map((item) => toNumber(item.revenue)), 1);

  return (
    <View style={styles.list}>
      {products.map((product, index) => (
        <View key={product.product_id} style={styles.productRow}>
          <View style={styles.rank}>
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
          <View style={styles.productInfo}>
            <View style={styles.productTop}>
              <Text style={styles.productName} numberOfLines={1}>
                {product.product_name}
              </Text>
              <Text style={styles.productRevenue}>{formatMoney(product.revenue, currency, true)}</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.max(6, (toNumber(product.revenue) / max) * 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barsWrap: {
    gap: 6,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  emptyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  barSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: radius.sm,
    minWidth: 6,
  },
  labels: {
    flexDirection: 'row',
    gap: 5,
  },
  label: {
    ...type.tiny,
    flex: 1,
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 10,
  },
  list: {
    gap: 14,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    ...type.tiny,
    color: colors.primary,
    fontWeight: '800',
  },
  productInfo: {
    flex: 1,
    gap: 6,
  },
  productTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  productName: {
    ...type.small,
    color: colors.ink,
    fontWeight: '600',
    flex: 1,
  },
  productRevenue: {
    ...type.small,
    color: colors.inkSoft,
    fontWeight: '700',
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primaryMist,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
