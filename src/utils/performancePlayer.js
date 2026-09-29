import * as Tone from 'tone';
import {
  StudioAudioEngine,
  exitLoopInPlace,
  masterAssistProfile,
  rampCompressor,
  validPerformanceInput,
} from './studioAudioEngine';
import { SyncClock } from './syncClock';
import { getAudioAsset } from './audioProjectStore';
import { performanceAssetIds } from './performanceReplay';
import {
  masterGain,
  normalizeMasterProcessing,
  normalizeMasterStems,
  trimGain,
} from './masterOutput';
import { rackTopology } from './arrangementEffects';
import { MIX_EVENTS, canScheduleMix, mixAutomation } from './replayMix';
import { performanceFilter } from './performanceFilter';
import { ReplaySourceCache, replaySourceDurations } from './replaySources';
import { ReplayInput } from './replayInput';
import { performanceAudioTime } from './performanceClock';
import { PITCH_EVENTS, pitchAutomation } from './replayPitch';

export const REPLAY_METHODS = new Set([
  'setCrossfader',
  'setCrossfaderCurve',
  'setDeckGain',
  'setDeckFader',
  'setDeckSide',
  'setDeckEq',
  'setDeckFilter',
  'setDeckFx',
  'setDeckSend',
  'setDeckInserts',
  'setReturn',
  'setLaneState',
  'setLaneFx',
  'removeLane',
  'setPlaybackRate',
  'setDeckPitch',
  'setDeckKeyLock',
  'setStemPitch',
  'setLoopRegion',
  'setLoop',
  'setMasterLevel',
  'setMasterStems',
  'setMasterProcessing',
  'setMasterAssist',
  'setLimiter',
  'setPadGain',
]);
const requestedTransport = new Set([
  'playDeck',
  'pauseDeck',
  'stopDeck',
  'seekDeck',
  'setPlaybackRate',
]);
const scheduledControls = new Set([
  'inputState',
  'setDeckFx',
  'setDeckSend',
  'setReturn',
  'setDeckEq',
  'setMasterLevel',
  'setLimiter',
  'setMasterAssist',
  'setProjectTempo',
]);
// Sync intent. The replay engine re-derives the rate corrections it implies,
// exactly as the live controller did; corrections themselves are not journaled.
const SYNC_INTENT = new Set(['setDeckSync', 'setTempoFollow']);

export function replayScheduling(
  plan,
  { scheduledLoopDecks = new Set(), scheduledPitchDecks = new Set() } = {}
) {
  // Start/stop/seek and supported granular loop states can be queued ahead.
  // Mutable sources/legacy transport still require the monitored dispatcher.
  // Pitch-capable fixed-source decks compile their whole musical-state history.
  const pitchDecks = new Set(
    [...scheduledPitchDecks].filter(
      (id) =>
        !plan.events.some(
          (event) =>
            event.args[0] === id &&
            (requestedTransport.has(event.type) ||
              event.type === 'removeLane' ||
              (event.type === 'setLaneState' &&
                (event.args[2]?.assetId || 'pitch' in (event.args[2] || {}))))
        )
    )
  );
  const compilePitch = pitchAutomation(plan.initial);
  const initialRates = new Map(
    (plan.initial.decks || []).map((deck) => [deck.id, deck.playbackRate || 1])
  );
  const mutableTransport = new Set([
    'setDeckPitch',
    'setDeckKeyLock',
    'setStemPitch',
    'setPlaybackRate',
    'setLoop',
    'setLoopRegion',
    'removeLane',
    'playDeck',
    'pauseDeck',
    'stopDeck',
    'seekDeck',
  ]);
  const unstableDecks = new Set();
  for (const event of plan.events)
    if (
      (mutableTransport.has(event.type) &&
        !(
          (scheduledLoopDecks.has(event.args[0]) &&
            ['setLoop', 'setLoopRegion'].includes(event.type)) ||
          (pitchDecks.has(event.args[0]) && PITCH_EVENTS.has(event.type))
        )) ||
      (event.type === 'setLaneState' &&
        (event.args[2]?.assetId || 'pitch' in (event.args[2] || {}))) ||
      (event.type === 'deckTransport' &&
        !pitchDecks.has(event.args[0]) &&
        (event.args[1]?.action === 'rate' ||
          (event.args[1]?.rate || 1) !== (initialRates.get(event.args[0]) || 1)))
    )
      unstableDecks.add(event.args[0]);
  const initial = plan.initial.masterProcessing || {};
  // A future topology swap would dispose nodes with queued automation. Embedded
  // stem state also affects lane controls, so keep interdependent edits together.
  const stableMaster = !plan.events.some(
    (event) =>
      event.type === 'setMasterStems' ||
      (event.type === 'setMasterProcessing' &&
        (rackTopology(event.args[0]?.effects || []) !== rackTopology(initial.effects || []) ||
          JSON.stringify(normalizeMasterStems(event.args[0]?.stems)) !==
            JSON.stringify(normalizeMasterStems(initial.stems))))
  );
  const scheduled = [],
    dispatched = [];
  // Frequency is an AudioParam, but filter type is not. Only queue sweeps when
  // every event uses the initial type; otherwise keep the whole deck together.
  const filterTypes = new Map(
    (plan.initial.decks || []).map((deck) => [deck.id, performanceFilter(deck.filter ?? 50).type])
  );
  const unstableFilters = new Set(
    plan.events
      .filter(
        (event) =>
          event.type === 'setDeckFilter' &&
          performanceFilter(event.args[1]).type !== (filterTypes.get(event.args[0]) || 'lowpass')
      )
      .map((event) => event.args[0])
  );
  const stableMix = canScheduleMix(plan.events),
    compileMix = mixAutomation(plan.initial);
  for (const event of plan.events) {
    if (
      pitchDecks.has(event.args[0]) &&
      !unstableDecks.has(event.args[0]) &&
      (PITCH_EVENTS.has(event.type) || event.type === 'deckTransport')
    ) {
      scheduled.push({ ...event, grainState: compilePitch(event) });
      continue;
    }
    // Stem gains are independent of insert topology. Compile their complete
    // history even when the FX graph itself still needs monitored dispatch.
    if (stableMix && event.type === 'setMasterProcessing') {
      scheduled.push({
        ...event,
        type: 'compiledMix',
        mixState: event,
        mixRamps: compileMix(event),
      });
      (stableMaster ? scheduled : dispatched).push({ ...event, mixScheduled: true });
      continue;
    }
    if (
      scheduledLoopDecks.has(event.args[0]) &&
      ['setLoop', 'setLoopRegion'].includes(event.type)
    ) {
      scheduled.push(event);
      continue;
    }
    if (event.type === 'deckTransport' && !unstableDecks.has(event.args[0])) {
      scheduled.push(event);
      continue;
    }
    if (stableMix && MIX_EVENTS.has(event.type)) {
      scheduled.push({ ...event, mixRamps: compileMix(event) });
      continue;
    }
    (scheduledControls.has(event.type) ||
    (event.type === 'setDeckFilter' && !unstableFilters.has(event.args[0])) ||
    (stableMaster && event.type === 'setMasterProcessing')
      ? scheduled
      : dispatched
    ).push(event);
  }
  const compiledPitchDecks = new Set([...pitchDecks].filter((id) => !unstableDecks.has(id)));
  return { scheduled, dispatched, pitchDecks: compiledPitchDecks };
}

// A damaged journal row (NaN/Infinity from storage or an edit) is skipped, never
// dispatched: the engine would ignore it anyway, and a skipped control must not
// be mistaken for a failed transport change that stops the whole replay.
const damagedArgs = (event) =>
  event.type !== 'initialState' && !validPerformanceInput(event.type, event.args || []);
const damagedEvent = (event) =>
  !Number.isFinite(event.time) ||
  (event.scheduledTime != null && !Number.isFinite(event.scheduledTime)) ||
  damagedArgs(event);

export function replayPlan(capture) {
  const enabled = structuredClone(capture.events || []).filter((e) => !e.disabled);
  const events = enabled.filter((e) => !damagedEvent(e)).sort((a, b) => a.time - b.time);
  const snapshot = events.find((e) => e.type === 'initialState');
  const initial = snapshot?.args[0];
  if (!initial?.decks || !(capture.duration > 0))
    throw new Error('Replay needs a source snapshot and a recording duration.');
  const warnings = [];
  if (events.length < enabled.length) {
    console.warn(
      'Replay skipped damaged events.',
      enabled.filter((e) => damagedEvent(e))
    );
    warnings.push(
      `${enabled.length - events.length} damaged event(s) with invalid values were skipped.`
    );
  }
  if (initial.dspVersion !== 2)
    warnings.push('Legacy reverb used a different random impulse; keep the printed reference.');
  if (initial.decks.some((d) => d.playing))
    warnings.push(
      'Pre-recording effect tails and grain phase were not captured; the opening may differ.'
    );
  const confirmed = new Set(events.filter((e) => e.type === 'deckTransport').map((e) => e.args[0]));
  if (
    !confirmed.size ||
    events.some((e) => requestedTransport.has(e.type) && !confirmed.has(e.args[0]))
  )
    warnings.push('Legacy transport has requested rather than confirmed timing.');
  const supported = new Set([
    ...REPLAY_METHODS,
    ...requestedTransport,
    ...SYNC_INTENT,
    'setProjectTempo',
    'initialState',
    'deckTransport',
    'triggerPad',
    'padSource',
    'openMicrophone',
    'closeMicrophone',
    'inputState',
  ]);
  const unknown = events.filter((e) => !supported.has(e.type));
  if (unknown.length)
    throw new Error(
      `Unsupported replay events: ${[...new Set(unknown.map((e) => e.type))].join(', ')}. Use the safety take.`
    );
  return {
    initial,
    initialTime: snapshot.time,
    events: events.filter(
      (e) =>
        e.type !== 'initialState' && !(confirmed.has(e.args[0]) && requestedTransport.has(e.type))
    ),
    warnings,
  };
}

// The same live DSP graph, not a look-alike set of arranger effects. Real-time
// replay intentionally exposes scheduling lateness instead of claiming bit parity.
export class PerformancePlayer {
  constructor(owner, { onStatus = () => {}, onFinish = () => {} } = {}) {
    Object.assign(this, { owner, onStatus, onFinish });
    this.buffers = new Map();
    this.inputNodes = new Set();
    this.scheduledInputs = new Set();
    this.inputBuffers = new Map();
    this.inputBytes = 0;
  }
  async prepare(capture, tracks = [], { rebuildPads = false } = {}) {
    if (
      this.owner.performanceStartedAt != null ||
      ['connected', 'interrupted'].includes(this.owner.getInputState?.().status) ||
      [...this.owner.decks.values()].some((d) => d.playing)
    )
      throw new Error(
        'Stop live decks and disconnect monitoring before auditioning a performance replay.'
      );
    this.capture = structuredClone(capture);
    this.plan = replayPlan(capture);
    this.engine = new StudioAudioEngine({ monitor: false });
    this.engine.output.connect(this.owner.output);
    this.raw = this.engine.getAudioContext().rawContext;
    this.inputs = tracks.filter(
      (t) =>
        t.captureId === capture.sourceCaptureId &&
        t.replayInput &&
        !(rebuildPads && t.replayInput.startsWith('pad'))
    );
    const rawInput =
      this.plan.initial.inputCaptureVersion === 1 &&
      this.inputs.some((t) => t.replayInput === 'microphoneRaw');
    this.inputs = this.inputs.filter(
      (t) => t.replayInput !== (rawInput ? 'microphone' : 'microphoneRaw')
    );
    if (rawInput) {
      this.inputReplay = new ReplayInput(this.raw, this.engine.unseparated.input);
      this.plan.warnings.push(
        'Input gain, monitoring and built-in FX are editable. Device/channel selection is printed into the input source; unarmed, unmonitored audio was not recorded.'
      );
    } else if (this.plan.events.some((e) => e.type === 'inputState')) {
      this.plan.warnings.push(
        'Input changes are journaled, but this take uses printed input audio; those edits cannot change its sound.'
      );
    }
    this.hasPrintedPads = this.inputs.some((t) => t.replayInput === 'pads');
    if (this.hasPrintedPads)
      this.plan.warnings.push(
        'Captured pad audio preserves the original sound; pad hit/level event edits require source reconstruction.'
      );
    if (
      this.plan.events.some((e) => e.type === 'openMicrophone') &&
      !this.inputs.some((t) => t.replayInput.startsWith('microphone'))
    )
      throw new Error(
        'This take has input events but no dry input capture. Recover source audio or use the printed take.'
      );
    this.sourceEvents = this.plan.events.filter((event) => performanceAssetIds([event]).length);
    this.transportEvents = this.plan.events.filter((event) => event.type === 'deckTransport');
    this.loopEvents = this.plan.events.filter((event) =>
      ['setLoop', 'setLoopRegion'].includes(event.type)
    );
    // Only the effective replay plan participates. Pads retain their sampler
    // path; deck sources are descriptors, never whole decoded song buffers.
    const padIds = new Set(
      performanceAssetIds([
        this.plan.initial.pads || [],
        ...this.plan.events.filter((event) => event.type === 'padSource'),
      ])
    );
    const windowedIds = new Set(
      performanceAssetIds([this.plan.initial, ...this.plan.events]).filter((id) => !padIds.has(id))
    );
    this.sourceCache = new ReplaySourceCache(this.raw, getAudioAsset, {
      durations: replaySourceDurations(this.plan),
      windowedIds,
    });
    this.buffers = this.sourceCache.buffers;
    // Only the opening and its next ten seconds are prepared. Future source
    // replacements are prefetched, never decoded in a musical dispatch call.
    await this.sourceCache.prepare(
      new Set([
        ...performanceAssetIds([this.plan.initial]),
        ...performanceAssetIds(this.sourceEvents.filter((event) => event.time <= 10)),
      ])
    );
    if (this.stopped) return;
    const s = this.plan.initial,
      engine = this.engine;
    engine.setMasterLevel(s.masterLevel ?? 100);
    engine.setMasterProcessing(s.masterProcessing || {});
    engine.setMasterAssist(!!s.aiMaster, s.aiMasterMode);
    engine.setLimiter(s.limiter !== false);
    engine.setCrossfaderCurve(s.crossfaderCurve);
    engine.setCrossfader(s.crossfader ?? 50);
    for (const [bus, params] of Object.entries(s.returns || {})) engine.setReturn?.(bus, params);
    for (const d of s.decks) {
      engine.ensureDeck(d.id, d.cfSide || d.side || 'left');
      for (const [lane, values] of Object.entries(d.lanes || {}))
        if (values.assetId) {
          await engine.loadLane(d.id, d.cfSide || d.side, lane, this.buffers.get(values.assetId));
          engine.setLaneState(d.id, lane, values);
        }
      engine.setDeckGain(d.id, d.gain ?? 100);
      engine.setDeckFader(d.id, d.fader ?? 100);
      engine.setDeckEq(d.id, d.eq || {});
      engine.setDeckFilter(d.id, d.filter ?? 50);
      engine.setDeckFx(d.id, d.fx || {});
      if (d.inserts?.length) engine.setDeckInserts?.(d.id, d.inserts);
      for (const [bus, amount] of Object.entries(d.sends || {}))
        if (amount) engine.setDeckSend?.(d.id, bus, amount);
      for (const [lane, fx] of Object.entries(d.stemFx || {})) engine.setLaneFx(d.id, lane, fx);
      engine.setDeckPitch(d.id, d.pitch || 0);
      engine.setDeckKeyLock(d.id, d.keyLock !== false);
      engine.setPlaybackRate(d.id, d.playbackRate || 1);
      if (
        (await engine.setLoopRegion(
          d.id,
          !!d.looping,
          d.loopStart || 0,
          d.loopEnd || d.duration || 1
        )) === false
      )
        throw new Error(
          engine.getDeckTransportStatus(d.id).error || 'Opening loop could not be prepared.'
        );
      for (const lane of engine.decks.get(d.id).lanes.values())
        await lane.player.prepareWindow?.(d.position || 0);
    }
    for (const [index, pad] of (s.pads || []).entries())
      if (pad.assetId) await this.setPadSource(index, pad.assetId, pad.gain);
    this.index = 0;
    this.lateEvents = 0;
    this.maxLateness = 0;
    this.onStatus(this.plan.warnings.join(' '));
  }
  async queueSources(elapsed) {
    if (!this.sourceCache || this.stopped) return;
    const active = [];
    for (const deck of this.engine.decks.values())
      for (const lane of deck.lanes.values()) if (lane.assetId) active.push(lane.assetId);
    for (const pad of this.engine.padPlayers.values()) if (pad.assetId) active.push(pad.assetId);
    await this.sourceCache.prepare(
      new Set([
        ...active,
        ...performanceAssetIds(
          this.sourceEvents.filter(
            (event) => event.time >= elapsed - 0.5 && event.time <= elapsed + 10
          )
        ),
      ])
    );
    if (this.stopped) return;
    // Warm only each launch page, in musical deadline order. Start far enough
    // ahead for slow decoders, give it audible-read priority, and keep it resident
    // until native grains take over. The shared pool still bounds all admission.
    const upcoming = [
      ...(this.transportEvents || []).filter(
        (event) => event.args[1].playing !== false && event.args[1].action !== 'rate'
      ),
      ...(this.loopEvents || []).filter((event) => event.args[1]),
    ]
      .map((event) => ({
        event,
        at: performanceAudioTime(
          event,
          this.raw?.sampleRate || 48000,
          this.engine.getAudioContext?.().lookAhead || 0
        ),
      }))
      .filter(({ at }) => at >= elapsed && at <= elapsed + 8)
      .sort((a, b) => a.at - b.at);
    for (const { event, at } of upcoming) {
      const transport = event.type === 'deckTransport';
      const start = transport
        ? event.args[1].position || 0
        : event.type === 'setLoopRegion'
          ? Math.max(0, Number(event.args[2]) || 0)
          : 0;
      const region = transport
        ? { loop: false }
        : {
            loop: true,
            loopStart: start,
            loopEnd:
              event.type === 'setLoopRegion'
                ? Number(event.args[3])
                : 240 / Math.max(1, Number(event.args[2]) || 120),
          };
      const deck = this.engine.decks.get(event.args[0]);
      await Promise.all(
        [...(deck?.lanes || [])].map(([id, lane]) => {
          const current = () =>
            !this.stopped &&
            !lane.player.disposed &&
            this.engine.decks.get(event.args[0]) === deck &&
            deck.lanes.get(id) === lane &&
            (!Number.isFinite(this.base) || this.raw.currentTime < this.base + at + 0.1);
          return lane.player.warmWindow?.(
            start,
            { ...region, prepareSeconds: 1, priority: 1 },
            current,
            current
          );
        })
      );
    }
  }
  async setPadSource(index, assetId, level = 100) {
    const buffer = this.buffers.get(assetId);
    if (!buffer) throw new Error(`Pad source missing: ${assetId}`);
    const old = this.engine.padPlayers.get(index);
    old?.player.dispose();
    old?.gain.dispose();
    const gain = new Tone.Gain(1).connect(this.engine.unseparated),
      player = new Tone.Player(buffer).connect(gain);
    this.engine.padPlayers.set(index, { player, gain, level, assetId });
    this.engine.setPadGain(index, level);
  }
  // Musical pitch (without rate transposition) as rate-following automation: the
  // player adds each grain's own rate when key lock is off. Derived rate
  // corrections then keep pitch and rate together without rewriting either.
  schedulePitchFollow(deck, when, state) {
    for (const [laneId, lane] of deck.lanes)
      lane.player.schedulePitch(
        when,
        ((state?.pitch ?? deck.pitch ?? 0) + ((state ? state.stems[laneId] : lane.pitch) || 0)) *
          100,
        { followRate: !(state?.keyLock ?? deck.keyLock) }
      );
  }
  transport(id, state, when, grainState) {
    const d = this.engine.decks.get(id);
    if (!d) return;
    const rate = grainState?.rate || state.rate || d.playbackRate || 1;
    // GrainPlayer derives its initial clock ticks from the current rate. Install
    // the new rate before starting, or an opening rate change misplaces the seek.
    const scheduledRates = [...d.lanes.values()].every((lane) => lane.player.schedulePlaybackRate);
    if (scheduledRates) {
      const transportPitch = d.keyLock ? 0 : 12 * Math.log2(Math.max(0.01, rate));
      for (const [laneId, lane] of d.lanes)
        lane.player.schedulePlaybackRate(
          rate,
          when,
          grainState?.detunes[laneId] ?? ((d.pitch || 0) + (lane.pitch || 0) + transportPitch) * 100
        );
      if (this.pitchFollowDecks?.has(id)) this.schedulePitchFollow(d, when, grainState);
    } else {
      d.playbackRate = rate;
      this.engine.applyPlaybackRates(d);
    }
    // A rate-only confirmation must not restart the grain clock or reattack the
    // envelope. Older captures lack this discriminator and retain legacy replay.
    if (state.action !== 'rate')
      for (const lane of d.lanes.values()) {
        if (d.playing || scheduledRates) lane.player.stop(when);
        if (state.playing)
          lane.player.start(when, (Math.max(0, state.position) % lane.duration) / rate);
      }
    const values = {
      offset: Math.max(0, state.position),
      startedAt: when,
      playing: !!state.playing,
      playbackRate: rate,
    };
    if (scheduledRates && this.raw && when > this.raw.currentTime) {
      this.pendingTransportStates ||= [];
      this.pendingTransportStates.push({ deck: d, id, when, values });
      this.pendingTransportStates.sort((a, b) => a.when - b.when);
    } else Object.assign(d, values);
  }
  dispatch(event, when) {
    const [a, b, c] = event.args,
      e = this.engine;
    if (damagedArgs(event)) {
      console.warn('Replay skipped a damaged event.', event);
      return;
    }
    if (event.type === 'deckTransport') return this.transport(a, b, when);
    if (SYNC_INTENT.has(event.type)) return e[event.type](...event.args);
    if (event.type === 'setMasterProcessing' && event.mixScheduled)
      return e.setMasterProcessing(a, { applyStems: false });
    if (
      event.type === 'setLaneState' &&
      c?.assetId &&
      e.decks.get(a)?.lanes.get(b)?.assetId !== c.assetId
    ) {
      // Predecoded sources attach synchronously; no decoding on the replay clock.
      const buffer = this.buffers.get(c.assetId);
      if (!buffer) throw new Error('Replay source was not ready in time. Keep the safety take.');
      return e.loadLane(a, e.decks.get(a)?.side, b, buffer).then(() => e.setLaneState(a, b, c));
    }
    if (REPLAY_METHODS.has(event.type)) return e[event.type](...event.args);
    if (event.type === 'padSource') return this.setPadSource(a, b.assetId || b, c);
    if (event.type === 'triggerPad' && !this.hasPrintedPads) return e.triggerPad(a, b);
    if (requestedTransport.has(event.type)) return e[event.type](...event.args);
    // Input audio and original pad voices come from durable pre-master chunks.
  }
  scheduleControl(event, when) {
    const [id, value] = event.args,
      e = this.engine,
      ramp = (param, v, d) => param.rampTo(v, d, when);
    if (damagedArgs(event)) {
      console.warn('Replay skipped a damaged event.', event);
      return;
    }
    if (event.grainState) {
      const deck = e.decks.get(id);
      if (!deck) return;
      // A synced deck's rate belongs to the re-derived controller: queue only its
      // pitch, never the compiled (journal-time) rate.
      if (event.type !== 'deckTransport' && this.pitchFollowDecks?.has(id))
        this.schedulePitchFollow(deck, when, event.grainState);
      else if (event.type !== 'deckTransport')
        for (const [laneId, lane] of deck.lanes)
          lane.player.schedulePlaybackRate(
            event.grainState.rate,
            when,
            event.grainState.detunes[laneId]
          );
      this.pendingPitchStates ||= [];
      this.pendingPitchStates.push({ deck, id, when, state: event.grainState });
      this.pendingPitchStates.sort((a, b) => a.when - b.when);
      if (event.type !== 'deckTransport') return;
    }
    if (event.type === 'deckTransport') return this.transport(id, value, when, event.grainState);
    if (['setLoop', 'setLoopRegion'].includes(event.type)) {
      const deck = e.decks.get(id);
      if (!deck) return;
      const start = event.type === 'setLoop' ? 0 : Math.max(0, Number(event.args[2]) || 0);
      const end =
        event.type === 'setLoop'
          ? Math.max(0.25, 240 / Math.max(1, event.args[2]))
          : Math.max(start + 0.05, Number(event.args[3]) || start + 1);
      for (const lane of deck.lanes.values()) {
        const loopStart = Math.min(Math.max(0, lane.duration - 0.001), start);
        lane.player.scheduleLoop(
          {
            loop: !!value,
            loopStart,
            loopEnd: Math.min(lane.duration, Math.max(loopStart + 0.001, end)),
          },
          when
        );
      }
      // Audio receives the change ahead of time; the public deck state follows
      // only when it becomes audible. Reapplying the engine setter here would
      // either change the UI early or schedule the audio twice.
      this.pendingLoopStates ||= [];
      this.pendingLoopStates.push({ deck, id, when, looping: !!value, start, end });
      this.pendingLoopStates.sort((a, b) => a.when - b.when);
      return;
    }
    if (event.type === 'inputState') return this.inputReplay?.schedule(id, when);
    if (event.type === 'setProjectTempo') {
      // Anchor the replay clock with the journaled beat: followers of the project
      // clock then re-derive the same phase, not merely the same tempo.
      const beat = Number.isFinite(value) ? value : (e.syncClock?.beatAt(when) ?? 0);
      if (e.syncClock) e.syncClock.anchor(Number(id), when, beat);
      else e.syncClock = new SyncClock(Number(id), when, beat);
      return;
    }
    if (event.mixRamps) {
      for (const step of event.mixRamps) {
        const deck = e.decks.get(step.deckId);
        const param =
          step.target === 'unseparated'
            ? e.unseparated.gain
            : step.target === 'deck'
              ? deck?.output.gain
              : deck?.lanes.get(step.laneId)?.gain.gain;
        if (param) ramp(param, step.value, 0.025);
      }
      this.pendingMixStates ||= [];
      this.pendingMixStates.push({ event: event.mixState || event, when });
      this.pendingMixStates.sort((a, b) => a.when - b.when);
      return;
    }
    if (event.type === 'setDeckFx') {
      const deck = e.decks.get(id);
      if (!deck) return;
      ramp(deck.reverb.wet, Math.min(100, Math.max(0, value.reverb || 0)) / 100, 0.04);
      ramp(deck.delay.wet, Math.min(100, Math.max(0, value.echo || 0)) / 100, 0.04);
    } else if (event.type === 'setDeckSend' || event.type === 'setReturn') {
      // A first send is built silent; both ramps start at the journaled time.
      const previous = e.performanceParameterTime;
      e.performanceParameterTime = when;
      try {
        e[event.type]?.(...event.args);
      } finally {
        e.performanceParameterTime = previous;
      }
    } else if (event.type === 'setDeckFilter') {
      const deck = e.decks.get(id);
      if (deck) ramp(deck.filter.frequency, performanceFilter(value).frequency, 0.035);
    } else if (event.type === 'setDeckEq') {
      const deck = e.decks.get(id);
      if (!deck) return;
      for (const band of ['low', 'mid', 'high'])
        ramp(deck.eq[band], (Math.min(100, Math.max(0, value[band] ?? 50)) - 50) * 0.24, 0.035);
    } else if (event.type === 'setMasterLevel') {
      ramp(e.master.gain, masterGain(id), 0.04);
    } else if (event.type === 'setLimiter') {
      ramp(e.limitedGain.gain, id ? 1 : 0, 0.04);
      ramp(e.dryGain.gain, id ? 0 : 1, 0.04);
    } else if (event.type === 'setMasterAssist') {
      rampCompressor(e.masterCompressor, masterAssistProfile(id, value), when);
    } else if (event.type === 'setMasterProcessing') {
      const settings = normalizeMasterProcessing(id);
      ramp(e.masterInputTrim.gain, trimGain(settings.inputTrim), 0.04);
      ramp(e.masterLimiterDrive.gain, trimGain(settings.limiterDrive), 0.04);
      ramp(e.masterEq.lowFrequency, settings.lowFrequency, 0.04);
      ramp(e.masterEq.highFrequency, settings.highFrequency, 0.04);
      e.masterInserts.schedule(settings.effects || [], when);
      for (const band of ['low', 'mid', 'high'])
        ramp(e.masterEq[band], settings.bypass ? 0 : settings[band], 0.04);
      ramp(e.masterLowCut.frequency, settings.bypass ? 20 : settings.lowCut, 0.04);
      ramp(e.masterWidth.width, settings.bypass ? 0.5 : settings.width / 200, 0.04);
      ramp(e.limiter.threshold, settings.ceiling, 0.04);
    }
  }
  commitLoopStates(now) {
    while (this.pendingPitchStates?.length && this.pendingPitchStates[0].when <= now) {
      const { deck, id, state } = this.pendingPitchStates.shift();
      if (this.engine.decks.get(id) !== deck) continue;
      deck.pitch = state.pitch;
      deck.keyLock = state.keyLock;
      for (const [laneId, pitch] of Object.entries(state.stems))
        if (deck.lanes.has(laneId)) deck.lanes.get(laneId).pitch = pitch;
    }
    while (this.pendingMixStates?.length && this.pendingMixStates[0].when <= now) {
      const { event } = this.pendingMixStates.shift();
      const [id, value, updates] = event.args;
      const deck = this.engine.decks.get(id);
      if (event.type === 'setMasterStems') this.engine.masterStems = normalizeMasterStems(id);
      if (event.type === 'setMasterProcessing')
        this.engine.masterStems = normalizeMasterStems(id?.stems);
      if (event.type === 'setCrossfader') this.engine.crossfader = id;
      if (event.type === 'setCrossfaderCurve') this.engine.crossfaderCurve = id;
      if (deck && event.type === 'setDeckGain') deck.gain = value;
      if (deck && event.type === 'setDeckFader') deck.fader = value;
      if (deck && event.type === 'setDeckSide') deck.side = value;
      if (event.type === 'setLaneState' && deck?.lanes.has(value))
        Object.assign(deck.lanes.get(value), updates);
    }
    while (this.pendingTransportStates?.length && this.pendingTransportStates[0].when <= now) {
      const state = this.pendingTransportStates.shift();
      if (this.engine.decks.get(state.id) === state.deck) Object.assign(state.deck, state.values);
    }
    while (this.pendingLoopStates?.length && this.pendingLoopStates[0].when <= now) {
      const state = this.pendingLoopStates.shift();
      if (this.engine.decks.get(state.id) !== state.deck) continue;
      // The players left the loop in place at this audio time (scheduleLoop).
      if (!state.looping) exitLoopInPlace(state.deck, state.when);
      Object.assign(state.deck, {
        looping: state.looping,
        loopStart: state.start,
        loopEnd: state.end,
        loopTransitionTime: state.when,
      });
    }
  }
  async queueInputs(elapsed, preload = false) {
    for (const track of this.inputs)
      for (const clip of track.clips) {
        if (this.stopped) return;
        const start = clip.start - (this.capture.timelineStart || 0);
        if (
          start > elapsed + 8 ||
          start + clip.duration < elapsed ||
          this.scheduledInputs.has(clip.id)
        )
          continue;
        let buffer = this.inputBuffers.get(clip.id);
        if (!buffer) {
          const asset = await getAudioAsset(clip.assetId);
          if (this.stopped) return;
          if (!asset?.blob) throw new Error(`Missing captured input: ${clip.name}`);
          if (asset.blob.size > 64 * 1048576)
            throw new Error('Captured input chunk exceeds the 64 MiB replay budget.');
          const encoded = await asset.blob.arrayBuffer();
          if (this.stopped) return;
          buffer = await this.raw.decodeAudioData(encoded);
          // Decoding cannot be cancelled. Never repopulate disposed buffers or
          // schedule stale input when a stop/dispose happened during the await.
          if (this.stopped) return;
          const bytes = buffer.length * buffer.numberOfChannels * 4;
          if (bytes + this.inputBytes > 64 * 1048576)
            throw new Error('Buffered captured inputs exceed the 64 MiB replay budget.');
          this.inputBuffers.set(clip.id, buffer);
          this.inputBytes += bytes;
        }
        if (this.stopped) return;
        if (preload) continue;
        const node = this.raw.createBufferSource();
        node.buffer = buffer;
        if (track.replayInput === 'microphoneRaw' && this.inputReplay)
          node.connect(this.inputReplay.input);
        else Tone.connect(node, this.engine.unseparated);
        this.inputNodes.add(node);
        node.onended = () => {
          node.disconnect();
          this.inputNodes.delete(node);
          if (this.inputBuffers.delete(clip.id))
            this.inputBytes -= buffer.length * buffer.numberOfChannels * 4;
        };
        const at = this.base + start;
        if (this.raw.currentTime > at + 0.05)
          throw new Error(
            'Input streaming missed its deadline. Replay stopped; keep the safety take.'
          );
        node.start(at, clip.offset || 0, clip.duration);
        this.scheduledInputs.add(clip.id);
      }
  }
  async play({ record = false } = {}) {
    if (this.stopped) return;
    await this.engine.unlock();
    if (this.stopped) return;
    this.stopped = false;
    this.record = record;
    // Loading and decoding must not consume the transport's scheduling runway.
    await this.queueInputs(0, true);
    await this.queueSources(0);
    if (this.stopped) return;
    if (record) await this.engine.startRecording({ longSession: true, sources: false });
    this.base = this.raw.currentTime + 0.5;
    this.inputReplay?.schedule(this.plan.initial.inputState || {}, this.base, true);
    const scheduledLoopDecks = new Set(
      [...this.engine.decks]
        .filter(
          ([id, deck]) =>
            [...deck.lanes.values()].every((lane) => lane.player.scheduleLoop) &&
            !this.plan.events.some(
              (event) =>
                event.args[0] === id &&
                (event.type === 'removeLane' ||
                  (event.type === 'setLaneState' && event.args[2]?.assetId))
            )
        )
        .map(([id]) => id)
    );
    const scheduledPitchDecks = new Set(
      [...scheduledLoopDecks].filter((id) =>
        [...this.engine.decks.get(id).lanes.values()].every(
          (lane) => lane.player.schedulePlaybackRate
        )
      )
    );
    // Decks whose rate the replay controller re-derives from journaled sync intent.
    const derivedDecks = new Set(
      this.plan.events
        .filter(
          (event) =>
            (event.type === 'setDeckSync' && event.args[1]) ||
            (event.type === 'setTempoFollow' && event.args[1]?.length > 1)
        )
        .map((event) => event.args[0])
    );
    const schedule = replayScheduling(this.plan, { scheduledLoopDecks, scheduledPitchDecks });
    this.pitchFollowDecks = new Set(
      [...schedule.pitchDecks].filter(
        (id) =>
          derivedDecks.has(id) &&
          [...this.engine.decks.get(id).lanes.values()].every((lane) => lane.player.schedulePitch)
      )
    );
    for (const id of this.pitchFollowDecks) this.engine.decks.get(id).pitchScheduled = true;
    this.scheduled = schedule.scheduled;
    this.plan.events = schedule.dispatched;
    this.scheduledIndex = 0;
    await this.queueInputs(0);
    for (const d of this.plan.initial.decks)
      if (d.playing)
        this.transport(
          d.id,
          { playing: true, position: d.position || 0, rate: d.playbackRate || 1 },
          this.base + this.plan.initialTime
        );
    const tick = () => {
      try {
        for (const deck of this.engine.decks?.values() || [])
          for (const lane of deck.lanes.values())
            if (lane.player.failure) throw lane.player.failure;
        const elapsed = this.raw.currentTime - this.base;
        while (
          this.scheduledIndex < this.scheduled.length &&
          this.scheduled[this.scheduledIndex].time <= elapsed + 1
        ) {
          const event = this.scheduled[this.scheduledIndex++];
          // Confirmed transport already contains its actual scheduled time.
          const at =
            this.base +
            performanceAudioTime(
              event,
              this.raw.sampleRate || 48000,
              this.engine.getAudioContext().lookAhead || 0
            );
          if (this.raw.currentTime - at > 0.25)
            throw new Error(
              `Replay missed ${event.type} automation by ${Math.round((this.raw.currentTime - at) * 1000)} ms (limit 250 ms). Print stopped; recover partial chunks if needed and retry with less system load.`
            );
          if (this.raw.currentTime > at) {
            this.lateEvents++;
            this.maxLateness = Math.max(this.maxLateness, this.raw.currentTime - at);
          }
          this.scheduleControl(event, Math.max(at, this.raw.currentTime));
        }
        this.commitLoopStates(this.raw.currentTime);
        while (
          this.index < this.plan.events.length &&
          this.plan.events[this.index].time <= elapsed
        ) {
          const event = this.plan.events[this.index++],
            late = elapsed - event.time;
          if (late > 0.25)
            throw new Error(
              `Replay missed ${event.type} dispatch by ${Math.round(late * 1000)} ms (limit 250 ms). Print stopped; recover partial chunks if needed and retry with less system load.`
            );
          this.maxLateness = Math.max(this.maxLateness, late);
          if (late > 0.025) this.lateEvents++;
          const result = this.dispatch(event, this.raw.currentTime + 0.005);
          if (result?.then)
            result.then(
              (value) => {
                if (value === false)
                  void this.fail(
                    new Error(
                      'Replay could not apply a transport change. Keep the safety recording.'
                    )
                  );
              },
              (error) => void this.fail(error)
            );
          else if (result === false)
            throw new Error(
              'Replay could not apply a transport change. Keep the safety recording.'
            );
        }
        if (!this.loadingInputs) {
          this.loadingInputs = this.queueInputs(elapsed)
            .catch((error) => this.fail(error))
            .finally(() => {
              this.loadingInputs = null;
            });
        }
        if (!this.loadingSources && elapsed >= (this.nextSourcePrefetch ?? -1)) {
          this.nextSourcePrefetch = elapsed + 0.5;
          this.loadingSources = this.queueSources(elapsed)
            .catch((error) => this.fail(error))
            .finally(() => {
              this.loadingSources = null;
            });
        }
        if (elapsed >= this.capture.duration) void this.stop();
      } catch (error) {
        void this.fail(error);
      }
    };
    this.timer = setInterval(tick, 10);
    tick(); // Queue the opening before yielding to UI work.
  }
  async fail(error) {
    if (this.stopped) return;
    this.onStatus(error.message);
    await this.stop(error);
  }
  async stop(error) {
    if (this.stopped) return;
    this.stopped = true;
    this.commitLoopStates(this.raw.currentTime);
    this.pendingLoopStates = [];
    this.pendingTransportStates = [];
    this.pendingMixStates = [];
    this.pendingPitchStates = [];
    clearInterval(this.timer);
    this.engine?.stopAll();
    for (const node of this.inputNodes) {
      try {
        node.stop();
      } catch {
        /* A source may already have ended before transport cleanup. */
      }
      node.disconnect();
    }
    this.inputNodes.clear();
    let sources;
    if (this.record) {
      try {
        await this.engine.stopRecording();
      } catch (failure) {
        error ||= failure;
      }
      sources = this.engine.capturedSources();
    }
    this.onFinish({
      sources,
      error,
      lateEvents: this.lateEvents,
      maxLateness: this.maxLateness,
      offset: this.base - (this.engine?.recordingClock || this.base),
    });
  }
  dispose() {
    this.inputReplay?.dispose();
    clearInterval(this.timer);
    this.stopped = true;
    for (const node of this.inputNodes) {
      try {
        node.stop();
      } catch {
        /* Disposing an already-ended source is harmless. */
      }
      node.disconnect();
    }
    this.inputNodes.clear();
    this.engine?.dispose();
    this.sourceCache?.dispose();
    this.buffers.clear();
    this.inputBuffers.clear();
    this.inputBytes = 0;
  }
}
