import { expect, test } from '@jest/globals';

import { qualityOf } from './quality';

const labels = (name: string) => qualityOf(name).map((tag) => tag.label);

test('a release name gives its resolution, range, codec and source, in that order', () => {
  expect(labels('Sintel.2010.WEB-DL.x265.HDR10.2160p')).toEqual(['4K', 'HDR', 'HEVC', 'WEB']);
});

test('4K is the only tag drawn strong', () => {
  expect(qualityOf('Tears.of.Steel.2012.2160p.UHD.BluRay')).toEqual([
    { label: '4K', strong: true },
    { label: 'Blu-ray' },
  ]);
  expect(qualityOf('Tears.of.Steel.2012.1080p')).toEqual([{ label: '1080p' }]);
});

test('each kind shows one tag, the most telling one', () => {
  expect(labels('Sintel.2010.2160p.DV.HDR.BluRay.REMUX.HEVC')).toEqual(['4K', 'Dolby Vision', 'HEVC', 'Remux']);
});

test('tags are found whatever separates the words', () => {
  expect(labels('Big Buck Bunny (2008) [1080p] [BluRay] [x264]')).toEqual(['1080p', 'H.264', 'Blu-ray']);
  expect(labels('big_buck_bunny_720p_h264')).toEqual(['720p', 'H.264']);
});

test('letters inside a word are not a tag', () => {
  expect(labels('Night.of.the.Living.Dead.1968.Adventure.Edition')).toEqual([]);
});

test('a name with no tags gives none', () => {
  expect(qualityOf('Night of the Living Dead')).toEqual([]);
});
