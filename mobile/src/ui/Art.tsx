import { Image, type ImageContentFit } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

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
}: {
  id: string;
  kind: ArtKind;
  name?: string;
  season?: number;
  episode?: number;
  fit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  placeholder?: boolean;
}) {
  const link = useLink();
  const [failed, setFailed] = useState(false);
  const uri = url(link, '/api/title/art', { id, kind, season, episode });

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
          source={{ uri, headers: authHeaders(link) }}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          transition={220}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => setFailed(true)}
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
