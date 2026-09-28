import { useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';

const NO_PARAMS = new URLSearchParams();
const subscribe = () => () => {};

/**
 * True while React is hydrating prerendered HTML (and on the prerender server),
 * false once the page is live. On a client-side navigation it is false from
 * the first render.
 */
export function useHydrating() {
  return useSyncExternalStore(
    subscribe,
    () => false,
    () => true
  );
}

/**
 * Search params that are safe to render from. Pages are prerendered without a
 * query string (/checkout/success, not /checkout/success?session_id=…), and
 * hydration must first render what that HTML shows, so this returns no params
 * while hydrating and the real ones immediately after.
 */
export function useHydratedSearchParams() {
  const [params] = useSearchParams();
  return useHydrating() ? NO_PARAMS : params;
}
