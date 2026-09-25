import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import AutomationCurve from './AutomationCurve';
it('supports keyboard editing and removal of graphical automation points', () => {
  const change = vi.fn();
  render(
    <AutomationCurve
      points={[{ time: 1, value: 100 }]}
      duration={4}
      parameter="volume"
      onChange={change}
    />
  );
  const point = screen.getByRole('button', { name: /Automation point 1/ });
  fireEvent.keyDown(point, { key: 'ArrowRight' });
  expect(change).toHaveBeenLastCalledWith([{ time: 1.01, value: 100 }]);
  fireEvent.keyDown(point, { key: 'ArrowUp' });
  expect(change).toHaveBeenLastCalledWith([{ time: 1, value: 103 }]);
  fireEvent.keyDown(point, { key: 'Delete' });
  expect(change).toHaveBeenLastCalledWith([]);
});
