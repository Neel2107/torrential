import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Job } from '@web/wire';

import { color, motion } from '@/theme';

import { BandsMark, fill } from './Bands';
import { Icon, icons } from './Icon';

/**
 * A download's state at the start of its status line: the mark filling a band a third while pieces
 * arrive, a pause, or the check, which springs in when the download finished a moment ago and pings
 * while others download it from this engine.
 */
export function JobBadge({ job, landed }: { job: Job; landed: boolean }) {
  const share = job.progress.size ? job.progress.verified / job.progress.size : 0;
  const filling =
    job.state === 'downloading' || job.state === 'metadata' || job.state === 'queued' || job.state === 'checking';
  const progress = useSharedValue(share);
  const pop = useSharedValue(1);

  useEffect(() => {
    progress.set(withTiming(share, { duration: motion.tick, easing: Easing.linear }));
  }, [progress, share]);

  useEffect(() => {
    if (!landed) return;
    pop.set(0.9);
    pop.set(withDelay(80, withSpring(1, motion.pop)));
  }, [landed, pop]);

  const top = useAnimatedStyle(() => ({ opacity: fill(progress.get(), 0) }));
  const middle = useAnimatedStyle(() => ({ opacity: fill(progress.get(), 1) }));
  const last = useAnimatedStyle(() => ({ opacity: fill(progress.get(), 2) }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  const seeding = job.state === 'done' && job.progress.up_rate > 0;

  if (filling)
    return <BandsMark size={15} bands={[top, middle, last]} label={`${Math.round(share * 100)}% downloaded`} />;
  return (
    <Animated.View style={popStyle}>
      {seeding ? <Ping /> : null}
      <Icon
        name={job.state === 'done' ? icons.check : job.state === 'paused' ? icons.pause : icons.warning}
        size={14}
        tint={job.state === 'done' ? color.action : job.state === 'error' ? color.error : color.soft}
        weight={2.6}
        filled={job.state === 'paused'}
      />
    </Animated.View>
  );
}

function Ping() {
  return (
    <View pointerEvents="none" style={styles.ping}>
      <View style={styles.ring} />
    </View>
  );
}

const PING_MS = 2000;

const styles = StyleSheet.create({
  ping: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 16, height: 16, borderRadius: 8, backgroundColor: color.action },
});
