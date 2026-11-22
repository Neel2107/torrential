import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { bytes } from '@web/lib/format';
import { readable } from '@web/lib/release';
import type { Release } from '@web/wire';

import { qualityOf } from '@/engine/quality';
import { Button } from '@/ui/Button';
import { rise } from '@/ui/rise';
import { Sheet } from '@/ui/Sheet';
import { STAGE_DIFFERS, useStaged, useTone } from '@/ui/stage';
import { Tap } from '@/ui/Tap';
import { color as themedColor, font, space, stage, stageType, type as themedType, type Palette } from '@/theme';

import { useSources, type Sources } from './sources';

export function SourcesSheet({
  video,
  label,
  current,
  onPick,
  onClose,
}: {
  video: string;
  label: string;
  current?: string;
  onPick?: (release: Release) => void;
  onClose: () => void;
}) {
  const styles = useStaged(themed, staged);
  const color = useTone();
  const type = useStaged(themedType, stageType);
  const sources = useSources(video);
  const state: Sources = sources.data ?? {
    releases: [],
    done: sources.isError,
    error: sources.error ? sources.error.message : null,
  };

  return (
    <Sheet onClose={onClose}>
      <View style={styles.head}>
        <Text style={type.title}>Choose a source</Text>
        <Text style={type.caption}>{label}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: space.md }}>
        {state.releases.map((release, index) => (
          <SourceRow
            key={release.id}
            release={release}
            index={index}
            playing={release.id === current}
            onPress={() => {
              if (onPick) return onPick(release);
              onClose();
              router.push({ pathname: '/play', params: { video, source: release.id } });
            }}
          />
        ))}
        {!state.done ? (
          <View style={styles.status}>
            <ActivityIndicator color={color.soft} />
            <Text style={type.caption}>Looking for sources…</Text>
          </View>
        ) : state.error || state.releases.length === 0 ? (
          <View style={styles.problem}>
            <Text style={[type.label, { color: state.error ? color.error : color.soft }]}>
              {state.error ? `Couldn't load sources. ${state.error}` : 'No playable sources found.'}
            </Text>
            <Button label="Try again" kind="secondary" onPress={() => sources.refetch()} />
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function SourceRow({
  release,
  index,
  playing,
  onPress,
}: {
  release: Release;
  index: number;
  playing: boolean;
  onPress: () => void;
}) {
  const styles = useStaged(themed, staged);
  const color = useTone();
  const name = readable(release.name);
  const tags = qualityOf(release.name);
  const detail = name.tags || name.title;
  const seeds = release.seeders;
  const health = seeds === null ? color.pencil : seeds >= 20 ? color.action : seeds >= 5 ? color.soft : color.error;

  return (
    <Animated.View entering={rise(index)}>
      <Tap
        shrink={1}
        highlight
        haptic={!playing}
        disabled={playing}
        accessibilityState={{ selected: playing }}
        onPress={onPress}
        accessibilityLabel={[
          index === 0 ? 'Best match' : null,
          ...tags.map((tag) => tag.label),
          release.size ? bytes(release.size) : null,
          seeds !== null ? `${seeds} seeds` : null,
          release.name,
        ]
          .filter(Boolean)
          .join(', ')}
        style={[styles.row, playing && styles.rowPlaying]}
      >
        <View style={styles.body}>
          <View style={styles.tags}>
            {index === 0 && !playing ? <Text style={[styles.tag, styles.best]}>Best</Text> : null}
            {playing ? <Text style={[styles.tag, styles.best]}>Playing</Text> : null}
            {tags.map((tag) => (
              <Text key={tag.label} style={[styles.tag, tag.strong && styles.tagStrong]}>
                {tag.label}
              </Text>
            ))}
            {tags.length === 0 ? <Text style={styles.unknown}>Unknown quality</Text> : null}
          </View>
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <View style={styles.side}>
          {release.size ? <Text style={styles.size}>{bytes(release.size)}</Text> : null}
          {seeds !== null ? (
            <View style={styles.seeds}>
              <View style={[styles.dot, { backgroundColor: health }]} />
              <Text style={styles.seedText}>{seeds}</Text>
            </View>
          ) : null}
        </View>
      </Tap>
    </Animated.View>
  );
}

const sheet = (c: Palette, t: typeof themedType) =>
  StyleSheet.create({
    head: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.xl,
      paddingVertical: 14,
    },
    rowPlaying: { backgroundColor: 'rgba(166, 199, 154, 0.08)' },
    body: { flex: 1, gap: 6 },
    tags: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    tag: {
      fontFamily: font.semibold,
      fontSize: 11,
      letterSpacing: 0.2,
      color: c.soft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      overflow: 'hidden',
      backgroundColor: c.lifted,
    },
    tagStrong: { color: c.actionInk, backgroundColor: c.action },
    best: { color: c.action, backgroundColor: 'transparent', borderWidth: 1, borderColor: c.action },
    unknown: { ...t.caption, color: c.pencil },
    detail: { ...t.caption, color: c.pencil },
    side: { alignItems: 'flex-end', gap: 6 },
    size: { ...t.numeric, color: c.ink },
    seeds: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    seedText: { ...t.caption, fontVariant: ['tabular-nums'] },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.xl,
      paddingVertical: space.lg,
    },
    problem: { paddingHorizontal: space.xl, paddingVertical: space.lg, gap: space.md, alignItems: 'flex-start' },
  });

const themed = sheet(themedColor, themedType);
const staged = STAGE_DIFFERS ? sheet(stage, stageType) : themed;
