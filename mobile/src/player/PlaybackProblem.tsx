import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, icons } from '@/ui/Icon';
import { appear } from '@/ui/presets';
import { stage as color, font, space, stageType as type } from '@/theme';

type Room = { top?: number; bottom?: number; sides?: number };

/**
 * Why playback stopped and what to do next, held inside the safe area. The words scroll when they run long,
 * so the actions always stay on screen and wrap onto more lines at large text sizes.
 */
export function PlaybackProblem({
  title,
  detail,
  message,
  hint,
  actions,
  align = 'center',
  room = {},
}: {
  title?: string;
  detail?: string;
  message: string;
  hint?: string | null;
  actions: ReactNode;
  align?: 'center' | 'start';
  room?: Room;
}) {
  const insets = useSafeAreaInsets();
  const sides = room.sides ?? 0;
  const centered = align === 'center';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.frame,
        centered ? styles.frameCenter : styles.frameStart,
        {
          paddingTop: Math.max(insets.top, space.lg) + (room.top ?? 0),
          paddingBottom: Math.max(insets.bottom, space.lg) + (room.bottom ?? 0),
          paddingLeft: insets.left + space.lg + sides,
          paddingRight: insets.right + space.lg + sides,
        },
      ]}
    >
      <Animated.View entering={appear} style={[styles.column, centered ? styles.columnCenter : styles.columnStart]}>
        <ScrollView
          style={styles.words}
          contentContainerStyle={[styles.wordsContent, centered ? styles.columnCenter : null]}
          showsVerticalScrollIndicator
          bounces={false}
          accessibilityLiveRegion="polite"
        >
          {title || detail ? (
            <View style={styles.heading}>
              {title ? <Text style={[styles.title, centered && styles.textCenter]}>{title}</Text> : null}
              {detail ? <Text style={[styles.detail, centered && styles.textCenter]}>{detail}</Text> : null}
            </View>
          ) : null}
          <View style={[styles.messageLine, centered && styles.messageLineCenter]}>
            <Icon name={icons.warning} size={centered ? 28 : 20} tint={color.error} />
            <Text style={[styles.message, centered ? styles.textCenter : styles.messageStart]}>{message}</Text>
          </View>
          {hint ? <Text style={[type.label, centered && styles.textCenter]}>{hint}</Text> : null}
        </ScrollView>
        <View style={[styles.actions, centered && styles.actionsCenter]}>{actions}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { ...StyleSheet.absoluteFill, zIndex: 2, justifyContent: 'center' },
  frameCenter: { alignItems: 'center' },
  frameStart: { alignItems: 'flex-start' },
  column: { maxHeight: '100%', gap: space.md },
  columnCenter: { alignItems: 'center', maxWidth: 420 },
  columnStart: { maxWidth: 640, alignSelf: 'stretch' },
  words: { flexGrow: 0, flexShrink: 1 },
  wordsContent: { gap: space.md },
  heading: { gap: space.xs },
  title: { fontFamily: font.bold, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: color.ink },
  detail: { fontFamily: font.medium, fontSize: 16, lineHeight: 22, color: color.soft },
  messageLine: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', maxWidth: 520 },
  messageLineCenter: { flexDirection: 'column', alignItems: 'center' },
  message: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22, color: color.ink },
  messageStart: { flex: 1 },
  textCenter: { textAlign: 'center' },
  actions: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actionsCenter: { justifyContent: 'center' },
});
