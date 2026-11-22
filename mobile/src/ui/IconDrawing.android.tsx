import { processColor } from 'react-native';

import { GlyphView } from '../../modules/glyph-android';

import type { IconDrawingProps } from './IconDrawing';

/** Android draws icons natively: Lucide icons drawn by react-native-svg rasterise on the main thread, about half a millisecond each. */
export function IconDrawing({ paths, size, ink, weight, filled, style }: IconDrawingProps) {
  return (
    <GlyphView
      paths={paths}
      tint={Number(processColor(ink))}
      weight={weight}
      filled={filled}
      style={[{ width: size, height: size }, style]}
    />
  );
}
