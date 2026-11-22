import { describe, expect, test } from '@jest/globals';

import { languageInName, languageLabel, languageName, sameLanguage } from './languages';

describe('naming a language', () => {
  test.each([
    ['en', 'English'],
    ['eng', 'English'],
    ['pt-BR', 'Portuguese (BR)'],
    ['zh_tw', 'Chinese (TW)'],
    ['xx', 'XX'],
  ])('the tag %p reads as %p', (tag, label) => {
    expect(languageLabel(tag)).toBe(label);
  });

  test('a track with no language, or "und", has no name', () => {
    expect(languageName(null)).toBe(null);
    expect(languageName(undefined)).toBe(null);
    expect(languageName('und')).toBe(null);
  });

  test('a code the app does not know keeps its code', () => {
    expect(languageName('tlh')).toBe('tlh');
  });
});

describe('matching languages', () => {
  test.each([
    ['en', 'eng'],
    ['en-US', 'en-GB'],
    ['fre', 'fra'],
    ['DE', 'ger'],
  ])('%p and %p are the same language', (a, b) => {
    expect(sameLanguage(a, b)).toBe(true);
  });

  test('different languages, or a missing one, do not match', () => {
    expect(sameLanguage('fr', 'de')).toBe(false);
    expect(sameLanguage(null, 'en')).toBe(false);
    expect(sameLanguage('en', undefined)).toBe(false);
  });
});

describe('the language in a subtitle file name', () => {
  test.each([
    ['Sintel.2010.en.srt', 'en'],
    ['English.srt', 'en'],
    ['Night.of.the.Living.Dead.1968.FRENCH.srt', 'fr'],
    ['Tears.of.Steel.de.en.srt', 'en'],
  ])('%p is in %p', (name, language) => {
    expect(languageInName(name)).toBe(language);
  });

  test('a name that gives no language gives none', () => {
    expect(languageInName('Big.Buck.Bunny.2008.srt')).toBe(null);
  });
});
