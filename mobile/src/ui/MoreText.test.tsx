import { expect, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MoreText } from './MoreText';

const SYNOPSIS = 'A group of people hide from flesh-eating ghouls in an old farmhouse. A sentence that runs on.';

function laidOut(count: number) {
  return {
    nativeEvent: {
      lines: Array.from({ length: count }, (_, i) => ({
        text: 'line',
        x: 0,
        y: i * 24,
        width: 300,
        height: 24,
        ascender: 18,
        descender: 6,
        capHeight: 12,
        xHeight: 9,
      })),
    },
  };
}

test('text that fits in three lines shows no More and does nothing when tapped', async () => {
  await render(<MoreText text={SYNOPSIS} />);
  await fireEvent(screen.getByText(SYNOPSIS), 'textLayout', laidOut(3));

  expect(screen.queryByText('More')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

test('longer text offers More, and a tap shows all of it', async () => {
  await render(<MoreText text={SYNOPSIS} />);
  await fireEvent(screen.getByText(SYNOPSIS), 'textLayout', laidOut(5));

  expect(screen.getByText('More')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: SYNOPSIS })).toBeCollapsed();

  await fireEvent.press(screen.getByRole('button', { name: SYNOPSIS }));

  expect(screen.queryByText('More')).toBeNull();
  expect(screen.getByRole('button', { name: SYNOPSIS })).toBeExpanded();
});

test('More shows again when the text is folded back', async () => {
  await render(<MoreText text={SYNOPSIS} />);
  await fireEvent(screen.getByText(SYNOPSIS), 'textLayout', laidOut(5));
  await fireEvent.press(screen.getByRole('button', { name: SYNOPSIS }));
  await fireEvent.press(screen.getByRole('button', { name: SYNOPSIS }));

  expect(screen.getByText('More')).toBeOnTheScreen();
});
