import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sentence } from '@web/lib/format';

import { EngineError } from '@/engine/client';
import { parsePairing, useSession } from '@/engine/session';
import { Button } from '@/ui/Button';
import { color, font, radius, space, type } from '@/theme';

export default function Relocate() {
  const insets = useSafeAreaInsets();
  const { session, relocate } = useSession();
  const current = session.state === 'paired' ? session.link.base.replace(/^https?:\/\//, '') : '';
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    const found = parsePairing(text);
    if (!found) return setProblem('Type the address of the computer, such as 192.168.1.20 or mac.local.');
    setBusy(true);
    setProblem(null);
    try {
      await relocate(found.base);
      router.back();
    } catch (error) {
      setProblem(
        error instanceof EngineError && error.unpaired
          ? 'That engine does not know this phone. Pair again from the computer.'
          : error instanceof EngineError
            ? sentence(error.message)
            : 'Nothing answered at that address.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
      <Text style={type.title}>Change address</Text>
      <Text style={type.body}>
        The phone is still paired. If the computer moved to another network, type its address there. Run{' '}
        <Text style={styles.code}>torrential devices add</Text> on it to see the address, then cancel.
      </Text>
      <Text style={type.caption}>Last address: {current}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="192.168.1.20 or mac.local"
        placeholderTextColor={color.pencil}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={submit}
        selectionColor={color.action}
        style={styles.input}
        accessibilityLabel="Address of the computer"
      />
      {problem ? <Text style={[type.label, { color: color.error }]}>{problem}</Text> : null}
      <Button label="Connect" onPress={submit} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: color.raised, padding: space.xl, gap: space.lg },
  code: { fontFamily: 'monospace', fontSize: 14, color: color.ink },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: color.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.rule,
    paddingHorizontal: space.lg,
    color: color.ink,
    fontFamily: font.regular,
    fontSize: 17,
  },
});
