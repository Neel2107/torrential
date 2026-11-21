import { NativeTabs } from 'expo-router/native-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useJobs } from '@/engine/jobs';
import { ChromeProvider } from '@/ui/chrome';
import { color } from '@/theme';

/**
 * How much the system tab bar covers above the safe area. It cannot be measured, and it does not
 * inset these feeds itself: they are lists the system does not find, so they leave the room.
 */
const SYSTEM_TAB_BAR = 50;

/**
 * The system tab bar, in Liquid Glass on iOS 26 and later, with Search apart at its end. Android
 * keeps the X-style bar in `_layout.tsx`.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { jobs } = useJobs();
  const downloading = jobs.some((job) => job.state === 'downloading' || job.state === 'metadata');

  return (
    <ChromeProvider bar={insets.bottom + SYSTEM_TAB_BAR}>
      <NativeTabs tintColor={color.action}>
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
    </ChromeProvider>
  );
}
