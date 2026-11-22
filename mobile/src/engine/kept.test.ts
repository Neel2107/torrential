import { expect, test } from '@jest/globals';

import { keepReply, keptOptions, keptReply } from './kept';

const PHONE = { base: 'http://127.0.0.1:47929', token: 'secret' };
const COMPUTER = { base: 'http://192.168.1.20:47919', token: 'device' };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('a reply kept for an engine is read back for that engine only', async () => {
  keepReply(PHONE, '/api/home', { continue: [], saved: [{ id: 'tt0063350' }] });
  await settle();

  expect(keptReply(PHONE, '/api/home')?.data).toEqual({ continue: [], saved: [{ id: 'tt0063350' }] });
  expect(keptReply(COMPUTER, '/api/home')).toBeUndefined();
  expect(keptReply(PHONE, '/api/titles/popular?kind=film')).toBeUndefined();
});

test('a query starts from the kept reply and knows how old it is', async () => {
  keepReply(PHONE, '/api/titles/popular?kind=series', { titles: [] });
  await settle();
  const options = keptOptions<{ titles: [] }>(PHONE, '/api/titles/popular?kind=series');

  expect(options.initialData()).toEqual({ titles: [] });
  expect(options.initialDataUpdatedAt()).toBeGreaterThan(0);
});

test('with nothing kept, a query starts empty', () => {
  expect(keptOptions(COMPUTER, '/api/home').initialData()).toBeUndefined();
});
