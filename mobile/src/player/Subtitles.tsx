import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SubtitleStyle } from '@web/lib/storage';
import { VttParser, type Cue } from '@web/player/vtt';
import type { OnlineSubtitle, OnlineSubtitles, PlayInfo } from '@web/wire';

import { authHeaders, get, url } from '@/engine/client';
import { useLink } from '@/engine/session';
import { font } from '@/theme';

/**
 * A subtitle the app draws over the picture itself: a file of the torrent, which the engine converts
 * to WebVTT as a whole, or one the engine found on a subtitle site for the playing file.
 */
export type SubtitleChoice =
  { kind: 'file'; index: number; name: string } | { kind: 'online'; subtitle: OnlineSubtitle };

/** Stable for one video file. Names the track in the timing memory. */
export function choiceKey(choice: SubtitleChoice): string {
  return choice.kind === 'file' ? `file:${choice.index}` : `online:${choice.subtitle.id}`;
}

export function useSubtitleCues(play: PlayInfo, choice: SubtitleChoice | null): Cue[] {
  const link = useLink();
  const [cues, setCues] = useState<Cue[]>([]);
  const address = !choice
    ? null
    : choice.kind === 'file'
      ? url(link, '/api/subtitles', { id: play.id, file: choice.index })
      : url(link, '/api/subtitles/online/fetch', { id: play.id, file: play.video.index, subtitle: choice.subtitle.id });

  useEffect(() => {
    setCues([]);
    if (!address) return;
    const controller = new AbortController();
    fetch(address, { headers: authHeaders(link), signal: controller.signal })
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        const parser = new VttParser();
        setCues([...parser.feed(text), ...parser.finish()].sort((a, b) => a.start - b.start));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [address, link]);

  return cues;
}

/** How long to wait before asking again while the engine has searched without the file's hash. */
const LOOK_AGAIN_MS = 10_000;

/** What the engine's online lookup has found so far. */
export type OnlineLookup =
  | { kind: 'looking' }
  /** Exact matches first, otherwise in the engine's order. */
  | { kind: 'found'; subtitles: OnlineSubtitle[] }
  | { kind: 'nothing' }
  | { kind: 'failed' };

/**
 * The engine's online subtitles for the playing file, looked up beside playback. Until the engine
 * has searched with the file's hash, which it can once both ends of the file are on disk, it is
 * asked again now and then, as the web player does, for subtitles timed for this exact file.
 */
export function useOnlineSubtitles(id: string, file: number): OnlineLookup {
  const link = useLink();
  const [lookup, setLookup] = useState<OnlineLookup>({ kind: 'looking' });

  useEffect(() => {
    const stop = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = () =>
      get<OnlineSubtitles>(link, `/api/subtitles/online?id=${id}&file=${file}`, stop.signal)
        .then((found) => {
          const subtitles = [...found.subtitles].sort((a, b) => Number(b.exact) - Number(a.exact));
          setLookup(subtitles.length ? { kind: 'found', subtitles } : { kind: 'nothing' });
          if (!found.hashed) timer = setTimeout(ask, LOOK_AGAIN_MS);
        })
        .catch(() => {
          if (!stop.signal.aborted) setLookup((before) => (before.kind === 'found' ? before : { kind: 'failed' }));
        });
    ask();
    return () => {
      stop.abort();
      clearTimeout(timer);
    };
  }, [link, id, file]);

  return lookup;
}

const BASE_SIZE = 20;

/**
 * The cues showing at `time`, drawn over the picture the way a TV draws them: white, set off from
 * the picture by a soft shadow, a tight outline, or a box, at the size the viewer chose.
 */
export function SubtitleOverlay({
  cues,
  time,
  lifted,
  look,
}: {
  cues: Cue[];
  time: number;
  lifted: boolean;
  look: SubtitleStyle;
}) {
  const showing = cues.filter((cue) => cue.start <= time && time < cue.end);
  if (showing.length === 0) return null;
  const size = Math.round(BASE_SIZE * look.scale);
  const text = [styles.line, styles[look.backing], { fontSize: size, lineHeight: Math.round(size * 1.35) }];

  return (
    <View style={[styles.wrap, { bottom: lifted ? 96 : 28 }]} pointerEvents="none">
      {showing.map((cue) => (
        <View key={`${cue.start}-${cue.text}`} style={[styles.cue, look.backing === 'box' && styles.boxed]}>
          {cue.lines.map((line, i) => (
            <Text key={i} style={text}>
              {line.map((span, j) => (
                <Text
                  key={j}
                  style={[span.italic && styles.italic, span.bold && styles.bold, span.underline && styles.underline]}
                >
                  {span.text}
                </Text>
              ))}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 48, right: 48, alignItems: 'center', gap: 4 },
  cue: { alignItems: 'center' },
  line: { fontFamily: font.semibold, color: '#fff', textAlign: 'center' },
  shadow: {
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  outline: { textShadowColor: '#000', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 },
  box: {},
  boxed: { backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  italic: { fontStyle: 'italic' },
  bold: { fontFamily: font.bold },
  underline: { textDecorationLine: 'underline' },
});
