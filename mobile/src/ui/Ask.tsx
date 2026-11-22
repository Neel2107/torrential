import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { motion, space } from '@/theme';

import { icons } from './Icon';
import { Panel, PanelHeading, PanelRow, PanelRule, surface } from './Panel';

export type Question = { title: string; message: string; confirm: string; danger?: boolean; icon?: LucideIcon };

type Asking = Question & { id: number; answer: (yes: boolean) => void };

let asked = 0;

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
    asked += 1;
    show({ ...question, id: asked, answer: resolve });
  });
}

export function AskHost() {
  const current = useSyncExternalStore(subscribe, () => asking);

  return current ? <Dialog key={current.id} asking={current} /> : null;
}

function Dialog({ asking: question }: { asking: Asking }) {
  const shown = useSharedValue(0);
  const answered = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const tallest = height - insets.top - insets.bottom - space.xl * 2;

  const finish = (yes: boolean) => {
    if (asking === question) show(null);
    question.answer(yes);
  };

  const close = (yes: boolean) => {
    if (answered.current) return;
    answered.current = true;
    setLeaving(true);
    shown.set(withTiming(0, { duration: 140, easing: Easing.linear }, (done) => done && scheduleOnRN(finish, yes)));
  };

  useEffect(() => {
    shown.set(withTiming(1, { duration: 220, easing: motion.out }));
  }, [shown]);

  const backdrop = useAnimatedStyle(() => ({ opacity: shown.get() }));

  const card = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: 0.94 + shown.get() * 0.06 }],
  }));

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close(false)}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents={leaving ? 'none' : 'auto'}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} accessibilityLabel="Cancel" />
        </Animated.View>
        <View
          style={[styles.center, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}
          pointerEvents="box-none"
        >
          <Panel style={[styles.card, { maxHeight: tallest }, card]} accessibilityRole="alert">
            <ScrollView style={styles.words} alwaysBounceVertical={false} overScrollMode="never">
              <PanelHeading title={question.title} message={question.message} />
            </ScrollView>
            <PanelRule />
            <PanelRow
              icon={question.icon ?? icons.check}
              label={question.confirm}
              destructive={question.danger}
              onPress={() => close(true)}
            />
            <PanelRow icon={icons.close} label="Cancel" onPress={() => close(false)} />
          </Panel>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: surface.backdrop },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 320 },
  words: { flexGrow: 0, flexShrink: 1 },
});
