import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { use, type ReactNode } from 'react';
import { Platform, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { color, scheme, stage } from '@/theme';

import { Stage } from './stage';

/** Some iOS 26 betas lack the API and crash on it. */
export const LIQUID_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/** Glass goes blank under opacity, so fade a wrapper around it, never the glass or its parents. */
export function Glass({
  children,
  style,
  interactive = false,
  tint,
  fallback,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  tint?: ColorValue;
  fallback?: ColorValue;
}) {
  const onStage = use(Stage);

  if (!LIQUID_GLASS) {
    const surface = tint ?? fallback ?? (onStage ? stage : color).lifted;

    return <View style={[{ backgroundColor: surface }, style]}>{children}</View>;
  }

  return (
    <GlassView style={style} isInteractive={interactive} tintColor={tint} colorScheme={onStage ? 'dark' : scheme}>
      {children}
    </GlassView>
  );
}
