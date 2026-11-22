import { expect, test } from '@jest/globals';

import { parsePairing } from './session';

test('an address with a code gives the engine on its port and the code', () => {
  expect(parsePairing('192.168.1.5#123456')).toEqual({ base: 'http://192.168.1.5:47919', code: '123456' });
});

test('an address without a code still pairs, by asking for the code', () => {
  expect(parsePairing('  192.168.1.5  ')).toEqual({ base: 'http://192.168.1.5:47919', code: null });
});

test('a bare IPv6 address is bracketed', () => {
  expect(parsePairing('fe80::1')).toEqual({ base: 'http://[fe80::1]:47919', code: null });
});

test('a port given in the address is kept', () => {
  expect(parsePairing('http://engine.local:8080#654321')).toEqual({ base: 'http://engine.local:8080', code: '654321' });
});

test('an https address uses https’s own port', () => {
  expect(parsePairing('https://engine.example.com')).toEqual({ base: 'https://engine.example.com', code: null });
});

test('a code that is not six digits is no code', () => {
  expect(parsePairing('192.168.1.5#12345')?.code).toBe(null);
  expect(parsePairing('192.168.1.5#abcdef')?.code).toBe(null);
});

test('nothing, or something that is not an address, gives nothing', () => {
  expect(parsePairing('   ')).toBe(null);
  expect(parsePairing('http://[')).toBe(null);
});
