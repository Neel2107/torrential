import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { font, scheme } from '@/theme';

import { Icon } from './Icon';
import { Tap } from './Tap';

/** The look of the Android glass menu (modules/glass-menu-android), for what React Native draws beside it. */
export function surfaceFor(dark: boolean) {
  return {
    fill: dark ? 'rgba(24, 24, 27, 0.97)' : 'rgba(250, 250, 252, 0.97)',
    rim: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
    rule: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    grabber: dark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)',
    ink: dark ? 'rgba(255, 255, 255, 0.96)' : 'rgba(0, 0, 0, 0.92)',
    muted: dark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    destructive: dark ? 'rgb(255, 82, 84)' : 'rgb(220, 30, 48)',
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

export function PanelRule() {
  return <View style={styles.rule} />;
}

/** One choice in a panel, laid out like a menu item: icon, then label; destructive ones in the menu's red. */
export function PanelRow({
  icon,
  label,
  destructive = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const tint = destructive ? surface.destructive : surface.ink;

  return (
    <Tap shrink={1} highlight haptic onPress={onPress} accessibilityLabel={label} style={styles.row}>
      <Icon name={icon} size={20} tint={tint} />
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
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
    paddingBottom: 8,
  },
  heading: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18, gap: 6 },
  title: { fontFamily: font.semibold, fontSize: 18, lineHeight: 23, color: surface.ink },
  message: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: surface.muted },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: surface.rule, marginHorizontal: 24, marginBottom: 8 },
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
  label: { fontFamily: font.medium, fontSize: 17, color: surface.ink },
});
