import { useEvent } from 'expo';
import type { AudioTrack, SubtitleTrack, VideoPlayer } from 'expo-video';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MediaInfo } from '@web/wire';

import { languageName } from './languages';

import { Icon, icons } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { color, font, space, type } from '@/theme';

function trackName(track: { label?: string | null; language?: string | null; name?: string | null }, index: number): string {
  return track.label || track.name || languageName(track.language) || `Track ${index + 1}`;
}

/** Subtitles and audio, read from the video itself by the phone's player. */
export function TracksSheet({ player, media, onClose }: { player: VideoPlayer; media: MediaInfo | null; onClose: () => void }) {
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', { subtitleTrack: player.subtitleTrack });
  const { audioTrack } = useEvent(player, 'audioTrackChange', { audioTrack: player.audioTrack });
  const subtitles = player.availableSubtitleTracks;
  const audio = player.availableAudioTracks;

  return (
    <Sheet onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.xs }}>
        <Text style={[type.title, styles.heading]}>Subtitles</Text>
        <Row label="Off" selected={!subtitleTrack} onPress={() => (player.subtitleTrack = null)} />
        {subtitles.map((track: SubtitleTrack, index) => (
          <Row
            key={`${track.id ?? index}`}
            label={trackName(track, index)}
            detail={languageName(track.language)}
            selected={subtitleTrack?.id === track.id && subtitleTrack?.label === track.label}
            onPress={() => (player.subtitleTrack = track)}
          />
        ))}
        {subtitles.length === 0 ? <Text style={[type.caption, styles.empty]}>This video has no subtitles inside it.</Text> : null}

        <Text style={[type.title, styles.heading, { marginTop: space.lg }]}>Audio</Text>
        {audio.map((track: AudioTrack, index) => {
          const fromEngine = media?.audio[index];
          return (
            <Row
              key={`${track.id ?? index}`}
              label={trackName(track, index)}
              detail={fromEngine ? `${fromEngine.codec.toUpperCase()} · ${fromEngine.channels > 2 ? `${fromEngine.channels - 1}.1` : fromEngine.channels === 2 ? 'Stereo' : 'Mono'}` : null}
              selected={audioTrack?.id === track.id && audioTrack?.label === track.label}
              onPress={() => (player.audioTrack = track)}
            />
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

function Row({ label, detail, selected, onPress }: { label: string; detail?: string | null; selected: boolean; onPress: () => void }) {
  return (
    <Tap
      shrink={1}
      highlight
      haptic
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={styles.row}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, selected && { color: color.ink, fontFamily: font.semibold }]}>{label}</Text>
        {detail ? <Text style={type.caption}>{detail}</Text> : null}
      </View>
      {selected ? <Icon name={icons.check} size={20} tint={color.action} weight={2.6} /> : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.md, borderRadius: 12, gap: space.md },
  label: { fontFamily: font.medium, fontSize: 16, color: color.soft },
  empty: { paddingHorizontal: space.md, paddingVertical: space.sm },
});
