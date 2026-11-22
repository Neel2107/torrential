import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ago, bytes } from '@web/lib/format';

import { useCopies, type Copy } from '@/offline/saved';
import { Icon, icons } from '@/ui/Icon';
import { rise } from '@/ui/rise';
import { Tap } from '@/ui/Tap';
import { color, font, radius, space, type } from '@/theme';

type Saved = Extract<Copy, { state: 'saved' }>;

export default function SavedVideos() {
  const insets = useSafeAreaInsets();
  const saved = useCopies().filter((copy): copy is Saved => copy.state === 'saved');

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Tap haptic shrink={0.9} onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Icon name={icons.back} size={22} tint={color.ink} />
        </Tap>
        <Text style={styles.title} accessibilityRole="header">
          On this phone
        </Text>
      </View>
      <FlatList
        data={saved}
        keyExtractor={(copy) => copy.job}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name={icons.phone} size={28} tint={color.soft} />
            <Text style={[type.title, { textAlign: 'center' }]}>Nothing saved on this phone</Text>
            <Text style={[type.body, { textAlign: 'center' }]}>
              Save a finished download from its menu to watch it without an engine.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={rise(index)}>
            <Tap
              highlight
              shrink={1}
              onPress={() => router.push({ pathname: '/offline', params: { job: item.job } })}
              accessibilityLabel={`${item.label.title}, ${bytes(item.size)}`}
              style={styles.row}
            >
              <View style={styles.badge}>
                <Icon name={icons.play} size={18} tint={color.ink} filled />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={type.callout} numberOfLines={2}>
                  {item.label.title} <Text style={styles.tags}>{item.label.tags}</Text>
                </Text>
                <Text style={type.numeric}>
                  {bytes(item.size)} · saved {ago(item.saved_at)}
                </Text>
              </View>
            </Tap>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bold, fontSize: 20, color: color.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.page,
    paddingVertical: space.md,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: { color: color.pencil, fontFamily: font.regular },
  empty: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 80 },
});
