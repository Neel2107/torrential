import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { color } from '@/theme';

/** Some iOS 26 betas lack the API and crash on it. */
export const LIQUID_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/** Glass goes blank under opacity, so fade a wrapper around it, never the glass or its parents. */
export function Glass({
  children,
  style,
  interactive = false,
  tint,
  fallback = color.lifted,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  tint?: ColorValue;
  fallback?: ColorValue;
}) {
  if (!LIQUID_GLASS) return <View style={[{ backgroundColor: tint ?? fallback }, style]}>{children}</View>;
  return (
    <GlassView style={style} isInteractive={interactive} tintColor={tint} colorScheme="dark">
      {children}
    </GlassView>
  );
}
