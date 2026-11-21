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

/**
 * A sheet over the current screen, as X shows its menus: it springs up from the bottom, follows the
 * finger down, and a flick or a drag past a third of its height closes it. Back closes it too.
 */
export function Sheet({ children, onClose, maxWidth = 560 }: { children: ReactNode; onClose: () => void; maxWidth?: number }) {
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const offset = useSharedValue(screen);
  const height = useSharedValue(screen);

  const close = () => {
    offset.value = withTiming(height.value, { duration: 200, easing: motion.out }, (done) => done && runOnJS(onClose)());
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  });

  const drag = Gesture.Pan()
    .onUpdate((event) => {
      offset.value = event.translationY > 0 ? event.translationY : event.translationY * 0.15;
    })
    .onEnd((event) => {
      if (event.translationY > height.value / 3 || event.velocityY > 900) {
        offset.value = withTiming(height.value, { duration: 180, easing: motion.out }, (done) => done && runOnJS(onClose)());
      } else {
        offset.value = withSpring(0, motion.settle);
      }
    });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(offset.value, [0, height.value], [1, 0]) }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <GestureDetector gesture={drag}>
        <Animated.View
          onLayout={(event) => {
            height.value = event.nativeEvent.layout.height;
            if (offset.value >= screen) offset.value = withSpring(0, motion.settle);
          }}
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg, maxWidth }, sheet]}
        >
          <View style={styles.grabber} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: 'center',
    marginHorizontal: 'auto',
    width: '100%',
    maxHeight: '88%',
    backgroundColor: color.raised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.sm,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: color.rule, marginBottom: space.md },
});
