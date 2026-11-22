import { expect, test } from '@jest/globals';

import { remembered } from './recent';

test.each<[string, string[], string, string[]]>([
  ['a new search goes first', ['sintel'], 'tears of steel', ['tears of steel', 'sintel']],
  ['a search made again moves to the front', ['a', 'b', 'c'], 'c', ['c', 'a', 'b']],
  ['a search made again in another case replaces the old one', ['Sintel', 'b'], 'SINTEL', ['SINTEL', 'b']],
  ['spaces around a search are dropped', [], '  sintel  ', ['sintel']],
  ['a blank search changes nothing', ['a'], '   ', ['a']],
  [
    'only the newest 8 are kept',
    ['1', '2', '3', '4', '5', '6', '7', '8'],
    '9',
    ['9', '1', '2', '3', '4', '5', '6', '7'],
  ],
])('%s', (_, previous, query, next) => {
  expect(remembered(previous, query)).toEqual(next);
});
