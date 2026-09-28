import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import QuantityInput from './QuantityInput';

function renderInput(value = 3) {
  const onCommit = vi.fn();
  function Harness() {
    const [quantity, setQuantity] = useState(value);
    return (
      <QuantityInput
        aria-label="Quantity"
        value={quantity}
        onCommit={(next) => {
          onCommit(next);
          setQuantity(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { input: screen.getByRole('spinbutton', { name: 'Quantity' }), onCommit };
}

it('lets the box be cleared and retyped without committing the empty value', () => {
  const { input, onCommit } = renderInput(3);

  fireEvent.change(input, { target: { value: '' } });
  expect(input).toHaveValue(null);
  expect(onCommit).not.toHaveBeenCalled();

  fireEvent.change(input, { target: { value: '7' } });
  expect(onCommit).toHaveBeenLastCalledWith(7);
  expect(input).toHaveValue(7);
});

it('puts the current quantity back when the box is left empty', () => {
  const { input, onCommit } = renderInput(4);

  fireEvent.change(input, { target: { value: '' } });
  fireEvent.blur(input);

  expect(input).toHaveValue(4);
  expect(onCommit).not.toHaveBeenCalled();
});

it('never commits 0, and clamps typed numbers to 1–10 (the per-order limit) on Enter or blur', () => {
  const { input, onCommit } = renderInput(2);

  fireEvent.change(input, { target: { value: '0' } });
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onCommit).toHaveBeenLastCalledWith(1);
  expect(input).toHaveValue(1);

  fireEvent.change(input, { target: { value: '25' } });
  expect(onCommit).toHaveBeenCalledTimes(1);
  fireEvent.blur(input);
  expect(onCommit).toHaveBeenLastCalledWith(10);
  expect(input).toHaveValue(10);
  expect(input).toHaveAttribute('max', '10');
});

it('follows the quantity when it changes elsewhere (the − and + buttons)', () => {
  const onCommit = vi.fn();
  const { rerender } = render(
    <QuantityInput aria-label="Quantity" value={2} onCommit={onCommit} />
  );
  rerender(<QuantityInput aria-label="Quantity" value={5} onCommit={onCommit} />);
  expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(5);
});
