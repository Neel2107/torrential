import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { motion, scheme, space } from '@/theme';

import { surface, surfaceFor } from './Panel';
import { Portal } from './Portal';
import { STAGE_DIFFERS, useStaged } from './stage';

type Close = (after?: () => void) => void;

export const SHEET_SHARE = 0.88;
export const SHEET_CHROME = 28 + space.xs;

/** A sheet from the bottom. Content given as `render` gets `close`, which slides it away before running what was picked, once. `onBack` takes the back button first, for a sheet with pages of its own (see Pages). */
export function Sheet({
  children,
  render,
  onClose,
  onBack,
  maxWidth = 560,
}: {
  children?: ReactNode;
  render?: (close: Close) => ReactNode;
  onClose: () => void;
  onBack?: () => boolean;
  maxWidth?: number;
}) {
  const styles = useStaged(themed, staged);
  const insets = useSafeAreaInsets();
  const { height: screen, width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, maxWidth);
  const offset = useSharedValue(screen);
  const height = useSharedValue(screen);
  const start = useSharedValue(0);
  const leaving = useSharedValue(false);
  const [closing, setClosing] = useState(false);

  const finish = (after?: () => void) => {
    after?.();
    onClose();
  };

  const close: Close = (after) => {
    if (leaving.get()) return;
    leaving.set(true);
    setClosing(true);
    offset.set(
      withTiming(
        height.get() + insets.bottom + surface.gap * 4,
        { duration: 200, easing: motion.out },
        (done) => done && scheduleOnRN(finish, after),
      ),
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
          onLayout={(event) => {
            height.set(event.nativeEvent.layout.height);

            if (offset.get() >= screen) offset.set(withSpring(0, motion.settle));
          }}
          style={[
            styles.sheet,
            {
              bottom: insets.bottom + surface.gap,
              width: width - surface.gap * 2,
              left: (screenWidth - width) / 2 + surface.gap,
            },
            sheet,
          ]}
        >
          <GestureDetector gesture={drag}>
            <View style={styles.handle}>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>
          <View style={styles.body}>{render ? render(close) : children}</View>
        </Animated.View>
      </View>
    </Portal>
  );
}

const sheet = (dark: boolean) => {
  const look = surfaceFor(dark);

  return StyleSheet.create({
    backdrop: { backgroundColor: look.backdrop },
    sheet: {
      position: 'absolute',
      maxHeight: `${SHEET_SHARE * 100}%`,
      backgroundColor: look.fill,
      borderRadius: look.radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: look.rim,
      shadowColor: '#000',
      shadowOpacity: look.shadow,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
      elevation: 24,
      paddingBottom: space.md,
      overflow: 'hidden',
    },
    handle: { height: SHEET_CHROME - space.xs, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
    body: { flexShrink: 1 },
    grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: look.grabber },
  });
};

const themed = sheet(scheme === 'dark');
const staged = STAGE_DIFFERS ? sheet(true) : themed;
