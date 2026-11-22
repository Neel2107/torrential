import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, motion, radius, space, stage, type Palette } from '@/theme';

import { Portal } from './Portal';
import { STAGE_DIFFERS, useStaged } from './stage';

type Close = (after?: () => void) => void;

const MORPH = LinearTransition.duration(260).easing(motion.inOut);

/** A sheet from the bottom. Its content gets `close`, which slides it away before running what was picked, once. `onBack` takes the back button first, for a sheet with pages of its own. `morph` eases the sheet to each new height when its content changes. */
export function Sheet({
  children,
  onClose,
  onBack,
  morph = false,
  maxWidth = 560,
}: {
  children: ReactNode | ((close: Close) => ReactNode);
  onClose: () => void;
  onBack?: () => boolean;
  morph?: boolean;
  maxWidth?: number;
}) {
  const styles = useStaged(themed, staged);
  const insets = useSafeAreaInsets();
  const { height: screen, width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, maxWidth);
  const offset = useSharedValue(screen);
  const height = useSharedValue(screen);
  const start = useSharedValue(0);
  const leaving = useRef(false);
  const [closing, setClosing] = useState(false);

  const finish = (after?: () => void) => {
    after?.();
    onClose();
  };
  const close: Close = (after) => {
    if (leaving.current) return;
    leaving.current = true;
    setClosing(true);
    offset.set(
      withTiming(height.get(), { duration: 200, easing: motion.out }, (done) => done && scheduleOnRN(finish, after)),
    );
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!onBack?.()) close();
      return true;
    });
    return () => subscription.remove();
  });

  const drag = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      cancelAnimation(offset);
      start.set(offset.get());
    })
    .onUpdate((event) => {
      const next = start.get() + event.translationY;
      offset.set(next > 0 ? next : next * 0.15);
    })
    .onEnd((event) => {
      if (offset.get() + event.velocityY * 0.2 > height.get() * 0.4) {
        scheduleOnRN(close);
      } else {
        offset.set(withSpring(0, { ...motion.settle, velocity: event.velocityY }));
      }
    });

  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
  }));
  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get(), [0, height.get()], [1, 0]),
  }));

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal pointerEvents={closing ? 'none' : 'auto'}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          layout={morph ? MORPH : undefined}
          onLayout={(event) => {
            height.set(event.nativeEvent.layout.height);
            if (offset.get() >= screen) offset.set(withSpring(0, motion.settle));
          }}
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + space.lg,
              width,
              left: (screenWidth - width) / 2,
            },
            sheet,
          ]}
        >
          <GestureDetector gesture={drag}>
            <View style={styles.handle}>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>
          <View style={styles.body}>{typeof children === 'function' ? children(close) : children}</View>
        </Animated.View>
      </View>
    </Portal>
  );
}

const sheet = (c: Palette) =>
  StyleSheet.create({
    backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      position: 'absolute',
      bottom: 0,
      maxHeight: '88%',
      backgroundColor: c.raised,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
    },
    handle: { height: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
    body: { flexShrink: 1 },
    grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.rule },
  });

const themed = sheet(color);
const staged = STAGE_DIFFERS ? sheet(stage) : themed;
