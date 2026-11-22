import { NativeTabs } from 'expo-router/native-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SaveWhenDone } from '@/engine/download';
import { useJobsSelect } from '@/engine/jobs';
import { CastBar } from '@/ui/CastBar';
import { PullProvider } from '@/ui/pull';
import { ChromeProvider, useChrome } from '@/ui/chrome';
import { color, scheme, space } from '@/theme';

/**
 * How much the system tab bar covers above the safe area. It cannot be measured, and it does not
 * inset these feeds itself: they are lists the system does not find, so they leave the room.
 */
const SYSTEM_TAB_BAR = 50;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  const downloading = useJobsSelect(({ jobs }) =>
    jobs.some((job) => job.state === 'downloading' || job.state === 'metadata'),
  );

  return (
    <PullProvider>
      <SaveWhenDone />
      <ChromeProvider bar={insets.bottom + SYSTEM_TAB_BAR}>
        <NativeTabs
          tintColor={color.action}
          blurEffect={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        >
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="downloads">
            <NativeTabs.Trigger.Label>Downloads</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'arrow.down.circle', selected: 'arrow.down.circle.fill' }} />
            {downloading ? <NativeTabs.Trigger.Badge /> : null}
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="search" role="search">
            <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf="magnifyingglass" />
          </NativeTabs.Trigger>
        </NativeTabs>
        <DockedCastBar />
      </ChromeProvider>
    </PullProvider>
  );
}

function DockedCastBar() {
  const insets = useSafeAreaInsets();
  const { setDocked } = useChrome();

  return <CastBar bottom={insets.bottom + SYSTEM_TAB_BAR + space.sm} onHeight={setDocked} />;
}
