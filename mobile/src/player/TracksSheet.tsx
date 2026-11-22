import type { ReactNode } from 'react';
import { useEvent } from 'expo';
import type { AudioTrack, SubtitleTrack, VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { MediaInfo, OnlineSubtitle } from '@web/wire';

import { languageLabel, languageName, phoneLanguage } from './languages';
import type { OnlineLookup, SubtitleChoice } from './Subtitles';

import { Icon, icons } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Check } from '@/ui/Check';
import { Tap } from '@/ui/Tap';
import { stage as color, font, motion, space, stageType as type } from '@/theme';

type FileChoice = Extract<SubtitleChoice, { kind: 'file' }>;

function trackName(
  track: { label?: string | null; language?: string | null; name?: string | null },
  index: number,
  kind: string,
): string {
  const label = track.label && track.label !== 'und' ? track.label : null;
  return label || track.name || languageName(track.language) || `${kind} ${index + 1}`;
}

export function TracksSheet({
  player,
  media,
  streamAudio,
  files,
  online,
  drawn,
  onDraw,
  onLanguage,
  look,
  onClose,
}: {
  player: VideoPlayer;
  media: MediaInfo | null;
  streamAudio: { tracks: MediaInfo['audio']; selected: number | null; onSelect: (stream: number) => void } | null;
  files: FileChoice[];
  online: OnlineLookup;
  drawn: SubtitleChoice | null;
  onDraw: (choice: SubtitleChoice | null) => void;
  onLanguage: (language: string | null) => void;
  look: ReactNode;
  onClose: () => void;
}) {
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', { subtitleTrack: player.subtitleTrack });
  const { audioTrack } = useEvent(player, 'audioTrackChange', { audioTrack: player.audioTrack });
  const subtitles = player.availableSubtitleTracks;
  const audio = player.availableAudioTracks;

  return (
    <Sheet onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.xs }}>
        <Text style={[type.title, styles.heading]}>Subtitles</Text>
        <Row
          label="Off"
          selected={!subtitleTrack && !drawn}
          onPress={() => {
            player.subtitleTrack = null;
            onDraw(null);
            onLanguage(null);
          }}
        />
        {subtitles.map((track: SubtitleTrack, index) => (
          <Row
            key={`${track.id ?? index}`}
            label={trackName(track, index, 'Subtitles')}
            detail={languageName(track.language)}
            selected={!drawn && subtitleTrack?.id === track.id && subtitleTrack?.label === track.label}
            onPress={() => {
              onDraw(null);
              player.subtitleTrack = track;
              if (track.language) onLanguage(track.language);
            }}
          />
        ))}
        {files.map((candidate) => (
          <Row
            key={`file-${candidate.index}`}
            label={candidate.name.replace(/\.(srt|vtt|ass|ssa|sub)$/i, '')}
            detail="Subtitle file in the torrent"
            selected={drawn?.kind === 'file' && drawn.index === candidate.index}
            onPress={() => onDraw(candidate)}
          />
        ))}
        {subtitles.length === 0 && files.length === 0 ? (
          <Text style={[type.caption, styles.empty]}>This video has no subtitles of its own.</Text>
        ) : null}

        <Text style={[type.section, styles.section]}>Found online</Text>
        <OnlineRows lookup={online} drawn={drawn} onDraw={onDraw} />
        {look}

        <Text style={[type.title, styles.heading, { marginTop: space.lg }]}>Audio</Text>
        {streamAudio
          ? streamAudio.tracks.map((track, index) => (
              <Row
                key={`stream-${track.stream}`}
                label={track.title || languageName(track.language) || `Audio ${index + 1}`}
                detail={`${track.codec.toUpperCase()} · ${channels(track.channels)} · converted by the engine`}
                selected={
                  track.stream ===
                  (streamAudio.selected ?? (streamAudio.tracks.find((t) => t.default) ?? streamAudio.tracks[0])?.stream)
                }
                onPress={() => streamAudio.onSelect(track.stream)}
              />
            ))
          : audio.map((track: AudioTrack, index) => {
              const fromEngine = media?.audio[index];
              return (
                <Row
                  key={`${track.id ?? index}`}
                  label={
                    audio.length === 1 && !languageName(track.language) ? 'Original' : trackName(track, index, 'Audio')
                  }
                  detail={fromEngine ? `${fromEngine.codec.toUpperCase()} · ${channels(fromEngine.channels)}` : null}
                  selected={audioTrack?.id === track.id && audioTrack?.label === track.label}
                  onPress={() => (player.audioTrack = track)}
                />
              );
            })}
      </ScrollView>
    </Sheet>
  );
}

function OnlineRows({
  lookup,
  drawn,
  onDraw,
}: {
  lookup: OnlineLookup;
  drawn: SubtitleChoice | null;
  onDraw: (choice: SubtitleChoice) => void;
}) {
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  if (lookup.kind === 'looking') {
    return (
      <View style={styles.status}>
        <ActivityIndicator color={color.soft} size="small" />
        <Text style={type.caption}>Looking for subtitles online…</Text>
      </View>
    );
  }
  if (lookup.kind !== 'found') {
    return (
      <Text style={[type.caption, styles.empty]}>
        {lookup.kind === 'nothing'
          ? 'No subtitles were found online for this video.'
          : 'The online lookup did not answer.'}
      </Text>
    );
  }

  const chosen = drawn?.kind === 'online' ? drawn.subtitle : null;
  const byLanguage = new Map<string, OnlineSubtitle[]>();
  for (const subtitle of lookup.subtitles) {
    byLanguage.set(subtitle.language, [...(byLanguage.get(subtitle.language) ?? []), subtitle]);
  }
  const languages = [...byLanguage.keys()].sort((a, b) => languageLabel(a).localeCompare(languageLabel(b)));
  const wanted = [phoneLanguage(), 'en'];
  const near = languages.filter((tag) => wanted.includes(tag.slice(0, 2).toLowerCase()) || tag === chosen?.language);
  const rest = languages.filter((tag) => !near.includes(tag));
  const versions = chosen ? (byLanguage.get(chosen.language) ?? []) : [];

  const row = (subtitle: OnlineSubtitle, label: string, detail: string | null) => (
    <Row
      key={subtitle.id}
      label={label}
      detail={[subtitle.exact ? 'Exact match' : 'Online', detail].filter(Boolean).join(' · ')}
      selected={chosen?.id === subtitle.id}
      onPress={() => onDraw({ kind: 'online', subtitle })}
    />
  );
  const best = (tag: string) => {
    const subtitle = chosen?.language === tag ? chosen : byLanguage.get(tag)![0]!;
    return row(subtitle, languageLabel(tag), subtitle.name);
  };

  return (
    <>
      {near.map(best)}
      {chosen && versions.length > 1 ? (
        <>
          <Disclosure
            label={`Other ${languageLabel(chosen.language)} versions`}
            count={versions.length - 1}
            open={versionsOpen}
            onToggle={() => setVersionsOpen((open) => !open)}
          />
          {versionsOpen ? (
            <Animated.View entering={FadeIn.duration(motion.quick)}>
              {versions.map((subtitle) => row(subtitle, subtitle.name ?? subtitle.source, subtitle.source))}
              <Text style={[type.caption, styles.empty]}>
                A version made for another release can run early or late. Shift its timing in Settings.
              </Text>
            </Animated.View>
          ) : null}
        </>
      ) : null}
      {rest.length > 0 ? (
        <>
          <Disclosure
            label={near.length ? 'More languages' : 'Languages'}
            count={rest.length}
            open={moreOpen}
            onToggle={() => setMoreOpen((open) => !open)}
          />
          {moreOpen ? <Animated.View entering={FadeIn.duration(motion.quick)}>{rest.map(best)}</Animated.View> : null}
        </>
      ) : null}
    </>
  );
}

function Disclosure({
  label,
  count,
  open,
  onToggle,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: motion.quick, easing: motion.out });
  }, [open, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <Tap
      shrink={1}
      highlight
      haptic
      onPress={onToggle}
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}, ${count}`}
      style={styles.row}
    >
      <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
      <Text style={type.numeric}>{count}</Text>
      <Animated.View style={chevron}>
        <Icon name={icons.expand} size={18} tint={color.pencil} />
      </Animated.View>
    </Tap>
  );
}

function channels(count: number): string {
  return count > 2 ? `${count - 1}.1` : count === 2 ? 'Stereo' : 'Mono';
}

function Row({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Tap
      shrink={1}
      highlight
      haptic
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={styles.row}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, selected && { color: color.ink, fontFamily: font.semibold }]}>{label}</Text>
        {detail ? <Text style={type.caption}>{detail}</Text> : null}
      </View>
      <Check shown={selected} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: space.md,
    borderRadius: 12,
    gap: space.md,
  },
  label: { fontFamily: font.medium, fontSize: 16, color: color.soft },
  empty: { paddingHorizontal: space.md, paddingVertical: space.sm },
  section: { paddingHorizontal: space.md, marginTop: space.md, marginBottom: space.xs },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
