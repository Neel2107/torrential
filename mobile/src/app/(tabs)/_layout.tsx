import { NativeTabs } from 'expo-router/native-tabs';

import { useJobs } from '@/engine/queries';
import { color, font } from '@/theme';

export default function TabsLayout() {
  const { jobs } = useJobs();
  const active = jobs.filter((job) => job.state === 'downloading' || job.state === 'metadata').length;

  return (
    <NativeTabs
      backgroundColor={color.raised}
      iconColor={{ default: color.pencil, selected: color.ink }}
      indicatorColor={color.lifted}
      rippleColor={color.hairline}
      labelStyle={{ default: { color: color.pencil, fontFamily: font.medium, fontSize: 12 }, selected: { color: color.ink, fontFamily: font.semibold, fontSize: 12 } }}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="downloads">
        <NativeTabs.Trigger.Label>Downloads</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'arrow.down.circle', selected: 'arrow.down.circle.fill' }} md="download" />
        {active > 0 ? <NativeTabs.Trigger.Badge>{String(active)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
