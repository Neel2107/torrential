import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { authHeaders, url } from '@/engine/client';
import { useLink } from '@/engine/session';
import { color, font } from '@/theme';

/** A title's logo art over its picture, or its name set in type when it has no logo. */
export function Logo({ id, name, style }: { id: string; name: string; style?: StyleProp<ViewStyle> }) {
  const link = useLink();
  // Android drops the pixels of images behind the player when it rotates and back; a new key reloads them from cache.
  const { width, height } = useWindowDimensions();
  const orientation = width > height ? 'landscape' : 'portrait';
  const uri = url(link, '/api/title/art', { id, kind: 'logo' });
  const [missingUri, setMissingUri] = useState<string | null>(null);
  const missing = missingUri === uri;

  return (
    <View style={style} accessibilityLabel={name} accessibilityRole="text">
      {missing ? (
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
      ) : (
        <Image
          key={orientation}
          source={{ uri, headers: authHeaders(link) }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          contentPosition="left bottom"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setMissingUri(uri)}
          accessible={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  name: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    fontFamily: font.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: color.ink,
  },
});
