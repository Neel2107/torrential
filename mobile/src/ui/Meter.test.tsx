import { expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { Meter } from './Meter';

test.each([
  [0.42, 42],
  [1.4, 100],
  [-0.2, 0],
])('a meter at %p tells a screen reader %p percent', async (fraction, percent) => {
  await render(<Meter fraction={fraction} />);

  expect(screen.root).toHaveAccessibilityValue({ min: 0, max: 100, now: percent });
});

test('a meter given words says them instead of a percentage', async () => {
  await render(<Meter fraction={0.5} valueText="3 of 6 episodes" />);

  expect(screen.root).toHaveAccessibilityValue({ text: '3 of 6 episodes' });
});

test('a screen reader finds a meter as one progress bar with its value', async () => {
  await render(<Meter fraction={0.42} />);

  expect(screen.getByRole('progressbar', { value: { now: 42 } })).toBeOnTheScreen();
});

test('a meter given words is found by them', async () => {
  await render(<Meter fraction={0.5} valueText="3 of 6 episodes" />);

  expect(screen.getByRole('progressbar', { value: { text: '3 of 6 episodes' } })).toBeOnTheScreen();
});
