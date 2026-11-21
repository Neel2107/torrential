import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { sentence } from '@web/lib/format';

import { EngineError } from '@/engine/client';
import { useSession } from '@/engine/session';
import { color, space, type } from '@/theme';

import { Button } from './Button';
import { Icon, icons } from './Icon';

/** What went wrong talking to the engine, in words, with the one thing worth trying next. */
export function EngineProblem({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { session } = useSession();
  const engine = error instanceof EngineError;
  const base = session.state === 'paired' ? session.link.base.replace(/^https?:\/\//, '') : '';

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Icon name={engine ? icons.warning : icons.wifi} size={36} tint={color.pencil} />
      <Text style={[type.title, styles.center]}>{engine ? 'The engine said no' : "Can't reach your engine"}</Text>
      <Text style={[type.body, styles.center]}>
        {engine
          ? sentence(error.message)
          : `Make sure the computer running torrential at ${base} is awake and on the same network as this phone.`}
      </Text>
      {engine && error.hint ? <Text style={[type.caption, styles.center]}>{sentence(error.hint)}</Text> : null}
      <View style={styles.actions}>
        <Button label="Try again" icon={icons.refresh} onPress={onRetry} />
        {engine ? null : <Button label="Change address" kind="quiet" onPress={() => router.push('/relocate')} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 80 },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
