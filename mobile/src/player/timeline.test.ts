import { describe, expect, test } from '@jest/globals';

import { LINK } from '@/test/engine';
import { aMedia, anAudioTrack, aPlay } from '@/test/wire';
import type { AudioTrack } from '@web/wire';

import { needsAudioConversion, recover, sourceFor, streamBase, type Mode, type Retried } from './timeline';

const FRESH: Retried = { direct: false, stream: false };
const COPY: Mode = { kind: 'stream', video: 'copy', from: 10, audio: null, reason: 'audio' };

describe('what plays after the player fails', () => {
  test.each<[string, Mode, Retried, ReturnType<typeof recover>]>([
    [
      'the file is tried once more after 1.5 s',
      { kind: 'direct' },
      FRESH,
      { mode: { kind: 'direct' }, after: 1500, retried: { direct: true, stream: false } },
    ],
    [
      'then a stream copying the video, from where it stopped',
      { kind: 'direct' },
      { direct: true, stream: false },
      {
        mode: { kind: 'stream', video: 'copy', from: 42, audio: null, reason: 'failed' },
        after: 0,
        retried: { direct: true, stream: false },
      },
    ],
    [
      'a stream is tried once more after 1.5 s, from where it stopped',
      COPY,
      FRESH,
      { mode: { ...COPY, from: 42 }, after: 1500, retried: { direct: false, stream: true } },
    ],
    [
      'then a stream converting the video to H.264',
      COPY,
      { direct: true, stream: true },
      {
        mode: { ...COPY, video: 'h264', from: 42, reason: 'failed' },
        after: 0,
        retried: { direct: true, stream: true },
      },
    ],
    ['after H.264 there is nothing left to try', { ...COPY, video: 'h264' }, { direct: true, stream: true }, null],
    ['nothing is tried before the player knows what to play', { kind: 'pending' }, FRESH, null],
  ])('%s', (_, current, retried, next) => {
    expect(recover(current, 42, retried)).toEqual(next);
  });

  test('a stream keeps the audio track it was converting', () => {
    expect(recover({ ...COPY, audio: 3 }, 42, { direct: true, stream: true })?.mode).toMatchObject({ audio: 3 });
  });
});

describe('where a stream’s player counts from', () => {
  test.each([
    ['a player counting from zero, 5 s in', 600, 5.1, 5, 600],
    ['a player counting the file’s own time, 5 s in', 600, 605.1, 5, 0],
    ['a zero-based player held up by buffering', 600, 2, 30, 600],
    ['a file-time player held up by buffering', 600, 602, 30, 0],
    ['a stream from the start reads the same either way', 0, 5, 5, 0],
  ])('%s counts from %p', (_, from, currentTime, elapsed, base) => {
    expect(streamBase(from, currentTime, elapsed)).toBe(base);
  });
});

describe('whether the audio needs converting before the phone can play it', () => {
  const track = (stream: number, codec: string, isDefault = false) =>
    anAudioTrack({ stream, codec, default: isDefault });

  test.each<[string, AudioTrack[], number | null, boolean]>([
    ['DTS by default', [track(1, 'dts', true)], null, true],
    ['TrueHD by default', [track(1, 'truehd', true)], null, true],
    ['AAC by default', [track(1, 'aac', true)], null, false],
    ['with no default, the first track', [track(1, 'dts'), track(2, 'aac')], null, true],
    ['a picked AAC track beside a DTS default', [track(1, 'dts', true), track(2, 'aac')], 2, false],
    ['a picked DTS track beside an AAC default', [track(1, 'aac', true), track(2, 'DTS-HD MA')], 2, true],
    ['no audio at all', [], null, false],
  ])('%s', (_, audio, picked, converts) => {
    expect(needsAudioConversion(aMedia({ audio }), picked)).toBe(converts);
  });
});

describe('the source the player is handed', () => {
  const play = aPlay({
    id: 'a1',
    video: { index: 2, path: 'Sintel.mkv', size: 100, url: '/a1/2/Sintel.mkv', offset: 0 },
  });

  const metadata = { title: 'Sintel' };

  test('nothing while the player waits to know what to play', () => {
    expect(sourceFor(LINK, play, { kind: 'pending' }, metadata)).toBe(null);
  });

  test('the file itself, with the device cookie', () => {
    expect(sourceFor({ ...LINK, token: 'ab' }, play, { kind: 'direct' }, metadata)).toEqual({
      uri: `${LINK.base}/a1/2/Sintel.mkv`,
      headers: { Cookie: 'torrential_device=ab' },
      metadata,
      contentType: 'progressive',
    });
  });

  test('a file name the engine already encoded is sent as the engine wrote it', () => {
    const named = aPlay({
      video: {
        index: 0,
        path: 'Sintel 2010 – été.mkv',
        size: 100,
        url: '/a1/0/Sintel%202010%20%E2%80%93%20%C3%A9t%C3%A9.mkv',
        offset: 0,
      },
    });

    expect(sourceFor(LINK, named, { kind: 'direct' }, metadata)?.uri).toBe(
      `${LINK.base}/a1/0/Sintel%202010%20%E2%80%93%20%C3%A9t%C3%A9.mkv`,
    );
  });

  test('on Android a stream is the engine’s one fragmented MP4, from where it starts', () => {
    const source = sourceFor(LINK, play, { ...COPY, from: 61.5, audio: 3 }, metadata);

    expect(source).toMatchObject({ contentType: 'progressive' });
    expect(source?.uri).toBe(`${LINK.base}/api/stream?id=a1&file=2&t=61.500&video=copy&audio=3`);
  });

  test('a stream with no audio picked leaves the track to the engine', () => {
    expect(sourceFor(LINK, play, COPY, metadata)?.uri).toBe(`${LINK.base}/api/stream?id=a1&file=2&t=10.000&video=copy`);
  });
});
