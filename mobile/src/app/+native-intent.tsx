export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (/^magnet:/i.test(path)) return `/add?link=${encodeURIComponent(path)}`;

    if (/^(content|file):/i.test(path)) return `/add?file=${encodeURIComponent(path)}`;

    const { hostname } = new URL(path);

    if (hostname === 'expo-sharing') return '/add';

    if (hostname === 'update') return '/settings?check=now';

    return path;
  } catch {
    return path;
  }
}
