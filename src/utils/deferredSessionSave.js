// Coalesce continuous fader/note edits without serializing the entire project
// on each pointer event. Call flush on pagehide/visibility loss and unmount.
export function deferredSessionSave(write, report, delay = 600) {
  let pending,
    timer,
    firstAt = 0,
    inflight;
  const flush = () => {
    clearTimeout(timer);
    if (inflight) return inflight.then(flush);
    if (!pending) return;
    const value = pending;
    pending = undefined;
    firstAt = 0;
    try {
      const result = write(value);
      if (result?.then) {
        inflight = Promise.resolve(result)
          .catch(report)
          .finally(() => {
            inflight = null;
          });
        return inflight;
      }
    } catch (error) {
      report(error);
    }
  };
  return {
    schedule(value) {
      pending = value;
      firstAt ||= Date.now();
      clearTimeout(timer);
      timer = setTimeout(flush, Math.max(0, Math.min(delay, 3000 - (Date.now() - firstAt))));
    },
    flush,
  };
}
