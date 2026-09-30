// Printing must wait for lazy-loaded notation, not just two animation frames.
export function waitForScores(root, expected, signal, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (error) => {
      observer.disconnect();
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new DOMException('Print cancelled', 'AbortError'));
    const check = () => {
      if (root.querySelector('[data-score-ready="error"]'))
        finish(
          new Error(
            'Sheet music could not finish rendering. Try again, or download the text guide.'
          )
        );
      else if (root.querySelectorAll('[data-score-ready="ready"]').length >= expected) finish();
    };
    const observer = new MutationObserver(check);
    observer.observe(root, { subtree: true, attributes: true, childList: true });
    timer = setTimeout(
      () => finish(new Error('Sheet music is taking too long to render. Try printing again.')),
      timeoutMs
    );
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    else check();
  });
}
