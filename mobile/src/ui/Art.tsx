import { Image, type ImageContentFit } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { authHeaders, url } from '@/engine/client';
import { useLink } from '@/engine/session';
import { color, font } from '@/theme';

export type ArtKind = 'poster' | 'background' | 'logo' | 'thumbnail';

/**
 * Artwork the engine fetched for a title, with the title's name behind it so a missing poster still
 * reads as something. The image fades in over the placeholder instead of popping.
 */
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
  id: string;
  kind: ArtKind;
  name?: string;
  season?: number;
  episode?: number;
  fit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  placeholder?: boolean;
  /** Fade the image in over the placeholder. Off where a transition carries the same picture in. */
  fade?: boolean;
  /** The picture is on screen. */
  onDisplay?: () => void;
}) {
  const link = useLink();
  // Android drops the pixels of images behind the player when it rotates and back; a new key reloads them from cache.
  const { width, height } = useWindowDimensions();
  const orientation = width > height ? 'landscape' : 'portrait';
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const uri = url(link, '/api/title/art', { id, kind, season, episode });
  const failed = failedUri === uri;

  return (
    <View style={[placeholder && styles.frame, style]}>
      {placeholder && name && failed ? (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText} numberOfLines={3}>
            {name}
          </Text>
        </View>
      ) : null}
      {failed ? null : (
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

const styles = StyleSheet.create({
  frame: { backgroundColor: color.raised, overflow: 'hidden' },
  fallback: { ...StyleSheet.absoluteFill, padding: 12, justifyContent: 'flex-end' },
  fallbackText: { fontFamily: font.semibold, fontSize: 15, lineHeight: 19, color: color.soft },
});
