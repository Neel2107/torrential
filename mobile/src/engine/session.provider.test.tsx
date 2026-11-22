import { afterEach, describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { keychain, SessionProvider, useSession } from './session';

const kept = { ...keychain };

afterEach(() => {
  Object.assign(keychain, kept);
});

const computer = {
  id: 'http://192.168.1.5:47919',
  name: '192.168.1.5',
  kind: 'computer',
  link: { base: 'http://192.168.1.5:47919', token: 'f'.repeat(64) },
};

/** Keeps the keychain in memory, starting from `stored`; `held` names keys whose first read waits until `release` is called. */
function inMemory(stored: Record<string, string>, held: string[] = []) {
  const values = new Map(Object.entries(stored));
  const waiting: (() => void)[] = [];

  keychain.get = (key) => {
    const value = values.get(key) ?? null;

    if (!held.includes(key)) return Promise.resolve(value);

    held.splice(held.indexOf(key), 1);

    return new Promise((resolve) => waiting.push(() => resolve(value)));
  };

  keychain.set = async (key, value) => {
    values.set(key, value);
  };

  keychain.remove = async (key) => {
    values.delete(key);
  };

  return { values, release: () => waiting.splice(0).forEach((resolve) => resolve()) };
}

function Engines() {
  const { session, engines, connectOverUsb } = useSession();

  return (
    <>
      <Text>{session.state === 'paired' ? `Using ${session.engine.name}` : session.state}</Text>
      <Text>{`Engines: ${engines.map((engine) => engine.name).join(', ')}`}</Text>
      <Pressable onPress={() => connectOverUsb()}>
        <Text>Connect over USB</Text>
      </Pressable>
    </>
  );
}

const storedEngines = (values: Map<string, string>) => {
  const text = values.get('engines');

  return text ? JSON.parse(text) : null;
};

describe('the engines this phone has paired with', () => {
  test('are read back as they were saved, using the active one', async () => {
    inMemory({ engines: JSON.stringify({ engines: [computer], active: computer.id }) });
    await render(
      <SessionProvider>
        <Engines />
      </SessionProvider>,
    );

    expect(await screen.findByText('Using 192.168.1.5')).toBeOnTheScreen();
  });

  test('none saved leaves the phone unpaired', async () => {
    inMemory({});
    await render(
      <SessionProvider>
        <Engines />
      </SessionProvider>,
    );

    expect(await screen.findByText('unpaired')).toBeOnTheScreen();
  });

  test('a link saved before there were several engines becomes the one engine, under the new key once changed', async () => {
    const { values } = inMemory({ 'engine-link': JSON.stringify(computer.link) });
    await render(
      <SessionProvider>
        <Engines />
      </SessionProvider>,
    );

    expect(await screen.findByText('Using 192.168.1.5')).toBeOnTheScreen();
    expect(values.has('engine-link')).toBe(true);

    await fireEvent.press(screen.getByText('Connect over USB'));

    expect(await screen.findByText('Engines: 192.168.1.5, Computer over USB')).toBeOnTheScreen();
    expect(values.has('engine-link')).toBe(false);
    expect(storedEngines(values).engines.map((engine: { name: string }) => engine.name)).toEqual([
      '192.168.1.5',
      'Computer over USB',
    ]);
  });

  test('an old link that no longer reads leaves the phone unpaired', async () => {
    inMemory({ 'engine-link': '{"base":' });
    await render(
      <SessionProvider>
        <Engines />
      </SessionProvider>,
    );

    expect(await screen.findByText('unpaired')).toBeOnTheScreen();
  });
});
