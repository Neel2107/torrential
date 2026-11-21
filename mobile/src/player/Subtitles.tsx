import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
    fetch(url(link, '/api/subtitles', { id: download, file: file.index }), { headers: authHeaders(link), signal: controller.signal })
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

/** The cues showing at `time`, drawn over the picture the way a TV draws them: white with a soft shadow. */
export function SubtitleOverlay({ cues, time, lifted }: { cues: Cue[]; time: number; lifted: boolean }) {
  const showing = cues.filter((cue) => cue.start <= time && time < cue.end);
  if (showing.length === 0) return null;

  return (
    <View style={[styles.wrap, { bottom: lifted ? 96 : 28 }]} pointerEvents="none">
      {showing.map((cue) => (
        <View key={`${cue.start}-${cue.text}`} style={styles.cue}>
          {cue.lines.map((line, i) => (
            <Text key={i} style={styles.line}>
              {line.map((span, j) => (
                <Text key={j} style={[span.italic && styles.italic, span.bold && styles.bold, span.underline && styles.underline]}>
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
  line: {
    fontFamily: font.semibold,
    fontSize: 20,
    lineHeight: 27,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  italic: { fontStyle: 'italic' },
  bold: { fontFamily: font.bold },
  underline: { textDecorationLine: 'underline' },
});
