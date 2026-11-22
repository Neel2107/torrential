import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/ui/Button';
import { stage as color, space, stageType as type } from '@/theme';

export type SubtitleStatusShown =
  { kind: 'loading'; message: string } | { kind: 'failed'; message: string; retry: () => void };

/** The one line the Tracks tray shows while subtitles load, or when they couldn't, with a way to try again. */
export function SubtitleStatus({ status }: { status: SubtitleStatusShown }) {
  if (status.kind === 'loading') {
    return (
      <View style={styles.row} accessibilityLiveRegion="polite">
        <ActivityIndicator color={color.soft} size="small" />
        <Text style={type.caption}>{status.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <Text style={[type.caption, styles.problem]}>{status.message}</Text>
      <Button label="Try again" kind="secondary" onPress={status.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  problem: { flex: 1, color: color.error },
});
