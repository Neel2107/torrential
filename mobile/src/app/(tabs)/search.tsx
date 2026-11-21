import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
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

import { bytes } from '@web/lib/format';
import { readable } from '@web/lib/release';
import { cardFacts } from '@web/titles/words';
import type { Release, SearchMessage, TitleCard } from '@web/wire';

import { stream } from '@/engine/client';
import { useTitleSearch } from '@/engine/queries';
import { useRecentSearches } from '@/engine/recent';
import { useLink } from '@/engine/session';
import { Art } from '@/ui/Art';
import { useChrome, useChromeScroll } from '@/ui/chrome';
import { EngineProblem } from '@/ui/EngineProblem';
import { Icon, icons } from '@/ui/Icon';
import { rise } from '@/ui/rise';
import { TAB_BAR_HEIGHT } from '@/ui/TabBar';
import { Tap } from '@/ui/Tap';
import { BAR_HEIGHT, TABS_HEIGHT } from '@/ui/TopBar';
import { color, font, motion, radius, space, type } from '@/theme';

const TABS = ['Films & shows', 'Torrents'] as const;

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
  const query = useDebounced(text.trim(), 280);
  const top = insets.top + BAR_HEIGHT + TABS_HEIGHT;
  const recents = useRecentSearches();
  const remember = () => recents.remember(text);
  const idle =
    recents.recent.length > 0 ? (
      <Recent items={recents.recent} onPick={setText} onForget={recents.forget} onClear={recents.clear} />
    ) : null;

  return (
    <View style={styles.screen}>
      {tab === 0 ? (
        <Titles query={query} top={top} idle={idle} onOpen={remember} />
      ) : (
        <Torrents query={query} top={top} idle={idle} onOpen={remember} />
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
  top,
  idle,
  onOpen,
}: {
  query: string;
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

  useEffect(() => {
    if (!query) return setState({ releases: [], pending: [], done: false, error: null });
    const controller = new AbortController();
    setState((previous) => ({ ...previous, pending: ['…'], done: false, error: null }));
    stream<SearchMessage>(
      link,
      '/api/search',
      { method: 'POST', body: { q: query }, signal: controller.signal },
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
  }, [link, query]);

  return (
    <Animated.FlatList
      data={state.releases}
      keyExtractor={(item) => item.id}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + space.xl + docked }}
      ListHeaderComponent={
        query && !state.done ? (
          <View style={styles.searching}>
            <ActivityIndicator size="small" color={color.soft} />
            <Text style={type.caption}>
              Asking {state.pending.length > 1 ? `${state.pending.length} sources` : 'sources'}…
            </Text>
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
            body={state.error ?? 'Try fewer or different words.'}
          />
        ) : undefined
      }
      renderItem={({ item, index }) => <ReleaseRow release={item} index={index} onOpen={onOpen} />}
    />
  );
}

function ReleaseRow({ release, index, onOpen }: { release: Release; index: number; onOpen: () => void }) {
  const name = readable(release.name);
  const chips = [
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
          router.push({ pathname: '/play', params: { ref: release.magnet ?? release.id } });
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

function Recent({
  items,
  onPick,
  onForget,
  onClear,
}: {
  items: string[];
  onPick: (query: string) => void;
  onForget: (query: string) => void;
  onClear: () => void;
}) {
  return (
    <Animated.View entering={rise(0)}>
      <View style={styles.recentHead}>
        <Text style={type.title}>Recent</Text>
        <Tap shrink={0.94} haptic onPress={onClear} accessibilityLabel="Clear recent searches">
          <Text style={[type.label, { color: color.action }]}>Clear all</Text>
        </Tap>
      </View>
      {items.map((item, index) => (
        <Animated.View
          key={item}
          entering={rise(index + 1)}
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
