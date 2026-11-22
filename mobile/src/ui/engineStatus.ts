import type { UseQueryResult } from '@tanstack/react-query';

import { color } from '@/theme';

export type EngineStatus = { label: string; tint?: string };

/** How the engine answered its version check, in words and in the colour that marks it. */
export function engineStatus(version: UseQueryResult<{ version: string }>): EngineStatus {
  if (version.isSuccess) return { label: `Online · torrential ${version.data.version}`, tint: color.action };

  if (version.isError) return { label: 'Not answering', tint: color.error };

  return { label: 'Checking…' };
}
