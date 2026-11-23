import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, View, type TextLayoutEvent } from 'react-native';

import { alpha, color, font, space, type } from '@/theme';

import { Tap } from './Tap';

type Line = TextLayoutEvent['nativeEvent']['lines'][number];

type Fit = { shut: number; full: number; lastTop: number };

const FADE = 56;

function fitOf(lines: Line[], shown: number): Fit | null {
  if (lines.length <= shown) return null;
  const bottom = (line: Line) => line.y + line.height;

  return { shut: bottom(lines[shown - 1]), full: bottom(lines[lines.length - 1]), lastTop: lines[shown - 1].y };
}

/**
 * Long body text shown to its first `lines`; the last shown line fades into "More", and a tap shows all of it.
 * Text is cut by height, never by `numberOfLines`, so Android's ellipsis never lands after a full stop.
 * `on` is the colour behind the text, which the fade blends into.
 * Opening and shutting are instant: only this box could animate, so the lines below would jump while it grew and the text would draw over them.
 * Once cut, the text sits in a layer the cut can't squeeze: iOS reports only the lines a clipped box shows, so measuring inside the cut would find the text short, drop the cut, and loop.
 */
export function MoreText({ text, lines = 3, on = color.paper }: { text: string; lines?: number; on?: string }) {
  const [open, setOpen] = useState(false);
  const [fit, setFit] = useState<Fit | null>(null);

  return (
    <Tap
      shrink={1}
      disabled={!fit}
      onPress={() => setOpen((was) => !was)}
      accessibilityRole={fit ? 'button' : 'text'}
      accessibilityLabel={text}
      accessibilityState={fit ? { expanded: open } : undefined}
    >
      <View style={fit && { height: open ? fit.full : fit.shut, overflow: 'hidden' }}>
        <View style={fit && styles.uncut}>
          <Text style={type.body} onTextLayout={(event) => setFit(fitOf(event.nativeEvent.lines, lines))}>
            {text}
          </Text>
        </View>
        {fit && !open ? (
          <View style={[styles.more, { top: fit.lastTop }]} pointerEvents="none">
            <LinearGradient
              colors={[alpha(on, 0), on]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fade}
            />
            <Text style={[type.body, styles.label, { backgroundColor: on }]}>More</Text>
          </View>
        ) : null}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  uncut: { position: 'absolute', top: 0, left: 0, right: 0 },
  more: { position: 'absolute', right: 0, flexDirection: 'row' },
  fade: { width: FADE },
  label: { fontFamily: font.semibold, color: color.ink, paddingLeft: space.xs },
});
