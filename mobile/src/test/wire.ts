import type { Error as WireError, ErrorCode, Job, JobStatus, Position, Release } from '@web/wire';

type JobFields = Omit<Extract<Job, { state: 'queued' }>, 'state'>;

/** A download as the engine sends it, downloading unless `status` says otherwise, changed only where a test says. */
export function aJob(change: Partial<JobFields> = {}, status: JobStatus = { state: 'downloading' }): Job {
  const base: JobFields = {
    id: 'a1',
    info_hash: 'a1',
    name: 'Sintel',
    dir: '/downloads',
    path: null,
    progress: { size: 100, verified: 0, down_rate: 0, up_rate: 0, peers: 0, seeds: 0, eta: null },
    selection: { kind: 'all' },
    added_at: 0,
    place: 'folder',
  };

  return { ...base, ...change, ...status };
}

/** A search result as the engine sends it, changed only where a test says. */
export function aRelease(change: Partial<Release> = {}): Release {
  const base: Release = {
    id: 'r1',
    name: 'Sintel.2010.1080p.WEB.x264',
    size: 1_000_000_000,
    seeders: 10,
    leechers: 1,
    published: 0,
    category: 'video',
    quality: { resolution: '1080p', codec: 'h264', hdr: false },
    flags: ['creative_commons'],
    sources: ['archive'],
    magnet: null,
    torrent_url: null,
    info_url: null,
  };

  return { ...base, ...change };
}

/** Where a video stopped, as the app reports it to the engine, changed only where a test says. */
export function aPosition(change: Partial<Position> = {}): Position {
  const base: Position = {
    video: 'tt0063350',
    position: 0,
    duration: 5_760,
    release: null,
    tab: 'phone',
    starts: false,
  };

  return { ...base, ...change };
}

/** The error the engine puts in its `{ "error": … }` envelope. */
export function anError(code: ErrorCode, message: string, change: Partial<WireError> = {}): WireError {
  return { code, message, ...change };
}
