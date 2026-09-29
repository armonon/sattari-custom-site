// Preparing a cold destination must not stop the source that is currently audible.
// All lanes commit together; a newer command, source replacement or disposal wins.
export function prepareDeckAudio(deck, position, region, isCurrent = () => true, retainUntil) {
  const jobs = [];
  for (const lane of deck.lanes.values()) {
    if (!lane.player.prepareWindow) continue;
    const offset = lane.duration ? Math.max(0, position) % lane.duration : 0;
    const requested = region || lane.player.loopStateAt?.(lane.player.context.now()) || lane.player;
    // Keep audible read-ahead alive while the full cold destination is loading.
    const warm = lane.player.warmWindow || lane.player.prepareWindow;
    jobs.push(
      warm.call(
        lane.player,
        offset,
        {
          loop: requested.loop,
          loopStart: Math.min(Math.max(0, lane.duration - 0.001), requested.loopStart || 0),
          loopEnd: Math.min(lane.duration, requested.loopEnd || lane.duration),
        },
        isCurrent,
        retainUntil
      )
    );
  }
  return jobs.length ? Promise.all(jobs) : null;
}

export function cancelPreparedTransport(deck) {
  deck.transportGeneration = (deck.transportGeneration || 0) + 1;
  deck.preparing = false;
}

export function preparedTransport(engine, deck, position, apply, region, { restart = false } = {}) {
  cancelPreparedTransport(deck);
  const generation = deck.transportGeneration;
  const lanes = [...deck.lanes.values()];
  let finished = false;
  const finish = () => {
    finished = true;
    // An invalidated source/disposed engine still owns its pending indicator.
    // A newer command owns a different generation and must remain untouched.
    if (deck.transportGeneration === generation) deck.preparing = false;
  };
  const current = () =>
    !engine.disposed &&
    deck.transportGeneration === generation &&
    lanes.length === deck.lanes.size &&
    lanes.every((lane) => [...deck.lanes.values()].includes(lane));
  const commit = () => {
    if (!current()) {
      finish();
      return false;
    }
    // Warming source pages is not a playback restart. In particular, changing
    // a loop must not erase a deadline failure while its grain clock is stopped.
    const failure = lanes.find((lane) => lane.player.failure)?.player.failure;
    deck.transportError = restart ? null : failure?.message || null;
    if (restart)
      for (const lane of lanes) if (lane.player.prepareWindow) lane.player.failure = null;
    for (const lane of lanes) lane.player.invalidatePrefetch?.();
    // Keep every destination page resident until all lanes have queued their
    // first native grains; those grains then own their ordinary page leases.
    try {
      return apply();
    } finally {
      finish();
    }
  };
  const fail = (error) => {
    finish();
    if (current()) {
      deck.transportError =
        error.message || 'Audio could not be prepared. The current source is unchanged.';
    }
    return false;
  };
  try {
    const pending = prepareDeckAudio(deck, position, region, current, () => !finished && current());
    if (!pending) return commit();
    deck.preparing = true;
    return pending.then(commit).catch(fail);
  } catch (error) {
    return fail(error);
  }
}
