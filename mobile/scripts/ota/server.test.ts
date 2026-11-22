/// <reference types="node" />

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createOtaServer, negotiate, type Manifest } from './server';

const RUNTIME = 'f7ad18300e794548ba88aa7253c43450f11b7eba';
const BUNDLE = 'console.log("torrential")';
const ICON = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const ICON_MD5 = createHash('md5').update(ICON).digest('hex');
const ANDROID_HEADERS = {
  accept: 'multipart/mixed,application/expo+json,application/json',
  'expo-platform': 'android',
  'expo-protocol-version': '1',
  'expo-runtime-version': RUNTIME,
};

let root: string;
let base: string;
let close: () => void;

function publish(publishedAt: number, bundle: string) {
  const dir = join(root, RUNTIME, String(publishedAt));
  mkdirSync(join(dir, '_expo/static/js/android'), { recursive: true });
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, '_expo/static/js/android/entry-1.hbc'), bundle);
  writeFileSync(join(dir, `assets/${ICON_MD5}`), ICON);
  writeFileSync(
    join(dir, 'expoConfig.json'),
    JSON.stringify({ name: 'torrential preview', extra: { commit: 'abc1234' } }),
  );
  writeFileSync(
    join(dir, 'metadata.json'),
    JSON.stringify({
      version: 0,
      bundler: 'metro',
      fileMetadata: {
        android: {
          bundle: '_expo/static/js/android/entry-1.hbc',
          assets: [{ path: `assets/${ICON_MD5}`, ext: 'png' }],
        },
      },
    }),
  );
}

function base64urlSha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('base64url');
}

function parts(response: Response, body: string) {
  const boundary = /boundary=([^;]+)/.exec(response.headers.get('content-type') ?? '')?.[1];
  if (!boundary) throw new Error('no multipart boundary');
  expect(body.endsWith(`--${boundary}--\r\n`)).toBe(true);
  return body
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((raw) => {
      const [head, ...rest] = raw.replace(/^\r\n/, '').split('\r\n\r\n');
      const name = /name="([^"]+)"/.exec(head)?.[1];
      return { name, head: head.toLowerCase(), body: rest.join('\r\n\r\n').replace(/\r\n$/, '') };
    });
}

async function askForUpdate(headers: Record<string, string> = ANDROID_HEADERS) {
  const response = await fetch(`${base}/manifest`, { headers });
  return { response, body: await response.text() };
}

async function latestManifest() {
  const { response, body } = await askForUpdate();
  const manifestPart = parts(response, body).find((part) => part.name === 'manifest');
  if (!manifestPart) throw new Error('no manifest part');
  const manifest: Manifest = JSON.parse(manifestPart.body);
  return manifest;
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'torrential-ota-'));
  publish(1_700_000_000_000, 'console.log("older")');
  publish(1_700_000_100_000, BUNDLE);
  const server = createOtaServer(root);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
  process.env.OTA_QUIET = '1';
});

afterAll(() => {
  close();
  rmSync(root, { recursive: true, force: true });
});

describe('the manifest request', () => {
  it('answers with the protocol headers and a multipart body of manifest and extensions', async () => {
    const { response, body } = await askForUpdate();

    expect(response.status).toBe(200);
    expect(response.headers.get('expo-protocol-version')).toBe('1');
    expect(response.headers.get('expo-sfv-version')).toBe('0');
    expect(response.headers.get('cache-control')).toBe('private, max-age=0');
    expect(response.headers.get('content-type')).toMatch(/^multipart\/mixed; boundary=/);
    const received = parts(response, body);
    expect(received.map((part) => part.name)).toEqual(['manifest', 'extensions']);
    expect(received.every((part) => part.head.includes('content-type: application/json'))).toBe(true);
    expect(JSON.parse(received[1].body)).toEqual({ assetRequestHeaders: {} });
  });

  it('describes the newest update for the runtime version, with its config for expo-constants', async () => {
    const manifest = await latestManifest();

    expect(manifest.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(manifest.createdAt).toBe(new Date(1_700_000_100_000).toISOString());
    expect(manifest.runtimeVersion).toBe(RUNTIME);
    expect(manifest.metadata).toEqual({});
    expect(manifest.extra).toEqual({ expoClient: { name: 'torrential preview', extra: { commit: 'abc1234' } } });
  });

  it('gives the bundle as the launch asset and every other file with its key, hash and extension', async () => {
    const manifest = await latestManifest();

    expect(manifest.launchAsset).toEqual({
      hash: base64urlSha256(BUNDLE),
      key: createHash('md5').update(BUNDLE).digest('hex'),
      contentType: 'application/javascript',
      url: `${base}/assets/${RUNTIME}/1700000100000/_expo/static/js/android/entry-1.hbc`,
    });
    expect(manifest.assets).toEqual([
      {
        hash: base64urlSha256(ICON),
        key: ICON_MD5,
        contentType: 'image/png',
        fileExtension: '.png',
        url: `${base}/assets/${RUNTIME}/1700000100000/assets/${ICON_MD5}`,
      },
    ]);
  });

  it('says there is no update when the phone already runs the newest one', async () => {
    const { id } = await latestManifest();
    const { response, body } = await askForUpdate({ ...ANDROID_HEADERS, 'expo-current-update-id': id });

    expect(response.status).toBe(200);
    expect(response.headers.get('expo-protocol-version')).toBe('1');
    const received = parts(response, body);
    expect(received.map((part) => part.name)).toEqual(['directive']);
    expect(JSON.parse(received[0].body)).toEqual({ type: 'noUpdateAvailable' });
  });

  it('says there is no update for a runtime version nothing was published for', async () => {
    const { response, body } = await askForUpdate({ ...ANDROID_HEADERS, 'expo-runtime-version': 'another-build' });

    expect(JSON.parse(parts(response, body)[0].body)).toEqual({ type: 'noUpdateAvailable' });
  });

  it('says there is no update for a platform the export left out', async () => {
    const { response, body } = await askForUpdate({ ...ANDROID_HEADERS, 'expo-platform': 'ios' });

    expect(JSON.parse(parts(response, body)[0].body)).toEqual({ type: 'noUpdateAvailable' });
  });

  it('sends the manifest alone as JSON to a client that only accepts JSON', async () => {
    const { response, body } = await askForUpdate({ ...ANDROID_HEADERS, accept: 'application/expo+json' });

    expect(response.headers.get('content-type')).toBe('application/expo+json');
    expect(JSON.parse(body).runtimeVersion).toBe(RUNTIME);
  });

  it('refuses a request without a platform or runtime version, or one it cannot answer in', async () => {
    const { 'expo-platform': _platform, ...noPlatform } = ANDROID_HEADERS;
    const { 'expo-runtime-version': _runtime, ...noRuntime } = ANDROID_HEADERS;

    expect((await askForUpdate(noPlatform)).response.status).toBe(400);
    expect((await askForUpdate(noRuntime)).response.status).toBe(400);
    expect((await askForUpdate({ ...ANDROID_HEADERS, accept: 'text/html' })).response.status).toBe(406);
  });
});

describe('an asset request', () => {
  it('serves the bytes the manifest hashed, compressed when asked, and cacheable for good', async () => {
    const manifest = await latestManifest();

    const plain = await fetch(manifest.launchAsset.url, { headers: { 'accept-encoding': 'identity' } });
    expect(plain.headers.get('content-type')).toBe('application/javascript');
    expect(plain.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(base64urlSha256(Buffer.from(await plain.arrayBuffer()))).toBe(manifest.launchAsset.hash);

    const icon = await fetch(manifest.assets[0].url);
    expect(icon.headers.get('content-type')).toBe('image/png');
    expect(base64urlSha256(Buffer.from(await icon.arrayBuffer()))).toBe(manifest.assets[0].hash);
  });

  it('compresses with brotli or gzip, as the client asks', async () => {
    const manifest = await latestManifest();
    const { request } = await import('node:http');
    const raw = (encoding: string) =>
      new Promise<{ encoding?: string; body: Buffer }>((done, fail) => {
        request(manifest.launchAsset.url, { headers: { 'accept-encoding': encoding } }, (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            done({ encoding: response.headers['content-encoding'], body: Buffer.concat(chunks) }),
          );
        })
          .on('error', fail)
          .end();
      });

    const br = await raw('zstd, br, gzip');
    expect(br.encoding).toBe('br');
    expect(brotliDecompressSync(br.body).toString()).toBe(BUNDLE);
    const gzip = await raw('gzip');
    expect(gzip.encoding).toBe('gzip');
    expect(gunzipSync(gzip.body).toString()).toBe(BUNDLE);
  });

  it('serves nothing outside what an update lists', async () => {
    const folder = `${base}/assets/${RUNTIME}/1700000100000`;

    expect((await fetch(`${folder}/metadata.json`)).status).toBe(404);
    expect((await fetch(`${folder}/expoConfig.json`)).status).toBe(404);
    expect((await fetch(`${folder}/..%2F..%2F..%2Fetc%2Fpasswd`)).status).toBe(404);
    expect((await fetch(`${base}/assets/..%2F${RUNTIME}/1700000100000/assets/${ICON_MD5}`)).status).toBe(404);
  });
});

describe('choosing how to answer', () => {
  it('prefers multipart on a tie, since only it can say there is no update', () => {
    expect(negotiate('application/expo+json, application/json, multipart/mixed')?.structure).toBe('multipart');
    expect(negotiate(undefined)?.structure).toBe('multipart');
  });

  it('follows the q values the client sends', () => {
    expect(negotiate('application/expo+json;q=0.9, application/json;q=0.8, multipart/mixed;q=0.1')).toEqual({
      structure: 'json',
      contentType: 'application/expo+json',
    });
    expect(negotiate('multipart/mixed;q=0, application/json')?.contentType).toBe('application/json');
  });
});
