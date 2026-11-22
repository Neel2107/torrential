import { requireNativeView } from 'expo';
import type { StyleProp, ViewStyle } from 'react-native';

export type GlyphViewProps = {
  paths: string[];
  tint: number;
  weight: number;
  filled: boolean;
  style?: StyleProp<ViewStyle>;
};

export const GlyphView = requireNativeView<GlyphViewProps>('GlyphAndroid');
