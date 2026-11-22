import { z } from 'zod';

const link = z.object({ base: z.string(), token: z.string().nullable() });

const engine = z.object({ id: z.string(), name: z.string(), kind: z.enum(['computer', 'phone']), link });

export const savedEngines = z.object({ engines: z.array(engine), active: z.string().nullable() });

export const oldLink = link;

const position = z.object({
  video: z.string(),
  position: z.number(),
  duration: z.number().nullable(),
  release: z.string().nullable(),
  tab: z.string(),
  starts: z.boolean(),
});

export const unsentPositions = z.record(z.string(), z.record(z.string(), position));

const label = z.object({ title: z.string(), tags: z.string(), poster: z.string().nullable() });

export const wantedCopies = z.record(z.string(), z.object({ label, file: z.number() }));

export const recentSearches = z.array(z.string());

export const savedCopies = z.array(
  z.object({
    job: z.string(),
    label,
    size: z.number(),
    file: z.number().optional(),
    state: z.literal('saved'),
    saved_at: z.number(),
    uri: z.string(),
    subtitles: z.string().optional(),
  }),
);

const show = z.object({ subtitles: z.string().nullable().optional(), audio: z.string().optional() });

export const playerPreferences = z.object({
  speed: z.number().optional(),
  subtitleStyle: z
    .object({ scale: z.number(), backing: z.enum(['shadow', 'outline', 'box']), lift: z.number() })
    .partial()
    .optional(),
  subtitles: z.string().nullable().optional(),
  shows: z.record(z.string(), show).optional(),
});

export type StoredPreferences = z.infer<typeof playerPreferences>;

export const NO_PREFERENCES: StoredPreferences = {};

/** Reads JSON the app stored, checked against `schema`; anything else, including a file from an older version that no longer fits, gives `fallback`. */
export function readStored<T, F>(schema: z.ZodType<T>, text: string | null | undefined, fallback: F): T | F {
  if (!text) return fallback;

  try {
    const parsed = schema.safeParse(JSON.parse(text));

    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}
