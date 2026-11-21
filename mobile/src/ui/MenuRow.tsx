import { StyleSheet, Text } from 'react-native';

import { color, font, radius, space } from '@/theme';

import { Icon, icons } from './Icon';
import { Tap } from './Tap';

/** One action in a sheet's menu. */
export function MenuRow({
  icon,
  label,
  onPress,
  danger = false,
  disabled = false,
}: {
  icon: (typeof icons)[keyof typeof icons];
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tap shrink={1} highlight disabled={disabled} onPress={onPress} style={styles.row}>
      <Icon name={icon} size={22} tint={danger ? color.error : color.ink} />
      <Text style={[styles.label, danger && { color: color.error }]}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: 56,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  label: { fontFamily: font.semibold, fontSize: 17, color: color.ink },
});
