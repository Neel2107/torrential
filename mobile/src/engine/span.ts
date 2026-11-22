/** One episode of a show, as the engine numbers it. */
export type Episode = { season: number; episode: number };

/** What a download holds of a title, as the engine's `Span` in `crates/core/src/title.rs` says. */
export type Span =
  | { kind: 'film' }
  | ({ kind: 'episode' } & Episode)
  | { kind: 'season'; season: number }
  | { kind: 'seasons'; first: number; last: number }
  | { kind: 'complete' };

const LARGEST_U32 = 4_294_967_295;

function number(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);

  return value <= LARGEST_U32 ? value : null;
}

function pair(text: string, separator: string): [string, string] | null {
  const at = text.indexOf(separator);

  return at < 0 ? null : [text.slice(0, at), text.slice(at + 1)];
}

/** Reads a span as the engine writes it: `film`, `s3e5`, `s3`, `s1-5` or `complete`. Anything else is no span. */
export function parseSpan(text: string): Span | null {
  if (text === 'film') return { kind: 'film' };

  if (text === 'complete') return { kind: 'complete' };
  const season = text.startsWith('s') ? text.slice(1) : '';
  const episodeSplit = pair(season, 'e');
  const seasonsSplit = pair(season, '-');

  if (episodeSplit && !seasonsSplit) {
    const [held, episode] = [number(episodeSplit[0]), number(episodeSplit[1])];

    return held !== null && episode !== null ? { kind: 'episode', season: held, episode } : null;
  }

  if (seasonsSplit && !episodeSplit) {
    const [first, last] = [number(seasonsSplit[0]), number(seasonsSplit[1])];

    return first !== null && last !== null ? { kind: 'seasons', first, last } : null;
  }

  const only = number(season);

  return only !== null ? { kind: 'season', season: only } : null;
}

/** Whether `span` holds the film, for a null `episode`, or that episode, as `Span::covers` decides. */
export function covers(span: Span, episode: Episode | null): boolean {
  if (episode === null) return span.kind === 'film';

  switch (span.kind) {
    case 'film':
      return false;
    case 'episode':
      return span.season === episode.season && span.episode === episode.episode;
    case 'season':
      return span.season === episode.season;
    case 'seasons':
      return span.first <= episode.season && episode.season <= span.last;
    case 'complete':
      return true;
  }
}

/** A film, with no episode, or one episode of a show. */
export type Video = { title: string; episode: Episode | null };

/** The title and episode a video ID names: `tt0063350` for a film, `tt0063350:1:2` for season 1 episode 2. */
export function parseVideo(video: string): Video {
  const [title, season, episode] = video.split(':');

  return { title, episode: season === undefined ? null : { season: Number(season), episode: Number(episode) } };
}
