import { audioClip, audioTrack, bounded, validateArrangement } from './arrangementModel';
import { crossfaderGains, gainFromPercent, validPerformanceInput } from './studioAudioEngine';
import { masterStemGain, normalizeMasterStems } from './masterOutput';
import { performanceAudioTime } from './performanceClock';
import { RECONSTRUCTION_EVENTS, performanceSupportForTake } from './performanceSupport';
import {
  SyncClock,
  beatSyncCorrection,
  leaderTempo,
  sourceBeat,
  tempoFollowRate,
} from './syncClock';

const TRANSPORT_EVENTS = new Set([
  'playDeck',
  'pauseDeck',
  'stopDeck',
  'seekDeck',
  'setPlaybackRate',
  'deckTransport',
]);
// Live controller periods (beat sync 25 ms, tempo follow 100 ms) and the rate
// change that starts a new clip piece.
const SYNC_STEP = 0.025,
  FOLLOW_STEPS = 4,
  RATE_TOLERANCE = 0.001;

const loopedPosition = ({ position, looping, loopStart, loopEnd }) =>
  looping && loopEnd > loopStart && position >= loopEnd
    ? loopStart + ((position - loopStart) % (loopEnd - loopStart))
    : position;

// Takes journal sync intent, not the controllers' continuous corrections. Re-run
// the live controllers over the reconstructed transport so reopened clips keep
// their tempo and phase lock. Steps within 0.1% merge into one constant-rate
// piece at its time-weighted average rate, so every piece boundary is phase-exact.
function syncRateSchedules(events, initial, start, duration) {
  const schedules = new Map();
  if (!events.some((event) => ['setDeckSync', 'setTempoFollow'].includes(event.type)))
    return schedules;
  const decks = new Map();
  const deckState = (id) => {
    if (!decks.has(id)) {
      const deck = initial.decks.find((item) => item.id === id) || {};
      decks.set(id, {
        playing: !!deck.playing,
        position: deck.position || 0,
        rate: deck.playbackRate || 1,
        at: start,
        looping: !!deck.looping,
        loopStart: deck.loopStart || 0,
        loopEnd: deck.loopEnd || 0,
        accurate: events.some((event) => event.type === 'deckTransport' && event.args[0] === id),
        history: [{ time: start, rate: deck.playbackRate || 1, hard: true }],
      });
    }
    return decks.get(id);
  };
  for (const deck of initial.decks) deckState(deck.id);
  const followers = new Map(),
    tempoFollowers = new Map(),
    derived = new Set();
  let clock = null;
  const advance = (deck, time) => {
    if (deck.playing && time > deck.at) {
      deck.position += (time - deck.at) * deck.rate;
      deck.position = loopedPosition(deck);
    }
    deck.at = time;
  };
  const setRate = (deck, rate, time, hard = false) => {
    deck.rate = rate;
    deck.history.push({ time, rate, hard });
  };
  const step = (time, index) => {
    for (const deck of decks.values()) advance(deck, time);
    for (const [id, { grid, reference }] of clock ? followers : []) {
      const deck = decks.get(id);
      if (!deck.playing) continue;
      const master = reference && decks.get(reference.id);
      const masterPosition = master?.playing ? loopedPosition(master) : 0;
      const { rate } = beatSyncCorrection({
        position: loopedPosition(deck),
        grid,
        target: master?.playing ? sourceBeat(masterPosition, reference) : clock.beatAt(time),
        leaderBpm: master?.playing
          ? leaderTempo(reference, masterPosition, master.rate)
          : clock.bpmAt(time),
      });
      if (Number.isFinite(rate) && Math.abs(rate - deck.rate) > 0.00005) setRate(deck, rate, time);
    }
    if (index % FOLLOW_STEPS) return;
    for (const [id, { beats, targetBpm }] of tempoFollowers) {
      const deck = decks.get(id);
      if (!deck.playing || followers.has(id)) continue;
      const rate = tempoFollowRate(targetBpm, beats, loopedPosition(deck));
      if (Number.isFinite(rate) && Math.abs(rate - deck.rate) > 0.001) setRate(deck, rate, time);
    }
  };
  let index = Math.ceil(start / SYNC_STEP);
  const run = (until) => {
    for (; index * SYNC_STEP < until; index++) step(index * SYNC_STEP, index);
  };
  for (const event of events) {
    if (event.type === 'initialState' || event.time > duration) continue;
    const time = bounded(event.time, 0, duration),
      [id, value, extra] = event.args;
    run(time);
    if (event.type === 'setProjectTempo') {
      const beat = Number.isFinite(value) ? value : (clock?.beatAt(time) ?? 0);
      if (Number(id) > 0) clock = new SyncClock(Number(id), time, beat);
      continue;
    }
    if (event.type === 'setDeckSync') {
      deckState(id);
      if (value && extra?.bpm > 0) {
        followers.set(id, { grid: extra, reference: event.args[3] });
        derived.add(id);
      } else followers.delete(id);
      continue;
    }
    if (event.type === 'setTempoFollow') {
      deckState(id);
      if (value?.length > 1) {
        tempoFollowers.set(id, { beats: value, targetBpm: extra });
        derived.add(id);
      } else tempoFollowers.delete(id);
      continue;
    }
    const loop = ['setLoop', 'setLoopRegion'].includes(event.type);
    if (typeof id !== 'string' || !(loop || TRANSPORT_EVENTS.has(event.type))) continue;
    const deck = deckState(id);
    if (loop) {
      advance(deck, time);
      deck.position = loopedPosition(deck);
      deck.looping = !!value;
      deck.loopStart = event.type === 'setLoop' ? 0 : Math.max(0, Number(extra) || 0);
      deck.loopEnd =
        event.type === 'setLoop'
          ? Math.max(0.25, 240 / Math.max(1, Number(extra) || 120))
          : Math.max(deck.loopStart + 0.05, Number(event.args[3]) || deck.loopStart + 1);
      continue;
    }
    if (deck.accurate && event.type !== 'deckTransport') continue;
    advance(deck, time);
    let rate = deck.rate;
    if (event.type === 'deckTransport') {
      deck.position = value.position;
      rate = bounded(value.rate, 0.25, 4, 1);
      deck.playing = value.playing;
    } else if (event.type === 'playDeck') {
      deck.playing = true;
      if (value != null) deck.position = value;
    } else if (event.type === 'seekDeck') deck.position = Math.max(0, value);
    else if (event.type === 'setPlaybackRate') rate = bounded(value, 0.25, 4, 1);
    else {
      deck.playing = false;
      if (event.type === 'stopDeck' && value !== false) deck.position = 0;
    }
    setRate(deck, rate, time, true);
  }
  run(duration);
  for (const id of derived) {
    const { history } = decks.get(id);
    const pieces = [];
    for (let i = 0; i < history.length; ) {
      let j = i + 1;
      while (
        j < history.length &&
        !history[j].hard &&
        Math.abs(history[j].rate - history[i].rate) <= RATE_TOLERANCE * history[i].rate
      )
        j++;
      const end = j < history.length ? history[j].time : duration;
      let travelled = 0;
      for (let k = i; k < j; k++)
        travelled += history[k].rate * ((k + 1 < j ? history[k + 1].time : end) - history[k].time);
      pieces.push({
        time: history[i].time,
        rate: end > history[i].time ? travelled / (end - history[i].time) : history[i].rate,
      });
      i = j;
    }
    schedules.set(id, pieces);
  }
  return schedules;
}

// Reconstruct source edits, never apply processing again to a printed reference.
// Unsupported DSP stays explicitly reported; the safety take remains untouched.
export function reconstructPerformance(project, capture) {
  const enabled = (capture.events || []).filter((event) => !event.disabled);
  // A damaged row (NaN/Infinity) is skipped exactly as replay skips it.
  const valid = enabled.filter(
    (event) =>
      Number.isFinite(performanceAudioTime(event, event.sampleRate || 48000, 0)) &&
      (event.type === 'initialState' || validPerformanceInput(event.type, event.args || []))
  );
  const events = valid
    .map((event, index) => ({
      ...event,
      index,
      // Use the same audible clock as replay, not the earlier UI request time.
      // Legacy captures have no scheduled time; keep their recorded timing.
      time: performanceAudioTime(event, event.sampleRate || 48000, 0),
    }))
    .sort((a, b) => a.time - b.time || (a.sequence ?? a.index) - (b.sequence ?? b.index));
  const snapshot = events.find((event) => event.type === 'initialState');
  const initial = snapshot?.args[0];
  if (!initial?.decks)
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
  if (valid.length < enabled.length) {
    console.warn(
      'Reconstruction skipped damaged events.',
      enabled.filter((e) => !valid.includes(e))
    );
    warnings.add(
      `${enabled.length - valid.length} damaged event(s) with invalid values were skipped.`
    );
  }
  const supported = new Set(RECONSTRUCTION_EVENTS);
  for (const event of events) if (!supported.has(event.type)) warnings.add(event.type);
  const rateSchedules = syncRateSchedules(events, initial, snapshot.time || 0, duration);
  const allDecks = structuredClone(initial.decks);
  for (const event of events) {
    if (
      event.type === 'setLaneState' &&
      event.args[2]?.assetId &&
      !allDecks.some((deck) => deck.id === event.args[0])
    )
      allDecks.push({ id: event.args[0], lanes: {}, playing: false, side: 'left' });
  }
  for (const original of allDecks) {
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
    let stems = normalizeMasterStems(initial.masterProcessing?.stems);
    if (
      Object.values(deck.eq || {}).some((value) => value !== 50) ||
      (deck.filter ?? 50) !== 50 ||
      deck.fx?.reverb ||
      deck.fx?.echo ||
      deck.pitch ||
      Object.values(deck.stemFx || {}).some((fx) => fx.send || fx.pitch || (fx.filter ?? 50) !== 50)
    )
      warnings.add(`${deck.id}: original deck/stem FX or pitch needs printed audio`);
    const rows = [];
    const addRow = (id, lane) => {
      const track = {
        ...audioTrack(`Replay ${deck.id} · ${id}`),
        replayCapture: capture.id || capture.assetId,
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
      const row = { id, lane, track };
      rows.push(row);
      return row;
    };
    for (const [id, lane] of Object.entries(deck.lanes || {})) addRow(id, lane);
    const gain = (lane, id) => {
      const solo = rows.some((row) => row.lane.solo),
        gains = crossfaderGains(crossfader, curve);
      return lane.muted || (solo && !lane.solo) || deck.muted
        ? 0
        : ((gainFromPercent(deck.gain ?? 100) *
            gainFromPercent(deck.fader ?? 100) *
            gainFromPercent(lane.level ?? 100) *
            masterStemGain(stems, id) *
            (gains[deck.cfSide || deck.side] ?? 1)) /
            81) *
            100;
    };
    const levels = (time) => {
      for (const row of rows) {
        const points = row.track.automation.volume,
          value = gain(row.lane, row.id);
        const last = points.at(-1);
        if (last && last.value === value) continue;
        const at = timeline + time;
        if (last) {
          // Fast knob moves can interrupt the preceding ramp. Preserve its
          // value at the interruption, not a future endpoint out of time order.
          const left = points.at(-2);
          const held =
            last.time > at && left
              ? left.value +
                (last.value - left.value) * ((at - left.time) / (last.time - left.time))
              : last.value;
          while (points.length && points.at(-1).time >= at) points.pop();
          if (time) points.push({ time: at, value: held });
        }
        points.push({ time: timeline + time + (time ? 0.025 : 0), value });
      }
    };
    // Emit source intervals for [previous, end) at one constant rate.
    const emit = (end, rate) => {
      for (const row of rows) {
        if (!row.lane.assetId) continue;
        const length = row.lane.duration || deck.duration || 0;
        const loopStart = Math.max(0, deck.loopStart || 0);
        const loopEnd = Math.min(length, deck.loopEnd || length);
        const looping = deck.looping && loopEnd > loopStart;
        let position = offset,
          at = previous;
        while (at < end - 0.000001) {
          if (looping && position >= loopEnd)
            position = loopStart + ((position - loopStart) % (loopEnd - loopStart));
          const available = Math.min(end - at, ((looping ? loopEnd : length) - position) / rate);
          if (available < 0.000001) break;
          if (available < 0.001) {
            warnings.add(
              'Sub-millisecond source fragments cannot be represented as arrangement clips; keep the printed reference.'
            );
            at += available;
            position += available * rate;
            continue;
          }
          if (row.track.clips.length >= 20000)
            throw new Error(
              'This performance expands beyond 20,000 loop regions. Shorten the take before reconstruction.'
            );
          row.track.clips.push({
            ...audioClip(
              row.lane.assetId,
              row.lane.name || deck.title || `${deck.id} · ${row.id}`,
              available,
              timeline + at
            ),
            offset: position,
            sourceDuration: length,
            rate,
            fadeIn: 0,
            fadeOut: 0,
            mixGain: 81,
            ...(looping ? { performanceLoop: { start: loopStart, end: loopEnd } } : {}),
          });
          at += available;
          position += available * rate;
          if (!looping) break;
        }
      }
      offset += (end - previous) * rate;
      if (deck.looping && deck.loopEnd > (deck.loopStart || 0) && offset >= deck.loopEnd)
        offset =
          (deck.loopStart || 0) +
          ((offset - (deck.loopStart || 0)) % (deck.loopEnd - (deck.loopStart || 0)));
      previous = end;
    };
    // Synced decks follow their re-derived rate pieces; others keep journaled rates.
    const schedule = rateSchedules.get(original.id);
    let piece = 0;
    const append = (end) => {
      while (playing && end > previous) {
        if (!schedule) {
          emit(end, rate);
          break;
        }
        while (piece + 1 < schedule.length && schedule[piece + 1].time <= previous) piece++;
        const boundary = schedule[piece + 1]?.time;
        emit(boundary > previous && boundary < end ? boundary : end, schedule[piece].rate);
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
      else if (event.type === 'setMasterStems') stems = normalizeMasterStems(id);
      else if (event.type === 'setCrossfaderCurve') curve = id;
      else if (id === deck.id) {
        if (event.type === 'setLoop' || event.type === 'setLoopRegion') {
          append(time);
          deck.looping = !!value;
          deck.loopStart = event.type === 'setLoop' ? 0 : Math.max(0, Number(extra) || 0);
          deck.loopEnd =
            event.type === 'setLoop'
              ? Math.max(0.25, 240 / Math.max(1, Number(extra) || 120))
              : Math.max(deck.loopStart + 0.05, Number(event.args[3]) || deck.loopStart + 1);
        }
        if (event.type === 'removeLane') {
          append(time);
          const row = rows.find((row) => row.id === value);
          if (row) {
            row.lane = {};
            row.removed = true;
          }
        }
        if (event.type === 'setDeckGain') deck.gain = value;
        if (event.type === 'setDeckFader') deck.fader = value;
        if (event.type === 'setDeckSide') deck.cfSide = value;
        if (event.type === 'setLaneState') {
          let row = rows.find((row) => row.id === value);
          if (extra?.assetId && extra.assetId !== row?.lane.assetId) append(time);
          if (!row && extra?.assetId) row = addRow(value, {});
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
  const support = performanceSupportForTake(capture);
  return {
    project: next,
    support,
    warnings: [
      ...warnings,
      ...support.printed.map((item) => `Printed audio required: ${item}`),
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
