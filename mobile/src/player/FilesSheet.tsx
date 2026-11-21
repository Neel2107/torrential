import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { bytes } from '@web/lib/format';
import { fileName, isVideoFile, readable } from '@web/lib/release';
import type { PlayInfo, TorrentFile } from '@web/wire';

import { Icon, icons } from '@/ui/Icon';
import { rise } from '@/ui/rise';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { color, font, space, type } from '@/theme';

/** The torrent's videos in playing order: by path, with numbers compared as numbers. */
export function videosOf(play: PlayInfo): TorrentFile[] {
  return play.files
    .filter((file) => isVideoFile(file.path))
    .sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }));
}

/** The words every name starts with, such as the show's title before each episode's number. */
function sharedStart(names: string[]): string {
  const words = names.map((name) => name.split(' '));
  let shared = 0;
  while (words.every((own) => own.length > shared + 1 && own[shared] === words[0]![shared])) shared += 1;
  return words[0]!.slice(0, shared).join(' ');
}

function spaced(path: string): string {
  const name = readable(fileName(path));
  return `${name.title} ${name.tags}`.trim();
}

/** The other videos of a torrent, such as the episodes of a season, as the web player's files panel lists them. */
export function FilesSheet({
  videos,
  current,
  onPick,
  onClose,
}: {
  videos: TorrentFile[];
  current: number;
  onPick: (file: TorrentFile) => void;
  onClose: () => void;
}) {
  const shared = sharedStart(videos.map((file) => spaced(file.path)));

  return (
    <Sheet onClose={onClose}>
      <View style={styles.head}>
        <Text style={type.title} numberOfLines={1}>
          {shared || 'Videos'}
        </Text>
        <Text style={type.caption}>{videos.length} videos in this torrent</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: space.md }}>
        {videos.map((file, index) => {
          const playing = file.index === current;
          return (
            <Animated.View key={file.index} entering={rise(index)}>
              <Tap
                shrink={1}
                highlight
                haptic={!playing}
                disabled={playing}
                onPress={() => onPick(file)}
                accessibilityLabel={`Play ${spaced(file.path)}`}
                accessibilityState={{ selected: playing }}
                style={styles.row}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.name, playing && styles.playing]} numberOfLines={2}>
                    {spaced(file.path).slice(shared.length).trim() || spaced(file.path)}
                  </Text>
                  <Text style={type.numeric}>
                    {bytes(file.size)}
                    {playing ? ' · playing' : ''}
                  </Text>
                </View>
                <Icon name={icons.play} size={18} tint={playing ? color.action : color.soft} filled={playing} />
              </Tap>
            </Animated.View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  name: { fontFamily: font.medium, fontSize: 15, lineHeight: 20, color: color.soft },
  playing: { color: color.ink, fontFamily: font.semibold },
});
