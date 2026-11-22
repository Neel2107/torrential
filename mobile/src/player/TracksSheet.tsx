import type { ReactNode } from 'react';
import { useEvent } from 'expo';
import type { AudioTrack, SubtitleTrack, VideoPlayer } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { MediaInfo, OnlineSubtitle } from '@web/wire';

import { languageLabel, languageName, phoneLanguage, sameLanguage } from './languages';
import type { OnlineLookup, SubtitleChoice } from './Subtitles';

import { PageHeader, Pages } from '@/ui/Pages';
import { NavRow, OptionRow } from '@/ui/Row';
import { Sheet } from '@/ui/Sheet';
import { stage as color, space, stageType as type } from '@/theme';
import { chooseAudio, chooseSubtitles } from './control';
import { appear } from '@/ui/presets';

type FileChoice = Extract<SubtitleChoice, { kind: 'file' }>;

function trackName(
  track: { label?: string | null; language?: string | null; name?: string | null },
  index: number,
  kind: string,
): string {
  const label = track.label && track.label !== 'und' ? track.label : null;

  return label || track.name || languageName(track.language) || `${kind} ${index + 1}`;
}

type Page = 'menu' | 'subtitles' | 'audio' | 'style';

const MENU_AUDIO = 3;

/** Names for a list of tracks where two would read the same: the second English becomes English 2. */
function namesOf(
  tracks: { label?: string | null; language?: string | null; name?: string | null }[],
  kind: string,
): string[] {
  const names = tracks.map((track, index) => trackName(track, index, kind));
  const total = new Map<string, number>();

  for (const name of names) total.set(name, (total.get(name) ?? 0) + 1);
  const seen = new Map<string, number>();

  return names.map((name) => {
    if (total.get(name) === 1) return name;
    const nth = (seen.get(name) ?? 0) + 1;
    seen.set(name, nth);

    return nth === 1 ? name : `${name} ${nth}`;
  });
}

function languageDetail(language: string | null | undefined, label: string): string | null {
  const name = languageName(language);

  return name && name.length > 3 && !label.toLowerCase().startsWith(name.toLowerCase()) ? name : null;
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
  onAudioLanguage,
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
  onAudioLanguage: (language: string) => void;
  look: ReactNode;
  onClose: () => void;
}) {
  const [page, setPage] = useState<Page>('menu');
  const window = useWindowDimensions();
  const wide = window.width > window.height;
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', { subtitleTrack: player.subtitleTrack });
  const { audioTrack } = useEvent(player, 'audioTrackChange', { audioTrack: player.audioTrack });
  const subtitles = player.availableSubtitleTracks;
  const audio = player.availableAudioTracks;
  const subtitleNames = namesOf(subtitles, 'Subtitles');

  const off = (
    <OptionRow
      label="Off"
      selected={!subtitleTrack && !drawn}
      onPress={() => {
        chooseSubtitles(player, null);
        onDraw(null);
        onLanguage(null);
      }}
    />
  );

  const embedded = (track: SubtitleTrack, index: number) => (
    <OptionRow
      key={`${track.id ?? index}`}
      label={subtitleNames[index]!}
      detail={languageDetail(track.language, subtitleNames[index]!)}
      selected={!drawn && subtitleTrack?.id === track.id && subtitleTrack?.label === track.label}
      onPress={() => {
        onDraw(null);
        chooseSubtitles(player, track);

        if (track.language) onLanguage(track.language);
      }}
    />
  );

  const file = (candidate: FileChoice) => (
    <OptionRow
      key={`file-${candidate.index}`}
      label={candidate.name.replace(/\.(srt|vtt|ass|ssa|sub)$/i, '')}
      detail="Subtitle file in the torrent"
      selected={drawn?.kind === 'file' && drawn.index === candidate.index}
      onPress={() => onDraw(candidate)}
    />
  );

  const audioRows = streamAudio
    ? streamAudio.tracks.map((track, index) => (
        <OptionRow
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
          <OptionRow
            key={`${track.id ?? index}`}
            label={audio.length === 1 && !languageName(track.language) ? 'Original' : namesOf(audio, 'Audio')[index]!}
            detail={fromEngine ? `${fromEngine.codec.toUpperCase()} · ${channels(fromEngine.channels)}` : null}
            selected={audioTrack ? audioTrack.id === track.id && audioTrack.label === track.label : index === 0}
            onPress={() => {
              chooseAudio(player, track);

              if (track.language) onAudioLanguage(track.language);
            }}
          />
        );
      });

  const wanted = [phoneLanguage(), 'en'];

  const current = subtitles.findIndex(
    (track) => !drawn && subtitleTrack?.id === track.id && subtitleTrack?.label === track.label,
  );

  const suggested = subtitles
    .map((track, index) => ({ track, index }))
    .filter(({ track, index }) => index !== current && wanted.some((tag) => sameLanguage(track.language, tag)))
    .slice(0, current >= 0 || drawn ? 1 : 2);

  const found = online.kind === 'found' ? online.subtitles.length : 0;
  const allSubtitles = subtitles.length + files.length + found;
  const audioCount = streamAudio ? streamAudio.tracks.length : audio.length;
  const audioSelected = audioRows.findIndex((row) => row.props.selected);

  const subtitleColumn = (
    <View style={styles.column}>
      <Text style={[type.title, styles.heading]}>Subtitles</Text>
      {off}
      {current >= 0 ? embedded(subtitles[current]!, current) : null}
      {drawn?.kind === 'file' ? file(drawn) : null}
      {drawn?.kind === 'online' ? (
        <OptionRow
          label={languageLabel(drawn.subtitle.language)}
          detail={[drawn.subtitle.exact ? 'Exact match' : 'Online', drawn.subtitle.name].filter(Boolean).join(' · ')}
          selected
          onPress={() => {}}
        />
      ) : null}
      {suggested.map(({ track, index }) => embedded(track, index))}
      <NavRow label="All subtitles" count={allSubtitles} onPress={() => setPage('subtitles')} />
    </View>
  );

  const audioColumn = (
    <View style={styles.column}>
      {audioCount > 0 ? <Text style={[type.title, styles.heading]}>Audio</Text> : null}
      {audioCount <= MENU_AUDIO ? audioRows : null}
      {audioCount > MENU_AUDIO ? (
        <>
          {audioSelected >= 0 ? audioRows[audioSelected] : null}
          <NavRow label="All audio" count={audioCount} onPress={() => setPage('audio')} />
        </>
      ) : null}

      <View style={styles.gap} />
      <NavRow label="Timing and style" onPress={() => setPage('style')} />
    </View>
  );

  const menu = (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, wide && styles.wide]}>
      {subtitleColumn}
      {!wide ? <View style={styles.gap} /> : null}
      {audioColumn}
    </ScrollView>
  );

  const pages: Record<Exclude<Page, 'menu'>, { title: string; body: ReactNode }> = {
    subtitles: {
      title: 'Subtitles',
      body: (
        <>
          {off}
          {subtitles.length > 0 ? <Text style={[type.section, styles.section]}>In the video</Text> : null}
          {subtitles.map(embedded)}
          {files.length > 0 ? <Text style={[type.section, styles.section]}>In the torrent</Text> : null}
          {files.map(file)}
          {subtitles.length === 0 && files.length === 0 ? (
            <Text style={[type.caption, styles.empty]}>This video has no subtitles of its own.</Text>
          ) : null}
          <Text style={[type.section, styles.section]}>Found online</Text>
          <OnlineRows lookup={online} drawn={drawn} onDraw={onDraw} />
        </>
      ),
    },
    audio: { title: 'Audio', body: audioRows },
    style: { title: 'Timing and style', body: look },
  };

  return (
    <Sheet
      maxWidth={wide ? 760 : 560}
      onClose={onClose}
      onBack={() => {
        if (page === 'menu') return false;
        setPage('menu');

        return true;
      }}
    >
      <Pages page={page} depth={page === 'menu' ? 0 : 1}>
        {(shown) =>
          shown === 'menu' ? (
            menu
          ) : (
            <>
              <PageHeader title={pages[shown].title} onBack={() => setPage('menu')} />
              <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
                {pages[shown].body}
              </ScrollView>
            </>
          )
        }
      </Pages>
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
    <OptionRow
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
          <NavRow
            label={`Other ${languageLabel(chosen.language)} versions`}
            count={versions.length - 1}
            expanded={versionsOpen}
            onPress={() => setVersionsOpen((open) => !open)}
          />
          {versionsOpen ? (
            <Animated.View entering={appear}>
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
          <NavRow
            label={near.length ? 'More languages' : 'Languages'}
            count={rest.length}
            expanded={moreOpen}
            onPress={() => setMoreOpen((open) => !open)}
          />
          {moreOpen ? <Animated.View entering={appear}>{rest.map(best)}</Animated.View> : null}
        </>
      ) : null}
    </>
  );
}

function channels(count: number): string {
  return count > 2 ? `${count - 1}.1` : count === 2 ? 'Stereo' : 'Mono';
}

const styles = StyleSheet.create({
  heading: { marginBottom: space.xs },
  gap: { marginTop: space.lg },
  shrink: { flexShrink: 1 },
  column: { flex: 1, gap: space.xs },
  wide: { flexDirection: 'row', gap: space.xl },
  scroll: { flexGrow: 0, flexShrink: 1 },
  page: { paddingHorizontal: space.xl, gap: space.xs, paddingBottom: space.sm },
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
