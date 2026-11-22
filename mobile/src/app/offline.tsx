import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCopy, type Copy } from '@/offline/saved';
import { Button } from '@/ui/Button';
import { Icon, icons } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { color, font, space, type } from '@/theme';

export default function Offline() {
  const { job } = useLocalSearchParams<{ job: string }>();
  const copy = useCopy(job ?? '');
  if (copy?.state !== 'saved') {
    return (
      <View style={[styles.screen, styles.gone]}>
        <Text style={type.title}>This film is no longer on the phone</Text>
        <Button label="Close" kind="secondary" onPress={() => router.back()} />
      </View>
    );
  }
  return <SavedPlayer copy={copy} />;
}

function SavedPlayer({ copy }: { copy: Extract<Copy, { state: 'saved' }> }) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer({ uri: copy.uri, metadata: { title: copy.label.title } }, (p) => {
    p.keepScreenOnWhilePlaying = true;
    p.play();
  });

  return (
    <View style={styles.screen}>
      <View
        style={[styles.bar, { paddingTop: insets.top, height: 48 + insets.top, paddingLeft: insets.left + space.sm }]}
      >
        <Tap haptic shrink={0.88} onPress={() => router.back()} accessibilityLabel="Close" style={styles.close}>
          <Icon name={icons.close} size={22} tint={color.ink} />
        </Tap>
        <Text style={styles.title} numberOfLines={1}>
          {copy.label.title} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{copy.label.tags}</Text>
        </Text>
      </View>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        allowsPictureInPicture
        startsPictureInPictureAutomatically
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  gone: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.lg },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: color.ink },
  video: { flex: 1 },
});
