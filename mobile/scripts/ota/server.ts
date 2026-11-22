/// <reference types="node" />

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

/**
 * A server for the expo-updates protocol, version 1 (https://docs.expo.dev/technical-specs/expo-updates-1/),
 * for "torrential preview" on the owner's phones. It serves what `scripts/ota-publish.sh` put in `root`:
 *
 *   <root>/<runtime version>/<published at, ms since epoch>/  an `expo export`, plus expoConfig.json
 *
 * The newest folder for the phone's runtime version is the update. Asset URLs name the folder, so they
 * never change once published.
 */

type Platform = 'android' | 'ios';

type ExportedAsset = { path: string; ext: string };

type ExportMetadata = {
  fileMetadata: Partial<Record<Platform, { bundle: string; assets: ExportedAsset[] }>>;
};

export type Asset = { hash: string; key: string; contentType: string; fileExtension?: string; url: string };

export type Manifest = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: Asset;
  assets: Asset[];
  metadata: Record<string, string>;
  extra: { expoClient?: unknown };
};

type Update = { runtimeVersion: string; folder: string; dir: string; createdAt: Date; id: string };

type Reply = { status: number; headers: Record<string, string>; body: Buffer | string };

/** A runtime version as app config allows it, which also keeps it to one path segment. */
const RUNTIME_VERSION = /^[a-zA-Z\d][a-zA-Z\d._+()-]{0,254}$/;
const PUBLISHED_AT = /^\d+$/;

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  json: 'application/json',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  wav: 'audio/wav',
};

function sha256(data: Buffer | string) {
  return createHash('sha256').update(data);
}

function base64url(data: Buffer) {
  return data.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** The update's UUID comes from what it serves, so publishing the same export twice is one update. */
function updateId(dir: string) {
  const hex = sha256(readFileSync(join(dir, 'metadata.json')))
    .update(readExpoConfigBytes(dir))
    .digest('hex');
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function readExpoConfigBytes(dir: string) {
  const path = join(dir, 'expoConfig.json');
  return existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
}

export function latestUpdate(root: string, runtimeVersion: string): Update | null {
  if (!RUNTIME_VERSION.test(runtimeVersion)) return null;
  const versionDir = join(root, runtimeVersion);
  if (!existsSync(versionDir)) return null;

  const folder = readdirSync(versionDir)
    .filter((name) => PUBLISHED_AT.test(name) && existsSync(join(versionDir, name, 'metadata.json')))
    .sort((a, b) => Number(b) - Number(a))[0];
  if (!folder) return null;

  const dir = join(versionDir, folder);
  return { runtimeVersion, folder, dir, createdAt: new Date(Number(folder)), id: updateId(dir) };
}

function readMetadata(update: Update): ExportMetadata {
  return JSON.parse(readFileSync(join(update.dir, 'metadata.json'), 'utf8'));
}

function assetUrl(baseUrl: string, update: Update, path: string) {
  const segments = [update.runtimeVersion, update.folder, ...path.split('/')].map(encodeURIComponent);
  return `${baseUrl}/assets/${segments.join('/')}`;
}

function describeAsset(baseUrl: string, update: Update, path: string, contentType: string, ext?: string): Asset {
  const bytes = readFileSync(join(update.dir, path));
  return {
    hash: base64url(sha256(bytes).digest()),
    key: createHash('md5').update(bytes).digest('hex'),
    contentType,
    ...(ext !== undefined && { fileExtension: `.${ext}` }),
    url: assetUrl(baseUrl, update, path),
  };
}

export function manifestFor(update: Update, platform: Platform, baseUrl: string): Manifest | null {
  const files = readMetadata(update).fileMetadata[platform];
  if (!files) return null;
  const expoConfig = readExpoConfigBytes(update.dir);

  return {
    id: update.id,
    createdAt: update.createdAt.toISOString(),
    runtimeVersion: update.runtimeVersion,
    launchAsset: describeAsset(baseUrl, update, files.bundle, 'application/javascript'),
    assets: files.assets.map((asset) =>
      describeAsset(baseUrl, update, asset.path, CONTENT_TYPES[asset.ext] ?? 'application/octet-stream', asset.ext),
    ),
    metadata: {},
    extra: expoConfig.length > 0 ? { expoClient: JSON.parse(expoConfig.toString('utf8')) } : {},
  };
}

type Structure = 'multipart' | 'json';

/** Picks the response structure from `accept`; multipart wins a tie because only it can carry a directive. */
export function negotiate(accept: string | undefined): { structure: Structure; contentType: string } | null {
  const offered = (accept ?? '*/*').split(',').map((entry) => {
    const [type, ...params] = entry.split(';').map((part) => part.trim().toLowerCase());
    const q = params.find((param) => param.startsWith('q='));
    return { type, q: q ? Number(q.slice(2)) : 1 };
  });
  const quality = (type: string) =>
    Math.max(
      0,
      ...offered
        .filter((entry) => entry.type === type || entry.type === '*/*' || entry.type === `${type.split('/')[0]}/*`)
        .map((entry) => entry.q),
    );

  const choices = [
    { structure: 'multipart' as const, contentType: 'multipart/mixed', q: quality('multipart/mixed') },
    { structure: 'json' as const, contentType: 'application/expo+json', q: quality('application/expo+json') },
    { structure: 'json' as const, contentType: 'application/json', q: quality('application/json') },
  ].filter((choice) => choice.q > 0);
  const best = choices.sort((a, b) => b.q - a.q)[0];
  return best ? { structure: best.structure, contentType: best.contentType } : null;
}

function multipart(parts: { name: string; body: string }[]) {
  const boundary = `ota-${sha256(parts.map((part) => part.body).join('\n'))
    .digest('hex')
    .slice(0, 24)}`;
  const body =
    parts
      .map(
        (part) =>
          `--${boundary}\r\ncontent-disposition: form-data; name="${part.name}"\r\n` +
          `content-type: application/json; charset=utf-8\r\n\r\n${part.body}\r\n`,
      )
      .join('') + `--${boundary}--\r\n`;
  return { contentType: `multipart/mixed; boundary=${boundary}`, body };
}

function protocolHeaders(protocolVersion: number) {
  return {
    'expo-protocol-version': String(protocolVersion),
    'expo-sfv-version': '0',
    'cache-control': 'private, max-age=0',
  };
}

function error(status: number, message: string): Reply {
  return {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=0' },
    body: JSON.stringify({ error: message }),
  };
}

function header(request: IncomingMessage, name: string) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function manifestReply(root: string, request: IncomingMessage, baseUrl: string): Reply {
  const protocolVersion = Number.parseInt(header(request, 'expo-protocol-version') ?? '0', 10);
  if (protocolVersion !== 0 && protocolVersion !== 1) return error(400, 'Unsupported expo-protocol-version.');

  const platform = header(request, 'expo-platform');
  if (platform !== 'android' && platform !== 'ios') return error(400, 'expo-platform must be android or ios.');

  const runtimeVersion = header(request, 'expo-runtime-version');
  if (!runtimeVersion) return error(400, 'No expo-runtime-version.');

  const structure = negotiate(header(request, 'accept'));
  if (!structure) return error(406, 'Accept multipart/mixed, application/expo+json or application/json.');

  const update = latestUpdate(root, runtimeVersion);
  const manifest = update && manifestFor(update, platform, baseUrl);
  const current = header(request, 'expo-current-update-id')?.toLowerCase();
  const headers = protocolHeaders(protocolVersion);

  if (manifest && (protocolVersion === 0 || manifest.id !== current)) {
    const body = JSON.stringify(manifest);
    if (structure.structure === 'json') {
      return { status: 200, headers: { ...headers, 'content-type': structure.contentType }, body };
    }
    const reply = multipart([
      { name: 'manifest', body },
      { name: 'extensions', body: JSON.stringify({ assetRequestHeaders: {} }) },
    ]);
    return { status: 200, headers: { ...headers, 'content-type': reply.contentType }, body: reply.body };
  }

  if (protocolVersion === 0) return error(404, `Nothing published for runtime version ${runtimeVersion}.`);
  if (structure.structure === 'json') return error(406, 'No update; a directive needs multipart/mixed.');
  const reply = multipart([{ name: 'directive', body: JSON.stringify({ type: 'noUpdateAvailable' }) }]);
  return { status: 200, headers: { ...headers, 'content-type': reply.contentType }, body: reply.body };
}

const compressed = new Map<string, Buffer>();

function encodingFor(acceptEncoding: string | undefined) {
  const accepted = (acceptEncoding ?? '').split(',').map((entry) => entry.split(';')[0].trim().toLowerCase());
  if (accepted.includes('br')) return 'br';
  if (accepted.includes('gzip')) return 'gzip';
  return null;
}

function compress(path: string, bytes: Buffer, encoding: 'br' | 'gzip') {
  const cacheKey = `${encoding}:${path}`;
  const cached = compressed.get(cacheKey);
  if (cached) return cached;
  const result =
    encoding === 'br'
      ? brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      : gzipSync(bytes);
  if (compressed.size >= 64) compressed.clear();
  compressed.set(cacheKey, result);
  return result;
}

/** Serves only files an update's metadata.json lists, from inside that update's folder. */
export function assetReply(root: string, pathname: string, acceptEncoding: string | undefined): Reply {
  const [runtimeVersion, folder, ...rest] = pathname.split('/').map((segment) => decodeURIComponent(segment));
  if (!runtimeVersion || !RUNTIME_VERSION.test(runtimeVersion) || !folder || !PUBLISHED_AT.test(folder)) {
    return error(404, 'No such asset.');
  }
  const dir = resolve(root, runtimeVersion, folder);
  const relative = rest.join('/');
  const file = resolve(dir, relative);
  if (!file.startsWith(dir + sep) || !existsSync(join(dir, 'metadata.json'))) return error(404, 'No such asset.');

  const metadata: ExportMetadata = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf8'));
  const platforms = Object.values(metadata.fileMetadata);
  const isBundle = platforms.some((files) => files?.bundle === relative);
  const asset = platforms.flatMap((files) => files?.assets ?? []).find((entry) => entry.path === relative);
  if ((!isBundle && !asset) || !existsSync(file) || !statSync(file).isFile()) return error(404, 'No such asset.');

  const bytes = readFileSync(file);
  const contentType = isBundle
    ? 'application/javascript'
    : (CONTENT_TYPES[asset?.ext ?? ''] ?? 'application/octet-stream');
  const encoding = encodingFor(acceptEncoding);
  return {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
      vary: 'accept-encoding',
      ...(encoding && { 'content-encoding': encoding }),
    },
    body: encoding ? compress(file, bytes, encoding) : bytes,
  };
}

function send(response: ServerResponse, reply: Reply) {
  response.writeHead(reply.status, { ...reply.headers, 'content-length': String(Buffer.byteLength(reply.body)) });
  response.end(reply.body);
}

export function createOtaServer(root: string): Server {
  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://ota.invalid');
    const baseUrl = `http://${request.headers.host ?? 'localhost'}`;
    const started = Date.now();
    let reply: Reply;
    try {
      if (request.method !== 'GET') reply = error(405, 'Expected GET.');
      else if (url.pathname === '/manifest') reply = manifestReply(root, request, baseUrl);
      else if (url.pathname.startsWith('/assets/'))
        reply = assetReply(root, url.pathname.slice('/assets/'.length), header(request, 'accept-encoding'));
      else reply = error(404, 'Not found.');
    } catch (cause) {
      reply = error(500, cause instanceof Error ? cause.message : String(cause));
    }
    send(response, reply);
    if (process.env.OTA_QUIET !== '1') {
      const who = [header(request, 'expo-platform'), header(request, 'expo-runtime-version')?.slice(0, 12)];
      console.log(
        `${reply.status} ${request.method} ${url.pathname} ${who.filter(Boolean).join(' ')} ${Date.now() - started}ms`,
      );
    }
  });
}

/** Run directly: `node scripts/ota/server.ts`. OTA_HOST defaults to this machine's Tailscale address. */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.env.OTA_DIR ?? join(process.env.HOME ?? '.', '.local/share/torrential-ota'));
  const host = process.env.OTA_HOST ?? '100.87.229.89';
  const port = Number(process.env.OTA_PORT ?? 8790);
  createOtaServer(root).listen(port, host, () =>
    console.log(`torrential OTA: http://${host}:${port}/manifest serving ${root}`),
  );
}
