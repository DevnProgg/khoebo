import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, softShadow, spacing, tabBarSpace, type } from '../lib/theme';
import { Logo } from './Brand';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function tapHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => undefined);
}

export function ScalePressable({
  children,
  style,
  haptic = true,
  disabled,
  ...props
}: Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        scale.set(withSpring(0.97, { damping: 18, stiffness: 320 }));
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, { damping: 18, stiffness: 260 }));
        props.onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) tapHaptic();
        props.onPress?.(event);
      }}
      style={[style, animatedStyle] as StyleProp<ViewStyle>}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Screen({
  children,
  scroll = true,
  bottomTab = false,
  contentContainerStyle,
  style,
  refreshing,
  onRefresh,
  edges = ['top', 'left', 'right'],
}: {
  children: React.ReactNode;
  scroll?: boolean;
  bottomTab?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const insets = useSafeAreaInsets();
  const bottomPadding = bottomTab ? tabBarSpace + insets.bottom : insets.bottom + spacing.xxl;

  return (
    <View style={[styles.screen, style]}>
      <SafeAreaView edges={edges} style={styles.flex}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: bottomPadding },
              contentContainerStyle,
            ]}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={Boolean(refreshing)}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentContainerStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(420).springify().damping(18)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export function Fade({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(320)} style={style}>
      {children}
    </Animated.View>
  );
}

export function Header({
  title,
  subtitle,
  right,
  onBack,
  showBack = true,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      {showBack ? (
        <ScalePressable
          onPress={() => (onBack ? onBack() : router.back())}
          style={styles.iconButton}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </ScalePressable>
      ) : (
        <View style={styles.iconButton} />
      )}
      <View style={styles.headerText}>
        <Text style={type.heading} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.small, styles.muted]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const content = (
    <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>
  );
  if (!onPress) return content;
  return (
    <ScalePressable onPress={onPress} style={styles.cardPressable}>
      {content}
    </ScalePressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  small = false,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const isDisabled = disabled || loading;
  const textColor =
    variant === 'primary'
      ? colors.white
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.ink
          : colors.primary;

  return (
    <ScalePressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        small && styles.buttonSmall,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={small ? 16 : 19} color={textColor} /> : null}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: textColor }]}>
            {title}
          </Text>
        </View>
      )}
    </ScalePressable>
  );
}

export function IconButton({
  icon,
  onPress,
  tone = 'light',
  size = 20,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  tone?: 'light' | 'primary' | 'dark';
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.iconButton,
        tone === 'primary' && styles.iconButtonPrimary,
        tone === 'dark' && styles.iconButtonDark,
      ]}
    >
      <Ionicons
        name={icon}
        size={size}
        color={tone === 'primary' ? colors.primary : tone === 'dark' ? colors.white : colors.ink}
      />
    </ScalePressable>
  );
}

export function TextField({
  label,
  error,
  icon,
  secure = false,
  containerStyle,
  right,
  multiline,
  ...props
}: TextInputProps & {
  label?: string;
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  right?: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, multiline && styles.fieldMultiline, error && styles.fieldError]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.inkMuted} /> : null}
        <TextInput
          {...props}
          multiline={multiline}
          secureTextEntry={secure ? hidden : false}
          placeholderTextColor={colors.inkMuted}
          selectionColor={colors.primary}
          style={[styles.input, multiline && styles.inputMultiline, props.style]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((value) => !value)} hitSlop={10}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={19}
              color={colors.inkMuted}
            />
          </Pressable>
        ) : (
          right
        )}
      </View>
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <ScalePressable
      onPress={onPress}
      haptic={false}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? colors.white : colors.inkSoft}
        />
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </ScalePressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'warning';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const palette = {
    neutral: { background: colors.primaryMist, text: colors.inkSoft },
    primary: { background: colors.primarySoft, text: colors.primary },
    success: { background: colors.successSoft, text: colors.success },
    danger: { background: colors.dangerSoft, text: colors.danger },
    warning: { background: colors.warningSoft, text: colors.warning },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      {icon ? <Ionicons name={icon} size={11} color={palette.text} /> : null}
      <Text style={[styles.badgeText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

export function Avatar({
  name,
  size = 44,
  tone = 'primary',
}: {
  name: string;
  size?: number;
  tone?: 'primary' | 'light';
}) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone === 'primary' ? colors.primary : colors.primarySoft,
        },
      ]}
    >
      <Text
        style={[
          styles.avatarText,
          { fontSize: size * 0.36, color: tone === 'primary' ? colors.white : colors.primary },
        ]}
      >
        {letters || 'K'}
      </Text>
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  tone = 'primary',
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  last?: boolean;
}) {
  const tint = {
    primary: { background: colors.primarySoft, color: colors.primary },
    success: { background: colors.successSoft, color: colors.success },
    warning: { background: colors.warningSoft, color: colors.warning },
    danger: { background: colors.dangerSoft, color: colors.danger },
  }[tone];

  return (
    <ScalePressable onPress={onPress} haptic={false} style={[styles.menuRow, !last && styles.menuRowBorder]}>
      <View style={[styles.menuIcon, { backgroundColor: tint.background }]}>
        <Ionicons name={icon} size={19} color={tint.color} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle ? (
          <Text style={[type.small, styles.muted]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />}
    </ScalePressable>
  );
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  body,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} small style={styles.emptyButton} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
      </View>
      <Text style={styles.emptyTitle}>Could not load this</Text>
      <Text style={styles.emptyBody}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" small /> : null}
    </View>
  );
}

export function LoadingView({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[type.small, styles.muted]}>{label}</Text>
    </View>
  );
}

export function LoadingScreen({ label = 'Getting things ready' }: { label?: string }) {
  return (
    <View style={styles.loadingScreen}>
      <Logo width={150} />
      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      <Text style={[type.small, styles.muted, { marginTop: spacing.sm }]}>{label}</Text>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!active) {
                tapHaptic();
                onChange(option.value);
              }
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({
  value,
  max,
  color = colors.primary,
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${percent}%`, backgroundColor: color, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export interface SheetAction {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                setTimeout(action.onPress, 120);
              }}
              style={styles.sheetAction}
            >
              {action.icon ? (
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.destructive ? colors.danger : colors.ink}
                />
              ) : null}
              <Text
                style={[
                  styles.sheetActionText,
                  action.destructive && { color: colors.danger },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Button title="Cancel" variant="secondary" onPress={onClose} style={{ marginTop: spacing.sm }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerCompact: {
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerRight: {
    minWidth: 42,
    alignItems: 'flex-end',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMist,
  },
  iconButtonPrimary: {
    backgroundColor: colors.primarySoft,
  },
  iconButtonDark: {
    backgroundColor: colors.ink,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    ...softShadow,
  },
  cardPadded: {
    padding: spacing.lg,
  },
  cardPressable: {
    borderRadius: radius.xl,
  },
  button: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonSmall: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    ...softShadow,
  },
  buttonSecondary: {
    backgroundColor: colors.primaryMist,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDanger: {
    backgroundColor: colors.dangerSoft,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttonText: {
    ...type.bodyStrong,
    fontSize: 16,
  },
  buttonTextSmall: {
    fontSize: 14,
  },
  disabled: {
    opacity: 0.48,
  },
  fieldWrap: {
    gap: spacing.sm,
  },
  label: {
    ...type.small,
    color: colors.inkSoft,
    fontWeight: '600',
    marginLeft: 4,
  },
  field: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    minHeight: 108,
  },
  fieldError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  input: {
    flex: 1,
    ...type.body,
    color: colors.ink,
    paddingVertical: 0,
    minHeight: 50,
  },
  inputMultiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  fieldErrorText: {
    ...type.small,
    color: colors.danger,
    marginLeft: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMist,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...type.small,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.white,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    ...type.tiny,
    fontWeight: '700',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.ink,
  },
  sectionAction: {
    ...type.small,
    color: colors.primary,
    fontWeight: '700',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    gap: 1,
  },
  menuTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyCompact: {
    paddingVertical: spacing.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    ...type.small,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: spacing.sm,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMist,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.white,
    ...softShadow,
  },
  segmentText: {
    ...type.small,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    backgroundColor: colors.primaryMist,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: spacing.lg,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...type.bodyStrong,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  sheetActionText: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  muted: {
    color: colors.inkSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shadow: shadow,
});
