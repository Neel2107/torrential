import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useDataSaver } from '@/engine/dataSaver';
import { useVersion } from '@/engine/queries';
import { useSession } from '@/engine/session';
import { applyLatestUpdate, runningBundle, runtimeVersion, takesUpdates, type UpdatePhase } from '@/updates';
import { engineStatus } from '@/ui/engineStatus';
import { Icon, icons } from '@/ui/Icon';
import { ActionRow } from '@/ui/Row';
import { rise } from '@/ui/rise';
import { Tap } from '@/ui/Tap';
import { ThemePicker } from '@/ui/ThemePicker';
import { Toggle } from '@/ui/Toggle';
import { leave } from '@/ui/leave';
import { color, font, radius, space, type } from '@/theme';

const commit = z.string().catch('Unknown').parse(Constants.expoConfig?.extra?.commit);

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { check } = useLocalSearchParams<{ check?: string }>();
  const { session } = useSession();
  const version = useVersion();
  const [saver, setSaver] = useDataSaver();
  const engine = session.state === 'paired' ? session.engine : null;

  const { label: status, tint = color.pencil } = engineStatus(version);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Tap haptic shrink={0.9} onPress={leave} accessibilityLabel="Back" style={styles.back}>
          <Icon name={icons.back} size={22} tint={color.ink} />
        </Tap>
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        <Group title="Engine" index={0}>
          <Tap
            highlight
            shrink={1}
            haptic
            onPress={() => router.push('/engine')}
            accessibilityLabel={`${engine?.name ?? 'Engine'}, ${status}. Switch or add an engine.`}
            style={styles.row}
          >
            <View style={styles.badge}>
              <Icon name={engine?.kind === 'phone' ? icons.phone : icons.drive} size={18} tint={color.soft} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.value}>{engine?.name ?? 'No engine'}</Text>
              <View style={styles.status}>
                <View style={[styles.dot, { backgroundColor: tint }]} />
                <Text style={type.caption}>{status}</Text>
              </View>
            </View>
            <Icon name={icons.chevron} size={18} tint={color.pencil} />
          </Tap>
        </Group>
        <Group title="Theme" index={1} bare>
          <ThemePicker />
        </Group>
        <Group title="Playback" index={2}>
          <View style={styles.toggle}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.value}>Smaller videos on mobile data</Text>
              <Text style={type.caption}>Prefers smaller sources on mobile data.</Text>
            </View>
            <Toggle value={saver} onValueChange={setSaver} accessibilityLabel="Smaller videos on mobile data" />
          </View>
        </Group>
        <Group title="About" index={3}>
          <Line label="Version" value={Application.nativeApplicationVersion ?? 'Unknown'} />
          <Line label="Build" value={Application.nativeBuildVersion ?? 'Unknown'} />
          <Line label="Commit" value={commit} last={!takesUpdates} />
          {takesUpdates ? <OverTheAir checkNow={check === 'now'} /> : null}
        </Group>
      </ScrollView>
    </View>
  );
}

function Group({
  title,
  index,
  bare = false,
  children,
}: {
  title: string;
  index: number;
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <Animated.View entering={rise(index)} style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      {bare ? children : <View style={styles.card}>{children}</View>}
    </Animated.View>
  );
}

const UPDATE_LABELS: Record<UpdatePhase, string> = {
  idle: 'Check for update',
  checking: 'Checking for update…',
  current: 'Up to date',
  failed: "Couldn't get the update. Try again",
  restarting: 'Restarting…',
};

/** "torrential preview" only: what this launch runs, and a row that fetches the newest update and restarts. */
function OverTheAir({ checkNow }: { checkNow: boolean }) {
  const [phase, setPhase] = useState<UpdatePhase>(checkNow ? 'checking' : 'idle');

  useEffect(() => {
    if (checkNow) applyLatestUpdate().then(setPhase);
  }, [checkNow]);

  const check = async () => {
    setPhase('checking');
    setPhase(await applyLatestUpdate());
  };

  return (
    <>
      <Line label="Bundle" value={runningBundle()} />
      <Line label="Runtime" value={runtimeVersion} />
      <View style={styles.action}>
        <ActionRow
          label={UPDATE_LABELS[phase]}
          icon={icons.refresh}
          disabled={phase === 'checking' || phase === 'restarting'}
          onPress={check}
        />
      </View>
    </>
  );
}

function Line({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.line, !last && styles.rule]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.lineValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bold, fontSize: 20, color: color.ink },
  content: { padding: space.page, gap: space.xl },
  group: { gap: space.sm },
  groupTitle: { ...type.label, color: color.pencil, paddingHorizontal: space.xs },
  card: { borderRadius: radius.lg, backgroundColor: color.raised, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.lifted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontFamily: font.medium, fontSize: 16, color: color.ink },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  action: { paddingHorizontal: space.lg },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.rule },
  label: { fontFamily: font.medium, fontSize: 15, color: color.soft },
  lineValue: { fontFamily: font.medium, fontSize: 15, color: color.ink, fontVariant: ['tabular-nums'] },
});
