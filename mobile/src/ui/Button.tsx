import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, font, radius, space } from '@/theme';

import { Icon, icons } from './Icon';
import { Tap } from './Tap';

type Kind = 'primary' | 'secondary' | 'quiet';

export function Button({
  label,
  icon,
  kind = 'primary',
  busy = false,
  disabled = false,
  onPress,
  style,
  accessibilityLabel,
}: {
  label: string;
  icon?: Parameters<typeof Icon>[0]['name'];
  kind?: Kind;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const ink = kind === 'primary' ? color.actionInk : color.ink;
  return (
    <Tap
      haptic
      disabled={disabled || busy}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={[styles.base, styles[kind], (disabled || busy) && styles.dimmed, style]}
    >
      <View style={styles.row}>
        {busy ? (
          <ActivityIndicator size="small" color={ink} />
        ) : icon ? (
          <Icon name={icon} size={20} tint={ink} filled={icon === icons.play} />
        ) : null}
        <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primary: { backgroundColor: color.action },
  secondary: { backgroundColor: color.lifted, borderWidth: StyleSheet.hairlineWidth, borderColor: color.rule },
  quiet: { backgroundColor: 'transparent', paddingHorizontal: space.md },
  dimmed: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  label: { fontFamily: font.semibold, fontSize: 16, letterSpacing: -0.1 },
});
