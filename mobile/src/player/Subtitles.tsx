import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SubtitleStyle } from '@web/lib/storage';
import { VttParser, type Cue } from '@web/player/vtt';
import type { OnlineSubtitle, OnlineSubtitles, PlayInfo } from '@web/wire';

import { authHeaders, get, url } from '@/engine/client';
import { useLink } from '@/engine/session';
import { font } from '@/theme';

export type SubtitleChoice =
  { kind: 'file'; index: number; name: string } | { kind: 'online'; subtitle: OnlineSubtitle };

export function choiceKey(choice: SubtitleChoice): string {
  return choice.kind === 'file' ? `file:${choice.index}` : `online:${choice.subtitle.id}`;
}

export type SubtitleLoad =
  | { key: string; kind: 'loading' }
  | { key: string; kind: 'failed'; message: string; retry: () => void }
  | { key: string; kind: 'ready' };

let drawnLoad: SubtitleLoad | null = null;
const drawnLoadListeners = new Set<() => void>();

function reportDrawnLoad(load: SubtitleLoad | null) {
  drawnLoad = load;

  for (const listener of drawnLoadListeners) listener();
}

function watchDrawnLoad(listener: () => void) {
  drawnLoadListeners.add(listener);

  return () => drawnLoadListeners.delete(listener);
}

/** How the subtitle being drawn over the video is loading, for whoever shows it as picked. */
export function useDrawnSubtitleLoad(choice: SubtitleChoice | null): SubtitleLoad | null {
  const load = useSyncExternalStore(watchDrawnLoad, () => drawnLoad);

  return choice && load?.key === choiceKey(choice) ? load : null;
}

export function useSubtitleCues(play: PlayInfo, choice: SubtitleChoice | null): Cue[] {
  const link = useLink();
  const [loaded, setLoaded] = useState<{ address: string; cues: Cue[] } | null>(null);

  const address = !choice
    ? null
    : choice.kind === 'file'
      ? url(link, '/api/subtitles', { id: play.id, file: choice.index })
      : url(link, '/api/subtitles/online/fetch', { id: play.id, file: play.video.index, subtitle: choice.subtitle.id });

  const key = choice ? choiceKey(choice) : null;

  useEffect(() => {
    if (!address || !key) {
      reportDrawnLoad(null);

      return;
    }

    const controller = new AbortController();

    const download = () => {
      reportDrawnLoad({ key, kind: 'loading' });

      fetch(address, { headers: authHeaders(link), signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return fail('Couldn’t download these subtitles.');
          const parser = new VttParser();
          const text = await response.text();
          const cues = [...parser.feed(text), ...parser.finish()].sort((x, y) => x.start - y.start);

          if (cues.length === 0) return fail('These subtitles have no lines to show.');
          setLoaded({ address, cues });
          reportDrawnLoad({ key, kind: 'ready' });
        })
        .catch(() => {
          if (!controller.signal.aborted) fail('Couldn’t download these subtitles.');
        });
    };

    const fail = (message: string) => reportDrawnLoad({ key, kind: 'failed', message, retry: download });
    download();

    return () => {
      controller.abort();
      reportDrawnLoad(null);
    };
  }, [address, key, link]);

  return loaded && loaded.address === address ? loaded.cues : [];
}

const LOOK_AGAIN_MS = 10_000;

export type OnlineLookup =
  | { kind: 'looking' }
  | { kind: 'found'; subtitles: OnlineSubtitle[] }
  | { kind: 'nothing' }
  | { kind: 'failed'; retry: () => void };

export function useOnlineSubtitles(id: string, file: number): OnlineLookup {
  const link = useLink();
  const [lookup, setLookup] = useState<OnlineLookup>({ kind: 'looking' });

  useEffect(() => {
    const stop = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const retry = () => {
      setLookup({ kind: 'looking' });
      ask();
    };

    const ask = (): Promise<void> =>
      get<OnlineSubtitles>(link, `/api/subtitles/online?id=${id}&file=${file}`, stop.signal)
        .then((found) => {
          const subtitles = [...found.subtitles].sort((a, b) => Number(b.exact) - Number(a.exact));
          setLookup(subtitles.length ? { kind: 'found', subtitles } : { kind: 'nothing' });

          if (!found.hashed) timer = setTimeout(ask, LOOK_AGAIN_MS);
        })
        .catch(() => {
          if (!stop.signal.aborted)
            setLookup((before) => (before.kind === 'found' ? before : { kind: 'failed', retry }));
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
const SIDE = 48;
const RESTING_BOTTOM = 28;
const LIFTED_BOTTOM = 96;
const EDGE = 8;

/**
 * The cues showing at `time`, drawn above the bottom edge. `bottom` is how far up from the screen's bottom edge the
 * caller's controls reach; `lifted` is the player's older way of saying its own controls are up.
 */
export function SubtitleOverlay({
  cues,
  time,
  bottom,
  lifted = false,
  look,
}: {
  cues: Cue[];
  time: number;
  bottom?: number;
  lifted?: boolean;
  look: SubtitleStyle;
}) {
  const insets = useSafeAreaInsets();
  const showing = cues.filter((cue) => cue.start <= time && time < cue.end);

  if (showing.length === 0) return null;
  const size = Math.round(BASE_SIZE * look.scale);
  const text = [styles.line, styles[look.backing], { fontSize: size, lineHeight: Math.round(size * 1.35) }];
  const above = bottom ?? (lifted ? LIFTED_BOTTOM : RESTING_BOTTOM);

  const room = {
    bottom: Math.max(above, insets.bottom + EDGE),
    top: insets.top + EDGE,
    left: Math.max(SIDE, insets.left + EDGE),
    right: Math.max(SIDE, insets.right + EDGE),
  };

  return (
    <View style={[styles.wrap, room]} pointerEvents="none">
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
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-end', gap: 4, overflow: 'hidden' },
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
