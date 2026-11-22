import { Platform, type TextStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';

export const color = {
  paper: '#14120f',
  raised: '#1d1a16',
  lifted: '#26221d',
  ink: '#f0e9dc',
  soft: '#bdb5a6',
  pencil: '#837c70',
  rule: '#3b3730',
  hairline: 'rgba(240, 233, 220, 0.08)',
  action: '#a6c79a',
  actionInk: '#14120f',
  error: '#e2806e',
  scrim: 'rgba(10, 9, 7, 0.72)',
} as const;

export const space = {
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  page: 20,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  display: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: color.ink },
  title: { fontFamily: font.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: color.ink },
  headline: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2, color: color.ink },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: color.soft },
  callout: { fontFamily: font.medium, fontSize: 15, lineHeight: 20, color: color.ink },
  label: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: color.soft },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: color.pencil },
  section: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.2, color: color.pencil },
  numeric: { ...tabular, fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: color.soft },
} satisfies Record<string, TextStyle>;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

export const motion = {
  press: 120,
  quick: 180,
  standard: 240,
  stagger: 40,
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  settle: { damping: 26, stiffness: 320, mass: 0.8 },
  pop: { damping: 12, stiffness: 380, mass: 0.6 },
} as const;

export const isAndroid = Platform.OS === 'android';
