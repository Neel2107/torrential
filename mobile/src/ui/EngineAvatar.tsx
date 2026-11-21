import { router } from 'expo-router';
import { HardDrive } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useVersion } from '@/engine/queries';
import { color } from '@/theme';

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
      <Icon name={HardDrive} size={18} tint={color.soft} />
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
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: color.lifted,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
