import { audioClip, audioTrack, bounded, validateArrangement } from './arrangementModel';
import { crossfaderGains, gainFromPercent } from './studioAudioEngine';

// Reconstruct source edits, never apply processing again to a printed reference.
// Unsupported DSP stays explicitly reported; the safety take remains untouched.
export function reconstructPerformance(project, capture) {
  const events = (capture.events || [])
    .filter((event) => !event.disabled)
    .map((event, index) => ({ ...event, index }))
    .sort((a, b) => a.time - b.time || a.index - b.index);
  const snapshot = events.find((event) => event.type === 'initialState');
  const initial = snapshot?.args[0];
  if (!initial?.decks?.length)
    throw new Error('This take has no source snapshot. Use its printed audio lanes.');
  const duration =
    capture.duration ||
    Math.max(
      0,
      ...project.tracks
        .flatMap((track) => track.clips)
        .filter((clip) => clip.assetId === capture.assetId)
        .map((clip) => clip.duration)
    );
  if (!duration) throw new Error('This take has no recording duration.');
  const timeline = capture.timelineStart || 0,
    warnings = new Set(),
    tracks = [];
  const supported = new Set([
    'initialState',
    'deckTransport',
    'playDeck',
    'pauseDeck',
    'stopDeck',
    'seekDeck',
    'setPlaybackRate',
    'setCrossfader',
    'setCrossfaderCurve',
    'setDeckGain',
    'setDeckFader',
    'setDeckSide',
    'setLaneState',
  ]);
  for (const event of events) if (!supported.has(event.type)) warnings.add(event.type);
  for (const original of initial.decks) {
    const accurateTransport = events.some(
      (event) => event.type === 'deckTransport' && event.args[0] === original.id
    );
    if (!accurateTransport)
      warnings.add('Legacy transport events: requested timing, not confirmed audio-clock timing');
    const deck = structuredClone(original);
    let offset = deck.position || 0,
      playing = !!deck.playing,
      rate = deck.playbackRate || 1;
    let crossfader = initial.crossfader ?? 50,
      curve = initial.crossfaderCurve || 'Smooth',
      previous = snapshot.time || 0;
    if (
      Object.values(deck.eq || {}).some((value) => value !== 50) ||
      (deck.filter ?? 50) !== 50 ||
      deck.fx?.reverb ||
      deck.fx?.echo ||
      deck.pitch ||
      Object.values(deck.stemFx || {}).some((fx) => fx.send || fx.pitch || (fx.filter ?? 50) !== 50)
    )
      warnings.add(`${deck.id}: original deck/stem FX or pitch needs printed audio`);
    if (deck.looping) warnings.add(`${deck.id}: loop reconstruction requires manual review`);
    const rows = Object.entries(deck.lanes || {}).map(([id, lane]) => {
      const track = {
        ...audioTrack(`Replay ${deck.id} · ${id}`),
        replayCapture: capture.assetId,
        stemRole:
          id === 'music'
            ? 'other'
            : ['vocals', 'drums', 'bass', 'other'].includes(id)
              ? id
              : 'unseparated',
        muted: true,
        automation: { volume: [] },
      };
      tracks.push(track);
      return { id, lane, track };
    });
    const gain = (lane) => {
      const solo = rows.some((row) => row.lane.solo),
        gains = crossfaderGains(crossfader, curve);
      return lane.muted || (solo && !lane.solo) || deck.muted
        ? 0
        : ((gainFromPercent(deck.gain ?? 100) *
            gainFromPercent(deck.fader ?? 100) *
            gainFromPercent(lane.level ?? 100) *
            (gains[deck.cfSide || deck.side] ?? 1)) /
            27) *
            100;
    };
    const levels = (time) => {
      for (const row of rows) {
        const points = row.track.automation.volume,
          value = gain(row.lane);
        const last = points.at(-1);
        if (last && last.value === value) continue;
        if (last && timeline + time > last.time)
          points.push({ time: timeline + time, value: last.value });
        points.push({ time: timeline + time + (time ? 0.025 : 0), value });
      }
    };
    const append = (end) => {
      if (playing && end > previous) {
        for (const row of rows) {
          if (!row.lane.assetId) continue;
          const length = row.lane.duration || deck.duration || 0;
          const available = Math.min(end - previous, (length - offset) / rate);
          if (available < 0.001) continue;
          row.track.clips.push({
            ...audioClip(
              row.lane.assetId,
              row.lane.name || deck.title,
              available,
              timeline + previous
            ),
            offset,
            sourceDuration: length,
            rate,
            fadeIn: 0,
            fadeOut: 0,
            mixGain: 27,
          });
        }
        offset += (end - previous) * rate;
      }
      previous = end;
    };
    levels(previous);
    for (const event of events) {
      const time = bounded(event.time, 0, duration),
        [id, value, extra] = event.args;
      if (event.type === 'initialState' || event.time > duration) continue;
      const transport = [
        'playDeck',
        'pauseDeck',
        'stopDeck',
        'seekDeck',
        'setPlaybackRate',
        'deckTransport',
      ].includes(event.type);
      if (transport && id === deck.id && (!accurateTransport || event.type === 'deckTransport')) {
        append(time);
        if (event.type === 'deckTransport') {
          offset = value.position;
          rate = bounded(value.rate, 0.25, 4, 1);
          playing = value.playing;
        } else if (event.type === 'playDeck') {
          playing = true;
          if (value != null) offset = value;
        } else if (event.type === 'seekDeck') offset = Math.max(0, value);
        else if (event.type === 'setPlaybackRate') rate = bounded(value, 0.25, 4, 1);
        else {
          playing = false;
          if (event.type === 'stopDeck' && value !== false) offset = 0;
        }
      }
      if (event.type === 'setCrossfader') crossfader = id;
      else if (event.type === 'setCrossfaderCurve') curve = id;
      else if (id === deck.id) {
        if (event.type === 'setDeckGain') deck.gain = value;
        if (event.type === 'setDeckFader') deck.fader = value;
        if (event.type === 'setDeckSide') deck.cfSide = value;
        if (event.type === 'setLaneState') {
          const row = rows.find((row) => row.id === value);
          if (row && extra?.assetId && extra.assetId !== row.lane.assetId) append(time);
          if (row) Object.assign(row.lane, extra);
          if (
            Object.keys(extra || {}).some(
              (key) =>
                ['pitch', 'filter', 'send'].includes(key) &&
                extra[key] !== (key === 'filter' ? 50 : 0)
            )
          )
            warnings.add('Lane processing changes need printed audio');
        }
      }
      levels(time);
    }
    append(duration);
  }
  if (!tracks.some((track) => track.clips.length))
    throw new Error('No playable source intervals were captured.');
  const next = {
    ...project,
    tracks: [...project.tracks, ...tracks.filter((track) => track.clips.length)],
  };
  validateArrangement(next);
  return {
    project: next,
    warnings: [
      ...warnings,
      'Master processing uses the current mix settings; compare with the printed reference.',
    ],
    tracks,
  };
}

export function performanceAssetIds(captures) {
  const ids = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.assetId === 'string' && value.assetId) ids.add(value.assetId);
    for (const child of Object.values(value)) if (typeof child === 'object') visit(child);
  };
  visit(captures);
  return [...ids];
}
export function relinkPerformanceAssets(captures, ids) {
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (ids.has(value.assetId)) value.assetId = ids.get(value.assetId);
    for (const child of Object.values(value)) if (typeof child === 'object') visit(child);
  };
  visit(captures);
}
