import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { ago, bytes } from '@web/lib/format';
import { readable } from '@web/lib/release';
import type { Release } from '@web/wire';

import { qualityOf } from '@/engine/quality';
import { Button } from '@/ui/Button';
import { Icon, icons } from '@/ui/Icon';
import { rise } from '@/ui/rise';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { STAGE_DIFFERS, useStaged, useTone } from '@/ui/stage';
import { Tap } from '@/ui/Tap';
import {
  color as themedColor,
  font,
  motion,
  radius,
  space,
  stage,
  stageType,
  type as themedType,
  type Palette,
} from '@/theme';

import { useSources, type Sources } from './sources';

export function SourcesSheet({
  video,
  label,
  heading = 'Choose a source',
  current,
  onPick,
  onClose,
}: {
  video: string;
  label: string;
  heading?: string;
  current?: string;
  onPick?: (release: Release) => void;
  onClose: () => void;
}) {
  const styles = useStaged(themed, staged);
  const type = useStaged(themedType, stageType);
  return (
    <Sheet onClose={onClose}>
      {(close) => (
        <>
          <View style={styles.head}>
            <Text style={type.title}>{heading}</Text>
            <Text style={type.caption}>{label}</Text>
          </View>
          <SourcesList
            video={video}
            current={current}
            onPick={(release) =>
              close(() =>
                onPick ? onPick(release) : router.push({ pathname: '/play', params: { video, source: release.id } }),
              )
            }
          />
        </>
      )}
    </Sheet>
  );
}

/** The sources for a video, best first, as rows to pick from, with the search's progress and problems under them. */
export function SourcesList({
  video,
  current,
  onPick,
}: {
  video: string;
  current?: string;
  onPick: (release: Release) => void;
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
    <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: space.md }}>
      {state.releases.map((release, index) => (
        <SourceRow
          key={release.id}
          release={release}
          index={index}
          why={index === 0 ? whyFirst(release, state.releases) : null}
          playing={release.id === current}
          onPress={() => onPick(release)}
        />
      ))}
      {!state.done && state.releases.length === 0
        ? [0, 1, 2].map((row) => <Skeleton key={row} style={[styles.ghost, { backgroundColor: color.lifted }]} />)
        : null}
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
  );
}

function whyFirst(first: Release, all: Release[]): string {
  if (first.flags.includes('official') || first.flags.includes('trusted')) return 'Best · trusted';
  if (first.sources.includes('archive.org')) return 'Best · Internet Archive';
  const seeds = (release: Release) => release.seeders ?? -1;
  if (all.length > 1 && all.every((other) => other === first || seeds(other) < seeds(first)))
    return 'Best · most seeds';
  const peers = all.filter((other) => other.quality.resolution === first.quality.resolution && other.size);
  if (
    first.size &&
    first.quality.resolution &&
    peers.length > 1 &&
    peers.every((other) => other === first || (other.size ?? 0) > first.size!)
  ) {
    return `Best · smallest at ${first.quality.resolution}`;
  }
  return 'Best';
}

function SourceRow({
  release,
  index,
  why,
  playing,
  onPress,
}: {
  release: Release;
  index: number;
  why: string | null;
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
  const [open, setOpen] = useState(false);
  const facts = [
    seeds !== null ? `${seeds} seeds` : null,
    release.leechers !== null ? `${release.leechers} peers` : null,
    release.published ? `added ${ago(release.published)}` : null,
    release.sources.length > 0 ? `from ${release.sources.join(', ')}` : null,
  ].filter(Boolean);

  return (
    <Animated.View entering={rise(index)} layout={LinearTransition.duration(motion.standard)}>
      <View style={styles.line}>
        <Tap
          shrink={1}
          highlight
          haptic={!playing}
          disabled={playing}
          accessibilityState={{ selected: playing }}
          onPress={onPress}
          accessibilityLabel={[
            why ? why.replace('Best', 'Best match').replace(' · ', ', ') : null,
            ...tags.map((tag) => tag.label),
            release.size ? bytes(release.size) : null,
            seeds !== null ? `${seeds} seeds` : null,
            release.name,
          ]
            .filter(Boolean)
            .join(', ')}
          style={[styles.row, { flex: 1 }, playing && styles.rowPlaying]}
        >
          <View style={styles.body}>
            <View style={styles.tags}>
              {why && !playing ? <Text style={[styles.tag, styles.best]}>{why}</Text> : null}
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
        <Tap
          shrink={0.88}
          haptic
          onPress={() => setOpen((was) => !was)}
          accessibilityLabel={`${open ? 'Hide' : 'Show'} details of ${[...tags.map((tag) => tag.label), release.size ? bytes(release.size) : null].filter(Boolean).join(' ')}`}
          accessibilityState={{ expanded: open }}
          style={styles.more}
        >
          <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
            <Icon name={icons.chevron} size={18} tint={color.pencil} />
          </View>
        </Tap>
      </View>
      {open ? (
        <Animated.View entering={FadeIn.duration(motion.quick)} style={styles.details}>
          <Text style={styles.fullName} selectable>
            {release.name}
          </Text>
          {facts.length > 0 ? <Text style={styles.detail}>{facts.join(' · ')}</Text> : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const sheet = (c: Palette, t: typeof themedType) =>
  StyleSheet.create({
    head: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: 2 },
    list: { flexGrow: 0, flexShrink: 1 },
    ghost: { height: 52, marginHorizontal: space.xl, marginVertical: space.xs, borderRadius: radius.md },
    line: { flexDirection: 'row', alignItems: 'center', paddingRight: space.sm },
    more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    details: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: 4 },
    fullName: { ...t.caption, color: c.soft },
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
