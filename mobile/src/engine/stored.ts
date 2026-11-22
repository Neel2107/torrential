import { z } from 'zod';

const link = z.object({ base: z.string(), token: z.string().nullable() });

const engine = z.object({ id: z.string(), name: z.string(), kind: z.enum(['computer', 'phone']), link });

export const savedEngines = z.object({ engines: z.array(engine), active: z.string().nullable() });

/** The engines this phone paired with, and the one in use, as the session saves them. */
export type SavedEngines = z.infer<typeof savedEngines>;

export type SavedEngine = z.infer<typeof engine>;

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

/** Positions not yet sent, by engine base and then video. */
export type UnsentPositions = z.infer<typeof unsentPositions>;

const label = z.object({ title: z.string(), tags: z.string(), poster: z.string().nullable() });

/** How a saved copy is named on the phone. */
export type StoredLabel = z.infer<typeof label>;

export const wantedCopies = z.record(z.string(), z.object({ label, file: z.number() }));

/** Copies asked for, by download, to save once each finishes. */
export type WantedCopies = z.infer<typeof wantedCopies>;

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

/** The copies saved on the phone, as their manifest lists them. */
export type SavedCopies = z.infer<typeof savedCopies>;

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
