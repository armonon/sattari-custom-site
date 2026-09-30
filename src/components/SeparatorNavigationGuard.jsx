import { useCallback, useContext, useEffect } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';

const LEAVE_MESSAGE =
  'Leave Stem Separator? Processing will stop and any results you have not downloaded will be lost.';

const pagePath = (pathname) => pathname.replace(/\/+$/, '').toLowerCase() || '/';

function DataRouterGuard({ when }) {
  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }) =>
      when && pagePath(currentLocation.pathname) !== pagePath(nextLocation.pathname),
    [when]
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined;
    if (!when || !window.confirm(LEAVE_MESSAGE)) {
      blocker.reset();
      return undefined;
    }

    // Match the router's native-prompt timing so a blocked POP can restore
    // its history position before proceeding. The router owns that replay.
    const timer = window.setTimeout(blocker.proceed, 0);
    return () => window.clearTimeout(timer);
  }, [blocker, when]);

  return null;
}

export default function SeparatorNavigationGuard({ when }) {
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  // Prerendering and legacy MemoryRouter tests do not provide the blocker API.
  return dataRouter && !dataRouter.static ? <DataRouterGuard when={when} /> : null;
}
