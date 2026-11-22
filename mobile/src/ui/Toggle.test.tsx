import { expect, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { Toggle } from './Toggle';

function Setting() {
  const [on, setOn] = useState(false);

  return <Toggle value={on} onValueChange={setOn} accessibilityLabel="Smaller videos on mobile data" />;
}

test('a switch tells a screen reader its state and flips when pressed', async () => {
  await render(<Setting />);
  const toggle = screen.getByRole('switch', { name: 'Smaller videos on mobile data' });

  expect(toggle).not.toBeChecked();

  await fireEvent.press(toggle);
  expect(screen.getByRole('switch', { name: 'Smaller videos on mobile data' })).toBeChecked();

  await fireEvent.press(screen.getByRole('switch', { name: 'Smaller videos on mobile data' }));
  expect(screen.getByRole('switch', { name: 'Smaller videos on mobile data' })).not.toBeChecked();
});
