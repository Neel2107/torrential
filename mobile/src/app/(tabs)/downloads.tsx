import * as Haptics from 'expo-haptics';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { ago, bytes, percent, rate, sentence } from '@web/lib/format';
import type { Job } from '@web/wire';

import { post } from '@/engine/client';
import { openJob, STATE, useJob, useJobName, useJobs } from '@/engine/jobs';
import { qualityOf } from '@/engine/quality';
import { Art } from '@/ui/Art';
import { useLink, useSession } from '@/engine/session';
import { cancel, copyOf, freeSpace, remove, save, useCopies, useCopy, type Copy } from '@/offline/saved';
import { useChrome, useChromeScroll } from '@/ui/chrome';
import { EngineAvatar } from '@/ui/EngineAvatar';
import { ADD_IN_TOP_BAR, FAB_ROOM, Fab } from '@/ui/Fab';
import { Icon, icons } from '@/ui/Icon';
import { JobBadge } from '@/ui/JobBadge';
import { ActionSheet, MoreMenu, type RowAction } from '@/ui/RowMenu';
import { Pager, usePagerPosition } from '@/ui/Pager';
import { Connecting } from '@/ui/Connecting';
import { Tap } from '@/ui/Tap';
import { TitlePoster, TitleTap } from '@/ui/TitleTap';
import { Actions, TopBar, useTopInset } from '@/ui/TopBar';
import { alpha, color, font, motion, space, type } from '@/theme';
import { reflow } from '@/ui/presets';
import { EmptyState, NOTHING_SAVED } from '@/ui/EmptyState';

const ACTIVE = new Set<Job['state']>(['queued', 'metadata', 'checking', 'downloading', 'paused', 'error']);

export default function Downloads() {
  const { jobs, live } = useJobs();
  const landed = useLanded(jobs);
  const top = useTopInset(true);
  const onScroll = useChromeScroll();
  const { bottom: chromeBottom } = useChrome();
  const [tab, setTab] = useState(0);
  const position = usePagerPosition(0);
  const [menu, setMenu] = useState<Job | null>(null);
  const [copyMenu, setCopyMenu] = useState<string | null>(null);
  const copies = useCopies();

  const active = jobs.filter((job) => ACTIVE.has(job.state));
  const finished = jobs.filter((job) => !ACTIVE.has(job.state));
  const bottom = chromeBottom + FAB_ROOM;
  const list = { onScroll, top, bottom, live, landed, onMenu: setMenu };

  return (
    <View style={styles.screen}>
      <Pager index={tab} onIndex={setTab} position={position}>
        <JobList
          {...list}
          jobs={active}
          empty={['Nothing downloading', 'What you play or add shows up here while it downloads.']}
        />
        <JobList
          {...list}
          jobs={finished}
          empty={['Nothing finished yet', 'Finished downloads stay here until you remove them.']}
        />
        <Animated.FlatList
          data={copies}
          keyExtractor={(copy) => copy.job}
          onScroll={onScroll}
          scrollEventThrottle={16}
          itemLayoutAnimation={reflow}
          contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
          ListHeaderComponent={<FreeSpace />}
          ListEmptyComponent={<EmptyState icon={icons.phone} title="Nothing on this phone" body={NOTHING_SAVED} />}
          renderItem={({ item }) => <CopyRow copy={item} onMenu={() => setCopyMenu(item.job)} />}
        />
      </Pager>
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
          position,
          onChange: setTab,
        }}
      />
      <Fab icon={icons.add} label="Add a magnet link" onPress={() => router.push('/add')} />
      {menu ? <JobMenu job={menu} onClose={() => setMenu(null)} /> : null}
      {copyMenu ? <CopyMenu job={copyMenu} onClose={() => setCopyMenu(null)} /> : null}
    </View>
  );
}

function JobList({
  jobs,
  onScroll,
  top,
  bottom,
  live,
  landed,
  onMenu,
  empty: [title, body],
}: {
  jobs: Job[];
  onScroll: ReturnType<typeof useChromeScroll>;
  top: number;
  bottom: number;
  live: boolean;
  landed: ReadonlySet<string>;
  onMenu: (job: Job) => void;
  empty: [string, string];
}) {
  return (
    <Animated.FlatList
      data={jobs}
      keyExtractor={(job) => job.id}
      onScroll={onScroll}
      scrollEventThrottle={16}
      itemLayoutAnimation={reflow}
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
      ListHeaderComponent={
        !live && jobs.length > 0 ? (
          <View style={styles.lost}>
            <ActivityIndicator size="small" color={color.soft} />
            <Text style={[type.label, { color: color.soft }]}>Connection lost. Reconnecting…</Text>
          </View>
        ) : undefined
      }
      ListEmptyComponent={live ? <EmptyState icon={icons.downloads} title={title} body={body} /> : <Connecting />}
      renderItem={({ item }) => <JobRow job={item} onMenu={() => onMenu(item)} landed={landed.has(item.id)} />}
    />
  );
}

function useLanded(jobs: Job[]): ReadonlySet<string> {
  const seen = useRef<Map<string, Job['state']> | null>(null);
  const [landed, setLanded] = useState<ReadonlySet<string>>(new Set());
  const focused = useIsFocused();
  useEffect(() => {
    const before = seen.current;
    seen.current = new Map(jobs.map((job) => [job.id, job.state]));

    if (!before) return;
    const fresh = jobs.filter((job) => job.state === 'done' && before.has(job.id) && before.get(job.id) !== 'done');

    if (fresh.length === 0) return;

    if (focused) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLanded((now) => new Set([...now, ...fresh.map((job) => job.id)]));

    const timer = setTimeout(
      () => setLanded((now) => new Set([...now].filter((id) => !fresh.some((job) => job.id === id)))),
      4000,
    );

    return () => clearTimeout(timer);
  }, [jobs, focused]);

  return landed;
}

function roughly(seconds: number): string {
  if (seconds >= 86400) return `about ${Math.round(seconds / 86400)}d`;

  if (seconds >= 5400) return `about ${Math.round(seconds / 3600)}h`;

  if (seconds >= 120) return `${Math.round(seconds / 60)} min`;

  return 'under 2 min';
}

function JobRow({ job, onMenu, landed }: { job: Job; onMenu: () => void; landed: boolean }) {
  const name = useJobName(job);
  const copy = useCopy(job.id);
  const tags = job.name ? qualityOf(job.name) : [];
  const size = job.progress.size;
  const fraction = size ? job.progress.verified / size : 0;
  const moving = job.state === 'downloading' && !job.waiting_for;

  const state =
    job.state === 'done'
      ? `Finished ${ago(job.finished_at)}`
      : job.state === 'error'
        ? sentence(job.error.message)
        : job.waiting_for
          ? `Waiting for ${job.waiting_for}`
          : size
            ? `${STATE[job.state]} ${percent(fraction)}`
            : STATE[job.state];

  const numbers =
    job.state === 'done' && job.progress.up_rate > 0
      ? `${rate(job.progress.up_rate)} up`
      : job.state === 'done' || job.state === 'error'
        ? null
        : moving && job.progress.down_rate > 0
          ? [rate(job.progress.down_rate), job.progress.eta ? roughly(job.progress.eta) : null]
              .filter(Boolean)
              .join(' · ')
          : size
            ? `${bytes(job.progress.verified)} of ${bytes(size)}`
            : null;

  const press = {
    shrink: 1,
    highlight: true,
    onLongPress: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onMenu();
    },
    accessibilityLabel: [name.title, name.tags, ...tags.map((tag) => tag.label), state, numbers]
      .filter(Boolean)
      .join(', '),
    accessibilityHint: 'Long press for pause, resume and remove.',
    style: styles.row,
  };

  const content = (
    <>
      {name.poster ? (
        <TitlePoster>
          <Art id={name.poster} kind="poster" name={name.title} style={styles.poster} />
        </TitlePoster>
      ) : (
        <View style={[styles.poster, styles.posterless]}>
          <Icon name={icons.film} size={18} tint={color.pencil} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[type.callout, { flex: 1 }]} numberOfLines={1}>
            {name.title} <Text style={styles.titleTags}>{name.tags}</Text>
          </Text>
          <View style={styles.more} />
        </View>
        <View style={styles.tags}>
          {tags.map((tag) => (
            <Text key={tag.label} style={[styles.tag, tag.strong && styles.tagStrong]}>
              {tag.label}
            </Text>
          ))}
          {size ? <Text style={styles.size}>{bytes(size)}</Text> : null}
        </View>
        {job.state !== 'done' && job.state !== 'error' ? (
          <Progress fraction={fraction} paused={job.state === 'paused'} />
        ) : null}
        <View style={styles.status}>
          <JobBadge job={job} landed={landed} />
          <Text
            style={[styles.state, job.state === 'error' && { color: color.error }]}
            numberOfLines={job.state === 'error' ? 2 : 1}
          >
            {state}
          </Text>
          {numbers ? (
            <Text style={styles.numbers} numberOfLines={1}>
              {numbers}
            </Text>
          ) : null}
        </View>
        {copy ? <CopyState copy={copy} /> : null}
      </View>
    </>
  );

  return (
    <Animated.View>
      {job.title ? (
        <TitleTap id={job.title.title} {...press}>
          {content}
        </TitleTap>
      ) : (
        <Tap onPress={() => openJob(job)} {...press}>
          {content}
        </Tap>
      )}
      <View style={styles.moreSpot}>
        <JobMore job={job} />
      </View>
    </Animated.View>
  );
}

function Progress({ fraction, paused }: { fraction: number; paused: boolean }) {
  const value = useDerivedValue(() =>
    withTiming(Math.min(1, Math.max(0, fraction)), { duration: motion.tick, easing: Easing.linear }),
  );

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: value.get() }] }));

  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ text: percent(fraction) }}>
      <Animated.View style={[styles.fill, { backgroundColor: paused ? color.pencil : color.action }, fill]} />
    </View>
  );
}

function useJobActions(job: Job): RowAction[] {
  const link = useLink();
  const { session } = useSession();
  const name = useJobName(job);
  const copy = useCopy(job.id);
  // On the phone's own engine nothing else can clear the files, so removing deletes them.
  const onPhone = session.state === 'paired' && session.engine.kind === 'phone';

  const running =
    job.state === 'downloading' || job.state === 'queued' || job.state === 'metadata' || job.state === 'checking';

  const send = async (path: '/api/pause' | '/api/resume' | '/api/remove') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const body = path === '/api/remove' && onPhone ? { refs: [job.id], delete: true } : { refs: [job.id] };
    await post(link, path, body).catch(() => {});
  };

  const actions: RowAction[] = [
    {
      id: 'play',
      symbol: 'play',
      label: 'Play',
      icon: icons.play,
      run: () => router.push({ pathname: '/play', params: { ref: job.id } }),
    },
  ];

  if (copy?.state === 'saved') {
    actions.push({
      id: 'offline',
      symbol: 'iphone',
      label: 'Play from this phone',
      icon: icons.phone,
      run: () => router.push({ pathname: '/offline', params: { job: job.id } }),
    });
  } else if (copy?.state === 'saving') {
    actions.push({
      id: 'stop-saving',
      symbol: 'xmark',
      label: 'Stop saving to phone',
      icon: icons.close,
      run: () => cancel(job.id),
    });
  } else if (job.state === 'done' && !onPhone) {
    actions.push({
      id: 'save',
      symbol: 'iphone.and.arrow.forward',
      label: 'Save to phone',
      icon: icons.phone,
      run: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        save(link, job.id, name);
      },
    });
  }

  if (running)
    actions.push({
      id: 'pause',
      symbol: 'pause',
      label: 'Pause',
      icon: icons.pause,
      run: () => send('/api/pause'),
    });

  if (job.state === 'paused' || job.state === 'error') {
    actions.push({
      id: 'resume',
      symbol: 'arrow.clockwise',
      label: 'Resume',
      icon: icons.refresh,
      run: () => send('/api/resume'),
    });
  }

  actions.push({
    id: 'remove',
    symbol: 'trash',
    label: onPhone ? 'Delete from this phone' : 'Remove from Downloads',
    icon: icons.trash,
    danger: true,
    ask: onPhone
      ? {
          title: `Delete ${name.title}?`,
          message: job.progress.verified
            ? `This frees ${bytes(job.progress.verified)} on this phone.`
            : 'The download stops and nothing is kept.',
          confirm: 'Delete',
          danger: true,
          icon: icons.trash,
        }
      : {
          title: `Remove ${name.title}?`,
          message: 'It leaves Downloads. The files stay on the computer.',
          confirm: 'Remove',
          danger: true,
          icon: icons.trash,
        },
    run: () => send('/api/remove'),
  });

  return actions;
}

function JobMore({ job }: { job: Job }) {
  const actions = useJobActions(job);
  const name = useJobName(job);

  return <MoreMenu actions={actions} label={`More options for ${name.title}`} />;
}

function JobMenu({ job: opened, onClose }: { job: Job; onClose: () => void }) {
  const job = useJob(opened.id) ?? opened;
  const name = useJobName(job);
  const actions = useJobActions(job);

  return <ActionSheet title={name.title} actions={actions} onClose={onClose} />;
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

function CopyRow({ copy, onMenu }: { copy: Copy; onMenu: () => void }) {
  const facts =
    copy.state === 'saved'
      ? `${bytes(copy.size)}  ·  saved ${ago(copy.saved_at)}`
      : copy.state === 'saving'
        ? `Saving · ${bytes(copy.written)} of ${bytes(copy.size)}`
        : sentence(copy.error);

  return (
    <Animated.View>
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
        <View style={styles.more} />
      </Tap>
      <View style={styles.moreSpot}>
        <CopyMore copy={copy} />
      </View>
    </Animated.View>
  );
}

function useCopyActions(copy: Copy): RowAction[] {
  const link = useLink();

  const when = (state: Copy['state']) => () => {
    if (copyOf(copy.job)?.state !== state) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    remove(copy.job);
  };

  if (copy.state === 'saving')
    return [{ id: 'stop', label: 'Stop saving', icon: icons.close, symbol: 'xmark', run: () => cancel(copy.job) }];

  if (copy.state === 'failed')
    return [
      {
        id: 'retry',
        label: 'Try again',
        icon: icons.refresh,
        symbol: 'arrow.clockwise',
        run: () => save(link, copy.job, copy.label),
      },
      { id: 'dismiss', label: 'Dismiss', icon: icons.close, symbol: 'xmark', run: when('failed') },
    ];

  return [
    {
      id: 'play',
      label: 'Play',
      icon: icons.play,
      symbol: 'play',
      run: () => router.push({ pathname: '/offline', params: { job: copy.job } }),
    },
    {
      id: 'delete',
      label: 'Delete from this phone',
      icon: icons.trash,
      symbol: 'trash',
      danger: true,
      ask: {
        title: `Delete ${copy.label.title}?`,
        message: `This frees ${bytes(copy.size)} on this phone.`,
        confirm: 'Delete',
        danger: true,
        icon: icons.trash,
      },
      run: when('saved'),
    },
  ];
}

function CopyMenu({ job, onClose }: { job: string; onClose: () => void }) {
  const copy = useCopy(job);
  const gone = !copy;
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);

  return copy ? <CopySheet copy={copy} onClose={onClose} /> : null;
}

function CopySheet({ copy, onClose }: { copy: Copy; onClose: () => void }) {
  return <ActionSheet title={copy.label.title} actions={useCopyActions(copy)} onClose={onClose} />;
}

function CopyMore({ copy }: { copy: Copy }) {
  return <MoreMenu actions={useCopyActions(copy)} label={`More options for ${copy.label.title}`} />;
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
  lost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.page,
    paddingVertical: space.md,
    backgroundColor: color.raised,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.page,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  poster: { width: 48, height: 72, borderRadius: 8 },
  posterless: { backgroundColor: color.raised, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -4 },
  titleTags: { color: color.pencil, fontFamily: font.regular },
  size: { ...type.caption, alignSelf: 'center', fontVariant: ['tabular-nums'] },
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 7, rowGap: 2 },
  state: { ...type.label, color: color.soft, flexShrink: 0, maxWidth: '100%', fontVariant: ['tabular-nums'] },
  numbers: {
    ...type.label,
    color: color.pencil,
    marginLeft: 'auto',
    paddingLeft: space.sm,
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
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
  moreSpot: {
    position: 'absolute',
    top: space.lg - 10,
    right: space.page - 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: alpha(color.ink, 0.12), overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, width: '100%', transformOrigin: 'left' },
});
