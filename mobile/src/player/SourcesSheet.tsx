import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { bytes, sentence } from '@web/lib/format';
import { readable } from '@web/lib/release';
import type { Release, SearchMessage } from '@web/wire';

import { stream, url } from '@/engine/client';
import { useLink } from '@/engine/session';
import { Icon, icons } from '@/ui/Icon';
import { rise } from '@/ui/rise';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { color, font, radius, space, type } from '@/theme';

import { useViewer } from './start';

type State = { releases: Release[]; done: boolean; error: string | null };

/**
 * Every release of a film or episode, ranked for this phone's screen and decoders, in the order Play
 * tries them. Picking one plays that release and no other.
 */
export function SourcesSheet({ video, label, onClose }: { video: string; label: string; onClose: () => void }) {
  const link = useLink();
  const viewer = useViewer();
  const [state, setState] = useState<State>({ releases: [], done: false, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const path = url({ ...link, base: '' }, '/api/title/sources', {
      video,
      width: viewer.width,
      height: viewer.height,
      scale: viewer.scale,
      playback: viewer.playback,
      h264: viewer.decoders?.h264,
      hevc: viewer.decoders?.hevc,
      av1: viewer.decoders?.av1,
    });
    stream<SearchMessage>(link, path, { method: 'GET', signal: controller.signal }, (message) => {
      if (message.type === 'update') setState({ releases: message.result.releases, done: false, error: null });
      if (message.type === 'done') setState({ releases: message.result.releases, done: true, error: null });
      if (message.type === 'error')
        setState((previous) => ({ ...previous, done: true, error: sentence(message.error.message) }));
    }).catch(
      (error: Error) =>
        !controller.signal.aborted && setState((previous) => ({ ...previous, done: true, error: error.message })),
    );
    return () => controller.abort();
    // The viewer is read once when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, video]);

  return (
    <Sheet onClose={onClose}>
      <View style={styles.head}>
        <Text style={type.title}>Sources</Text>
        <Text style={type.caption}>{label} · best first for this phone</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: space.md }}>
        {state.releases.map((release, index) => (
          <Animated.View key={release.id} entering={rise(index)}>
            <Tap
              shrink={1}
              highlight
              haptic
              onPress={() => {
                onClose();
                router.push({ pathname: '/play', params: { video, source: release.id } });
              }}
              accessibilityLabel={`Play ${readable(release.name).title}, ${release.size ? bytes(release.size) : ''}`}
              style={styles.row}
            >
              <View style={styles.rank}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={type.callout} numberOfLines={2}>
                  {readable(release.name).title}{' '}
                  <Text style={{ color: color.pencil, fontFamily: font.regular }}>{readable(release.name).tags}</Text>
                </Text>
                <View style={styles.facts}>
                  {[
                    release.quality.resolution?.toUpperCase(),
                    release.quality.codec?.toUpperCase(),
                    release.quality.hdr ? 'HDR' : null,
                  ]
                    .filter(Boolean)
                    .map((chip) => (
                      <View key={chip} style={styles.chip}>
                        <Text style={styles.chipText}>{chip}</Text>
                      </View>
                    ))}
                  {release.size ? <Text style={type.numeric}>{bytes(release.size)}</Text> : null}
                  {release.seeders !== null ? (
                    <Text style={[type.numeric, { color: release.seeders > 10 ? color.action : color.pencil }]}>
                      {release.seeders} seeds
                    </Text>
                  ) : null}
                </View>
              </View>
              <Icon name={icons.play} size={18} tint={color.soft} filled />
            </Tap>
          </Animated.View>
        ))}
        {!state.done ? (
          <View style={styles.status}>
            <ActivityIndicator color={color.soft} />
            <Text style={type.caption}>Asking sources…</Text>
          </View>
        ) : state.error ? (
          <Text style={[type.label, styles.statusText, { color: color.error }]}>{state.error}</Text>
        ) : state.releases.length === 0 ? (
          <Text style={[type.label, styles.statusText]}>No source was found.</Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: color.lifted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontFamily: font.bold, fontSize: 12, color: color.soft, fontVariant: ['tabular-nums'] },
  facts: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm - 2, backgroundColor: color.lifted },
  chipText: { fontFamily: font.semibold, fontSize: 11, color: color.soft, letterSpacing: 0.3 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  statusText: { paddingHorizontal: space.xl, paddingVertical: space.lg },
});
