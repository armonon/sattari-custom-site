import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// How long to wait for a #target that belongs to a page still loading.
const TARGET_TIMEOUT_MS = 5000;

function targetFor(hash) {
  if (!hash || hash === '#') return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

// The site sets `scroll-behavior: smooth` on <html>. A new page should start at
// the top at once, not glide there from wherever the last page was left.
function jumpTo(scroll) {
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  scroll();
  root.style.scrollBehavior = previous;
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Calls `found` with the element once it exists. Router navigations commit the
// new page before this runs, but a first render without prerendered HTML shows
// the loading fallback first, so the target can still be on its way.
function whenTargetExists(id, found) {
  const existing = document.getElementById(id);
  if (existing) {
    found(existing);
    return () => {};
  }
  const observer = new MutationObserver(() => {
    const target = document.getElementById(id);
    if (!target) return;
    stop();
    found(target);
  });
  const timer = window.setTimeout(() => stop(), TARGET_TIMEOUT_MS);
  function stop() {
    observer.disconnect();
    window.clearTimeout(timer);
  }
  observer.observe(document.body, { childList: true, subtree: true });
  return stop;
}

// Scroll handling for the storefront's client-side navigation:
// - a new page (PUSH/REPLACE) starts at the top;
// - a link to /page#section lands on the section once the page has rendered;
// - Back/Forward (POP) is left alone, because the browser restores the position.
// Only the window and the target's own ancestors are scrolled, so the Studio's
// panels keep their scroll positions.
export default function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(null);

  useEffect(() => {
    const initial = previousPath.current === null;
    const samePage = previousPath.current === location.pathname;
    previousPath.current = location.pathname;
    const id = targetFor(location.hash);

    if (initial) {
      // The browser has already jumped to a #target present in the prerendered
      // HTML; only a page rendered from the empty shell still needs the jump.
      if (!id || window.scrollY > 0) return undefined;
      return whenTargetExists(id, (target) => jumpTo(() => target.scrollIntoView?.()));
    }
    if (navigationType === 'POP') return undefined;
    if (!id) {
      jumpTo(() => window.scrollTo(0, 0));
      return undefined;
    }
    return whenTargetExists(id, (target) => {
      // Gliding makes sense within the page the reader is on; arriving on a
      // new page, go straight to the section.
      if (samePage && !prefersReducedMotion()) {
        target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } else {
        jumpTo(() => target.scrollIntoView?.({ block: 'start' }));
      }
    });
    // location.key changes on every navigation, including to the current URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  return null;
}
