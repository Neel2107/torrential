import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export type IconDrawingProps = {
  paths: string[];
  size: number;
  ink: string;
  weight: number;
  filled: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconDrawing({ paths, size, ink, weight, filled, style }: IconDrawingProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {paths.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={ink}
          strokeWidth={weight}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={filled ? ink : 'none'}
        />
      ))}
    </Svg>
  );
}
