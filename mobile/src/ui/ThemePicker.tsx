import { reloadAppAsync } from 'expo';
import { setStatusBarStyle } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useState } from 'react';
import { DevSettings, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { color, font, isThemeId, motion, radius, saveTheme, space, themeId, themes, type, type ThemeId } from '@/theme';

import { Mark } from './Mark';
import { Tap } from './Tap';

const IDS = Object.keys(themes).filter(isThemeId);

const COVER_MS = motion.standard;
const HOLD_MS = 160;

/** Swatches for every theme. Choosing one saves it, covers the screen in the new paper and reloads the app. */
export function ThemePicker() {
  const [next, setNext] = useState<ThemeId | null>(null);
  const [covered, setCovered] = useState(false);
  const shown = next ?? themeId;

  const reload = () =>
    reloadAppAsync('Theme changed').catch(() => {
      if (__DEV__) DevSettings.reload();
      else setCovered(false);
    });

  const choose = (id: ThemeId) => {
    if (id === shown || covered) return;

    try {
      saveTheme(id);
    } catch {
      return;
    }

    const chosen = themes[id];
    setNext(id);
    setCovered(true);
    SystemUI.setBackgroundColorAsync(chosen.color.paper);
    setStatusBarStyle(chosen.scheme === 'dark' ? 'light' : 'dark', true);
    setTimeout(reload, COVER_MS + HOLD_MS);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Theme">
        {IDS.map((id) => {
          const theme = themes[id];
          const on = id === shown;

          return (
            <Tap
              key={id}
              shrink={0.94}
              haptic={!on}
              onPress={() => choose(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${theme.name}, ${theme.note}`}
              style={styles.option}
            >
              <View style={[styles.ring, on && styles.ringOn]}>
                <View style={[styles.swatch, { backgroundColor: theme.color.paper }]}>
                  <View style={[styles.line, styles.long, { backgroundColor: theme.color.ink }]} />
                  <View style={[styles.line, styles.short, { backgroundColor: theme.color.pencil }]} />
                  <View style={[styles.pill, { backgroundColor: theme.color.action }]} />
                </View>
              </View>
              <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                {theme.name}
              </Text>
            </Tap>
          );
        })}
      </View>
      <Text style={type.caption}>{themes[shown].note}</Text>
      <Modal visible={covered} transparent animationType="none" statusBarTranslucent navigationBarTranslucent>
        {covered && next ? <Cover id={next} /> : null}
      </Modal>
    </View>
  );
}

function Cover({ id }: { id: ThemeId }) {
  const theme = themes[id];

  return (
    <Animated.View
      entering={FadeIn.duration(COVER_MS)}
      style={[styles.cover, { backgroundColor: theme.color.paper }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Switching to ${theme.name}`}
    >
      <Animated.View entering={ZoomIn.duration(COVER_MS).easing(motion.out)}>
        <Mark size={56} tone={theme.color} />
      </Animated.View>
      <Text style={[styles.coverName, { color: theme.color.ink }]}>{theme.name}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, backgroundColor: color.lifted, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  option: { alignItems: 'center', gap: space.sm, borderRadius: radius.md },
  ring: { borderRadius: radius.md + 4, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  ringOn: { borderColor: color.action },
  swatch: {
    width: 48,
    height: 64,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.rule,
    padding: space.sm,
    gap: 5,
    overflow: 'hidden',
  },
  line: { height: 4, borderRadius: 2 },
  long: { width: '82%' },
  short: { width: '52%' },
  pill: { position: 'absolute', left: space.sm, bottom: space.sm, width: 18, height: 8, borderRadius: 4 },
  name: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: color.soft },
  nameOn: { fontFamily: font.semibold, color: color.ink },
  cover: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  coverName: { fontFamily: font.semibold, fontSize: 17, letterSpacing: -0.2 },
});
