import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { font, motion, radius, space, stage, stageType, type as themedType, color, type Palette } from '@/theme';

import { Check } from './Check';
import { Icon, icons } from './Icon';
import { STAGE_DIFFERS, useStaged, useTone } from './stage';
import { Tap } from './Tap';

type Common = {
  label: string;
  detail?: string | null;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

/** One of a set where one is picked: the pick reads brighter and carries a check. */
export function OptionRow({
  label,
  detail,
  selected,
  disabled,
  onPress,
  accessibilityLabel,
}: Common & { selected: boolean }) {
  const styles = useStaged(themed, staged);
  const type = useStaged(themedType, stageType);

  return (
    <Tap
      shrink={1}
      highlight
      haptic
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text style={[styles.label, selected && styles.picked]}>{label}</Text>
        {detail ? <Text style={type.caption}>{detail}</Text> : null}
      </View>
      <Check shown={selected} />
    </Tap>
  );
}

/** A row that leads somewhere: another page, a screen, or more rows below it when `expanded` is given. */
export function NavRow({
  label,
  detail,
  value,
  count,
  leading,
  expanded,
  disabled,
  onPress,
  accessibilityLabel,
}: Common & { value?: string; count?: number; leading?: ReactNode; expanded?: boolean }) {
  const styles = useStaged(themed, staged);
  const tone = useTone();
  const type = useStaged(themedType, stageType);

  return (
    <Tap
      shrink={1}
      highlight
      haptic
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? [label, count].filter((part) => part !== undefined).join(', ')}
      accessibilityState={expanded === undefined ? { disabled } : { expanded, disabled }}
      style={styles.row}
    >
      {leading}
      <View style={styles.text}>
        <Text style={[styles.label, styles.lead]}>{label}</Text>
        {detail ? (
          <Text style={type.caption} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={type.label}>{value}</Text> : null}
      {count !== undefined ? <Text style={type.numeric}>{count}</Text> : null}
      {expanded === undefined ? (
        <Icon name={icons.chevron} size={18} tint={tone.pencil} />
      ) : (
        <Turn open={expanded} tint={tone.pencil} />
      )}
    </Tap>
  );
}

/** A row that does something at once; `danger` for what can't be undone. */
export function ActionRow({
  label,
  icon,
  danger = false,
  disabled,
  onPress,
  accessibilityLabel,
}: Omit<Common, 'detail'> & { icon: (typeof icons)[keyof typeof icons]; danger?: boolean }) {
  const styles = useStaged(themed, staged);
  const tone = useTone();
  const tint = danger ? tone.error : tone.ink;

  return (
    <Tap
      shrink={1}
      highlight
      haptic
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={[styles.row, styles.action]}
    >
      <Icon name={icon} size={22} tint={tint} />
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
    </Tap>
  );
}

function Turn({ open, tint }: { open: boolean; tint: string }) {
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(withTiming(open ? 1 : 0, { duration: motion.quick, easing: motion.out }));
  }, [open, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));

  return (
    <Animated.View style={style}>
      <Icon name={icons.expand} size={18} tint={tint} />
    </Animated.View>
  );
}

const sheet = (c: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minHeight: 52,
      marginHorizontal: -space.md,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.md,
    },
    text: { flex: 1, gap: 2 },
    label: { fontFamily: font.medium, fontSize: 16, lineHeight: 21, color: c.soft },
    picked: { color: c.ink, fontFamily: font.semibold },
    lead: { color: c.ink },
    action: { gap: space.lg, minHeight: 56 },
    actionLabel: { fontFamily: font.semibold, fontSize: 17 },
  });

const themed = sheet(color);
const staged = STAGE_DIFFERS ? sheet(stage) : themed;
