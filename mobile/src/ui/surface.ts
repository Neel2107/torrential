import { StyleSheet } from 'react-native';

import { font, scheme } from '@/theme';

const dark = scheme === 'dark';

/** The look of the Android glass menu (modules/glass-menu-android), for overlays drawn in React Native that sit beside it. */
export const surface = {
  fill: dark ? 'rgba(24, 24, 27, 0.97)' : 'rgba(250, 250, 252, 0.97)',
  rim: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
  rule: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
  plate: dark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
  ink: dark ? 'rgba(255, 255, 255, 0.96)' : 'rgba(0, 0, 0, 0.92)',
  muted: dark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
  destructive: dark ? 'rgb(255, 82, 84)' : 'rgb(220, 30, 48)',
  radius: 28,
} as const;

export const surfaceStyles = StyleSheet.create({
  panel: {
    backgroundColor: surface.fill,
    borderRadius: surface.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.rim,
    shadowColor: '#000',
    shadowOpacity: dark ? 0.5 : 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginHorizontal: 8,
    paddingLeft: 22,
    paddingRight: 16,
    gap: 16,
    borderRadius: 16,
  },
  rowLabel: { fontFamily: font.medium, fontSize: 17, color: surface.ink },
});
