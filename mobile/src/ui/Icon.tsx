import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { color } from '@/theme';

type Names = Extract<SymbolViewProps['name'], { ios?: unknown }>;

/** A system icon: an SF Symbol on iOS, a Material Symbol on Android. */
export function Icon({
  name,
  size = 22,
  tint = color.ink,
  style,
}: {
  name: Required<Pick<Names, 'ios' | 'android'>>;
  size?: number;
  tint?: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  return <SymbolView name={name} size={size} tintColor={tint} style={[{ width: size, height: size }, style]} />;
}

export const icons = {
  home: { ios: 'house', android: 'home' },
  search: { ios: 'magnifyingglass', android: 'search' },
  downloads: { ios: 'arrow.down.circle', android: 'download' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  close: { ios: 'xmark', android: 'close' },
  saved: { ios: 'bookmark.fill', android: 'bookmark' },
  save: { ios: 'bookmark', android: 'bookmark_add' },
  tv: { ios: 'tv', android: 'tv' },
  cast: { ios: 'airplayvideo', android: 'cast' },
  star: { ios: 'star.fill', android: 'star' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  forward: { ios: 'goforward.10', android: 'forward_10' },
  rewind: { ios: 'gobackward.10', android: 'replay_10' },
  subtitles: { ios: 'captions.bubble', android: 'subtitles' },
  audio: { ios: 'waveform', android: 'graphic_eq' },
  pip: { ios: 'pip.enter', android: 'picture_in_picture_alt' },
  more: { ios: 'ellipsis', android: 'more_vert' },
  trash: { ios: 'trash', android: 'delete' },
  resume: { ios: 'play.circle', android: 'play_circle' },
  paused: { ios: 'pause.circle', android: 'pause_circle' },
  check: { ios: 'checkmark', android: 'check' },
  qr: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
  link: { ios: 'link', android: 'link' },
  stop: { ios: 'stop.fill', android: 'stop' },
  volumeUp: { ios: 'speaker.plus', android: 'volume_up' },
  volumeDown: { ios: 'speaker.minus', android: 'volume_down' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
  wifi: { ios: 'wifi', android: 'wifi' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  film: { ios: 'film', android: 'movie' },
  episodes: { ios: 'list.bullet', android: 'format_list_bulleted' },
  magnet: { ios: 'link.badge.plus', android: 'add_link' },
} as const satisfies Record<string, Required<Pick<Names, 'ios' | 'android'>>>;
