import { StyleSheet, Text, View } from 'react-native';

import { color, space, type } from '@/theme';

import { Tap } from './Tap';

/** The heading over a section of a screen, with an optional action at its end; the title wraps before it pushes the action away. */
export function SectionHeading({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.row}>
      <Text style={[type.title, styles.title]} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Tap shrink={0.94} haptic onPress={action.onPress} accessibilityLabel={action.label} style={styles.action}>
          <Text style={[type.label, { color: color.action }]}>{action.label}</Text>
        </Tap>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.page,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  title: { flexShrink: 1 },
  action: { flexShrink: 0, minHeight: 44, justifyContent: 'center' },
});
