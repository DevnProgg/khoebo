import { Platform } from 'react-native';

export const colors = {
  primary: '#E96B1A',
  primaryDark: '#C4520D',
  primaryLight: '#F1852F',
  primarySoft: '#FFF1E8',
  primaryMist: '#FFF8F3',
  ink: '#201A16',
  inkSoft: '#72665E',
  inkMuted: '#A6968B',
  line: '#F0E4DB',
  lineStrong: '#E4D3C6',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#FFF9F5',
  success: '#2E9E5B',
  successSoft: '#E8F7EE',
  danger: '#D64545',
  dangerSoft: '#FDECEC',
  warning: '#C78200',
  warningSoft: '#FFF5DE',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(32, 26, 22, 0.42)',
};

export const fonts = {
  regular: undefined as string | undefined,
  medium: undefined as string | undefined,
  semibold: undefined as string | undefined,
  bold: undefined as string | undefined,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 32,
  pill: 999,
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#6A3B1B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  android: {
    elevation: 4,
  },
  default: {},
}) as object;

export const softShadow = Platform.select({
  ios: {
    shadowColor: '#6A3B1B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: {
    elevation: 2,
  },
  default: {},
}) as object;

export const tabBarHeight = 68;
export const tabBarSpace = 118;

export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -1 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  tiny: { fontSize: 11, lineHeight: 15, fontWeight: '600' as const, letterSpacing: 0.4 },
};

export const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  ZAR: 'R',
  NGN: '₦',
  KES: 'KSh',
  GHS: '₵',
  INR: '₹',
  CAD: 'C$',
  AUD: 'A$',
};
