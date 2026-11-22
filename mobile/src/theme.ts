import { File, Paths } from 'expo-file-system';
import { Platform, type TextStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';

export type Palette = {
  paper: string;
  raised: string;
  lifted: string;
  ink: string;
  soft: string;
  pencil: string;
  rule: string;
  hairline: string;
  action: string;
  actionInk: string;
  error: string;
  scrim: string;
  markLight: string;
  markDeep: string;
};

export type Scheme = 'dark' | 'light';

export type Theme = { name: string; note: string; scheme: Scheme; color: Palette };

const sage: Palette = {
  paper: '#14120f',
  raised: '#1d1a16',
  lifted: '#26221d',
  ink: '#f0e9dc',
  soft: '#bdb5a6',
  pencil: '#958d80',
  rule: '#3b3730',
  hairline: 'rgba(240, 233, 220, 0.08)',
  action: '#a6c79a',
  actionInk: '#14120f',
  error: '#e2806e',
  scrim: 'rgba(10, 9, 7, 0.72)',
  markLight: '#c3dbb8',
  markDeep: '#8fb683',
};

export const themes = {
  sage: { name: 'Sage', note: 'Warm paper', scheme: 'dark', color: sage },
  onyx: {
    name: 'Onyx',
    note: 'True black',
    scheme: 'dark',
    color: {
      paper: '#000000',
      raised: '#0f0f0e',
      lifted: '#1b1a19',
      ink: '#f2efe9',
      soft: '#b9b4ab',
      pencil: '#8f8a82',
      rule: '#2c2a28',
      hairline: 'rgba(242, 239, 233, 0.09)',
      action: '#a6c79a',
      actionInk: '#0b0d0a',
      error: '#e8826f',
      scrim: 'rgba(0, 0, 0, 0.72)',
      markLight: '#c3dbb8',
      markDeep: '#8fb683',
    },
  },
  dusk: {
    name: 'Dusk',
    note: 'Cool blue',
    scheme: 'dark',
    color: {
      paper: '#0e121a',
      raised: '#151b26',
      lifted: '#1d2431',
      ink: '#e7ecf5',
      soft: '#aab5c6',
      pencil: '#8692a6',
      rule: '#2c3546',
      hairline: 'rgba(231, 236, 245, 0.08)',
      action: '#9fb8f6',
      actionInk: '#0e121a',
      error: '#f0897d',
      scrim: 'rgba(6, 8, 12, 0.72)',
      markLight: '#c6d5fb',
      markDeep: '#7c9cee',
    },
  },
  ember: {
    name: 'Ember',
    note: 'Warm amber',
    scheme: 'dark',
    color: {
      paper: '#16100b',
      raised: '#1f1711',
      lifted: '#2a2018',
      ink: '#f6e9d9',
      soft: '#cbb69e',
      pencil: '#a08a72',
      rule: '#3f3226',
      hairline: 'rgba(246, 233, 217, 0.08)',
      action: '#f0ac5e',
      actionInk: '#1a1109',
      error: '#f08080',
      scrim: 'rgba(10, 7, 4, 0.72)',
      markLight: '#f7cb92',
      markDeep: '#de8c3a',
    },
  },
  linen: {
    name: 'Linen',
    note: 'Light',
    scheme: 'light',
    color: {
      paper: '#f4efe6',
      raised: '#fcf9f3',
      lifted: '#e9e3d8',
      ink: '#1d1a16',
      soft: '#4f493f',
      pencil: '#6a6358',
      rule: '#d3cabb',
      hairline: 'rgba(29, 26, 22, 0.1)',
      action: '#3d6a33',
      actionInk: '#f8f6f0',
      error: '#b23c2a',
      scrim: 'rgba(244, 239, 230, 0.82)',
      markLight: '#6f9a62',
      markDeep: '#2f5728',
    },
  },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof themes;

const stored = new File(Paths.document, 'theme');

function readTheme(): ThemeId {
  try {
    const saved = stored.exists ? stored.textSync().trim() : '';
    return saved in themes ? (saved as ThemeId) : 'sage';
  } catch {
    return 'sage';
  }
}

/** Saves the choice; it takes effect on the next launch or reload. */
export function saveTheme(id: ThemeId) {
  stored.write(id);
}

export const themeId: ThemeId = readTheme();

const chosen: Theme = themes[themeId];

export const scheme: Scheme = chosen.scheme;

export const color: Palette = chosen.color;

/** The player's palette: the chosen theme when it is dark, Sage otherwise. */
export const stage: Palette = scheme === 'dark' ? color : sage;

/** `hex` at `opacity`, for washes and fades of a token. */
export function alpha(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

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

function typeFor(c: Palette) {
  return {
    display: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: c.ink },
    title: { fontFamily: font.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: c.ink },
    headline: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2, color: c.ink },
    body: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: c.soft },
    callout: { fontFamily: font.medium, fontSize: 15, lineHeight: 20, color: c.ink },
    label: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: c.soft },
    caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: c.pencil },
    section: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.2, color: c.pencil },
    numeric: { ...tabular, fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: c.soft },
  } satisfies Record<string, TextStyle>;
}

export const type = typeFor(color);

export const stageType = stage === color ? type : typeFor(stage);

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
