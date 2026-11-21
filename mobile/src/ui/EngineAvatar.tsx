import { router } from 'expo-router';
import { HardDrive } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useVersion } from '@/engine/queries';
import { color } from '@/theme';

import { Glass, LIQUID_GLASS } from './Glass';
import { Icon } from './Icon';
import { Tap } from './Tap';

/** Where X puts your avatar: the engine this phone watches from, with a dot for whether it answers. */
export function EngineAvatar() {
  const version = useVersion();
  const state = version.isSuccess ? 'online' : version.isError ? 'offline' : 'checking';

  return (
    <Tap
      haptic
      shrink={0.9}
      onPress={() => router.push('/engine')}
      accessibilityLabel={`Engine, ${state}`}
      style={styles.avatar}
    >
      <Glass interactive style={styles.disc}>
        <Icon name={HardDrive} size={18} tint={color.soft} />
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
