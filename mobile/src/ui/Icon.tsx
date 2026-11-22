import { __iconData as ArrowDownToLine } from 'lucide-react-native/icons/arrow-down-to-line';
import { __iconData as ArrowLeft } from 'lucide-react-native/icons/arrow-left';
import { __iconData as AudioLines } from 'lucide-react-native/icons/audio-lines';
import { __iconData as Bookmark } from 'lucide-react-native/icons/bookmark';
import { __iconData as Cast } from 'lucide-react-native/icons/cast';
import { __iconData as Check } from 'lucide-react-native/icons/check';
import { __iconData as ChevronDown } from 'lucide-react-native/icons/chevron-down';
import { __iconData as ChevronRight } from 'lucide-react-native/icons/chevron-right';
import { __iconData as Ellipsis } from 'lucide-react-native/icons/ellipsis';
import { __iconData as Film } from 'lucide-react-native/icons/film';
import { __iconData as HardDrive } from 'lucide-react-native/icons/hard-drive';
import { __iconData as History } from 'lucide-react-native/icons/rotate-ccw-clock';
import { __iconData as House } from 'lucide-react-native/icons/house';
import { __iconData as Link } from 'lucide-react-native/icons/link';
import { __iconData as ListVideo } from 'lucide-react-native/icons/list-video';
import { __iconData as Lock } from 'lucide-react-native/icons/lock';
import { __iconData as LockOpen } from 'lucide-react-native/icons/lock-open';
import { __iconData as Magnet } from 'lucide-react-native/icons/magnet';
import { __iconData as Moon } from 'lucide-react-native/icons/moon';
import { __iconData as Pause } from 'lucide-react-native/icons/pause';
import { __iconData as PictureInPicture2 } from 'lucide-react-native/icons/picture-in-picture-2';
import { __iconData as Play } from 'lucide-react-native/icons/play';
import { __iconData as Plus } from 'lucide-react-native/icons/plus';
import { __iconData as RotateCcw } from 'lucide-react-native/icons/rotate-ccw';
import { __iconData as RotateCw } from 'lucide-react-native/icons/rotate-cw';
import { __iconData as ScanQrCode } from 'lucide-react-native/icons/scan-qr-code';
import { __iconData as Search } from 'lucide-react-native/icons/search';
import { __iconData as SlidersHorizontal } from 'lucide-react-native/icons/sliders-horizontal';
import { __iconData as Smartphone } from 'lucide-react-native/icons/smartphone';
import { __iconData as Square } from 'lucide-react-native/icons/square';
import { __iconData as Star } from 'lucide-react-native/icons/star';
import { __iconData as Subtitles } from 'lucide-react-native/icons/captions';
import { __iconData as Trash2 } from 'lucide-react-native/icons/trash';
import { __iconData as TriangleAlert } from 'lucide-react-native/icons/triangle-exclamation-point';
import { __iconData as Sun } from 'lucide-react-native/icons/sun';
import { __iconData as Tv } from 'lucide-react-native/icons/tv';
import { __iconData as Volume1 } from 'lucide-react-native/icons/volume-1';
import { __iconData as Volume2 } from 'lucide-react-native/icons/volume-2';
import { __iconData as VolumeX } from 'lucide-react-native/icons/volume-x';
import { __iconData as Wifi } from 'lucide-react-native/icons/wifi';
import { __iconData as X } from 'lucide-react-native/icons/x';
import type { LucideIconData } from 'lucide-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { IconDrawing } from './IconDrawing';
import { useTone } from './stage';

/** An icon's drawing: Lucide's 24-unit shapes. */
export type Glyph = LucideIconData;

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
  muted: VolumeX,
  brightness: Sun,
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
  drive: HardDrive,
} satisfies Record<string, Glyph>;

export function Icon({
  name: glyph,
  size = 22,
  tint,
  filled = false,
  weight,
  style,
}: {
  name: Glyph;
  size?: number;
  tint?: string;
  filled?: boolean;
  weight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = useTone();
  const ink = tint ?? tone.ink;
  const stroke = weight ?? (filled ? 2.2 : 1.9);

  return <IconDrawing paths={pathsOf(glyph)} size={size} ink={ink} weight={stroke} filled={filled} style={style} />;
}

const drawn = new WeakMap<Glyph, string[]>();

/** Every element of an icon as SVG path data, worked out once per icon. */
function pathsOf(glyph: Glyph): string[] {
  const known = drawn.get(glyph);

  if (known) return known;

  const paths = glyph.node.map(pathOf);
  drawn.set(glyph, paths);

  return paths;
}

type Element = Glyph['node'][number];

function pathOf([element, a]: Element): string {
  const n = (key: string) => Number(a[key] ?? 0);

  switch (element) {
    case 'path':
      return String(a.d);
    case 'circle':
      return ellipse(n('cx'), n('cy'), n('r'), n('r'));
    case 'ellipse':
      return ellipse(n('cx'), n('cy'), n('rx'), n('ry'));
    case 'line':
      return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
    case 'polyline':
    case 'polygon':
      return `M${String(a.points).trim()}${element === 'polygon' ? 'Z' : ''}`;
    case 'rect':
      return rect(n('x'), n('y'), n('width'), n('height'), Number(a.rx ?? a.ry ?? 0), Number(a.ry ?? a.rx ?? 0));
    default:
      return '';
  }
}

function ellipse(cx: number, cy: number, rx: number, ry: number) {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
}

function rect(x: number, y: number, w: number, h: number, rx: number, ry: number) {
  if (!rx && !ry) return `M${x} ${y}h${w}v${h}h${-w}Z`;

  return (
    `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}` +
    `h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`
  );
}
