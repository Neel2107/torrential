import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useSyncExternalStore } from 'react';
import { Alert, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { alpha, color, font, motion, radius, space, type } from '@/theme';

import { Button } from './Button';
import { Icon } from './Icon';

export type Question = { title: string; message: string; confirm: string; danger?: boolean; icon?: LucideIcon };

type Asking = Question & { answer: (yes: boolean) => void };

let asking: Asking | null = null;
const listeners = new Set<() => void>();

function show(next: Asking | null) {
  asking = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks before something that cannot be undone. iOS shows its own alert; Android shows the app's dialog from AskHost. */
export function ask(question: Question): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      Alert.alert(
        question.title,
        question.message,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: question.confirm,
            style: question.danger ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
      return;
    }
    asking?.answer(false);
    show({ ...question, answer: resolve });
  });
}

export function AskHost() {
  const current = useSyncExternalStore(subscribe, () => asking);
  return current ? <Dialog key={current.title + current.message} asking={current} /> : null;
}

function Dialog({ asking: question }: { asking: Asking }) {
  const shown = useSharedValue(0);
  const tint = question.danger ? color.error : color.action;

  const finish = (yes: boolean) => {
    if (asking === question) show(null);
    question.answer(yes);
  };
  const close = (yes: boolean) => {
    shown.value = withTiming(0, { duration: 150, easing: motion.out }, (done) => done && runOnJS(finish)(yes));
  };

  useEffect(() => {
    shown.value = withTiming(1, { duration: 240, easing: motion.out });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      close(false);
      return true;
    });
    return () => back.remove();
  });

  const backdrop = useAnimatedStyle(() => ({ opacity: shown.value }));
  const card = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 12 }, { scale: 0.96 + shown.value * 0.04 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} accessibilityLabel="Cancel" />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, card]} accessibilityRole="alert">
          {question.icon ? (
            <View style={[styles.badge, { backgroundColor: alpha(tint, 0.14) }]}>
              <Icon name={question.icon} size={22} tint={tint} />
            </View>
          ) : null}
          <Text style={styles.title} accessibilityRole="header">
            {question.title}
          </Text>
          <Text style={styles.message}>{question.message}</Text>
          <View style={styles.buttons}>
            <Button
              kind={question.danger ? 'danger' : 'primary'}
              label={question.confirm}
              onPress={() => close(true)}
            />
            <Button kind="secondary" label="Cancel" onPress={() => close(false)} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: color.scrim },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: color.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    alignItems: 'center',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  title: { ...type.headline, fontFamily: font.bold, fontSize: 19, lineHeight: 25, textAlign: 'center' },
  message: { ...type.body, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: space.sm },
  buttons: { alignSelf: 'stretch', gap: space.sm, marginTop: space.xl },
});
