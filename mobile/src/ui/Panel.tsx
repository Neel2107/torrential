import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { font, scheme } from '@/theme';

import { Tap } from './Tap';

/** The look of the Android glass menu (modules/glass-menu-android), for what React Native draws beside it. */
export function surfaceFor(dark: boolean) {
  return {
    fill: dark ? 'rgb(24, 24, 27)' : 'rgb(250, 250, 252)',
    rim: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
    rule: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    grabber: dark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)',
    ink: dark ? 'rgba(255, 255, 255, 0.96)' : 'rgba(0, 0, 0, 0.92)',
    muted: dark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    destructive: dark ? 'rgb(255, 82, 84)' : 'rgb(220, 30, 48)',
    button: dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
    shadow: dark ? 0.5 : 0.18,
    backdrop: 'rgba(0, 0, 0, 0.45)',
    radius: 28,
    gap: 8,
  } as const;
}

const dark = scheme === 'dark';

export const surface = surfaceFor(dark);

/** A floating panel in the menu's look: its fill, rim, radius and shadow. */
export function Panel({
  children,
  style,
  accessibilityRole,
}: {
  children: ReactNode;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  accessibilityRole?: 'alert' | 'menu';
}) {
  return (
    <Animated.View style={[styles.panel, style]} accessibilityRole={accessibilityRole}>
      {children}
    </Animated.View>
  );
}

/** The words at the top of a panel: what it's about, and a line on what happens. */
export function PanelHeading({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

/** A dialog's two choices as pills side by side, as iOS lays out an alert: Cancel first, then the action; a destructive action in the menu's red. */
export function PanelButtons({
  confirm,
  danger = false,
  onCancel,
  onConfirm,
}: {
  confirm: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.buttons}>
      <PanelButton label="Cancel" tint={surface.ink} onPress={onCancel} />
      <PanelButton label={confirm} tint={danger ? surface.destructive : surface.ink} onPress={onConfirm} />
    </View>
  );
}

function PanelButton({ label, tint, onPress }: { label: string; tint: string; onPress: () => void }) {
  return (
    <Tap
      shrink={0.97}
      haptic
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.button}
    >
      <Text style={[styles.buttonLabel, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: surface.fill,
    borderRadius: surface.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.rim,
    shadowColor: '#000',
    shadowOpacity: surface.shadow,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 24,
  },
  heading: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18, gap: 6 },
  title: { fontFamily: font.semibold, fontSize: 18, lineHeight: 23, color: surface.ink },
  message: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: surface.muted },
  buttons: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  button: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.button,
  },
  buttonLabel: { fontFamily: font.medium, fontSize: 17 },
});
