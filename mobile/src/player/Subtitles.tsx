import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SubtitleStyle } from '@web/lib/storage';
import { VttParser, type Cue } from '@web/player/vtt';

import { authHeaders, url } from '@/engine/client';
import { useLink } from '@/engine/session';
import { font } from '@/theme';

/** A subtitle file that came with the torrent, which the engine converts to WebVTT as a whole. */
export type SubtitleFile = { index: number; name: string };

export function useSubtitleFile(download: string, file: SubtitleFile | null): Cue[] {
  const link = useLink();
  const [cues, setCues] = useState<Cue[]>([]);

  useEffect(() => {
    setCues([]);
    if (!file) return;
    const controller = new AbortController();
    fetch(url(link, '/api/subtitles', { id: download, file: file.index }), {
      headers: authHeaders(link),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        const parser = new VttParser();
        setCues([...parser.feed(text), ...parser.finish()].sort((a, b) => a.start - b.start));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [download, file, link]);

  return cues;
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
