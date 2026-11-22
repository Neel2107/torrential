import ArrowDownToLine from 'lucide-react-native/icons/arrow-down-to-line';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import AudioLines from 'lucide-react-native/icons/audio-lines';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Cast from 'lucide-react-native/icons/cast';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import History from 'lucide-react-native/icons/history';
import Lock from 'lucide-react-native/icons/lock';
import LockOpen from 'lucide-react-native/icons/lock-open';
import Moon from 'lucide-react-native/icons/moon';
import Film from 'lucide-react-native/icons/film';
import House from 'lucide-react-native/icons/house';
import Link from 'lucide-react-native/icons/link';
import ListVideo from 'lucide-react-native/icons/list-video';
import Magnet from 'lucide-react-native/icons/magnet';
import Pause from 'lucide-react-native/icons/pause';
import PictureInPicture2 from 'lucide-react-native/icons/picture-in-picture-2';
import Play from 'lucide-react-native/icons/play';
import Plus from 'lucide-react-native/icons/plus';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import RotateCw from 'lucide-react-native/icons/rotate-cw';
import ScanQrCode from 'lucide-react-native/icons/scan-qr-code';
import Search from 'lucide-react-native/icons/search';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Square from 'lucide-react-native/icons/square';
import Star from 'lucide-react-native/icons/star';
import Subtitles from 'lucide-react-native/icons/subtitles';
import Trash2 from 'lucide-react-native/icons/trash-2';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Tv from 'lucide-react-native/icons/tv';
import Volume1 from 'lucide-react-native/icons/volume-1';
import Volume2 from 'lucide-react-native/icons/volume-2';
import Wifi from 'lucide-react-native/icons/wifi';
import X from 'lucide-react-native/icons/x';
import { type LucideIcon } from 'lucide-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

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
  lock: Lock,
  unlock: LockOpen,
  sleep: Moon,
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
  tint?: string;
  filled?: boolean;
  weight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = useTone();
  const ink = tint ?? tone.ink;

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
