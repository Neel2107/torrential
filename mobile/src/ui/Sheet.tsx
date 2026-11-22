import { useEffect, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, motion, radius, space } from '@/theme';

import { Portal } from './Portal';

/**
 * A sheet over the current screen, as X shows its menus: it springs up from the bottom, follows the
 * finger down from its grab strip, and a flick or a drag past a third of its height closes it. Back
 * and the dimmed screen behind close it too. Only the strip drags: the lists inside own their scroll.
 */
export function Sheet({
  children,
  onClose,
  maxWidth = 560,
}: {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: number;
}) {
  const insets = useSafeAreaInsets();
  const { height: screen, width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, maxWidth);
  const offset = useSharedValue(screen);
  const height = useSharedValue(screen);

  const close = () => {
    offset.value = withTiming(
      height.value,
      { duration: 200, easing: motion.out },
      (done) => done && runOnJS(onClose)(),
    );
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  });

  const drag = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onUpdate((event) => {
      offset.value = event.translationY > 0 ? event.translationY : event.translationY * 0.15;
    })
    .onEnd((event) => {
      if (event.translationY > height.value / 3 || event.velocityY > 900) {
        offset.value = withTiming(
          height.value,
          { duration: 180, easing: motion.out },
          (done) => done && runOnJS(onClose)(),
        );
      } else {
        offset.value = withSpring(0, motion.settle);
      }
    });

  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, height.value], [1, 0]),
  }));

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          onLayout={(event) => {
            height.value = event.nativeEvent.layout.height;
            if (offset.value >= screen) offset.value = withSpring(0, motion.settle);
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
          {/* Shrinks to the sheet's height, so a long list inside scrolls instead of running off the bottom. */}
          <View style={styles.body}>{children}</View>
        </Animated.View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: color.raised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  // A strip the width of the sheet and tall enough for a thumb, above the content.
  handle: { height: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  body: { flexShrink: 1 },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: color.rule },
});
