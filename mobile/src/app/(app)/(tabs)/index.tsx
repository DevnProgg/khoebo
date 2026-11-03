import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BusinessSwitcher } from '../../../components/BusinessSwitcher';
import { MiniBars } from '../../../components/Charts';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  LoadingView,
  Reveal,
  ScalePressable,
  Screen,
  SectionHeader,
  styles as uiStyles,
} from '../../../components/ui';
import { api } from '../../../lib/api';
import {
  firstName,
  formatMoney,
  greeting,
  relativeDay,
  startOfMonthISO,
  todayISO,
  toNumber,
} from '../../../lib/format';
import { colors, radius, spacing, type } from '../../../lib/theme';
import { useAuth } from '../../../providers/AuthProvider';

const quickActions: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}[] = [
  { title: 'New sale', subtitle: 'Take an order', icon: 'cart-outline', href: '/(app)/(tabs)/sell' },
  { title: 'Add stock', subtitle: 'New product', icon: 'cube-outline', href: '/(app)/product-form' },
  { title: 'Add expense', subtitle: 'Record spending', icon: 'receipt-outline', href: '/(app)/expense-form' },
  { title: 'Insights', subtitle: 'See your trends', icon: 'bar-chart-outline', href: '/(app)/analytics' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, business } = useAuth();
  const start = startOfMonthISO();
  const end = todayISO();

  const overview = useQuery({
    queryKey: ['overview', business?.id, start, end],
    queryFn: () => api.analytics.overview(business!.id, start, end),
    enabled: Boolean(business),
  });
  const due = useQuery({
    queryKey: ['reminders-due', business?.id],
    queryFn: () => api.reminders.due(business!.id),
    enabled: Boolean(business),
  });
  const lowStock = useQuery({
    queryKey: ['products-low', business?.id],
    queryFn: () => api.products.list(business!.id, { low_stock_only: true }),
    enabled: Boolean(business),
  });
  const recentSales = useQuery({
    queryKey: ['sales-recent', business?.id],
    queryFn: () => api.sales.list(business!.id, { limit: 5 }),
    enabled: Boolean(business),
  });

  const refreshing = [overview, due, lowStock, recentSales].some((query) => query.isRefetching);
  const refresh = () => {
    void Promise.all([
      overview.refetch(),
      due.refetch(),
      lowStock.refetch(),
      recentSales.refetch(),
    ]);
  };

  const currency = business?.currency ?? 'USD';
  const data = overview.data;
  const todayRevenue =
    data?.revenue_by_day.find((item) => item.date === end)?.revenue ?? 0;
  const lowItems = lowStock.data ?? [];
  const dueItems = due.data ?? [];
  const sales = recentSales.data ?? [];

  return (
    <Screen bottomTab refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.topRow}>
        <View style={styles.flex}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.name}>Hi, {firstName(user?.full_name)}</Text>
        </View>
        <View style={styles.topActions}>
          <View>
            <IconButton
              icon="notifications-outline"
              onPress={() => router.push('/(app)/reminders')}
              accessibilityLabel="Reminders"
            />
            {dueItems.length ? <View style={styles.notificationDot} /> : null}
          </View>
          <ScalePressable
            onPress={() => router.push('/(app)/(tabs)/more')}
            haptic={false}
            accessibilityLabel="Your profile"
          >
            <Avatar name={user?.full_name ?? 'K'} size={44} />
          </ScalePressable>
        </View>
      </View>

      <View style={styles.switcherRow}>
        <BusinessSwitcher />
      </View>

      {!business ? (
        <>
          <Reveal delay={40}>
            <Card style={styles.setupCard}>
              <View style={styles.setupIcon}>
                <Ionicons name="storefront" size={30} color={colors.primary} />
              </View>
              <Text style={styles.setupTitle}>Set up your business</Text>
              <Text style={styles.setupBody}>
                Add your business details once, then start selling, tracking stock and keeping
                clean books.
              </Text>
              <Button
                title="Create my business"
                icon="arrow-forward"
                onPress={() => router.push('/(app)/business-form?mode=create')}
                style={styles.setupButton}
              />
            </Card>
          </Reveal>

          <SectionHeader title="Everything in one place" />
          <Card padded={false}>
            {[
              { icon: 'cart-outline' as const, title: 'Fast sales', body: 'Take orders and get paid in seconds.' },
              { icon: 'cube-outline' as const, title: 'Live stock', body: 'Know what is on hand and what is running low.' },
              { icon: 'book-outline' as const, title: 'Clean books', body: 'Every sale and expense posts automatically.' },
            ].map((item, index) => (
              <View
                key={item.title}
                style={[styles.tipRow, index < 2 && styles.tipBorder]}
              >
                <View style={styles.tipIcon}>
                  <Ionicons name={item.icon} size={19} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.tipTitle}>{item.title}</Text>
                  <Text style={styles.tipBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
          <Reveal delay={40}>
            <LinearGradient
              colors={[colors.primary, '#F58A3C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroTop}>
                <View style={styles.flex}>
                  <Text style={styles.heroLabel}>THIS MONTH</Text>
                  <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMoney(data?.revenue, currency)}
                  </Text>
                  <Text style={styles.heroCaption}>
                    {data?.sales_count ?? 0} sales · revenue
                  </Text>
                </View>
                <View style={styles.livePill}>
                  <Ionicons name="pulse" size={13} color={colors.white} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              </View>

              {overview.isLoading ? (
                <View style={styles.heroLoading}>
                  <ActivityIndicator color={colors.white} />
                </View>
              ) : (
                <>
                  <View style={styles.heroChart}>
                    <MiniBars data={data?.revenue_by_day ?? []} height={48} />
                  </View>
                  <View style={styles.heroStats}>
                    <View style={styles.heroStat}>
                      <Text style={styles.heroStatLabel}>Today</Text>
                      <Text style={styles.heroStatValue}>
                        {formatMoney(todayRevenue, currency, true)}
                      </Text>
                    </View>
                    <View style={styles.heroDivider} />
                    <View style={styles.heroStat}>
                      <Text style={styles.heroStatLabel}>Net profit</Text>
                      <Text style={styles.heroStatValue}>
                        {formatMoney(data?.net_profit, currency, true)}
                      </Text>
                    </View>
                    <View style={styles.heroDivider} />
                    <View style={styles.heroStat}>
                      <Text style={styles.heroStatLabel}>Avg. sale</Text>
                      <Text style={styles.heroStatValue}>
                        {formatMoney(data?.average_sale_value, currency, true)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </LinearGradient>
          </Reveal>

          {overview.isError ? (
            <Text style={styles.inlineError}>
              Dashboard data could not refresh. Pull down to try again.
            </Text>
          ) : null}

          <SectionHeader title="Quick actions" />
          <View style={styles.grid}>
            {quickActions.map((action, index) => (
              <Reveal key={action.title} delay={60 + index * 40} style={styles.gridItem}>
                <ScalePressable
                  onPress={() => router.push(action.href as never)}
                  style={styles.action}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name={action.icon} size={21} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.inkMuted} />
                </ScalePressable>
              </Reveal>
            ))}
          </View>

          {lowItems.length ? (
            <Reveal delay={100}>
              <ScalePressable
                onPress={() => router.push('/(app)/(tabs)/stock')}
                style={styles.alert}
              >
                <View style={styles.alertIcon}>
                  <Ionicons name="alert-circle" size={22} color={colors.warning} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.alertTitle}>
                    {lowItems.length} {lowItems.length === 1 ? 'item is' : 'items are'} running low
                  </Text>
                  <Text style={styles.alertBody} numberOfLines={1}>
                    {lowItems.slice(0, 3).map((item) => item.name).join(', ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
              </ScalePressable>
            </Reveal>
          ) : null}

          {dueItems.length ? (
            <>
              <SectionHeader
                title="Reminders"
                actionLabel="See all"
                onAction={() => router.push('/(app)/reminders')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reminderList}
              >
                {dueItems.slice(0, 4).map((item) => (
                  <ScalePressable
                    key={item.reminder.id}
                    onPress={() => router.push('/(app)/reminders')}
                    style={styles.reminderCard}
                  >
                    <View style={styles.reminderTop}>
                      <View style={styles.reminderIcon}>
                        <Ionicons
                          name={
                            item.reminder.type === 'low_stock'
                              ? 'cube-outline'
                              : item.reminder.type === 'record_sales'
                                ? 'cart-outline'
                                : 'alarm-outline'
                          }
                          size={17}
                          color={colors.primary}
                        />
                      </View>
                      {item.overdue ? <Badge label="Overdue" tone="danger" /> : null}
                    </View>
                    <Text style={styles.reminderTitle} numberOfLines={2}>
                      {item.reminder.title}
                    </Text>
                    <Text style={styles.reminderDue}>
                      {item.overdue ? 'Needs attention' : relativeDay(item.reminder.next_due_at)}
                    </Text>
                  </ScalePressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <SectionHeader
            title="Recent sales"
            actionLabel={sales.length ? 'See all' : undefined}
            onAction={() => router.push('/(app)/sales-history')}
          />
          <Card padded={false}>
            {recentSales.isLoading ? (
              <LoadingView label="Loading sales" />
            ) : sales.length ? (
              sales.map((sale, index) => (
                <ScalePressable
                  key={sale.id}
                  onPress={() => router.push(`/(app)/sale/${sale.id}` as never)}
                  haptic={false}
                  style={[styles.saleRow, index < sales.length - 1 && styles.saleBorder]}
                >
                  <View style={styles.saleIcon}>
                    <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.saleRef}>{sale.reference}</Text>
                    <Text style={styles.saleMeta} numberOfLines={1}>
                      {sale.customer_name || 'Walk-in customer'} · {relativeDay(sale.created_at)}
                    </Text>
                  </View>
                  <View style={styles.saleRight}>
                    <Text style={styles.saleAmount}>
                      {formatMoney(sale.total, currency)}
                    </Text>
                    <Badge
                      label={sale.status === 'completed' ? 'Paid' : sale.status}
                      tone={sale.status === 'completed' ? 'success' : 'warning'}
                    />
                  </View>
                </ScalePressable>
              ))
            ) : (
              <EmptyState
                compact
                icon="receipt-outline"
                title="No sales yet"
                body="Your first sale will show up here."
                actionLabel="Make a sale"
                onAction={() => router.push('/(app)/(tabs)/sell')}
              />
            )}
          </Card>

          <Reveal delay={120}>
            <Card style={styles.tipCard}>
              <View style={styles.tipLogo}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.tipTitle}>Keep the momentum</Text>
                <Text style={styles.tipBody}>
                  {data && toNumber(data.sales_count) > 0
                    ? 'Your books update automatically with every sale. Nice and tidy.'
                    : 'Record your first sale to bring this dashboard to life.'}
                </Text>
              </View>
            </Card>
          </Reveal>
        </>
      )}
      <View style={uiStyles.flex} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  greeting: {
    ...type.small,
    color: colors.inkSoft,
  },
  name: {
    ...type.title,
    color: colors.ink,
    fontSize: 24,
  },
  switcherRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
  },
  hero: {
    borderRadius: radius.xxl,
    padding: spacing.xl,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroLabel: {
    ...type.tiny,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 1.6,
  },
  heroAmount: {
    ...type.display,
    color: colors.white,
    fontSize: 38,
    marginTop: 3,
  },
  heroCaption: {
    ...type.small,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveText: {
    ...type.tiny,
    color: colors.white,
    fontWeight: '700',
  },
  heroLoading: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChart: {
    marginTop: spacing.xl,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.28)',
  },
  heroStat: {
    flex: 1,
    gap: 3,
  },
  heroStatLabel: {
    ...type.tiny,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0,
  },
  heroStatValue: {
    ...type.bodyStrong,
    color: colors.white,
    fontSize: 14,
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginHorizontal: spacing.sm,
  },
  inlineError: {
    ...type.small,
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    minHeight: 76,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    ...type.small,
    color: colors.ink,
    fontWeight: '700',
  },
  actionSubtitle: {
    ...type.tiny,
    color: colors.inkMuted,
    fontWeight: '500',
    letterSpacing: 0,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#F2E2B7',
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  alertBody: {
    ...type.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  reminderList: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  reminderCard: {
    width: 210,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  reminderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    minHeight: 38,
  },
  reminderDue: {
    ...type.tiny,
    color: colors.primary,
    letterSpacing: 0,
  },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  saleBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  saleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleRef: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  saleMeta: {
    ...type.small,
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 1,
  },
  saleRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  saleAmount: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceAlt,
  },
  tipLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    fontSize: 14,
  },
  tipBody: {
    ...type.small,
    color: colors.inkSoft,
    marginTop: 3,
    lineHeight: 19,
  },
  setupCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  setupIcon: {
    width: 66,
    height: 66,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupTitle: {
    ...type.title,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
  },
  setupBody: {
    ...type.body,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  setupButton: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  tipBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  tipIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
