import type {
  AudioTrack,
  Error as WireError,
  ErrorCode,
  FilesReply,
  Job,
  JobStatus,
  MediaInfo,
  PlayInfo,
  Position,
  Release,
  TitleCard,
  TorrentFile,
} from '@web/wire';

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

/** One file of a download as the engine lists it, selected and wholly verified, changed only where a test says. */
export function aFile(change: Partial<TorrentFile> = {}): TorrentFile {
  const base: TorrentFile = { index: 0, path: 'Sintel.2010.mkv', size: 100, selected: true, verified: 100 };

  return { ...base, ...change };
}

/** A download's files as `POST /api/files` lists them. */
export function someFiles(files: TorrentFile[], change: Partial<FilesReply> = {}): FilesReply {
  const base: FilesReply = {
    id: 'a1',
    name: 'Sintel',
    total_size: files.reduce((total, file) => total + file.size, 0),
    files,
    metadata_source: 'download',
    elapsed_ms: 0,
  };

  return { ...base, ...change };
}

/** A title as the catalog shows it, a film unless the test says, changed only where a test says. */
export function aTitle(change: Partial<TitleCard> = {}): TitleCard {
  const base: TitleCard = { id: 'tt0063350', kind: 'film', name: 'Night of the Living Dead', year: 1968, rating: 7.8 };

  return { ...base, ...change };
}

/** What the engine plays: a download and the video it streams, changed only where a test says. */
export function aPlay(change: Partial<PlayInfo> = {}): PlayInfo {
  const video = { index: 0, path: 'Sintel.2010.mkv', size: 100, url: '/a1/0/Sintel.2010.mkv', offset: 0 };

  const base: PlayInfo = {
    id: 'a1',
    name: 'Sintel',
    job: aJob(),
    files: [aFile()],
    total_size: 100,
    video,
    subtitles: [],
  };

  return { ...base, ...change };
}

/** An audio track of a video as the engine describes it, English AAC stereo unless the test says. */
export function anAudioTrack(change: Partial<AudioTrack> = {}): AudioTrack {
  const base: AudioTrack = { stream: 1, codec: 'aac', channels: 2, language: 'eng', title: null, default: false };

  return { ...base, ...change };
}

/** What the engine knows of a video file, an MKV with no tracks unless the test says. */
export function aMedia(change: Partial<MediaInfo> = {}): MediaInfo {
  const base: MediaInfo = {
    duration: 888,
    container: 'matroska,webm',
    video: null,
    audio: [],
    subtitles: [],
    direct: null,
    ffmpeg: 'ready',
    chapters: [],
  };

  return { ...base, ...change };
}
