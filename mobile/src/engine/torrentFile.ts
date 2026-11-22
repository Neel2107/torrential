import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

/** A .torrent file's infohash is the SHA-1 of its bencoded `info` dictionary, exactly as stored in the file. */
export async function magnetFromTorrentFile(uri: string): Promise<string> {
  const bytes = await new File(uri).bytes();
  const { info, name, trackers } = scan(bytes);
  const hash = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA1, bytes.slice(info[0], info[1])));
  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
  const params = [`xt=urn:btih:${hex}`];
  if (name) params.push(`dn=${encodeURIComponent(name)}`);
  for (const tracker of trackers.slice(0, 8)) params.push(`tr=${encodeURIComponent(tracker)}`);
  return `magnet:?${params.join('&')}`;
}

type Scan = { info: [number, number]; name: string | null; trackers: string[] };

function scan(data: Uint8Array): Scan {
  const text = new TextDecoder();
  let at = 0;
  let info: [number, number] | null = null;
  let name: string | null = null;
  const trackers: string[] = [];

  const broken = () => new Error('This .torrent file is damaged or cut short.');
  const byte = (): number => {
    if (at >= data.length) throw broken();
    return data[at]!;
  };

  const digits = (until: number): number => {
    let n = 0;
    let negative = false;
    if (byte() === 0x2d) {
      negative = true;
      at++;
    }
    while (byte() !== until) {
      const d = data[at]! - 0x30;
      if (d < 0 || d > 9) throw broken();
      n = n * 10 + d;
      at++;
    }
    at++;
    return negative ? -n : n;
  };

  const bytesAt = (): Uint8Array => {
    const length = digits(0x3a);
    if (length < 0 || at + length > data.length) throw broken();
    const out = data.subarray(at, at + length);
    at += length;
    return out;
  };

  const value = (path: string): unknown => {
    const kind = byte();
    if (kind === 0x69) {
      at++;
      return digits(0x65);
    }
    if (kind === 0x6c) {
      at++;
      const list: unknown[] = [];
      while (byte() !== 0x65) list.push(value(`${path}[]`));
      at++;
      return list;
    }
    if (kind === 0x64) {
      at++;
      while (byte() !== 0x65) {
        const key = text.decode(bytesAt());
        const start = at;
        const child = value(`${path}.${key}`);
        if (path === '' && key === 'info') info = [start, at];
        if (path === '' && key === 'announce' && child instanceof Uint8Array) trackers.unshift(text.decode(child));
        if (path === '' && key === 'announce-list' && Array.isArray(child)) {
          for (const tier of child)
            if (Array.isArray(tier)) for (const t of tier) if (t instanceof Uint8Array) trackers.push(text.decode(t));
        }
        if (path === '.info' && key === 'name' && child instanceof Uint8Array) name = text.decode(child);
      }
      at++;
      return null;
    }
    if (kind >= 0x30 && kind <= 0x39) return bytesAt();
    throw new Error('This is not a .torrent file.');
  };

  value('');
  if (!info) throw new Error('This .torrent file has no info dictionary.');
  return { info, name, trackers: [...new Set(trackers)] };
}

export function findTorrent(text: string): string | null {
  const magnet = /magnet:\?[^\s"'<>]+/i.exec(text)?.[0];
  if (magnet) return magnet;
  const url = /https?:\/\/[^\s"'<>]+\.torrent(\?[^\s"'<>]*)?/i.exec(text)?.[0];
  if (url) return url;
  const hash = /\b([0-9a-f]{40}|[a-z2-7]{32})\b/i.exec(text.trim())?.[1];
  return hash ?? null;
}
