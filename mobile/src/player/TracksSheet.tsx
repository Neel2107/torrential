import { useEvent } from 'expo';
import type { AudioTrack, SubtitleTrack, VideoPlayer } from 'expo-video';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MediaInfo } from '@web/wire';

import { languageName } from './languages';
import type { SubtitleFile } from './Subtitles';

import { Icon, icons } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { color, font, space, type } from '@/theme';

function trackName(track: { label?: string | null; language?: string | null; name?: string | null }, index: number, kind: string): string {
  const label = track.label && track.label !== 'und' ? track.label : null;
  return label || track.name || languageName(track.language) || `${kind} ${index + 1}`;
}

/** Subtitles and audio, read from the video itself by the phone's player. */
export function TracksSheet({
  player,
  media,
  files,
  file,
  onFile,
  onClose,
}: {
  player: VideoPlayer;
  media: MediaInfo | null;
  files: SubtitleFile[];
  file: SubtitleFile | null;
  onFile: (file: SubtitleFile | null) => void;
  onClose: () => void;
}) {
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', { subtitleTrack: player.subtitleTrack });
  const { audioTrack } = useEvent(player, 'audioTrackChange', { audioTrack: player.audioTrack });
  const subtitles = player.availableSubtitleTracks;
  const audio = player.availableAudioTracks;

  return (
    <Sheet onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.xs }}>
        <Text style={[type.title, styles.heading]}>Subtitles</Text>
        <Row
          label="Off"
          selected={!subtitleTrack && !file}
          onPress={() => {
            player.subtitleTrack = null;
            onFile(null);
          }}
        />
        {subtitles.map((track: SubtitleTrack, index) => (
          <Row
            key={`${track.id ?? index}`}
            label={trackName(track, index, 'Subtitles')}
            detail={languageName(track.language)}
            selected={!file && subtitleTrack?.id === track.id && subtitleTrack?.label === track.label}
            onPress={() => {
              onFile(null);
              player.subtitleTrack = track;
            }}
          />
        ))}
        {files.map((candidate) => (
          <Row
            key={`file-${candidate.index}`}
            label={candidate.name.replace(/\.(srt|vtt|ass|ssa|sub)$/i, '')}
            detail="Subtitle file in the torrent"
            selected={file?.index === candidate.index}
            onPress={() => onFile(candidate)}
          />
        ))}
        {subtitles.length === 0 && files.length === 0 ? <Text style={[type.caption, styles.empty]}>This video has no subtitles.</Text> : null}

        <Text style={[type.title, styles.heading, { marginTop: space.lg }]}>Audio</Text>
        {audio.map((track: AudioTrack, index) => {
          const fromEngine = media?.audio[index];
          return (
            <Row
              key={`${track.id ?? index}`}
              label={audio.length === 1 && !languageName(track.language) ? 'Original' : trackName(track, index, 'Audio')}
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
