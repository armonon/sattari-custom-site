export function rhythmTargets(phrase, bpm, speed) {
  const beatSeconds = 60 / bpm / speed;
  return phrase.notes.map((note) => ({
    ...note,
    at: (note.start - phrase.start) / speed,
    hold:
      note.beatDuration != null ? note.beatDuration * beatSeconds : (note.end - note.start) / speed,
  }));
}

// One attack can claim one target, and each target can be claimed only once.
// Pitch and timing stay separate so a wrong note on the beat cannot earn credit.
export function scoreRhythm(targets, attacks, beatSeconds, elapsed = Infinity) {
  const window = Math.min(0.38, beatSeconds * 0.45);
  const tolerance = Math.min(0.18, beatSeconds * 0.25);
  const claims = new Map();
  let extras = 0;
  for (const attack of attacks) {
    let closest = -1,
      distance = Infinity;
    targets.forEach((target, i) => {
      const delta = Math.abs(attack.at - target.at);
      if (!claims.has(i) && delta < distance && delta <= window) {
        closest = i;
        distance = delta;
      }
    });
    if (closest < 0) {
      extras++;
      continue;
    }
    const target = targets[closest];
    const offset = attack.at - target.at;
    claims.set(closest, {
      offset,
      status:
        attack.midi !== target.midi || Math.abs(attack.cents || 0) > 35
          ? 'wrong'
          : Math.abs(offset) <= tolerance
            ? 'on-time'
            : offset < 0
              ? 'early'
              : 'late',
    });
  }
  const notes = targets.map((target, i) => ({
    ...target,
    ...(claims.get(i) || {
      status: elapsed > target.at + window ? 'missed' : 'waiting',
    }),
  }));
  return {
    notes,
    extras,
    total: targets.length,
    onTime: notes.filter((n) => n.status === 'on-time').length,
    pitch: notes.filter((n) => ['on-time', 'early', 'late'].includes(n.status)).length,
  };
}
