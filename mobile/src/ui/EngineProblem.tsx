import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { sentence } from '@web/lib/format';

import { EngineError } from '@/engine/client';
import { useSession } from '@/engine/session';
import { useCopies } from '@/offline/saved';
import { color, space, type } from '@/theme';

import { Button } from './Button';
import { Icon, icons } from './Icon';

export function EngineProblem({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { session, runOnPhone } = useSession();
  const engine = error instanceof EngineError;
  const base = session.state === 'paired' ? session.link.base.replace(/^https?:\/\//, '') : '';
  const onPhone = session.state === 'paired' && session.engine.kind === 'phone';
  const saved = useCopies().filter((copy) => copy.state === 'saved').length;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Icon name={engine ? icons.warning : icons.wifi} size={36} tint={color.pencil} />
      <Text style={[type.title, styles.center]}>{engine ? 'The engine said no' : "Can't reach your engine"}</Text>
      <Text style={[type.body, styles.center]}>
        {engine
          ? sentence(error.message)
          : onPhone
            ? 'The engine on this phone stopped. Starting it again usually fixes this.'
            : `Make sure the computer running torrential at ${base} is awake and on the same network as this phone.`}
      </Text>
      {engine && error.hint ? <Text style={[type.caption, styles.center]}>{sentence(error.hint)}</Text> : null}
      <View style={styles.actions}>
        <Button
          label={onPhone && !engine ? 'Start it again' : 'Try again'}
          icon={icons.refresh}
          onPress={async () => {
            if (onPhone) await runOnPhone().catch(() => {});
            onRetry();
          }}
        />
        {engine || onPhone ? null : (
          <Button label="Change address" kind="quiet" onPress={() => router.push('/relocate')} />
        )}
        {!engine && saved > 0 ? (
          <Button
            label={`Watch what is on this phone (${saved})`}
            kind="secondary"
            onPress={() => router.push('/saved')}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 80 },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
