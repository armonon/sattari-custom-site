import { useCallback, useInsertionEffect, useLayoutEffect, useRef, useState } from 'react';

// Insertion effects run before every layout/passive effect of the commit, so
// the latest value is visible to child effects as well as to event handlers.
const useCommitEffect = useInsertionEffect || useLayoutEffect;

/** Latest committed value, readable from events and effects without re-subscribing. */
export function useLatestRef(value) {
  const latest = useRef(value);
  useCommitEffect(() => {
    latest.current = value;
  });
  return latest;
}

/**
 * A function with a permanent identity that always runs the latest `callback`.
 * Memoized children therefore never re-render because a handler was recreated.
 * Call it from events and effects, not during render.
 */
export function useStableCallback(callback) {
  const latest = useLatestRef(callback);
  return useCallback((...args) => latest.current(...args), [latest]);
}

/**
 * The same guarantee for a fixed set of named actions: the returned object and
 * each of its functions keep their identity for the component's lifetime.
 */
export function useStableActions(actions) {
  const latest = useLatestRef(actions);
  const [stable] = useState(() =>
    Object.fromEntries(
      Object.keys(actions).map((name) => [name, (...args) => latest.current[name](...args)])
    )
  );
  return stable;
}
