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

test.each([
  ['[fe80::1]', 'http://[fe80::1]:47919'],
  ['[fe80::1]:9000', 'http://[fe80::1]:9000'],
  ['http://[fe80::1]:8080', 'http://[fe80::1]:8080'],
  ['2001:db8::5', 'http://[2001:db8::5]:47919'],
])('the IPv6 address %p reaches the engine at %p', (input, base) => {
  expect(parsePairing(input)?.base).toBe(base);
});

test('a path after the address is dropped and the code is still read', () => {
  expect(parsePairing('http://192.168.1.5:47919/pair#123456')).toEqual({
    base: 'http://192.168.1.5:47919',
    code: '123456',
  });
  expect(parsePairing('engine.local/api#123456')).toEqual({ base: 'http://engine.local:47919', code: '123456' });
});

test('an https address keeps a port it names, and drops a trailing slash', () => {
  expect(parsePairing('https://engine.example.com:8443/')?.base).toBe('https://engine.example.com:8443');
  expect(parsePairing('https://engine.example.com/')?.base).toBe('https://engine.example.com');
});

test('the scheme and host are read in any case', () => {
  expect(parsePairing('HTTP://Engine.Local')?.base).toBe('http://engine.local:47919');
});

test('a port and code with no scheme are both kept', () => {
  expect(parsePairing('192.168.1.5:9000#123456')).toEqual({ base: 'http://192.168.1.5:9000', code: '123456' });
});

test('a bare IPv6 address with a code gives the engine and the code', () => {
  expect(parsePairing('fe80::1#123456')).toEqual({ base: 'http://[fe80::1]:47919', code: '123456' });
});

test('an http address that names port 80 keeps it', () => {
  expect(parsePairing('http://engine.local:80')?.base).toBe('http://engine.local');
});

test.each(['ftp://engine.local', 'torrential://pair?code=123456', 'file:///engine'])(
  'an address with a scheme other than http or https, %p, gives nothing',
  (input) => {
    expect(parsePairing(input)).toBe(null);
  },
);
