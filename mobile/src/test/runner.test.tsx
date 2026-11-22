import { expect, test } from '@jest/globals';
import { Platform } from 'react-native';

import { Meter } from '@/ui/Meter';

test('tests run as Android, the platform the app is judged on', () => {
  expect(Platform.OS).toBe('android');
});

test('components run compiled by React Compiler, as Metro compiles them for the phone', () => {
  expect(String(Meter)).toMatch(/_compilerRuntime\.c\)\(\d+\)/);
});
