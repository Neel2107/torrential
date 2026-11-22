import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Keyboard, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bytes, percent, rate, sentence } from '@web/lib/format';
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
import { openJob, STATE, useJob, useJobName, useJobsSelect } from '@/engine/jobs';
import { keys, useHome, useKnownSearch, useTitleSearch } from '@/engine/queries';
import { mark, since } from '@/perf';
import { useRecentSearches } from '@/engine/recent';
import { useLink } from '@/engine/session';
import { Art } from '@/ui/Art';
import { useChrome, useChromeScroll } from '@/ui/chrome';
import { EngineProblem } from '@/ui/EngineProblem';
import { Glass } from '@/ui/Glass';
import { Icon, icons } from '@/ui/Icon';
import { ActionRow } from '@/ui/Row';
import { runAction } from '@/ui/RowMenu';
import { Meter } from '@/ui/Meter';
import { rise } from '@/ui/rise';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { Tap } from '@/ui/Tap';
import { PopularRow } from '@/ui/Popular';
import { TitlePoster, TitleTap } from '@/ui/TitleTap';
import { Pager, TabStrip, usePagerPosition } from '@/ui/Pager';
import { BAR_HEIGHT, TABS_HEIGHT } from '@/ui/TopBar';
import { progressOf, remainingOf, resume, subtitleOf } from '@/ui/watching';
import { alpha, color, font, motion, radius, space, type } from '@/theme';
import { appear, reflow, vanish } from '@/ui/presets';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Chip } from '@/ui/Chip';
import { SectionHeading } from '@/ui/SectionHeading';

const TABS = ['Films & shows', 'Torrents'] as const;
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

/** How long typing must pause before a new search is sent. The engine finishes a search even after the app stops waiting for it, so each one sent costs its full lookup; keep this longer than the gap between keystrokes. */
const SETTLE_MS = 280;

const ignore = () => {};
const NOTHING: ReadonlySet<string> = new Set();

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);

    return () => clearTimeout(timer);
  }, [value, ms]);

  return settled;
}

function useLingering(busy: boolean, ms: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!busy) return setShown(false);
    const timer = setTimeout(() => setShown(true), ms);

    return () => clearTimeout(timer);
  }, [busy, ms]);

  return shown;
}

export default function Search() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const searching = useLingering(busy, 200);
  const [tab, setTab] = useState(0);
  const position = usePagerPosition(0);
  const [everything, setEverything] = useState(false);
  const typed = text.trim();
  const settled = useDebounced(typed, SETTLE_MS);
  const known = useKnownSearch();
  const query = typed !== settled && known(typed) ? typed : settled;
  const top = insets.top + BAR_HEIGHT + TABS_HEIGHT;
  const recents = useRecentSearches();
  const pickup = usePickup();

  const idle =
    pickup.unfinished.length > 0 || pickup.downloads.length > 0 || recents.recent.length > 0 ? (
      <Recent
        unfinished={pickup.unfinished}
        downloads={pickup.downloads}
        more={pickup.more}
        searches={recents.recent}
        onPick={(query) => {
          Keyboard.dismiss();
          setText(query);
        }}
        onForget={recents.forget}
        onClear={recents.clear}
      />
    ) : null;

  return (
    <View style={styles.screen}>
      <Pager
        index={tab}
        onIndex={(next) => {
          setTab(next);
          Keyboard.dismiss();
        }}
        position={position}
        preload={false}
      >
        <Titles query={query} top={top} idle={idle} onOpen={recents.remember} onBusy={tab === 0 ? setBusy : ignore} />
        <Torrents
          query={query}
          everything={everything}
          onScope={setEverything}
          top={top}
          idle={idle}
          onOpen={recents.remember}
          onBusy={tab === 1 ? setBusy : ignore}
        />
      </Pager>
      <SearchHeader
        text={text}
        setText={setText}
        tab={tab}
        setTab={setTab}
        position={position}
        onSubmit={recents.remember}
        searching={searching}
      />
    </View>
  );
}

function SearchHeader({
  text,
  setText,
  tab,
  setTab,
  position,
  onSubmit,
  searching,
}: {
  text: string;
  setText: (text: string) => void;
  tab: number;
  setTab: (tab: number) => void;
  position: SharedValue<number>;
  onSubmit: (text: string) => void;
  searching: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { hidden } = useChrome();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const empty = useRef(true);
  useEffect(() => {
    empty.current = text.length === 0;
  }, [text]);

  useFocusEffect(
    useCallback(() => {
      const timer = empty.current ? setTimeout(() => input.current?.focus(), 120) : undefined;

      return () => {
        clearTimeout(timer);
        Keyboard.dismiss();
      };
    }, []),
  );
  const focus = useSharedValue(0);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: -hidden.get() * BAR_HEIGHT }] }));

  const field = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.get(), [0, 1], [`${color.action}00`, color.action]),
  }));

  return (
    <>
      <Animated.View style={[styles.header, { paddingTop: insets.top }, slide]}>
        <View style={styles.fieldRow}>
          <Animated.View style={[styles.field, field]}>
            <Glass style={styles.fieldGlass} />
            <View style={styles.fieldIcon}>
              {searching ? (
                <ActivityIndicator size="small" color={color.soft} />
              ) : (
                <Icon name={icons.search} size={18} tint={color.pencil} />
              )}
            </View>
            <TextInput
              ref={input}
              value={text}
              onChangeText={(next) => {
                mark('typed');
                setText(next);
              }}
              placeholder="Search films, shows, torrents"
              placeholderTextColor={color.pencil}
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={() => onSubmit(text)}
              autoCorrect={false}
              autoCapitalize="none"
              selectionColor={color.action}
              onFocus={() => focus.set(withTiming(1, { duration: motion.quick }))}
              onBlur={() => focus.set(withTiming(0, { duration: motion.quick }))}
              accessibilityLabel="Search"
            />
            {text ? (
              <Animated.View entering={appear} exiting={vanish}>
                <Tap shrink={0.85} onPress={() => setText('')} accessibilityLabel="Clear" style={styles.clear}>
                  <Icon name={icons.close} size={14} tint={color.paper} weight={3} />
                </Tap>
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
        <TabStrip
          labels={[...TABS]}
          index={tab}
          position={position}
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

function Titles({
  query,
  top,
  idle,
  onOpen,
  onBusy,
}: {
  query: string;
  top: number;
  idle: ReactElement | null;
  onOpen: (query: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const onScroll = useChromeScroll();
  const { bottom } = useChrome();
  const result = useTitleSearch(query);
  const titles = result.data?.titles ?? [];
  const fetching = result.isFetching && query.length > 0;

  const stale = useAnimatedStyle(() => ({
    opacity: withTiming(result.isPlaceholderData ? 0.5 : 1, { duration: motion.quick }),
  }));

  useEffect(() => onBusy(fetching), [fetching, onBusy]);

  const answered = query.length > 0 && result.data !== undefined && !result.isPlaceholderData;
  useEffect(() => {
    if (answered) since('typed', 'search results');
  }, [answered, query]);

  return (
    <Animated.FlatList
      data={query ? titles : []}
      keyExtractor={(item) => item.id}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottom + space.xl }}
      ListEmptyComponent={
        !query ? (
          <>
            {idle ?? (
              <Hint
                icon={icons.search}
                title="Find something to watch"
                body="Search by name. A film or a show starts playing in seconds, while it downloads."
              />
            )}
            <PopularRow kind="film" title="Popular films" skip={NOTHING} index={4} />
            <PopularRow kind="series" title="Popular shows" skip={NOTHING} index={5} />
          </>
        ) : result.isError ? (
          <EngineProblem error={result.error} onRetry={() => result.refetch()} />
        ) : result.isSuccess && !result.isPlaceholderData ? (
          <Hint
            icon={icons.film}
            title={`No films or shows named “${query}”`}
            body="Try the Torrents tab to search every source by name."
          />
        ) : (
          <RowsLoading />
        )
      }
      renderItem={({ item }) => (
        <Animated.View style={stale} pointerEvents={result.isPlaceholderData ? 'none' : 'auto'}>
          <TitleRow title={item} onOpen={() => onOpen(query)} />
        </Animated.View>
      )}
    />
  );
}

function TitleRow({ title, onOpen }: { title: TitleCard; onOpen: () => void }) {
  return (
    <Animated.View>
      <TitleTap
        id={title.id}
        shrink={1}
        highlight
        onOpen={() => {
          onOpen();
          Keyboard.dismiss();
        }}
        accessibilityLabel={[title.name, cardFacts(title)].filter(Boolean).join(', ')}
        style={styles.row}
      >
        <TitlePoster>
          <Art id={title.id} kind="poster" name={title.name} style={styles.thumb} />
        </TitlePoster>
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
      </TitleTap>
    </Animated.View>
  );
}

function RowsLoading() {
  return (
    <View accessibilityLabel="Searching" accessibilityRole="progressbar">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.row}>
          <Skeleton style={styles.thumb} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton style={{ height: 16, width: `${70 - i * 12}%`, borderRadius: radius.sm }} />
            <Skeleton style={{ height: 12, width: '35%', borderRadius: radius.sm }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Torrents({
  query,
  everything,
  onScope,
  top,
  idle,
  onOpen,
  onBusy,
}: {
  query: string;
  everything: boolean;
  onScope: (everything: boolean) => void;
  top: number;
  idle: ReactElement | null;
  onOpen: (query: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const link = useLink();
  const onScroll = useChromeScroll();
  const { bottom } = useChrome();

  const [state, setState] = useState<{ releases: Release[]; pending: string[]; done: boolean; error: string | null }>({
    releases: [],
    pending: [],
    done: false,
    error: null,
  });

  const [notVideo, setNotVideo] = useState<Release | null>(null);
  const running = useRef<AbortController | null>(null);

  const search = useCallback(() => {
    running.current?.abort();

    if (!query) return setState({ releases: [], pending: [], done: false, error: null });
    const controller = new AbortController();
    running.current = controller;
    setState({ releases: [], pending: ['…'], done: false, error: null });
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
  }, [link, query, everything]);

  useEffect(() => {
    search();

    return () => running.current?.abort();
  }, [search]);

  const retry = search;

  const busy = query.length > 0 && !state.done;
  useEffect(() => onBusy(busy), [busy, onBusy]);

  return (
    <>
      <Animated.FlatList
        data={state.releases}
        keyExtractor={(item) => item.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: top, paddingBottom: bottom + space.xl }}
        ListHeaderComponent={
          query ? (
            <Scope
              everything={everything}
              onChange={onScope}
              status={
                state.done
                  ? null
                  : `Asking ${state.pending.length > 1 ? `${state.pending.length} sources` : 'sources'}…`
              }
            />
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
          ) : state.done && state.error ? (
            <EmptyState icon={icons.warning} title="Search failed" body={sentence(state.error)}>
              <Button label="Try again" icon={icons.refresh} kind="secondary" onPress={retry} />
            </EmptyState>
          ) : state.done ? (
            <Hint
              icon={icons.warning}
              title="No torrents found"
              body={
                everything
                  ? 'Try fewer or different words.'
                  : 'Try fewer or different words, or search everything instead of only video.'
              }
            />
          ) : undefined
        }
        ListFooterComponent={
          state.error && state.releases.length > 0 ? (
            <View style={styles.partial}>
              <Text style={[type.caption, { color: color.error }]}>
                Not every source answered. {sentence(state.error)}
              </Text>
              <Button label="Try again" icon={icons.refresh} kind="secondary" onPress={retry} />
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <ReleaseRow
            release={item}
            onOpen={() => onOpen(query)}
            onNotVideo={() => {
              Keyboard.dismiss();
              setNotVideo(item);
            }}
          />
        )}
      />
      {notVideo ? <NotVideo release={notVideo} onClose={() => setNotVideo(null)} /> : null}
    </>
  );
}

function Scope({
  everything,
  onChange,
  status,
}: {
  everything: boolean;
  onChange: (everything: boolean) => void;
  status: string | null;
}) {
  return (
    <View style={styles.scope} accessibilityRole="radiogroup" accessibilityLabel="What to search">
      {[false, true].map((all) => {
        const on = everything === all;

        return (
          <Chip
            key={String(all)}
            radio
            label={all ? 'Everything' : 'Video'}
            selected={on}
            onPress={() => onChange(all)}
          />
        );
      })}
      {status ? (
        <Animated.Text
          entering={appear}
          exiting={vanish}
          style={[type.caption, styles.scopeStatus]}
          accessibilityLiveRegion="polite"
          numberOfLines={1}
        >
          {status}
        </Animated.Text>
      ) : null}
    </View>
  );
}

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
        <ActionRow
          icon={copied ? icons.check : icons.link}
          label={copied ? 'Copied' : `Copy “${command}”`}
          onPress={async () => {
            await Clipboard.setStringAsync(command);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopied(true);
          }}
        />
        {release.magnet ? (
          <ActionRow
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

function ReleaseRow({ release, onOpen, onNotVideo }: { release: Release; onOpen: () => void; onNotVideo: () => void }) {
  const name = readable(release.name);
  const playable = isVideo(release);

  const chips = [
    playable ? null : CATEGORIES[release.category ?? 'other'],
    release.quality.resolution?.toUpperCase(),
    release.quality.codec?.toUpperCase(),
    release.quality.hdr ? 'HDR' : null,
  ].flatMap((chip) => (chip ? [chip] : []));

  return (
    <Animated.View>
      <Tap
        shrink={1}
        highlight
        onPress={() => {
          onOpen();
          Keyboard.dismiss();

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

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

function usePickup() {
  const home = useHome();
  const unfinished = (home.data?.continue ?? []).slice(0, SHOWN);
  const watching = new Set(unfinished.map((item) => item.title.id));

  const others = useJobsSelect(
    ({ jobs }) => jobs.filter((job) => !(job.title && watching.has(job.title.title))).map((job) => job.id),
    sameIds,
  );

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
  downloads: string[];
  more: boolean;
  searches: string[];
  onPick: (query: string) => void;
  onForget: (query: string) => void;
  onClear: () => void;
}) {
  const afterUnfinished = unfinished.length > 0 ? unfinished.length + 1 : 0;
  const afterDownloads = afterUnfinished + (downloads.length > 0 ? downloads.length + 1 : 0);

  return (
    <View style={{ gap: space.md }}>
      {unfinished.length > 0 ? (
        <Animated.View entering={rise(0)}>
          <SectionHeading title="Continue watching" />
          {unfinished.map((item, index) => (
            <Animated.View key={item.video} entering={rise(index + 1)} exiting={vanish} layout={reflow}>
              <UnfinishedRow item={item} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
      {downloads.length > 0 ? (
        <Animated.View entering={rise(afterUnfinished)}>
          <SectionHeading
            title="Downloads"
            action={more ? { label: 'See all', onPress: () => router.navigate('/downloads') } : undefined}
          />
          {downloads.map((id, index) => (
            <Animated.View key={id} entering={rise(afterUnfinished + index + 1)} layout={reflow}>
              <DownloadRow id={id} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
      {searches.length > 0 ? (
        <Animated.View entering={rise(afterDownloads)}>
          <SectionHeading title="Recent searches" action={{ label: 'Clear all', onPress: onClear }} />
          {searches.map((item, index) => (
            <Animated.View key={item} entering={rise(afterDownloads + index + 1)} exiting={vanish} layout={reflow}>
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

function UnfinishedRow({ item }: { item: Continue }) {
  const link = useLink();
  const client = useQueryClient();
  const progress = progressOf(item);
  const subtitle = subtitleOf(item);

  const forget = () =>
    runAction({
      id: 'forget',
      label: 'Forget where it stopped',
      icon: icons.close,
      symbol: 'xmark',
      ask: {
        title: `Forget where ${item.title.name} stopped?`,
        message: 'It plays from the start next time.',
        confirm: 'Forget',
        danger: true,
      },
      run: async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await post(link, '/api/watched/forget', { video: item.video }).catch(() => {});
        client.invalidateQueries({ queryKey: keys.home });
      },
    });

  return (
    <View>
      <Tap
        shrink={1}
        highlight
        onPress={() => resume(item)}
        accessibilityLabel={[item.title.name, subtitle, remainingOf(item)].filter(Boolean).join(', ')}
        style={styles.pickRow}
      >
        <Art id={item.title.id} kind="poster" name={item.title.name} style={styles.pickPoster} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={type.callout} numberOfLines={2}>
            {item.title.name} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{subtitle}</Text>
          </Text>
          {progress !== null ? <Meter fraction={progress} /> : null}
          <Text style={type.numeric}>{remainingOf(item)}</Text>
        </View>
        {item.resume_at !== null ? <View style={styles.recentRemove} /> : null}
      </Tap>
      {item.resume_at !== null ? (
        <Tap
          shrink={0.85}
          onPress={forget}
          accessibilityLabel={`Forget where ${item.title.name} stopped`}
          style={[styles.recentRemove, styles.trailing]}
        >
          <Icon name={icons.close} size={16} tint={color.pencil} />
        </Tap>
      ) : null}
    </View>
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

function DownloadRow({ id }: { id: string }) {
  const job = useJob(id);

  if (!job) return null;

  return <DownloadRowOf job={job} />;
}

function DownloadRowOf({ job }: { job: Job }) {
  const name = useJobName(job);
  const said = summary(job);

  const content = (
    <>
      {name.poster ? (
        <TitlePoster>
          <Art id={name.poster} kind="poster" name={name.title} style={styles.pickPoster} />
        </TitlePoster>
      ) : (
        <View style={styles.pickBadge}>
          <Icon name={job.state === 'done' ? icons.check : icons.downloads} size={18} tint={color.soft} />
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={type.callout} numberOfLines={2}>
          {name.title} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{name.tags}</Text>
        </Text>
        <Text style={[type.numeric, job.state === 'error' && { color: color.error }]} numberOfLines={1}>
          {said}
        </Text>
      </View>
    </>
  );

  const label = `${name.title}, ${said}`;

  return job.title ? (
    <TitleTap id={job.title.title} shrink={1} highlight accessibilityLabel={label} style={styles.pickRow}>
      {content}
    </TitleTap>
  ) : (
    <Tap shrink={1} highlight onPress={() => openJob(job)} accessibilityLabel={label} style={styles.pickRow}>
      {content}
    </Tap>
  );
}

function Hint({ icon, title, body }: { icon: (typeof icons)[keyof typeof icons]; title: string; body: string }) {
  return <EmptyState icon={icon} title={title} body={body} />;
}

const styles = StyleSheet.create({
  partial: { paddingHorizontal: space.page, paddingVertical: space.lg, gap: space.md, alignItems: 'flex-start' },
  screen: { flex: 1, backgroundColor: color.paper },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: alpha(color.paper, 0.97) },
  statusShade: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11, backgroundColor: color.paper },
  fieldRow: { height: BAR_HEIGHT, justifyContent: 'center', paddingHorizontal: space.lg },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 40,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  fieldGlass: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.pill },
  input: { flex: 1, fontFamily: font.regular, fontSize: 16, color: color.ink, paddingVertical: 0 },
  clear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
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
  scopeStatus: { flex: 1, textAlign: 'right' },
  fieldIcon: { width: 20, alignItems: 'center' },
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
  chipText: { fontFamily: font.semibold, fontSize: 11, color: color.soft, letterSpacing: 0.3 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.page,
    minHeight: 52,
  },
  recentRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  trailing: { position: 'absolute', right: space.page - 6, top: '50%', marginTop: -16 },
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
