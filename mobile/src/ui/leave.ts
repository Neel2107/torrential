import { router } from 'expo-router';

/** Goes back, or home when the screen was opened straight from a link and has nothing behind it. */
export function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
