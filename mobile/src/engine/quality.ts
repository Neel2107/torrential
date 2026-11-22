export type Tag = { label: string; strong?: boolean };

const RULES: { test: RegExp; tag: Tag }[] = [
  { test: /\b(2160p|4k\b|uhd\b)/, tag: { label: '4K', strong: true } },
  { test: /\b1080[pi]/, tag: { label: '1080p' } },
  { test: /\b720p/, tag: { label: '720p' } },
  { test: /\b(480p|576p|dvdrip|sdtv)\b/, tag: { label: 'SD' } },
  { test: /\b(dv|dovi|dolby vision)\b/, tag: { label: 'Dolby Vision' } },
  { test: /\bhdr(10)?\+?\b/, tag: { label: 'HDR' } },
  { test: /\b(x ?265|h ?265|hevc)\b/, tag: { label: 'HEVC' } },
  { test: /\bav1\b/, tag: { label: 'AV1' } },
  { test: /\b(x ?264|h ?264|avc)\b/, tag: { label: 'H.264' } },
  { test: /\bremux\b/, tag: { label: 'Remux' } },
  { test: /\b(blu ray|bluray|bdrip|brrip)\b/, tag: { label: 'Blu-ray' } },
  { test: /\bweb( ?dl| ?rip)?\b/, tag: { label: 'WEB' } },
];

const KINDS = [
  ['4K', '1080p', '720p', 'SD'],
  ['Dolby Vision', 'HDR'],
  ['HEVC', 'AV1', 'H.264'],
  ['Remux', 'Blu-ray', 'WEB'],
];

export function qualityOf(name: string): Tag[] {
  const plain = ` ${name.toLowerCase().replace(/[._\-[\]()]+/g, ' ')} `;
  const found = RULES.flatMap((rule) => (rule.test.test(plain) ? [rule.tag] : []));

  return KINDS.flatMap((kind) => found.filter((tag) => kind.includes(tag.label)).slice(0, 1));
}
