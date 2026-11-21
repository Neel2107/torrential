import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useJobs } from '@/engine/jobs';
import { CastBar } from '@/ui/CastBar';
import { ChromeProvider, useChrome } from '@/ui/chrome';
import { TAB_BAR_HEIGHT, TabBar } from '@/ui/TabBar';
import { color, space } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { jobs } = useJobs();
  const downloading = jobs.some((job) => job.state === 'downloading' || job.state === 'metadata');

  return (
    <ChromeProvider bar={insets.bottom + TAB_BAR_HEIGHT}>
      <Tabs
        tabBar={(props) => <TabBar {...props} badges={{ downloads: downloading }} />}
        // Tabs switch at once, as X's do; Back returns to the tab you came from.
        backBehavior="history"
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.paper }, animation: 'none' }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="downloads" />
      </Tabs>
      <DockedCastBar />
    </ChromeProvider>
  );
}

function DockedCastBar() {
  const insets = useSafeAreaInsets();
  const { hidden, setDocked } = useChrome();
  return (
    <CastBar
      bottom={insets.bottom + TAB_BAR_HEIGHT + space.sm}
      hidden={hidden}
      travel={TAB_BAR_HEIGHT}
      onHeight={setDocked}
    />
  );
}
