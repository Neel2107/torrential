import * as Application from 'expo-application';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMe, useVersion } from '@/engine/queries';
import { useSession } from '@/engine/session';
import { Button } from '@/ui/Button';
import { color, font, radius, space, type } from '@/theme';

/** The engine this phone watches from: where it is, whether it answers, and how to leave it. */
export default function Engine() {
  const insets = useSafeAreaInsets();
  const { session, forget } = useSession();
  const version = useVersion();
  const me = useMe();
  const base = session.state === 'paired' ? session.link.base.replace(/^https?:\/\//, '') : '';
  const device = me.data?.asker === 'device' ? me.data.device : null;

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
      <Text style={type.title}>Your engine</Text>
      <View style={styles.card}>
        <Row label="Address" value={base} mono />
        <Row
          label="Status"
          value={version.isSuccess ? `Online · torrential ${version.data.version}` : version.isError ? 'Not answering' : 'Checking…'}
          tint={version.isSuccess ? color.action : version.isError ? color.error : undefined}
        />
        <Row label="This phone" value={me.data?.asker === 'mac' ? 'Connected over USB (development)' : device ? `${device.name} · ${device.id}` : '…'} />
        <Row label="App" value={`${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? ''})`} last />
      </View>
      {version.data?.notice ? <Text style={type.label}>{version.data.notice}</Text> : null}
      <Text style={type.caption}>
        Disconnecting forgets the engine on this phone. To stop the computer trusting this phone, remove it under Devices on the computer.
      </Text>
      <Button label="Disconnect" kind="secondary" onPress={forget} />
    </View>
  );
}

function Row({ label, value, mono = false, tint, last = false }: { label: string; value: string; mono?: boolean; tint?: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowRule]}>
      <Text style={type.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono, tint ? { color: tint } : null]} numberOfLines={2} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: color.raised, padding: space.xl, gap: space.lg },
  card: { borderRadius: radius.lg, backgroundColor: color.lifted, paddingHorizontal: space.lg },
  row: { paddingVertical: space.md, gap: 2 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.rule },
  value: { fontFamily: font.medium, fontSize: 15, color: color.ink },
  mono: { fontFamily: 'monospace', fontSize: 13 },
});
