import { useEffect, useState } from 'react';
import { MAX_LINE_QUANTITY } from '../utils/cartCatalog';

function parseWhole(text) {
  const trimmed = String(text).trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

// A quantity box the shopper can clear and retype. What they type is a draft:
// a whole number in range is passed on as they type, and blur or Enter settles
// the rest (an empty or invalid box goes back to the current quantity, an
// out-of-range number is clamped). Clearing the box never reaches the cart as
// 0, which used to remove the line.
export default function QuantityInput({
  value,
  onCommit,
  min = 1,
  max = MAX_LINE_QUANTITY,
  ...inputProps
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const settle = (text) => {
    const parsed = parseWhole(text);
    if (parsed === null) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      {...inputProps}
      value={draft}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = parseWhole(text);
        if (parsed !== null && parsed >= min && parsed <= max && parsed !== value) {
          onCommit(parsed);
        }
      }}
      onBlur={(event) => settle(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        settle(event.currentTarget.value);
      }}
    />
  );
}
