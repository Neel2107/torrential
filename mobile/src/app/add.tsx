import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { clearSharedPayloads, useIncomingShare } from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { findTorrent, magnetFromTorrentFile } from '@/engine/torrentFile';
import { Button } from '@/ui/Button';
import { Icon, icons } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { alpha, color, font, radius, space, type } from '@/theme';

function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function describe(ref: string): string {
  if (ref.startsWith('magnet:')) {
    const name = /[?&]dn=([^&]+)/.exec(ref)?.[1];
    return name ? decoded(name.replace(/\+/g, ' ')) : 'Magnet link';
  }
  if (/^https?:/i.test(ref)) return decoded(ref.split('/').pop()?.split('?')[0] ?? ref);
  return `Infohash ${ref.slice(0, 10)}…`;
}

export default function Add() {
  const params = useLocalSearchParams<{ link?: string; file?: string }>();
  const insets = useSafeAreaInsets();
  const share = useIncomingShare();
  const [text, setText] = useState(params.link ?? '');
  const [clip, setClip] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const found = findTorrent(text);

  useEffect(() => {
    if (params.link) return;
    Clipboard.getStringAsync()
      .then((value) => {
        const torrent = findTorrent(value);
        if (torrent) setClip(torrent);
      })
      .catch(() => {});
  }, [params.link]);

  const readFile = (uri: string) => {
    setReading(true);
    setProblem(null);
    return magnetFromTorrentFile(uri)
      .then(setText, (error: unknown) =>
        setProblem(error instanceof Error ? error.message : 'Could not read that file.'),
      )
      .then(() => setReading(false));
  };

  useEffect(() => {
    const payload = share.sharedPayloads[0];
    if (!payload) return;
    if (payload.shareType === 'text' || payload.shareType === 'url') {
      setText(payload.value);
      clearSharedPayloads();
    } else if (payload.value) {
      // Clearing deletes the shared copy, so only once it has been read.
      readFile(payload.value).finally(() => clearSharedPayloads());
    } else {
      clearSharedPayloads();
    }
  }, [share.sharedPayloads]);

  useEffect(() => {
    if (params.file) readFile(params.file);
  }, [params.file]);

  const play = (ref: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: '/play', params: { ref } });
  };

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
      <Text style={type.title}>Add a torrent</Text>
      <Text style={type.body}>
        Paste a magnet link, an infohash, or a link to a .torrent file. It starts playing while it downloads.
      </Text>

      {clip && !text ? (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Tap
            shrink={0.98}
            haptic
            onPress={() => setText(clip)}
            accessibilityLabel={`Paste ${describe(clip)}`}
            style={styles.clip}
          >
            <Icon name={icons.link} size={18} tint={color.action} />
            <View style={{ flex: 1 }}>
              <Text style={[type.caption, { color: color.action }]}>On your clipboard</Text>
              <Text style={type.callout} numberOfLines={1}>
                {describe(clip)}
              </Text>
            </View>
            <Text style={styles.clipAction}>Paste</Text>
          </Tap>
        </Animated.View>
      ) : null}

      <TextInput
        ref={input}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setProblem(null);
        }}
        placeholder="magnet:?xt=urn:btih:…"
        placeholderTextColor={color.pencil}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        selectionColor={color.action}
        accessibilityLabel="Magnet link, infohash or .torrent link"
      />

      {found ? (
        <Animated.View entering={FadeIn.duration(160)} style={styles.found}>
          <Icon name={icons.magnet} size={16} tint={color.soft} />
          <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
            {describe(found)}
          </Text>
        </Animated.View>
      ) : null}
      {problem ? <Text style={[type.label, { color: color.error }]}>{problem}</Text> : null}

      <Button
        label={reading ? 'Reading the file' : 'Play'}
        icon={icons.play}
        busy={reading}
        disabled={!found}
        onPress={() => found && play(found)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: color.raised, padding: space.xl, gap: space.lg },
  clip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: alpha(color.action, 0.1),
  },
  clipAction: { fontFamily: font.bold, fontSize: 15, color: color.action },
  input: {
    minHeight: 96,
    maxHeight: 160,
    borderRadius: radius.md,
    backgroundColor: color.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.rule,
    padding: space.lg,
    color: color.ink,
    fontFamily: font.regular,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  found: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
