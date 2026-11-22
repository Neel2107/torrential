import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useVersion } from '@/engine/queries';
import { useSession } from '@/engine/session';
import { color, motion } from '@/theme';

import { Glass, LIQUID_GLASS } from './Glass';
import { Icon, icons } from './Icon';
import { Tap } from './Tap';
import { vanish } from '@/ui/presets';

export function EngineAvatar() {
  const version = useVersion();
  const { session } = useSession();
  const phone = session.state === 'paired' && session.engine.kind === 'phone';
  const state = version.isSuccess ? 'online' : version.isError ? 'offline' : 'checking';

  return (
    <Tap
      haptic
      shrink={0.9}
      onPress={() => router.push('/settings')}
      accessibilityLabel={`Settings. ${phone ? "This phone's engine" : 'Engine'}, ${state}`}
      style={styles.avatar}
    >
      <Glass interactive style={styles.disc}>
        <Animated.View
          key={phone ? 'phone' : 'computer'}
          entering={ZoomIn.duration(motion.standard).easing(motion.out)}
          exiting={vanish}
          style={styles.glyph}
        >
          <Icon name={phone ? icons.phone : icons.drive} size={18} tint={color.soft} />
        </Animated.View>
      </Glass>
      <View
        style={[
          styles.dot,
          { backgroundColor: state === 'online' ? color.action : state === 'offline' ? color.error : color.pencil },
        ]}
      />
    </Tap>
  );
}

const styles = StyleSheet.create({
  avatar: { width: LIQUID_GLASS ? 38 : 34, height: LIQUID_GLASS ? 38 : 34 },
  glyph: { position: 'absolute' },
  disc: { flex: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: color.paper,
  },
});
