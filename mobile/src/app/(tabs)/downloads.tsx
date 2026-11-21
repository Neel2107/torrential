import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ago, bytes, percent, rate, sentence, span } from '@web/lib/format';
import type { Job } from '@web/wire';

import { post } from '@/engine/client';
import { openJob, STATE, useJobName, useJobs } from '@/engine/jobs';
import { Art } from '@/ui/Art';
import { useLink } from '@/engine/session';
import { useChromeScroll } from '@/ui/chrome';
import { EngineAvatar } from '@/ui/EngineAvatar';
import { Fab } from '@/ui/Fab';
import { Icon, icons } from '@/ui/Icon';
import { rise } from '@/ui/rise';
import { Sheet } from '@/ui/Sheet';
import { TAB_BAR_HEIGHT } from '@/ui/TabBar';
import { Tap } from '@/ui/Tap';
import { TopBar, useTopInset } from '@/ui/TopBar';
import { color, font, motion, radius, space, type } from '@/theme';

const ACTIVE = new Set<Job['state']>(['queued', 'metadata', 'checking', 'downloading', 'paused', 'error']);

export default function Downloads() {
  const { jobs, live } = useJobs();
  const insets = useSafeAreaInsets();
  const top = useTopInset(true);
  const onScroll = useChromeScroll();
  const [tab, setTab] = useState(0);
  const [menu, setMenu] = useState<Job | null>(null);

  const active = jobs.filter((job) => ACTIVE.has(job.state));
  const finished = jobs.filter((job) => !ACTIVE.has(job.state));
  const shown = tab === 0 ? active : finished;

  return (
    <View style={styles.screen}>
      <Animated.FlatList
        data={shown}
        keyExtractor={(job) => job.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        itemLayoutAnimation={LinearTransition.duration(motion.standard)}
        contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 96 }}
        ListEmptyComponent={
          live ? (
            <Animated.View entering={rise(0)} style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name={icons.downloads} size={26} tint={color.soft} />
              </View>
              <Text style={[type.title, { textAlign: 'center' }]}>
                {tab === 0 ? 'Nothing downloading' : 'Nothing finished yet'}
              </Text>
              <Text style={[type.body, { textAlign: 'center' }]}>
                {tab === 0
                  ? 'What you play or add shows up here while it downloads.'
                  : 'Finished downloads stay here until you remove them.'}
              </Text>
            </Animated.View>
          ) : (
            <Text style={[type.caption, { textAlign: 'center', marginTop: space.xxl }]}>Connecting…</Text>
          )
        }
        renderItem={({ item, index }) => <JobRow job={item} index={index} onMenu={() => setMenu(item)} />}
      />
      <TopBar
        left={<EngineAvatar />}
        title="Downloads"
        tabs={{
          labels: [`Active${active.length ? ` · ${active.length}` : ''}`, 'Finished'],
          index: tab,
          onChange: setTab,
        }}
      />
      <Fab icon={icons.add} label="Add a magnet link" onPress={() => router.push('/add')} />
      {menu ? <JobMenu job={menu} onClose={() => setMenu(null)} /> : null}
    </View>
  );
}

function JobRow({ job, index, onMenu }: { job: Job; index: number; onMenu: () => void }) {
  const name = useJobName(job);
  const size = job.progress.size;
  const fraction = size ? job.progress.verified / size : 0;
  const downloading = job.state === 'downloading';

  const facts =
    job.state === 'done'
      ? [size ? bytes(size) : null, `finished ${ago(job.finished_at)}`]
      : job.state === 'error'
        ? [sentence(job.error.message)]
        : [
            STATE[job.state],
            size ? `${bytes(job.progress.verified)} of ${bytes(size)}` : null,
            downloading && job.progress.down_rate > 0 ? rate(job.progress.down_rate) : null,
            downloading && job.progress.eta ? `${span(job.progress.eta)} left` : null,
          ];

  return (
    <Animated.View entering={rise(index)} exiting={FadeOut.duration(motion.quick)}>
      <Tap
        shrink={1}
        highlight
        onPress={() => openJob(job)}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onMenu();
        }}
        accessibilityLabel={`${name.title}, ${facts.filter(Boolean).join(', ')}`}
        accessibilityHint="Long press for pause, resume and remove."
        style={styles.row}
      >
        {name.poster ? (
          <View>
            <Art id={name.poster} kind="poster" name={name.title} style={styles.poster} />
            <View style={[styles.miniBadge, job.state === 'error' && { backgroundColor: color.error }]}>
              <Icon
                name={
                  job.state === 'done'
                    ? icons.check
                    : job.state === 'paused'
                      ? icons.pause
                      : job.state === 'error'
                        ? icons.warning
                        : icons.downloads
                }
                size={11}
                tint={color.actionInk}
                weight={3}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.badge, job.state === 'error' && { backgroundColor: 'rgba(226,128,110,0.14)' }]}>
            <Icon
              name={
                job.state === 'done'
                  ? icons.check
                  : job.state === 'paused'
                    ? icons.pause
                    : job.state === 'error'
                      ? icons.warning
                      : icons.downloads
              }
              size={18}
              tint={job.state === 'error' ? color.error : job.state === 'done' ? color.action : color.soft}
              weight={2.2}
            />
          </View>
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={type.callout} numberOfLines={2}>
            {name.title} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{name.tags}</Text>
          </Text>
          {job.state !== 'done' && job.state !== 'error' ? (
            <Progress fraction={fraction} paused={job.state === 'paused'} />
          ) : null}
          <Text style={type.numeric} numberOfLines={2}>
            {facts.filter(Boolean).join('  ·  ')}
          </Text>
        </View>
        <Tap shrink={0.85} onPress={onMenu} accessibilityLabel="More" style={styles.more}>
          <Icon name={icons.more} size={20} tint={color.pencil} />
        </Tap>
      </Tap>
    </Animated.View>
  );
}

/** A bar that eases to each new value instead of jumping, so a live download reads as motion. */
function Progress({ fraction, paused }: { fraction: number; paused: boolean }) {
  const value = useDerivedValue(
    () => withTiming(Math.min(1, Math.max(0, fraction)), { duration: 600, easing: motion.out }),
    [fraction],
  );
  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ text: percent(fraction) }}>
      <Animated.View style={[styles.fill, { backgroundColor: paused ? color.pencil : color.action }, fill]} />
    </View>
  );
}

function JobMenu({ job, onClose }: { job: Job; onClose: () => void }) {
  const link = useLink();
  const name = useJobName(job);
  const [busy, setBusy] = useState(false);

  const act = async (path: '/api/pause' | '/api/resume' | '/api/remove') => {
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await post(link, path, { refs: [job.id] }).catch(() => {});
    setBusy(false);
    onClose();
  };

  const running =
    job.state === 'downloading' || job.state === 'queued' || job.state === 'metadata' || job.state === 'checking';

  return (
    <Sheet onClose={onClose}>
      <View style={{ paddingHorizontal: space.xl, gap: space.xs }}>
        <Text style={[type.headline, { marginBottom: space.md }]} numberOfLines={2}>
          {name.title}
        </Text>
        <MenuRow
          icon={icons.play}
          label="Play"
          onPress={() => {
            onClose();
            router.push({ pathname: '/play', params: { ref: job.id } });
          }}
        />
        {running ? (
          <MenuRow icon={icons.pause} label="Pause" disabled={busy} onPress={() => act('/api/pause')} />
        ) : null}
        {job.state === 'paused' || job.state === 'error' ? (
          <MenuRow icon={icons.refresh} label="Resume" disabled={busy} onPress={() => act('/api/resume')} />
        ) : null}
        <MenuRow icon={icons.trash} label="Remove" danger disabled={busy} onPress={() => act('/api/remove')} />
      </View>
    </Sheet>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger = false,
  disabled = false,
}: {
  icon: (typeof icons)[keyof typeof icons];
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tap shrink={1} highlight disabled={disabled} onPress={onPress} style={styles.menuRow}>
      <Icon name={icon} size={22} tint={danger ? color.error : color.ink} />
      <Text style={[styles.menuLabel, danger && { color: color.error }]}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  row: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.page,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  poster: { width: 40, height: 60, borderRadius: 6 },
  miniBadge: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.action,
    borderWidth: 2,
    borderColor: color.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
  more: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(240,233,220,0.12)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  empty: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 80 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: 56,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  menuLabel: { fontFamily: font.semibold, fontSize: 17, color: color.ink },
});
