import { StyleSheet, View } from 'react-native';

import { alpha, color, radius } from '@/theme';

export function Meter({ fraction, tint = color.action }: { fraction: number; tint?: string }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: radius.pill, backgroundColor: alpha(color.ink, 0.18), overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
