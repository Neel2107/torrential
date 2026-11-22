import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';

import { color, space, type } from '@/theme';

import { LoadingMark } from './Bands';
import { Button } from './Button';
import { appear } from '@/ui/presets';

const PATIENT_MS = 6000;

export function Connecting() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), PATIENT_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View entering={appear} style={styles.wrap}>
      <LoadingMark size={44} label="Connecting to the engine" />
      <Text style={[type.headline, styles.center]}>Connecting to the engine</Text>
      {slow ? (
        <Animated.View entering={appear} style={styles.slow}>
          <Text style={[type.body, styles.center, { color: color.soft }]}>
            This is taking longer than usual. The engine may be asleep, or on another network.
          </Text>
          <Button label="Choose an engine" kind="secondary" onPress={() => router.push('/engine')} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 72 },
  center: { textAlign: 'center' },
  slow: { alignItems: 'center', gap: space.lg, marginTop: space.sm },
});
