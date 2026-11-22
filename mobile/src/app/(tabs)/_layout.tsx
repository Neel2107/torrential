import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SaveWhenDone } from '@/engine/download';
import { useJobsSelect } from '@/engine/jobs';
import { CastBar } from '@/ui/CastBar';
import { PullProvider } from '@/ui/pull';
import { ChromeProvider, useChrome } from '@/ui/chrome';
import { TAB_BAR_HEIGHT, TabBar } from '@/ui/TabBar';
import { color, space } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  const downloading = useJobsSelect(({ jobs }) =>
    jobs.some((job) => job.state === 'downloading' || job.state === 'metadata'),
  );

  return (
    <PullProvider>
      <SaveWhenDone />
      <ChromeProvider bar={insets.bottom + TAB_BAR_HEIGHT}>
        <Tabs
          tabBar={(props) => <TabBar {...props} badges={{ downloads: downloading }} />}
          backBehavior="history"
          screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.paper }, animation: 'none' }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="search" />
          <Tabs.Screen name="downloads" />
        </Tabs>
        <DockedCastBar />
      </ChromeProvider>
    </PullProvider>
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
