import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import type { Job } from '@web/wire';

import { color, motion } from '@/theme';

import { BandsMark, fill } from './Bands';
import { Icon, icons } from './Icon';

/**
 * Where a download stands, on its row. While pieces arrive the mark's bands fill with the download,
 * one band a third; when the last piece lands (`landed`, a moment ago, not on opening the app) the
 * check springs in from the full mark.
 */
export function JobBadge({ job, landed, small }: { job: Job; landed: boolean; small: boolean }) {
  const size = job.progress.size ? job.progress.verified / job.progress.size : 0;
  const filling =
    job.state === 'downloading' || job.state === 'metadata' || job.state === 'queued' || job.state === 'checking';
  const progress = useSharedValue(size);
  const pop = useSharedValue(landed ? 0.4 : 1);

  useEffect(() => {
    progress.value = withTiming(size, { duration: 600, easing: motion.out });
  }, [progress, size]);

  useEffect(() => {
    if (landed) pop.value = withDelay(80, withSpring(1, motion.pop));
  }, [landed, pop]);

  const top = useAnimatedStyle(() => ({ opacity: fill(progress.value, 0) }));
  const middle = useAnimatedStyle(() => ({ opacity: fill(progress.value, 1) }));
  const last = useAnimatedStyle(() => ({ opacity: fill(progress.value, 2) }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const mark = small ? 13 : 22;
  const icon = job.state === 'done' ? icons.check : job.state === 'paused' ? icons.pause : icons.warning;
  const tint = small
    ? color.actionInk
    : job.state === 'error'
      ? color.error
      : job.state === 'done'
        ? color.action
        : color.soft;

  return (
    <View
      style={[
        small ? styles.mini : styles.badge,
        small && filling && styles.miniFilling,
        small && job.state === 'error' && { backgroundColor: color.error },
        !small && job.state === 'error' && { backgroundColor: 'rgba(226,128,110,0.14)' },
      ]}
    >
      {filling ? (
        <BandsMark size={mark} bands={[top, middle, last]} label={`${Math.round(size * 100)}% downloaded`} />
      ) : (
        <Animated.View style={popStyle}>
          <Icon name={icon} size={small ? 11 : 18} tint={tint} weight={small ? 3 : 2.2} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mini: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.action,
    borderWidth: 2,
    borderColor: color.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniFilling: { backgroundColor: color.lifted },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
});
