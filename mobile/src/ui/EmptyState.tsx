import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { color, space, type } from '@/theme';

import { Icon } from './Icon';
import { rise } from './rise';

/** What a copy saved on this phone is for, said the same wherever the list is empty. */
export const NOTHING_SAVED = 'Save a finished download from its menu to watch it without the engine.';

/** What a screen or list shows when it has nothing yet (on Android without the rise, which sticks inside the Downloads pager): an icon in a soft circle, what's missing, what to do, and an optional way to do it. */
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <Animated.View entering={RISE} style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.circle}>
        <Icon name={icon} size={26} tint={color.soft} />
      </View>
      <Text style={[type.title, styles.center]}>{title}</Text>
      <Text style={[type.body, styles.center]}>{body}</Text>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </Animated.View>
  );
}

const RISE = Platform.OS === 'android' ? undefined : rise(0);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 80 },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', alignItems: 'center', gap: space.sm, marginTop: space.sm },
});
