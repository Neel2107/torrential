import * as Updates from 'expo-updates';

export type UpdatePhase = 'idle' | 'checking' | 'current' | 'failed' | 'restarting';

/** Only "torrential preview" takes over-the-air updates (`app.config.js`); the development app never does. */
export const takesUpdates = Updates.isEnabled;

/**
 * Asks the update server once for this build's runtime version, downloads what's newer and restarts
 * into it. The app never calls this on its own: launch makes no update request.
 */
export async function applyLatestUpdate(): Promise<UpdatePhase> {
  try {
    const fetched = await Updates.fetchUpdateAsync();

    if (!fetched.isNew) return 'current';

    await Updates.reloadAsync();

    return 'restarting';
  } catch {
    return 'failed';
  }
}

/** What this launch runs: the bundle built into the app, or an update and when it was published. */
export function runningBundle() {
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) return 'Built in';

  const published = Updates.createdAt.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `Update, ${published}`;
}

export const runtimeVersion = Updates.runtimeVersion?.slice(0, 12) ?? 'Unknown';
