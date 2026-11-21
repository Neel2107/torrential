import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/ui/Button';
import { icons } from '@/ui/Icon';
import { color, font, motion, space, type } from '@/theme';

const UP_NEXT_SECONDS = 10;

/**
 * The end of a video. A season goes on to its next episode after a countdown that can be cancelled,
 * as the web player does; a film offers to play again.
 */
export function Ended({
  next,
  onNext,
  onReplay,
  onBack,
}: {
  next: string | null;
  onNext: () => void;
  onReplay: () => void;
  onBack: () => void;
}) {
  const reduced = useReducedMotion();
  const [left, setLeft] = useState<number | null>(next ? UP_NEXT_SECONDS : null);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (left === null) return;
    if (left === 0) return onNext();
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, onNext]);

  useEffect(() => {
    if (next && !reduced) progress.value = withTiming(1, { duration: UP_NEXT_SECONDS * 1000, easing: Easing.linear });
  }, [next, progress, reduced]);

  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(motion.standard)} style={styles.screen}>
      {next ? (
        <View style={styles.heading}>
          <Text style={[type.label, styles.center]} accessibilityLiveRegion="polite">
            {left === null ? 'Up next' : `Up next in ${left}`}
          </Text>
          <Text style={[styles.next, styles.center]} numberOfLines={2}>
            {next}
          </Text>
        </View>
      ) : (
        <Text style={[type.title, styles.center]}>The end</Text>
      )}
      {left !== null ? (
        <View style={styles.track}>
          <Animated.View style={[styles.fill, bar]} />
        </View>
      ) : null}
      <View style={styles.actions}>
        {next ? <Button label="Play now" icon={icons.play} onPress={onNext} /> : null}
        {left !== null ? (
          <Button label="Cancel" kind="secondary" onPress={() => setLeft(null)} />
        ) : (
          <Button label="Watch again" kind={next ? 'secondary' : 'primary'} icon={icons.rewind} onPress={onReplay} />
        )}
        {left === null ? <Button label="Back" kind="quiet" onPress={onBack} /> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    padding: space.xl,
  },
  heading: { gap: space.xs, maxWidth: 520 },
  center: { textAlign: 'center' },
  next: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: color.ink },
  track: { width: 200, height: 3, borderRadius: 2, backgroundColor: 'rgba(240,233,220,0.16)', overflow: 'hidden' },
  fill: { height: 3, width: 200, backgroundColor: color.ink, transformOrigin: 'left' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
});
