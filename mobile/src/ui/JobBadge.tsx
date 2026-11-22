import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import type { Job } from '@web/wire';

import { color, motion } from '@/theme';

import { BandsMark, fill } from './Bands';
import { Icon, icons } from './Icon';

/**
 * A download's state at the start of its status line: the mark filling a band a third while pieces
 * arrive, a pause, or the check, which springs in when the download finished a moment ago.
 */
export function JobBadge({ job, landed }: { job: Job; landed: boolean }) {
  const share = job.progress.size ? job.progress.verified / job.progress.size : 0;
  const filling =
    job.state === 'downloading' || job.state === 'metadata' || job.state === 'queued' || job.state === 'checking';
  const progress = useSharedValue(share);
  const pop = useSharedValue(landed ? 0.4 : 1);

  useEffect(() => {
    progress.value = withTiming(share, { duration: 600, easing: motion.out });
  }, [progress, share]);

  useEffect(() => {
    if (landed) pop.value = withDelay(80, withSpring(1, motion.pop));
  }, [landed, pop]);

  const top = useAnimatedStyle(() => ({ opacity: fill(progress.value, 0) }));
  const middle = useAnimatedStyle(() => ({ opacity: fill(progress.value, 1) }));
  const last = useAnimatedStyle(() => ({ opacity: fill(progress.value, 2) }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  if (filling)
    return <BandsMark size={15} bands={[top, middle, last]} label={`${Math.round(share * 100)}% downloaded`} />;
  return (
    <Animated.View style={popStyle}>
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
