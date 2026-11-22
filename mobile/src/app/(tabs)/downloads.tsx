import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { ago, bytes, percent, rate, sentence } from '@web/lib/format';
import type { Job } from '@web/wire';

import { post } from '@/engine/client';
import { openJob, STATE, useJobName, useJobs } from '@/engine/jobs';
import { qualityOf } from '@/engine/quality';
import { Art } from '@/ui/Art';
import { useLink, useSession } from '@/engine/session';
import { cancel, freeSpace, remove, save, useCopies, useCopy, type Copy } from '@/offline/saved';
import { useChrome, useChromeScroll } from '@/ui/chrome';
import { EngineAvatar } from '@/ui/EngineAvatar';
import { ADD_IN_TOP_BAR, FAB_ROOM, Fab } from '@/ui/Fab';
import { Icon, icons } from '@/ui/Icon';
import { JobBadge } from '@/ui/JobBadge';
import { MenuRow } from '@/ui/MenuRow';
import { rise } from '@/ui/rise';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Actions, TopBar, useTopInset } from '@/ui/TopBar';
import { color, font, motion, space, type } from '@/theme';

const ACTIVE = new Set<Job['state']>(['queued', 'metadata', 'checking', 'downloading', 'paused', 'error']);

export default function Downloads() {
  const { jobs, live } = useJobs();
  const landed = useLanded(jobs);
  const top = useTopInset(true);
  const onScroll = useChromeScroll();
  const { bottom: chromeBottom } = useChrome();
  const [tab, setTab] = useState(0);
  const [menu, setMenu] = useState<Job | null>(null);
  const [copyMenu, setCopyMenu] = useState<string | null>(null);
  const copies = useCopies();

  const active = jobs.filter((job) => ACTIVE.has(job.state));
  const finished = jobs.filter((job) => !ACTIVE.has(job.state));
  const shown = tab === 0 ? active : finished;
  const bottom = chromeBottom + FAB_ROOM;

  return (
    <View style={styles.screen}>
      {tab === 2 ? (
        <Animated.FlatList
          key="phone"
          data={copies}
          keyExtractor={(copy) => copy.job}
          onScroll={onScroll}
          scrollEventThrottle={16}
          itemLayoutAnimation={LinearTransition.duration(motion.standard)}
          contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
          ListHeaderComponent={<FreeSpace />}
          ListEmptyComponent={
            <Animated.View entering={rise(0)} style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name={icons.phone} size={26} tint={color.soft} />
              </View>
              <Text style={[type.title, { textAlign: 'center' }]}>Nothing on this phone</Text>
              <Text style={[type.body, { textAlign: 'center' }]}>
                Save a finished download from its menu to watch it without the engine.
              </Text>
            </Animated.View>
          }
          renderItem={({ item, index }) => <CopyRow copy={item} index={index} onMenu={() => setCopyMenu(item.job)} />}
        />
      ) : (
        <Animated.FlatList
          key="engine"
          data={shown}
          keyExtractor={(job) => job.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          itemLayoutAnimation={LinearTransition.duration(motion.standard)}
          contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
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
          renderItem={({ item, index }) => (
            <JobRow job={item} index={index} onMenu={() => setMenu(item)} landed={landed.has(item.id)} />
          )}
        />
      )}
      <TopBar
        left={<EngineAvatar />}
        title="Downloads"
        right={
          ADD_IN_TOP_BAR ? (
            <Actions actions={[{ icon: icons.add, label: 'Add a magnet link', onPress: () => router.push('/add') }]} />
          ) : undefined
        }
        tabs={{
          labels: [`Active${active.length ? ` · ${active.length}` : ''}`, 'Finished', 'On this phone'],
          index: tab,
          onChange: setTab,
        }}
      />
      <Fab icon={icons.add} label="Add a magnet link" onPress={() => router.push('/add')} />
      {menu ? <JobMenu job={menu} onClose={() => setMenu(null)} /> : null}
      {copyMenu ? <CopyMenu job={copyMenu} onClose={() => setCopyMenu(null)} /> : null}
    </View>
  );
}

/**
 * Downloads that finished a moment ago, seen live rather than on opening the app: their badge pops
 * from the full mark into the check, and the phone gives one success tap for the lot.
 */
function useLanded(jobs: Job[]): ReadonlySet<string> {
  const seen = useRef<Map<string, Job['state']> | null>(null);
  const [landed, setLanded] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const before = seen.current;
    seen.current = new Map(jobs.map((job) => [job.id, job.state]));
    if (!before) return;
    const fresh = jobs.filter((job) => job.state === 'done' && before.has(job.id) && before.get(job.id) !== 'done');
    if (fresh.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLanded((now) => new Set([...now, ...fresh.map((job) => job.id)]));
    const timer = setTimeout(
      () => setLanded((now) => new Set([...now].filter((id) => !fresh.some((job) => job.id === id)))),
      4000,
    );
    return () => clearTimeout(timer);
  }, [jobs]);
  return landed;
}

/** Time left in the unit that matters, so it reads calmly as each second's estimate moves. */
function roughly(seconds: number): string {
  if (seconds >= 86400) return `about ${Math.round(seconds / 86400)}d`;
  if (seconds >= 5400) return `about ${Math.round(seconds / 3600)}h`;
  if (seconds >= 120) return `${Math.round(seconds / 60)} min`;
  return 'under 2 min';
}

function JobRow({ job, index, onMenu, landed }: { job: Job; index: number; onMenu: () => void; landed: boolean }) {
  const name = useJobName(job);
  const copy = useCopy(job.id);
  // Two downloads of one film read the same by name; the release's quality tells them apart.
  const tags = job.name ? qualityOf(job.name) : [];
  const size = job.progress.size;
  const fraction = size ? job.progress.verified / size : 0;
  const downloading = job.state === 'downloading';

  const facts =
    job.state === 'done'
      ? [size ? bytes(size) : null, `finished ${ago(job.finished_at)}`]
      : job.state === 'error'
        ? [sentence(job.error.message)]
        : [
            job.waiting_for ? `Waiting for ${job.waiting_for}` : STATE[job.state],
            size ? `${bytes(job.progress.verified)} of ${bytes(size)}` : null,
            downloading && !job.waiting_for && job.progress.down_rate > 0 ? rate(job.progress.down_rate) : null,
            downloading && !job.waiting_for && job.progress.eta ? `${roughly(job.progress.eta)} left` : null,
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
            <JobBadge job={job} landed={landed} small />
          </View>
        ) : (
          <JobBadge job={job} landed={landed} small={false} />
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={type.callout} numberOfLines={2}>
            {name.title} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{name.tags}</Text>
          </Text>
          {tags.length > 0 ? (
            <View style={styles.tags} accessibilityLabel={tags.map((tag) => tag.label).join(', ')}>
              {tags.map((tag) => (
                <Text key={tag.label} style={[styles.tag, tag.strong && styles.tagStrong]}>
                  {tag.label}
                </Text>
              ))}
            </View>
          ) : job.name && name.poster ? (
            <Text style={type.caption} numberOfLines={1}>
              {job.name}
            </Text>
          ) : null}
          {job.state !== 'done' && job.state !== 'error' ? (
            <Progress fraction={fraction} paused={job.state === 'paused'} />
          ) : null}
          <Text style={type.numeric} numberOfLines={2}>
            {facts.filter(Boolean).join('  ·  ')}
          </Text>
          {copy ? <CopyState copy={copy} /> : null}
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
  const { session } = useSession();
  const name = useJobName(job);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // On the phone's own engine nothing else can clear the files, so removing deletes them.
  const onPhone = session.state === 'paired' && session.engine.kind === 'phone';

  const act = async (path: '/api/pause' | '/api/resume' | '/api/remove') => {
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const body = path === '/api/remove' && onPhone ? { refs: [job.id], delete: true } : { refs: [job.id] };
    await post(link, path, body).catch(() => {});
    setBusy(false);
    onClose();
  };

  const copy = useCopy(job.id);
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
        {copy?.state === 'saved' ? (
          <MenuRow
            icon={icons.phone}
            label="Play from this phone"
            onPress={() => {
              onClose();
              router.push({ pathname: '/offline', params: { job: job.id } });
            }}
          />
        ) : copy?.state === 'saving' ? (
          <MenuRow
            icon={icons.close}
            label="Stop saving to phone"
            onPress={() => {
              cancel(job.id);
              onClose();
            }}
          />
        ) : job.state === 'done' && !onPhone ? (
          <MenuRow
            icon={icons.phone}
            label="Save to phone"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              save(link, job.id, name);
              onClose();
            }}
          />
        ) : null}
        {running ? (
          <MenuRow icon={icons.pause} label="Pause" disabled={busy} onPress={() => act('/api/pause')} />
        ) : null}
        {job.state === 'paused' || job.state === 'error' ? (
          <MenuRow icon={icons.refresh} label="Resume" disabled={busy} onPress={() => act('/api/resume')} />
        ) : null}
        {confirming ? (
          <MenuRow
            icon={icons.trash}
            label={
              onPhone
                ? `Delete ${job.progress.verified ? bytes(job.progress.verified) : 'it'} from this phone`
                : 'Remove from the list'
            }
            danger
            disabled={busy}
            onPress={() => act('/api/remove')}
          />
        ) : (
          <MenuRow icon={icons.trash} label="Remove" danger disabled={busy} onPress={() => setConfirming(true)} />
        )}
      </View>
    </Sheet>
  );
}

function CopyState({ copy }: { copy: Copy }) {
  if (copy.state === 'saving') {
    return (
      <View style={{ gap: 6 }}>
        <Progress fraction={copy.size ? copy.written / copy.size : 0} paused={false} />
        <Text style={type.numeric}>
          Saving to phone · {bytes(copy.written)} of {bytes(copy.size)}
        </Text>
      </View>
    );
  }
  if (copy.state === 'failed') {
    return (
      <Text style={[type.numeric, { color: color.error }]} numberOfLines={2}>
        Not saved to phone: {sentence(copy.error)}
      </Text>
    );
  }
  return (
    <View style={styles.onPhone}>
      <Icon name={icons.phone} size={13} tint={color.action} />
      <Text style={[type.numeric, { color: color.action }]}>On this phone</Text>
    </View>
  );
}

function FreeSpace() {
  const free = freeSpace();
  if (free === null) return null;
  return <Text style={styles.free}>{bytes(free)} free on this phone</Text>;
}

function CopyRow({ copy, index, onMenu }: { copy: Copy; index: number; onMenu: () => void }) {
  const facts =
    copy.state === 'saved'
      ? `${bytes(copy.size)}  ·  saved ${ago(copy.saved_at)}`
      : copy.state === 'saving'
        ? `Saving · ${bytes(copy.written)} of ${bytes(copy.size)}`
        : sentence(copy.error);

  return (
    <Animated.View entering={rise(index)} exiting={FadeOut.duration(motion.quick)}>
      <Tap
        shrink={1}
        highlight
        onPress={() => {
          if (copy.state === 'saved') router.push({ pathname: '/offline', params: { job: copy.job } });
          else onMenu();
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onMenu();
        }}
        accessibilityLabel={`${copy.label.title}, ${facts}`}
        accessibilityHint="Long press to delete it from the phone."
        style={styles.row}
      >
        {copy.label.poster ? (
          <Art id={copy.label.poster} kind="poster" name={copy.label.title} style={styles.poster} />
        ) : (
          <View style={styles.badge}>
            <Icon name={icons.phone} size={18} tint={color.soft} weight={2.2} />
          </View>
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={type.callout} numberOfLines={2}>
            {copy.label.title} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{copy.label.tags}</Text>
          </Text>
          {copy.state === 'saving' ? (
            <Progress fraction={copy.size ? copy.written / copy.size : 0} paused={false} />
          ) : null}
          <Text style={[type.numeric, copy.state === 'failed' && { color: color.error }]} numberOfLines={2}>
            {facts}
          </Text>
        </View>
        <Tap shrink={0.85} onPress={onMenu} accessibilityLabel="More" style={styles.more}>
          <Icon name={icons.more} size={20} tint={color.pencil} />
        </Tap>
      </Tap>
    </Animated.View>
  );
}

function CopyMenu({ job, onClose }: { job: string; onClose: () => void }) {
  const link = useLink();
  const copy = useCopy(job);
  const gone = !copy;
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);
  if (!copy) return null;

  return (
    <Sheet onClose={onClose}>
      <View style={{ paddingHorizontal: space.xl, gap: space.xs }}>
        <Text style={[type.headline, { marginBottom: space.md }]} numberOfLines={2}>
          {copy.label.title}
        </Text>
        {copy.state === 'saved' ? (
          <MenuRow
            icon={icons.play}
            label="Play"
            onPress={() => {
              onClose();
              router.push({ pathname: '/offline', params: { job } });
            }}
          />
        ) : null}
        {copy.state === 'failed' ? (
          <MenuRow
            icon={icons.refresh}
            label="Try again"
            onPress={() => {
              save(link, job, copy.label);
              onClose();
            }}
          />
        ) : null}
        <MenuRow
          icon={copy.state === 'saving' ? icons.close : icons.trash}
          label={
            copy.state === 'saving' ? 'Stop saving' : copy.state === 'failed' ? 'Dismiss' : 'Delete from this phone'
          }
          danger={copy.state === 'saved'}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            remove(job);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: {
    fontFamily: font.semibold,
    fontSize: 11,
    letterSpacing: 0.2,
    color: color.soft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: color.lifted,
  },
  tagStrong: { color: color.actionInk, backgroundColor: color.action },
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
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
  onPhone: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  free: { ...type.caption, paddingHorizontal: space.page, paddingTop: space.md, paddingBottom: space.xs },
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
});
