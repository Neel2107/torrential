import {
  ArrowDownToLine,
  ArrowLeft,
  AudioLines,
  Bookmark,
  Cast,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  History,
  Film,
  House,
  Link,
  ListVideo,
  Magnet,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  ScanQrCode,
  Search,
  Smartphone,
  Square,
  Star,
  Subtitles,
  Trash2,
  TriangleAlert,
  Tv,
  Volume1,
  Volume2,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { color } from '@/theme';

export const icons = {
  home: House,
  search: Search,
  downloads: ArrowDownToLine,
  play: Play,
  pause: Pause,
  back: ArrowLeft,
  close: X,
  save: Bookmark,
  saved: Bookmark,
  tv: Tv,
  cast: Cast,
  star: Star,
  refresh: RotateCw,
  forward: RotateCw,
  rewind: RotateCcw,
  subtitles: Subtitles,
  audio: AudioLines,
  pip: PictureInPicture2,
  more: Ellipsis,
  trash: Trash2,
  check: Check,
  qr: ScanQrCode,
  link: Link,
  stop: Square,
  volumeUp: Volume2,
  volumeDown: Volume1,
  warning: TriangleAlert,
  wifi: Wifi,
  chevron: ChevronRight,
  expand: ChevronDown,
  film: Film,
  episodes: ListVideo,
  magnet: Magnet,
  add: Plus,
  history: History,
  phone: Smartphone,
} satisfies Record<string, LucideIcon>;

/**
 * One line icon set on every platform, as X does. `filled` paints the shape for a selected state,
 * and a heavier stroke carries the selection for icons that have no inside to fill.
 */
export function Icon({
  name: Glyph,
  size = 22,
  tint = color.ink,
  filled = false,
  weight,
  style,
}: {
  name: LucideIcon;
  size?: number;
  tint?: ColorValue;
  filled?: boolean;
  weight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Glyph
      size={size}
      color={tint as string}
      fill={filled ? (tint as string) : 'none'}
      strokeWidth={weight ?? (filled ? 2.2 : 1.9)}
      absoluteStrokeWidth={false}
      style={style}
    />
  );
}
