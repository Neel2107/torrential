import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, font, radius, space, stage, type Palette } from '@/theme';

import { Icon, icons } from './Icon';
import { STAGE_DIFFERS, useStaged, useTone } from './stage';
import { Tap } from './Tap';

type Kind = 'primary' | 'danger' | 'secondary' | 'quiet';

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
  const tone = useTone();
  const styles = useStaged(themed, staged);
  const ink = kind === 'primary' ? tone.actionInk : kind === 'danger' ? tone.paper : tone.ink;

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
          <View style={styles.lead}>
            <ActivityIndicator size="small" color={ink} />
          </View>
        ) : icon ? (
          <View style={styles.lead}>
            <Icon name={icon} size={20} tint={ink} filled={icon === icons.play} />
          </View>
        ) : null}
        <Text style={[styles.label, { color: ink }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Tap>
  );
}

const sheet = (c: Palette) =>
  StyleSheet.create({
    base: {
      minHeight: 48,
      borderRadius: radius.pill,
      flexShrink: 1,
      paddingHorizontal: space.xl,
      paddingVertical: space.sm,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    primary: { backgroundColor: c.action },
    danger: { backgroundColor: c.error },
    secondary: { backgroundColor: c.lifted, borderWidth: StyleSheet.hairlineWidth, borderColor: c.rule },
    quiet: { backgroundColor: 'transparent', paddingHorizontal: space.md },
    dimmed: { opacity: 0.5 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
    lead: { flexShrink: 0 },
    label: { flexShrink: 1, fontFamily: font.semibold, fontSize: 16, letterSpacing: -0.1, textAlign: 'center' },
  });

const themed = sheet(color);
const staged = STAGE_DIFFERS ? sheet(stage) : themed;
