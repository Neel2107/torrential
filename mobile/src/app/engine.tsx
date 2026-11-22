import * as Application from 'expo-application';
import { router } from 'expo-router';
import { HardDrive } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CAN_RUN_LOCALLY } from '../../modules/torrential-engine';

import { useMe, useVersion } from '@/engine/queries';
import { useSession } from '@/engine/session';
import { Button } from '@/ui/Button';
import { Icon, icons } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { color, font, radius, space, type } from '@/theme';

/**
 * The engines this phone can watch from, as X lists accounts: tap one to switch, run the engine on
 * this phone, or add a computer. Below, the current one: where it is, whether it answers, and how
 * to leave it.
 */
export default function Engine() {
  const insets = useSafeAreaInsets();
  const { session, engines, switchTo, usePhone, forget } = useSession();
  const version = useVersion();
  const me = useMe();
  const [starting, setStarting] = useState(false);
  const current = session.state === 'paired' ? session.engine : null;
  const base = current?.link.base.replace(/^https?:\/\//, '') ?? '';
  const device = me.data?.asker === 'device' ? me.data.device : null;
  const hasPhone = engines.some((e) => e.kind === 'phone');

  return (
    <ScrollView
      style={styles.sheet}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
    >
      <Text style={type.title}>Engines</Text>
      <View style={styles.card}>
        {engines.map((engine) => {
          const active = engine.id === current?.id;
          return (
            <Tap
              key={engine.id}
              highlight
              shrink={1}
              haptic={!active}
              onPress={async () => {
                if (active) return;
                await switchTo(engine.id);
                router.back();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.engine, styles.rowRule]}
            >
              <View style={styles.engineIcon}>
                <Icon name={engine.kind === 'phone' ? icons.phone : HardDrive} size={18} tint={color.soft} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.value}>{engine.name}</Text>
                <Text style={type.caption} numberOfLines={1}>
                  {engine.kind === 'phone' ? 'Downloads to this phone' : engine.link.base.replace(/^https?:\/\//, '')}
                </Text>
              </View>
              {active ? <Icon name={icons.check} size={20} tint={color.action} weight={2.6} /> : null}
            </Tap>
          );
        })}
        {CAN_RUN_LOCALLY && !hasPhone ? (
          <Tap
            highlight
            shrink={1}
            haptic
            disabled={starting}
            onPress={async () => {
              setStarting(true);
              try {
                await usePhone();
                router.back();
              } finally {
                setStarting(false);
              }
            }}
            style={[styles.engine, styles.rowRule]}
          >
            <View style={styles.engineIcon}>
              <Icon name={icons.phone} size={18} tint={color.action} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.value, { color: color.action }]}>Run the engine on this phone</Text>
              <Text style={type.caption}>Download and play without a computer</Text>
            </View>
          </Tap>
        ) : null}
        <Tap highlight shrink={1} haptic onPress={() => router.push('/pair')} style={styles.engine}>
          <View style={styles.engineIcon}>
            <Icon name={icons.add} size={18} tint={color.soft} />
          </View>
          <Text style={[styles.value, { flex: 1 }]}>Add a computer</Text>
        </Tap>
      </View>

      <View style={styles.card}>
        <Row label="Address" value={base} mono />
        <Row
          label="Status"
          value={
            version.isSuccess
              ? `Online · torrential ${version.data.version}`
              : version.isError
                ? 'Not answering'
                : 'Checking…'
          }
          tint={version.isSuccess ? color.action : version.isError ? color.error : undefined}
        />
        <Row
          label="This phone"
          value={
            current?.kind === 'phone'
              ? 'Runs this engine'
              : me.data?.asker === 'mac'
                ? 'Connected over USB (development)'
                : device
                  ? `${device.name} · ${device.id}`
                  : '…'
          }
        />
        <Row
          label="App"
          value={`${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? ''})`}
          last
        />
      </View>
      {version.data?.notice ? <Text style={type.label}>{version.data.notice}</Text> : null}
      <Text style={type.caption}>
        {current?.kind === 'phone'
          ? 'Removing it stops watching from this phone’s engine. What it downloaded stays until the app is removed.'
          : 'Removing it forgets this computer on the phone. To stop the computer trusting this phone, remove it under Devices on the computer.'}
      </Text>
      <Button
        label={
          current?.kind === 'phone' ? "Stop using this phone's engine" : `Remove ${current?.name ?? 'this engine'}`
        }
        kind="secondary"
        onPress={() => forget()}
      />
    </ScrollView>
  );
}

function Row({
  label,
  value,
  mono = false,
  tint,
  last = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tint?: string;
  last?: boolean;
}) {
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
  sheet: { backgroundColor: color.raised },
  content: { padding: space.xl, gap: space.lg },
  engine: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 },
  engineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: radius.lg, backgroundColor: color.lifted, paddingHorizontal: space.lg },
  row: { paddingVertical: space.md, gap: 2 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.rule },
  value: { fontFamily: font.medium, fontSize: 15, color: color.ink },
  mono: { fontFamily: 'monospace', fontSize: 13 },
});
