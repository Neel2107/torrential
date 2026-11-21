import { Tabs } from 'expo-router/js-tabs';

import { JobsProvider, useJobs } from '@/engine/jobs';
import { ChromeProvider } from '@/ui/chrome';
import { TabBar } from '@/ui/TabBar';
import { color } from '@/theme';

export default function TabsLayout() {
  return (
    <JobsProvider>
      <Tabbed />
    </JobsProvider>
  );
}

function Tabbed() {
  const { jobs } = useJobs();
  const downloading = jobs.some((job) => job.state === 'downloading' || job.state === 'metadata');

  return (
    <ChromeProvider>
      <Tabs
        tabBar={(props) => <TabBar {...props} badges={{ downloads: downloading }} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.paper }, animation: 'fade' }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="downloads" />
      </Tabs>
    </ChromeProvider>
  );
}
