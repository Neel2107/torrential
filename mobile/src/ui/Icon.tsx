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
  SlidersHorizontal,
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

import { useTone } from './stage';

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
  settings: SlidersHorizontal,
  phone: Smartphone,
} satisfies Record<string, LucideIcon>;

export function Icon({
  name: Glyph,
  size = 22,
  tint,
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
  const tone = useTone();
  const ink = (tint ?? tone.ink) as string;
  return (
    <Glyph
      size={size}
      color={ink}
      fill={filled ? ink : 'none'}
      strokeWidth={weight ?? (filled ? 2.2 : 1.9)}
      absoluteStrokeWidth={false}
      style={style}
    />
  );
}
