export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (/^magnet:/i.test(path)) return `/add?link=${encodeURIComponent(path)}`;
    if (/^(content|file):/i.test(path)) return `/add?file=${encodeURIComponent(path)}`;
    if (new URL(path).hostname === 'expo-sharing') return '/add';
    return path;
  } catch {
    return path;
  }
}
