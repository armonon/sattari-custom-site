import { useRef } from 'react';

/**
 * A ref holding the value from the latest render. Stable callbacks read it at
 * call time instead of closing over one render's values.
 */
export function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
