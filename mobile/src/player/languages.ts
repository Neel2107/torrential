/** Hermes has no Intl.DisplayNames, so the languages films most often carry are named here. */
const NAMES = new Map(
  Object.entries({
    en: 'English',
    eng: 'English',
    es: 'Spanish',
    spa: 'Spanish',
    fr: 'French',
    fre: 'French',
    fra: 'French',
    de: 'German',
    ger: 'German',
    deu: 'German',
    it: 'Italian',
    ita: 'Italian',
    pt: 'Portuguese',
    por: 'Portuguese',
    ru: 'Russian',
    rus: 'Russian',
    ja: 'Japanese',
    jpn: 'Japanese',
    ko: 'Korean',
    kor: 'Korean',
    zh: 'Chinese',
    chi: 'Chinese',
    zho: 'Chinese',
    hi: 'Hindi',
    hin: 'Hindi',
    ar: 'Arabic',
    ara: 'Arabic',
    nl: 'Dutch',
    dut: 'Dutch',
    nld: 'Dutch',
    sv: 'Swedish',
    swe: 'Swedish',
    no: 'Norwegian',
    nor: 'Norwegian',
    nb: 'Norwegian',
    nob: 'Norwegian',
    da: 'Danish',
    dan: 'Danish',
    fi: 'Finnish',
    fin: 'Finnish',
    pl: 'Polish',
    pol: 'Polish',
    tr: 'Turkish',
    tur: 'Turkish',
    el: 'Greek',
    gre: 'Greek',
    ell: 'Greek',
    he: 'Hebrew',
    heb: 'Hebrew',
    cs: 'Czech',
    cze: 'Czech',
    ces: 'Czech',
    hu: 'Hungarian',
    hun: 'Hungarian',
    ro: 'Romanian',
    rum: 'Romanian',
    ron: 'Romanian',
    th: 'Thai',
    tha: 'Thai',
    vi: 'Vietnamese',
    vie: 'Vietnamese',
    id: 'Indonesian',
    ind: 'Indonesian',
    ms: 'Malay',
    may: 'Malay',
    msa: 'Malay',
    uk: 'Ukrainian',
    ukr: 'Ukrainian',
    ta: 'Tamil',
    tam: 'Tamil',
    te: 'Telugu',
    tel: 'Telugu',
    bn: 'Bengali',
    ben: 'Bengali',
    gu: 'Gujarati',
    guj: 'Gujarati',
    mr: 'Marathi',
    mar: 'Marathi',
    ml: 'Malayalam',
    mal: 'Malayalam',
    kn: 'Kannada',
    kan: 'Kannada',
    pa: 'Punjabi',
    pan: 'Punjabi',
    ur: 'Urdu',
    urd: 'Urdu',
    fa: 'Persian',
    per: 'Persian',
    fas: 'Persian',
  }),
);

export function languageLabel(tag: string): string {
  const [base = tag, region] = tag.toLowerCase().split(/[-_]/);
  const named = languageName(base);
  const name = named && named !== base ? named : base.toUpperCase();

  return region ? `${name} (${region.toUpperCase()})` : name;
}

export function phoneLanguage(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase();
  } catch {
    return null;
  }
}

export function languageName(code: string | null | undefined): string | null {
  if (!code || code === 'und') return null;
  const base = code.toLowerCase().split(/[-_]/)[0]!;

  return NAMES.get(base) ?? code;
}

/** Whether two language tags name the same language, whatever their form: `en`, `eng` and `en-US` agree. */
export function sameLanguage(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const base = (tag: string) => tag.toLowerCase().split(/[-_]/)[0]!;

  return (NAMES.get(base(a)) ?? base(a)) === (NAMES.get(base(b)) ?? base(b));
}

/** The language a subtitle file's name gives, such as `en` in `film.en.srt` or `English` in `English.srt`. */
export function languageInName(name: string): string | null {
  const words = name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

  for (const word of words.reverse()) {
    if (word.length <= 3 && NAMES.has(word)) return word;
    const code = [...NAMES].find(([, name]) => name.toLowerCase() === word)?.[0];

    if (code) return code;
  }

  return null;
}
