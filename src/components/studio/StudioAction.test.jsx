/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Play } from 'lucide-react';
import { afterEach, expect, it, vi } from 'vitest';
import StudioAction from './StudioAction';

afterEach(cleanup);

it('forwards action handlers and preserves the accessible label', () => {
  const onClick = vi.fn();
  const onPointerDown = vi.fn();
  render(<StudioAction icon={Play} label="Play" onClick={onClick} onPointerDown={onPointerDown} />);
  const button = screen.getByRole('button', { name: 'Play' });
  fireEvent.pointerDown(button);
  fireEvent.click(button);
  expect(onPointerDown).toHaveBeenCalledTimes(1);
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(button).toHaveAttribute('title', 'Play');
});

it('forwards disabled state and prevents activation', () => {
  const onClick = vi.fn();
  render(<StudioAction icon={Play} label="Play" onClick={onClick} disabled />);
  const button = screen.getByRole('button', { name: 'Play' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});
