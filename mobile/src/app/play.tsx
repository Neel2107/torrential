import { router, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bytes, sentence } from '@web/lib/format';
import { titleOf } from '@web/lib/video';
import { CHECKS, episodeCode, episodeName } from '@web/titles/words';

import { Player } from '@/player/Player';
import { useTitlePlay, type Start } from '@/player/start';
import { Art } from '@/ui/Art';
import { Button } from '@/ui/Button';
import { Icon, icons } from '@/ui/Icon';
import { Logo } from '@/ui/Logo';
import { Tap } from '@/ui/Tap';
import { color, font, motion, radius, space, type } from '@/theme';

export default function Play() {
  const { video } = useLocalSearchParams<{ video: string }>();
  const [attempt, setAttempt] = useState(0);
  const start = useTitlePlay(video, attempt);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  if (start.phase === 'ready') {
    return (
      <Player
        video={video}
        play={start.play}
        release={start.release}
        resumeAt={start.resumeAt}
        title={start.title}
        episode={start.episode}
      />
    );
  }
  return <Starting video={video} start={start} onRetry={() => setAttempt((n) => n + 1)} />;
}

function stepOf(start: Start): string {
  switch (start.phase) {
    case 'finding':
      return 'Finding sources';
    case 'trying':
      return start.check ? CHECKS[start.check].replace(/\.$/, '') : `Trying source ${start.rank} of ${start.of}`;
    default:
      return '';
  }
}

function Starting({ video, start, onRetry }: { video: string; start: Exclude<Start, { phase: 'ready' }>; onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  const id = titleOf(video);
  const name = start.title?.name ?? '';
  const detail = start.episode ? `${episodeCode(start.episode)} · ${episodeName(start.episode)}` : start.title?.year ? String(start.title.year) : '';

  return (
    <View style={styles.screen}>
      <Art id={id} kind="background" style={StyleSheet.absoluteFill} placeholder={false} />
      <LinearGradient
        colors={['rgba(10,9,7,0.55)', 'rgba(10,9,7,0.82)', '#0a0907']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.top, { paddingTop: Math.max(insets.top, space.lg), paddingLeft: insets.left + space.lg }]}>
        <Tap shrink={0.88} onPress={() => router.back()} accessibilityLabel="Cancel" style={styles.round}>
          <Icon name={icons.close} size={24} tint={color.ink} />
        </Tap>
      </View>
      <View style={[styles.body, { paddingLeft: insets.left + 56, paddingRight: insets.right + 56 }]}>
        {name ? <Logo id={id} name={name} style={styles.logo} /> : <View style={styles.logo} />}
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}

        {start.phase === 'failed' ? (
          <Animated.View entering={FadeIn.duration(motion.standard)} style={styles.failed}>
            <View style={styles.failedLine}>
              <Icon name={icons.warning} size={20} tint={color.error} />
              <Text style={styles.failedText}>{sentence(start.message)}</Text>
            </View>
            {start.hint ? <Text style={type.label}>{sentence(start.hint)}</Text> : null}
            <View style={styles.actions}>
              <Button label="Try again" icon={icons.refresh} onPress={onRetry} />
              <Button label="Back" kind="secondary" onPress={() => router.back()} />
            </View>
          </Animated.View>
        ) : (
          <View style={styles.progress}>
            <Animated.Text key={stepOf(start)} entering={FadeIn.duration(motion.quick)} exiting={FadeOut.duration(120)} layout={LinearTransition} style={styles.step}>
              {stepOf(start)}
            </Animated.Text>
            <Sweep />
            {start.phase === 'trying' ? (
              <Animated.Text key={start.release.id} entering={FadeIn.duration(motion.quick)} style={styles.release} numberOfLines={1}>
                {[start.release.quality.resolution?.toUpperCase(), start.release.size ? bytes(start.release.size) : null, start.release.seeders !== null ? `${start.release.seeders} seeds` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Animated.Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

/** An indeterminate bar: a short highlight that sweeps across while the engine works. */
function Sweep() {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1100, easing: motion.inOut }), -1, false);
  }, [x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -width * 0.35 + x.value * width * 1.35 }] }));
  return (
    <View style={styles.sweep} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Animated.View style={[styles.sweepBar, { width: width * 0.35 }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0907' },
  top: { position: 'absolute', top: 0, left: 0, zIndex: 2 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,18,15,0.5)' },
  body: { flex: 1, justifyContent: 'center', gap: space.md, maxWidth: 640 },
  logo: { height: 72, width: '70%' },
  detail: { fontFamily: font.medium, fontSize: 16, color: color.soft },
  progress: { gap: space.md, marginTop: space.lg, maxWidth: 420 },
  step: { fontFamily: font.semibold, fontSize: 17, color: color.ink },
  sweep: { height: 3, borderRadius: 2, backgroundColor: 'rgba(240,233,220,0.14)', overflow: 'hidden' },
  sweepBar: { height: 3, borderRadius: 2, backgroundColor: color.action },
  release: { ...type.numeric, color: color.pencil },
  failed: { gap: space.md, marginTop: space.lg, maxWidth: 520 },
  failedLine: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  failedText: { flex: 1, fontFamily: font.semibold, fontSize: 16, color: color.ink, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  radius: { borderRadius: radius.md },
});
