import { Image, type ImageContentFit } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { authHeaders, url } from '@/engine/client';
import { useLink } from '@/engine/session';
import { color, font, stage, type Palette } from '@/theme';

import { Icon, icons } from './Icon';
import { STAGE_DIFFERS, useStaged, useTone } from './stage';

export type ArtKind = 'poster' | 'background' | 'logo' | 'thumbnail';

/** Narrower than this, a title's name has no room to read, so the missing art shows a mark instead. */
const ROOM_FOR_NAME = 72;

export function Art({
  id,
  kind,
  name,
  season,
  episode,
  fit = 'cover',
  style,
  placeholder = true,
  fade = true,
  onDisplay,
}: {
  id: string | null | undefined;
  kind: ArtKind;
  name?: string;
  season?: number;
  episode?: number;
  fit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  placeholder?: boolean;
  fade?: boolean;
  onDisplay?: () => void;
}) {
  const link = useLink();
  const styles = useStaged(themed, staged);
  /** Android drops the pixels of images behind the player when it rotates and back; a new key reloads them from cache. */
  const { width, height } = useWindowDimensions();
  const orientation = width > height ? 'landscape' : 'portrait';
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const uri = id ? url(link, '/api/title/art', { id, kind, season, episode }) : null;
  const missing = uri === null || failedUri === uri;

  return (
    <View style={[placeholder && styles.frame, style]}>
      {placeholder && missing ? <Missing name={name} /> : null}
      {missing ? null : (
        <Image
          key={orientation}
          source={{ uri, headers: authHeaders(link) }}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          transition={fade ? 220 : 0}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => setFailedUri(uri)}
          onDisplay={onDisplay}
          accessible={false}
        />
      )}
    </View>
  );
}

function Missing({ name }: { name?: string }) {
  const styles = useStaged(themed, staged);
  const tone = useTone();
  const [width, setWidth] = useState<number | null>(null);
  const roomy = width !== null && width >= ROOM_FOR_NAME;

  return (
    <View style={styles.fallback} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width === null ? null : name && roomy ? (
        <Text style={styles.fallbackText} numberOfLines={3} maxFontSizeMultiplier={1.3}>
          {name}
        </Text>
      ) : (
        <View style={styles.mark}>
          <Icon name={icons.film} size={Math.min(28, Math.round(width * 0.4))} tint={tone.pencil} />
        </View>
      )}
    </View>
  );
}

const sheet = (c: Palette) =>
  StyleSheet.create({
    frame: { backgroundColor: c.raised, overflow: 'hidden' },
    fallback: { ...StyleSheet.absoluteFill, padding: 12, justifyContent: 'flex-end' },
    fallbackText: { fontFamily: font.semibold, fontSize: 15, lineHeight: 19, color: c.soft },
    mark: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.raised },
  });

const themed = sheet(color);
const staged = STAGE_DIFFERS ? sheet(stage) : themed;
