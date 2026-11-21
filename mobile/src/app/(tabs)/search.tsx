import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Keyboard, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bytes, percent, rate } from '@web/lib/format';
import { isVideo, readable } from '@web/lib/release';
import { cardFacts } from '@web/titles/words';
import {
  SHORT_ID,
  type Category,
  type Continue,
  type Job,
  type Release,
  type SearchMessage,
  type TitleCard,
} from '@web/wire';

import { post, stream } from '@/engine/client';
import { openJob, STATE, useJobName, useJobs } from '@/engine/jobs';
import { keys, useHome, useTitleSearch } from '@/engine/queries';
import { useRecentSearches } from '@/engine/recent';
import { useLink } from '@/engine/session';
import { Art } from '@/ui/Art';
import { useChrome, useChromeScroll } from '@/ui/chrome';
import { EngineProblem } from '@/ui/EngineProblem';
import { Icon, icons } from '@/ui/Icon';
import { MenuRow } from '@/ui/MenuRow';
import { Meter } from '@/ui/Meter';
import { rise } from '@/ui/rise';
import { Sheet } from '@/ui/Sheet';
import { TAB_BAR_HEIGHT } from '@/ui/TabBar';
import { Tap } from '@/ui/Tap';
import { BAR_HEIGHT, TABS_HEIGHT } from '@/ui/TopBar';
import { progressOf, remainingOf, resume, subtitleOf } from '@/ui/watching';
import { color, font, motion, radius, space, type } from '@/theme';

const TABS = ['Films & shows', 'Torrents'] as const;
/** How many of each kind of thing to pick up again the search page lists before a search. */
const SHOWN = 3;
const CATEGORIES: Record<Category, string> = {
  video: 'Video',
  audio: 'Audio',
  software: 'Software',
  book: 'Book',
  game: 'Game',
  dataset: 'Dataset',
  other: 'Other',
};

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export default function Search() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [tab, setTab] = useState(0);
  const [everything, setEverything] = useState(false);
  const query = useDebounced(text.trim(), 280);
  const top = insets.top + BAR_HEIGHT + TABS_HEIGHT;
  const recents = useRecentSearches();
  const remember = () => recents.remember(text);
  const pickup = usePickup();
  const idle =
    pickup.unfinished.length > 0 || pickup.downloads.length > 0 || recents.recent.length > 0 ? (
      <Recent
        unfinished={pickup.unfinished}
        downloads={pickup.downloads}
        more={pickup.more}
        searches={recents.recent}
        onPick={setText}
        onForget={recents.forget}
        onClear={recents.clear}
      />
    ) : null;

  return (
    <View style={styles.screen}>
      {tab === 0 ? (
        <Titles query={query} top={top} idle={idle} onOpen={remember} />
      ) : (
        <Torrents
          query={query}
          everything={everything}
          onScope={setEverything}
          top={top}
          idle={idle}
          onOpen={remember}
        />
      )}
      <SearchHeader text={text} setText={setText} tab={tab} setTab={setTab} onSubmit={remember} />
    </View>
  );
}

function SearchHeader({
  text,
  setText,
  tab,
  setTab,
  onSubmit,
}: {
  text: string;
  setText: (text: string) => void;
  tab: number;
  setTab: (tab: number) => void;
  onSubmit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { hidden } = useChrome();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const focus = useSharedValue(0);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: -hidden.value * BAR_HEIGHT }] }));
  const field = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], ['rgba(166,199,154,0)', color.action]),
  }));

  return (
    <>
      <Animated.View style={[styles.header, { paddingTop: insets.top }, slide]}>
        <View style={styles.fieldRow}>
          <Animated.View style={[styles.field, field]}>
            <Icon name={icons.search} size={18} tint={color.pencil} />
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder="Search films, shows, torrents"
              placeholderTextColor={color.pencil}
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={onSubmit}
              autoCorrect={false}
              autoCapitalize="none"
              selectionColor={color.action}
              onFocus={() => (focus.value = withTiming(1, { duration: motion.quick }))}
              onBlur={() => (focus.value = withTiming(0, { duration: motion.quick }))}
              accessibilityLabel="Search"
            />
            {text ? (
              <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)}>
                <Tap shrink={0.85} onPress={() => setText('')} accessibilityLabel="Clear" style={styles.clear}>
                  <Icon name={icons.close} size={14} tint={color.paper} weight={3} />
                </Tap>
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
        <Tabs
          index={tab}
          onChange={(next) => {
            setTab(next);
            Keyboard.dismiss();
          }}
        />
      </Animated.View>
      <View style={[styles.statusShade, { height: insets.top }]} pointerEvents="none" />
    </>
  );
}

function Tabs({ index, onChange }: { index: number; onChange: (index: number) => void }) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withTiming(index, { duration: motion.standard, easing: motion.out });
  }, [index, x]);
  const underline = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * (width / TABS.length) + (width / TABS.length - 56) / 2 }],
  }));

  return (
    <View
      style={styles.tabs}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {TABS.map((label, i) => (
        <Tap
          key={label}
          shrink={1}
          haptic={i !== index}
          onPress={() => onChange(i)}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === index }}
          style={styles.tab}
        >
          <Text style={[styles.tabLabel, i === index && styles.tabLabelOn]}>{label}</Text>
        </Tap>
      ))}
      {width > 0 ? <Animated.View style={[styles.underline, underline]} /> : null}
    </View>
  );
}

function Titles({
  query,
  top,
  idle,
  onOpen,
}: {
  query: string;
  top: number;
  idle: ReactElement | null;
  onOpen: () => void;
}) {
  const insets = useSafeAreaInsets();
  const onScroll = useChromeScroll();
  const { docked } = useChrome();
  const result = useTitleSearch(query);
  const titles = result.data?.titles ?? [];

  return (
    <Animated.FlatList
      data={query ? titles : []}
      keyExtractor={(item) => item.id}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + space.xl + docked }}
      ListHeaderComponent={
        result.isFetching && query ? (
          <ActivityIndicator style={{ marginTop: space.lg }} color={color.soft} />
        ) : undefined
      }
      ListEmptyComponent={
        !query ? (
          (idle ?? (
            <Hint
              icon={icons.search}
              title="Find something to watch"
              body="Search by name. A film or a show starts playing in seconds, while it downloads."
            />
          ))
        ) : result.isError ? (
          <EngineProblem error={result.error} onRetry={() => result.refetch()} />
        ) : result.isSuccess && !result.isPlaceholderData ? (
          <Hint
            icon={icons.film}
            title={`No films or shows named “${query}”`}
            body="Try the Torrents tab to search every source by name."
          />
        ) : undefined
      }
      renderItem={({ item, index }) => <TitleRow title={item} index={index} onOpen={onOpen} />}
    />
  );
}

function TitleRow({ title, index, onOpen }: { title: TitleCard; index: number; onOpen: () => void }) {
  return (
    <Animated.View entering={rise(index)}>
      <Tap
        shrink={1}
        highlight
        onPress={() => {
          onOpen();
          router.push({ pathname: '/title/[id]', params: { id: title.id } });
        }}
        accessibilityLabel={[title.name, cardFacts(title)].filter(Boolean).join(', ')}
        style={styles.row}
      >
        <Art id={title.id} kind="poster" name={title.name} style={styles.thumb} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={type.headline} numberOfLines={2}>
            {title.name}
          </Text>
          <View style={styles.facts}>
            {title.rating ? (
              <>
                <Icon name={icons.star} size={12} tint={color.action} filled />
                <Text style={[type.numeric, { color: color.ink }]}>{title.rating.toFixed(1)}</Text>
              </>
            ) : null}
            <Text style={type.label}>{cardFacts(title)}</Text>
          </View>
        </View>
        <Icon name={icons.chevron} size={18} tint={color.pencil} />
      </Tap>
    </Animated.View>
  );
}

function Torrents({
  query,
  everything,
  onScope,
  top,
  idle,
  onOpen,
}: {
  query: string;
  /** Search every category, not only video. */
  everything: boolean;
  onScope: (everything: boolean) => void;
  top: number;
  idle: ReactElement | null;
  onOpen: () => void;
}) {
  const link = useLink();
  const insets = useSafeAreaInsets();
  const onScroll = useChromeScroll();
  const { docked } = useChrome();
  const [state, setState] = useState<{ releases: Release[]; pending: string[]; done: boolean; error: string | null }>({
    releases: [],
    pending: [],
    done: false,
    error: null,
  });
  const [notVideo, setNotVideo] = useState<Release | null>(null);

  useEffect(() => {
    if (!query) return setState({ releases: [], pending: [], done: false, error: null });
    const controller = new AbortController();
    setState((previous) => ({ ...previous, pending: ['…'], done: false, error: null }));
    stream<SearchMessage>(
      link,
      '/api/search',
      { method: 'POST', body: { q: query, category: everything ? undefined : 'video' }, signal: controller.signal },
      (message) => {
        if (message.type === 'update')
          setState({ releases: message.result.releases, pending: message.pending, done: false, error: null });
        if (message.type === 'done')
          setState({ releases: message.result.releases, pending: [], done: true, error: null });
        if (message.type === 'error')
          setState((previous) => ({ ...previous, done: true, error: message.error.message }));
      },
    ).catch(
      (error: Error) =>
        !controller.signal.aborted && setState((previous) => ({ ...previous, done: true, error: error.message })),
    );
    return () => controller.abort();
  }, [link, query, everything]);

  return (
    <>
      <Animated.FlatList
        data={state.releases}
        keyExtractor={(item) => item.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + space.xl + docked }}
        ListHeaderComponent={
          query ? (
            <View>
              <Scope everything={everything} onChange={onScope} />
              {!state.done ? (
                <View style={styles.searching}>
                  <ActivityIndicator size="small" color={color.soft} />
                  <Text style={type.caption}>
                    Asking {state.pending.length > 1 ? `${state.pending.length} sources` : 'sources'}…
                  </Text>
                </View>
              ) : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          !query ? (
            (idle ?? (
              <Hint
                icon={icons.magnet}
                title="Search every source"
                body="Torrents are listed best first. Tap one to play it while it downloads."
              />
            ))
          ) : state.done ? (
            <Hint
              icon={icons.warning}
              title={state.error ? 'Search failed' : 'No torrents found'}
              body={
                state.error ??
                (everything
                  ? 'Try fewer or different words.'
                  : 'Try fewer or different words, or search everything instead of only video.')
              }
            />
          ) : undefined
        }
        renderItem={({ item, index }) => (
          <ReleaseRow release={item} index={index} onOpen={onOpen} onNotVideo={() => setNotVideo(item)} />
        )}
      />
      {notVideo ? <NotVideo release={notVideo} onClose={() => setNotVideo(null)} /> : null}
    </>
  );
}

/** Video only, as Play needs, or every category the sources know. */
function Scope({ everything, onChange }: { everything: boolean; onChange: (everything: boolean) => void }) {
  return (
    <View style={styles.scope} accessibilityRole="radiogroup" accessibilityLabel="What to search">
      {[false, true].map((all) => {
        const on = everything === all;
        return (
          <Tap
            key={String(all)}
            shrink={0.94}
            haptic={!on}
            onPress={() => onChange(all)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.scopeChip, on && styles.scopeChipOn]}
          >
            <Text style={[styles.scopeText, on && styles.scopeTextOn]}>{all ? 'Everything' : 'Video'}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

/**
 * What a result that is not a video offers. The engine's only add route for a phone starts a play,
 * which refuses a torrent with no video file, so the honest offer is the computer's own download
 * command, as the web app copies it, or the magnet for another app on the phone.
 */
function NotVideo({ release, onClose }: { release: Release; onClose: () => void }) {
  const command = `torrential get ${release.id.slice(0, SHORT_ID)}`;
  const [copied, setCopied] = useState(false);
  const name = readable(release.name);

  return (
    <Sheet onClose={onClose}>
      <View style={{ paddingHorizontal: space.xl, gap: space.xs }}>
        <Text style={type.headline} numberOfLines={2}>
          {name.title} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{name.tags}</Text>
        </Text>
        <Text style={[type.label, { marginBottom: space.md }]}>
          {CATEGORIES[release.category ?? 'other']}, not a video, so it cannot play here. Run the command on the
          computer running torrential to download it there.
        </Text>
        <MenuRow
          icon={copied ? icons.check : icons.link}
          label={copied ? 'Copied' : `Copy “${command}”`}
          onPress={async () => {
            await Clipboard.setStringAsync(command);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopied(true);
          }}
        />
        {release.magnet ? (
          <MenuRow
            icon={icons.magnet}
            label="Share the magnet link"
            onPress={() => {
              const magnet = release.magnet;
              if (magnet) Share.share({ message: magnet }).catch(() => {});
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function ReleaseRow({
  release,
  index,
  onOpen,
  onNotVideo,
}: {
  release: Release;
  index: number;
  onOpen: () => void;
  onNotVideo: () => void;
}) {
  const name = readable(release.name);
  const playable = isVideo(release);
  const chips = [
    playable ? null : CATEGORIES[release.category ?? 'other'],
    release.quality.resolution?.toUpperCase(),
    release.quality.codec?.toUpperCase(),
    release.quality.hdr ? 'HDR' : null,
  ].filter(Boolean) as string[];

  return (
    <Animated.View entering={rise(index)}>
      <Tap
        shrink={1}
        highlight
        onPress={() => {
          onOpen();
          if (playable) router.push({ pathname: '/play', params: { ref: release.magnet ?? release.id } });
          else onNotVideo();
        }}
        accessibilityLabel={`${name.title}, ${release.size ? bytes(release.size) : ''}, ${release.seeders ?? 0} seeders`}
        style={styles.release}
      >
        <Text style={type.callout} numberOfLines={2}>
          {name.title} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{name.tags}</Text>
        </Text>
        <View style={styles.releaseFacts}>
          {chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
          <Text style={type.numeric}>{release.size ? bytes(release.size) : '—'}</Text>
          {release.seeders !== null ? (
            <Text style={[type.numeric, { color: release.seeders > 10 ? color.action : color.pencil }]}>
              {release.seeders} seeds
            </Text>
          ) : null}
        </View>
      </Tap>
    </Animated.View>
  );
}

/**
 * What there is to pick up again before a search, as the web's search page shows it: unfinished
 * videos first, then the latest downloads not already among them.
 */
function usePickup(): { unfinished: Continue[]; downloads: Job[]; more: boolean } {
  const home = useHome();
  const { jobs } = useJobs();
  const unfinished = (home.data?.continue ?? []).slice(0, SHOWN);
  const watching = new Set(unfinished.map((item) => item.title.id));
  const others = jobs.filter((job) => !(job.title && watching.has(job.title.title)));
  return { unfinished, downloads: others.slice(0, SHOWN), more: others.length > SHOWN };
}

function Recent({
  unfinished,
  downloads,
  more,
  searches,
  onPick,
  onForget,
  onClear,
}: {
  unfinished: Continue[];
  downloads: Job[];
  more: boolean;
  searches: string[];
  onPick: (query: string) => void;
  onForget: (query: string) => void;
  onClear: () => void;
}) {
  let order = 0;
  return (
    <View style={{ gap: space.md }}>
      {unfinished.length > 0 ? (
        <Animated.View entering={rise(order++)}>
          <SectionHead title="Continue watching" />
          {unfinished.map((item) => (
            <Animated.View
              key={item.video}
              entering={rise(order++)}
              exiting={FadeOut.duration(motion.quick)}
              layout={LinearTransition.duration(motion.standard)}
            >
              <UnfinishedRow item={item} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
      {downloads.length > 0 ? (
        <Animated.View entering={rise(order++)}>
          <SectionHead
            title="Downloads"
            action={more ? { label: 'See all', onPress: () => router.navigate('/downloads') } : undefined}
          />
          {downloads.map((job) => (
            <Animated.View key={job.id} entering={rise(order++)} layout={LinearTransition.duration(motion.standard)}>
              <DownloadRow job={job} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
      {searches.length > 0 ? (
        <Animated.View entering={rise(order++)}>
          <SectionHead title="Recent searches" action={{ label: 'Clear all', onPress: onClear }} />
          {searches.map((item) => (
            <Animated.View
              key={item}
              entering={rise(order++)}
              exiting={FadeOut.duration(motion.quick)}
              layout={LinearTransition.duration(motion.standard)}
            >
              <Tap
                shrink={1}
                highlight
                onPress={() => onPick(item)}
                accessibilityLabel={`Search for ${item}`}
                style={styles.recentRow}
              >
                <Icon name={icons.history} size={18} tint={color.pencil} />
                <Text style={[type.callout, { flex: 1 }]} numberOfLines={1}>
                  {item}
                </Text>
                <Tap
                  shrink={0.85}
                  onPress={() => onForget(item)}
                  accessibilityLabel={`Remove ${item}`}
                  style={styles.recentRemove}
                >
                  <Icon name={icons.close} size={16} tint={color.pencil} />
                </Tap>
              </Tap>
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function SectionHead({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.recentHead}>
      <Text style={type.title} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Tap shrink={0.94} haptic onPress={action.onPress} accessibilityLabel={action.label}>
          <Text style={[type.label, { color: color.action }]}>{action.label}</Text>
        </Tap>
      ) : null}
    </View>
  );
}

function UnfinishedRow({ item }: { item: Continue }) {
  const link = useLink();
  const client = useQueryClient();
  const progress = progressOf(item);
  const subtitle = subtitleOf(item);
  const forget = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await post(link, '/api/watched/forget', { video: item.video }).catch(() => {});
    client.invalidateQueries({ queryKey: keys.home });
  };

  return (
    <Tap
      shrink={1}
      highlight
      onPress={() => resume(item)}
      accessibilityLabel={[item.title.name, subtitle, remainingOf(item)].filter(Boolean).join(', ')}
      style={styles.pickRow}
    >
      <Art id={item.title.id} kind="poster" name={item.title.name} style={styles.pickPoster} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={type.callout} numberOfLines={1}>
          {item.title.name} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{subtitle}</Text>
        </Text>
        {progress !== null ? <Meter fraction={progress} /> : null}
        <Text style={type.numeric}>{remainingOf(item)}</Text>
      </View>
      {item.resume_at !== null ? (
        <Tap
          shrink={0.85}
          onPress={forget}
          accessibilityLabel={`Forget where ${item.title.name} stopped`}
          style={styles.recentRemove}
        >
          <Icon name={icons.close} size={16} tint={color.pencil} />
        </Tap>
      ) : null}
    </Tap>
  );
}

function summary(job: Job): string {
  if (job.waiting_for) return `Waiting for ${job.waiting_for}`;
  const { size, verified, down_rate } = job.progress;
  const share = size ? percent(verified / size) : null;
  if (job.state === 'downloading') return [share, down_rate > 0 ? rate(down_rate) : null].filter(Boolean).join(' · ');
  if (job.state === 'done') return size ? bytes(size) : STATE.done;
  if (job.state === 'paused') return [STATE.paused, share].filter(Boolean).join(' · ');
  return STATE[job.state];
}

function DownloadRow({ job }: { job: Job }) {
  const name = useJobName(job);
  const said = summary(job);
  return (
    <Tap
      shrink={1}
      highlight
      onPress={() => openJob(job)}
      accessibilityLabel={`${name.title}, ${said}`}
      style={styles.pickRow}
    >
      {name.poster ? (
        <Art id={name.poster} kind="poster" name={name.title} style={styles.pickPoster} />
      ) : (
        <View style={styles.pickBadge}>
          <Icon name={job.state === 'done' ? icons.check : icons.downloads} size={18} tint={color.soft} />
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={type.callout} numberOfLines={1}>
          {name.title} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{name.tags}</Text>
        </Text>
        <Text style={[type.numeric, job.state === 'error' && { color: color.error }]} numberOfLines={1}>
          {said}
        </Text>
      </View>
    </Tap>
  );
}

function Hint({ icon, title, body }: { icon: (typeof icons)[keyof typeof icons]; title: string; body: string }) {
  return (
    <Animated.View entering={rise(0)} style={styles.hint}>
      <View style={styles.hintIcon}>
        <Icon name={icon} size={26} tint={color.soft} />
      </View>
      <Text style={[type.title, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { textAlign: 'center' }]}>{body}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(20,18,15,0.97)' },
  statusShade: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11, backgroundColor: color.paper },
  fieldRow: { height: BAR_HEIGHT, justifyContent: 'center', paddingHorizontal: space.lg },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 40,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    backgroundColor: color.lifted,
    borderWidth: 1,
  },
  input: { flex: 1, fontFamily: font.regular, fontSize: 16, color: color.ink, paddingVertical: 0 },
  clear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    height: TABS_HEIGHT,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.rule,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: font.medium, fontSize: 15, color: color.pencil },
  tabLabelOn: { fontFamily: font.bold, color: color.ink },
  underline: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.action,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.page,
    paddingVertical: space.md,
  },
  thumb: { width: 52, height: 78, borderRadius: radius.sm },
  facts: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  searching: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.page,
    paddingVertical: space.md,
  },
  release: {
    paddingHorizontal: space.page,
    paddingVertical: space.md,
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  releaseFacts: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: color.lifted },
  scope: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.page, paddingTop: space.md },
  scopeChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.rule,
  },
  scopeChipOn: { backgroundColor: color.ink, borderColor: color.ink },
  scopeText: { fontFamily: font.semibold, fontSize: 14, color: color.soft },
  scopeTextOn: { color: color.paper },
  chipText: { fontFamily: font.semibold, fontSize: 11, color: color.soft, letterSpacing: 0.3 },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.page,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.page,
    minHeight: 52,
  },
  recentRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.page,
    paddingVertical: space.sm,
  },
  pickPoster: { width: 40, height: 60, borderRadius: 6 },
  pickBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
  hint: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 80 },
  hintIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
});
