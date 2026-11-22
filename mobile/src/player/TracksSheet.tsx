import type { ReactNode } from 'react';
import { useEvent } from 'expo';
import type { AudioTrack, SubtitleTrack, VideoPlayer } from 'expo-video';
import { Fragment, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { MediaInfo, OnlineSubtitle } from '@web/wire';

import { languageLabel, languageName, phoneLanguage, sameLanguage } from './languages';
import { SubtitleStatus, type SubtitleStatusShown } from './SubtitleStatus';
import { useDrawnSubtitleLoad, type OnlineLookup, type SubtitleChoice } from './Subtitles';

import { PageHeader, Pages } from '@/ui/Pages';
import { NavRow, OptionRow } from '@/ui/Row';
import { Sheet } from '@/ui/Sheet';
import { space, stageType as type } from '@/theme';
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
const LIST_PAST = 40;

type Entry = { key: string; node: ReactNode };

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
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const window = useWindowDimensions();
  const wide = window.width > window.height;
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', { subtitleTrack: player.subtitleTrack });
  const { audioTrack } = useEvent(player, 'audioTrackChange', { audioTrack: player.audioTrack });

  const { availableSubtitleTracks: subtitles } = useEvent(player, 'availableSubtitleTracksChange', {
    availableSubtitleTracks: player.availableSubtitleTracks,
  });

  const { availableAudioTracks: audio } = useEvent(player, 'availableAudioTracksChange', {
    availableAudioTracks: player.availableAudioTracks,
  });

  const subtitleNames = namesOf(subtitles, 'Subtitles');
  const audioNames = namesOf(audio, 'Audio');
  const drawnLoad = useDrawnSubtitleLoad(drawn);

  const drawnStatus: SubtitleStatusShown | null =
    drawnLoad?.kind === 'loading'
      ? { kind: 'loading', message: 'Loading subtitles…' }
      : drawnLoad?.kind === 'failed'
        ? { kind: 'failed', message: drawnLoad.message, retry: drawnLoad.retry }
        : null;

  const drawnStatusEntry: Entry[] = drawnStatus
    ? [{ key: 'drawn-status', node: <SubtitleStatus status={drawnStatus} /> }]
    : [];

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

  const isDrawnFile = (candidate: FileChoice) => drawn?.kind === 'file' && drawn.index === candidate.index;

  const file = (candidate: FileChoice) => (
    <OptionRow
      key={`file-${candidate.index}`}
      label={candidate.name.replace(/\.(srt|vtt|ass|ssa|sub)$/i, '')}
      detail="Subtitle file in the torrent"
      selected={isDrawnFile(candidate)}
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
            label={audio.length === 1 && !languageName(track.language) ? 'Original' : audioNames[index]!}
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
      {drawnStatus ? <SubtitleStatus status={drawnStatus} /> : null}
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

  const section = (key: string, title: string): Entry => ({
    key,
    node: <Text style={[type.section, styles.section]}>{title}</Text>,
  });

  const caption = (key: string, words: string): Entry => ({
    key,
    node: <Text style={[type.caption, styles.empty]}>{words}</Text>,
  });

  const onlineParts = onlineEntries({
    lookup: online,
    chosen: drawn?.kind === 'online' ? drawn.subtitle : null,
    versionsOpen,
    moreOpen,
    onVersions: () => setVersionsOpen((open) => !open),
    onMore: () => setMoreOpen((open) => !open),
    onDraw,
    drawnStatus: drawnStatusEntry,
    caption,
  });

  const fixedSubtitles: Entry[] = [
    { key: 'off', node: off },
    ...(subtitles.length > 0 ? [section('in-video', 'In the video')] : []),
    ...subtitles.map((track, index) => ({
      key: `embedded-${track.id ?? index}-${index}`,
      node: embedded(track, index),
    })),
    ...(files.length > 0 ? [section('in-torrent', 'In the torrent')] : []),
    ...files.flatMap((candidate) => [
      { key: `file-${candidate.index}`, node: file(candidate) },
      ...(isDrawnFile(candidate) ? drawnStatusEntry : []),
    ]),
    ...(subtitles.length === 0 && files.length === 0
      ? [caption('none-own', 'This video has no subtitles of its own.')]
      : []),
    section('online', 'Found online'),
  ];

  const subtitleCount =
    fixedSubtitles.length +
    onlineParts.reduce((total, part) => total + (part.kind === 'one' ? 1 : part.rows.length), 0);

  const subtitleEntries = [...fixedSubtitles, ...flatten(onlineParts, subtitleCount > LIST_PAST)];

  const pages: Record<Exclude<Page, 'menu'>, { title: string; entries: Entry[] }> = {
    subtitles: { title: 'Subtitles', entries: subtitleEntries },
    audio: { title: 'Audio', entries: audioRows.map((row, index) => ({ key: `${row.key ?? index}`, node: row })) },
    style: { title: 'Timing and style', entries: [{ key: 'look', node: look }] },
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
              <PageBody entries={pages[shown].entries} />
            </>
          )
        }
      </Pages>
    </Sheet>
  );
}

function PageBody({ entries }: { entries: Entry[] }) {
  if (entries.length > LIST_PAST) {
    return (
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.page}
        data={entries}
        keyExtractor={(entry) => entry.key}
        renderItem={({ item }) => <>{item.node}</>}
        initialNumToRender={16}
        maxToRenderPerBatch={12}
        windowSize={5}
      />
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      {entries.map((entry) => (
        <Fragment key={entry.key}>{entry.node}</Fragment>
      ))}
    </ScrollView>
  );
}

type OnlinePart = { kind: 'one'; entry: Entry } | { kind: 'opened'; key: string; rows: Entry[] };

/** Rows that open under a toggle ease in when the page is short; in a long, virtualized page they appear as plain rows. */
function flatten(parts: OnlinePart[], virtualized: boolean): Entry[] {
  return parts.flatMap((part) => {
    if (part.kind === 'one') return [part.entry];

    if (virtualized) return part.rows;

    return [
      {
        key: part.key,
        node: (
          <Animated.View entering={appear} style={styles.opened}>
            {part.rows.map((row) => (
              <Fragment key={row.key}>{row.node}</Fragment>
            ))}
          </Animated.View>
        ),
      },
    ];
  });
}

function onlineEntries({
  lookup,
  chosen,
  versionsOpen,
  moreOpen,
  onVersions,
  onMore,
  onDraw,
  drawnStatus,
  caption,
}: {
  lookup: OnlineLookup;
  chosen: OnlineSubtitle | null;
  versionsOpen: boolean;
  moreOpen: boolean;
  onVersions: () => void;
  onMore: () => void;
  onDraw: (choice: SubtitleChoice) => void;
  drawnStatus: Entry[];
  caption: (key: string, words: string) => Entry;
}): OnlinePart[] {
  const one = (entry: Entry): OnlinePart => ({ kind: 'one', entry });

  if (lookup.kind === 'looking') {
    return [
      one({
        key: 'online-status',
        node: <SubtitleStatus status={{ kind: 'loading', message: 'Looking for subtitles online…' }} />,
      }),
    ];
  }

  if (lookup.kind === 'failed') {
    return [
      one({
        key: 'online-status',
        node: (
          <SubtitleStatus
            status={{ kind: 'failed', message: 'Couldn’t reach the online subtitle search.', retry: lookup.retry }}
          />
        ),
      }),
    ];
  }

  if (lookup.kind === 'nothing') return [one(caption('online-none', 'No subtitles were found online for this video.'))];

  const byLanguage = new Map<string, OnlineSubtitle[]>();

  for (const subtitle of lookup.subtitles) {
    const group = byLanguage.get(subtitle.language);

    if (group) group.push(subtitle);
    else byLanguage.set(subtitle.language, [subtitle]);
  }

  const languages = [...byLanguage.keys()].sort((a, b) => languageLabel(a).localeCompare(languageLabel(b)));
  const wanted = [phoneLanguage(), 'en'];
  const near = languages.filter((tag) => wanted.includes(tag.slice(0, 2).toLowerCase()) || tag === chosen?.language);
  const rest = languages.filter((tag) => !near.includes(tag));

  const otherVersions = chosen
    ? (byLanguage.get(chosen.language) ?? []).filter((subtitle) => subtitle.id !== chosen.id)
    : [];

  const row = (subtitle: OnlineSubtitle, label: string, detail: string | null): Entry[] => [
    {
      key: `online-${subtitle.id}`,
      node: (
        <OptionRow
          label={label}
          detail={[subtitle.exact ? 'Exact match' : 'Online', detail].filter(Boolean).join(' · ')}
          selected={chosen?.id === subtitle.id}
          onPress={() => onDraw({ kind: 'online', subtitle })}
        />
      ),
    },
    ...(chosen?.id === subtitle.id ? drawnStatus : []),
  ];

  const best = (tag: string) => {
    const subtitle = chosen?.language === tag ? chosen : byLanguage.get(tag)![0]!;

    return row(subtitle, languageLabel(tag), subtitle.name);
  };

  const parts: OnlinePart[] = near.flatMap(best).map(one);

  if (chosen && otherVersions.length > 0) {
    parts.push(
      one({
        key: 'online-versions',
        node: (
          <NavRow
            label={`Other ${languageLabel(chosen.language)} versions`}
            count={otherVersions.length}
            expanded={versionsOpen}
            onPress={onVersions}
          />
        ),
      }),
    );

    if (versionsOpen) {
      parts.push({
        kind: 'opened',
        key: 'online-versions-open',
        rows: [
          ...otherVersions.flatMap((subtitle) => row(subtitle, subtitle.name ?? subtitle.source, subtitle.source)),
          caption(
            'online-versions-note',
            'A version made for another release can run early or late. Shift its timing in Settings.',
          ),
        ],
      });
    }
  }

  if (rest.length > 0) {
    parts.push(
      one({
        key: 'online-more',
        node: (
          <NavRow
            label={near.length ? 'More languages' : 'Languages'}
            count={rest.length}
            expanded={moreOpen}
            onPress={onMore}
          />
        ),
      }),
    );

    if (moreOpen) parts.push({ kind: 'opened', key: 'online-more-open', rows: rest.flatMap(best) });
  }

  return parts;
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
  opened: { gap: space.xs },
});
