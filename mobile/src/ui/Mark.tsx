import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { color, type Palette } from '@/theme';

export const TRIANGLE =
  'M392 300 C392 268 426 248 454 264 L748 434 C776 450 776 490 748 506 L454 676 C426 692 392 672 392 640 Z';

export function Mark({ size = 28, tone = color }: { size?: number; tone?: Palette }) {
  return (
    <Svg width={size} height={size} viewBox="308 300 440 440" accessibilityLabel="torrential">
      <Defs>
        <LinearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={tone.markLight} />
          <Stop offset="1" stopColor={tone.markDeep} />
        </LinearGradient>
        <ClipPath id="triangle">
          <Path d={TRIANGLE} transform="translate(-40 42)" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#triangle)">
        <Rect x="300" y="300" width="520" height="118" fill="url(#mark)" />
        <Rect x="300" y="446" width="520" height="132" fill="url(#mark)" />
        <Rect x="300" y="606" width="520" height="160" fill="url(#mark)" opacity={0.42} />
      </G>
    </Svg>
  );
}
