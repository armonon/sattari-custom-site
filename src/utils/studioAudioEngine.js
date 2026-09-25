import * as Tone from 'tone';
import { SourceWindowPool } from './windowedSource';
import { TIMED_PARAMETERS, parameterRamp } from './performanceClock';
import { LiveInput } from './liveInput';
import { audioLatency } from './sessionTelemetry';
import { performanceFilter } from './performanceFilter';
import { alignedBeatPosition } from './beatGrid';
import { SyncClock, phaseError, sourceBeat, sourceTime } from './syncClock';
import { connectLoudness } from './liveLoudness';
import { tempoAt } from './tempoMap';
import { SourceCapture } from './sourceCapture';
import { PerformanceJournal } from './performanceJournal';
import { performanceReverb } from './performanceReverb';
import { createMutableEffectRack } from './arrangementEffects';
import {
  masterGain,
  trimGain,
  monitorGain,
  normalizeMasterProcessing,
  measureMasterChannels,
  normalizeMasterStems,
  masterStemGain,
  masterStemId,
} from './masterOutput';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function markTransport(deck, action, at) {
  deck.transportTransition = {
    action,
    at,
    position: deck.offset,
    playing: deck.playing,
    rate: deck.playbackRate,
  };
}

export function gainFromPercent(value) {
  // Unity is 100%; boosting above unity must not silently clamp to silence's
  // opposite endpoint. Preserve the existing taper below unity.
  const number = Number(value);
  const percent = clamp(Number.isFinite(number) ? number : 100, 0, 300);
  return percent <= 100 ? Math.pow(percent / 100, 1.35) : percent / 100;
}

export function recordingMimeType(isSupported) {
  // Prefer AAC where available: the release QA WebKit build produced a WebM
  // Opus stream with a malformed trailing packet when using its default codec.
  return ['audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find(
    (type) => isSupported?.(type)
  );
}

export function crossfaderGains(value, curve = 'Smooth') {
  const position = clamp(Number(value) || 0, 0, 100) / 100;
  if (curve === 'Linear') return { left: 1 - position, right: position };

  const exponent = curve === 'Sharp' ? 0.32 : 1;
  return {
    left: Math.pow(Math.cos(position * Math.PI * 0.5), exponent),
    right: Math.pow(Math.sin(position * Math.PI * 0.5), exponent),
  };
}

export function masterAssistProfile(enabled, mode = 'Streaming -14') {
  const profiles = {
    'Streaming -14': { threshold: -16, ratio: 2.2, attack: 0.012, release: 0.2 },
    'Club -9': { threshold: -12, ratio: 3.4, attack: 0.006, release: 0.14 },
    'Broadcast -16': { threshold: -20, ratio: 2.8, attack: 0.018, release: 0.28 },
  };
  const profile = profiles[mode] || profiles['Streaming -14'];
  return enabled ? profile : { ...profile, threshold: -1, ratio: 1 };
}

export function buildArrangementSchedule(clips, cursorSeconds = 0) {
  const cursor = Math.max(0, Number(cursorSeconds) || 0);
  return clips.flatMap((clip) => {
    const clipStart = Math.max(0, Number(clip.start) || 0);
    const sourceStart = Math.max(0, Number(clip.trimStart) || 0);
    const sourceEnd = Math.max(sourceStart, Number(clip.trimEnd) || sourceStart);
    const clipEnd = clipStart + (sourceEnd - sourceStart);
    if (!clip.enabled || cursor >= clipEnd) return [];
    return [
      {
        deckId: clip.deckId,
        delay: Math.max(0, clipStart - cursor),
        sourceOffset: sourceStart + Math.max(0, cursor - clipStart),
      },
    ];
  });
}

export class StudioAudioEngine {
  constructor({ monitor = true, recorder = true, metering = monitor } = {}) {
    this.meteringEnabled = metering;
    this.master = new Tone.Gain(0.82);
    this.masterInputTrim = new Tone.Gain(1);
    this.masterLimiterDrive = new Tone.Gain(1);
    this.unseparated = new Tone.Gain(1).connect(this.master);
    this.masterStems = normalizeMasterStems();
    this.masterCompressor = new Tone.Compressor({
      threshold: -1,
      ratio: 1,
      attack: 0.01,
      release: 0.18,
    });
    this.limiter = new Tone.Limiter(-1);
    this.limitedGain = new Tone.Gain(1);
    this.dryGain = new Tone.Gain(0);
    this.output = new Tone.Gain(1);
    this.masterLowCut = new Tone.Filter({ type: 'highpass', frequency: 20, rolloff: -12 });
    this.masterEq = new Tone.EQ3({
      low: 0,
      mid: 0,
      high: 0,
      lowFrequency: 250,
      highFrequency: 2500,
    });
    this.masterWidth = new Tone.StereoWidener(0.5);
    this.monitor = new Tone.Gain(1);
    this.monitorMono = new Tone.Mono();
    this.monitorMonoGain = new Tone.Gain(0);
    this.monitorStereoGain = new Tone.Gain(1);
    this.masterAnalyser = new Tone.Analyser({ type: 'waveform', size: 1024, channels: 2 });
    this.meter = new Tone.Meter({ normalRange: true, smoothing: 0.84 });
    const mimeType = recordingMimeType((type) => globalThis.MediaRecorder?.isTypeSupported(type));
    this.recorder =
      recorder && Tone.Recorder.supported ? new Tone.Recorder(mimeType ? { mimeType } : {}) : null;
    this.decks = new Map();
    this.padPlayers = new Map();
    this.crossfader = 50;
    this.crossfaderCurve = 'Smooth';
    this.padSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.004, decay: 0.12, sustain: 0.08, release: 0.16 },
    }).connect(this.unseparated);
    this.padKick = new Tone.MembraneSynth({
      pitchDecay: 0.035,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 },
    }).connect(this.unseparated);
    this.padNoise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    }).connect(this.unseparated);
    this.padHat = new Tone.MetalSynth({
      frequency: 260,
      envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      harmonicity: 4.8,
      modulationIndex: 25,
      resonance: 4200,
    }).connect(this.unseparated);

    this.masterInserts = createMutableEffectRack(this.master.context.rawContext);
    this.master.chain(this.masterInputTrim, this.masterLowCut, this.masterEq, this.masterWidth);
    Tone.connect(this.masterWidth, this.masterInserts.input);
    Tone.connect(this.masterInserts.output, this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiterDrive);
    this.masterLimiterDrive.connect(this.limiter);
    this.masterLimiterDrive.connect(this.dryGain);
    this.limiter.connect(this.limitedGain);
    this.limitedGain.connect(this.output);
    this.dryGain.connect(this.output);
    // Recorder and meters hear the program bus. Monitor audition controls only affect speakers.
    this.output.chain(this.monitorStereoGain, this.monitor);
    this.output.chain(this.monitorMono, this.monitorMonoGain, this.monitor);
    if (monitor) this.monitor.toDestination();
    this.output.connect(this.masterAnalyser);
    this.output.connect(this.meter);
    if (this.recorder) this.output.connect(this.recorder);
    this.installPerformanceCapture();
  }

  getAudioContext() {
    return this.output.context;
  }

  installPerformanceCapture() {
    this.performanceEvents = [];
    this.performanceLast = new Map();
    for (const name of [
      'playDeck',
      'pauseDeck',
      'stopDeck',
      'seekDeck',
      'setCrossfader',
      'setCrossfaderCurve',
      'setDeckGain',
      'setDeckFader',
      'setDeckSide',
      'setDeckEq',
      'setDeckFilter',
      'setDeckFx',
      'setLaneState',
      'setLaneFx',
      'removeLane',
      'setPlaybackRate',
      'setDeckPitch',
      'setDeckKeyLock',
      'setStemPitch',
      'setLoopRegion',
      'setMasterLevel',
      'setMasterStems',
      'setPadGain',
      'setLoop',
      'setMasterProcessing',
      'setMasterAssist',
      'setLimiter',
      'triggerPad',
      'openMicrophone',
      'closeMicrophone',
    ]) {
      const original = this[name].bind(this);
      this[name] = (...args) => {
        const captureStartedAt = this.performanceStartedAt;
        const previousTransition = this.decks.get(args[0])?.transportTransition;
        const previousTime = this.performanceParameterTime;
        if (TIMED_PARAMETERS.has(name) && this.performanceStartedAt != null) {
          const sampleRate = Tone.getContext().rawContext.sampleRate || 48000;
          this.performanceParameterTime =
            previousTime ?? Math.round(Tone.now() * sampleRate) / sampleRate;
        }
        let result;
        try {
          result = original(...args);
          // Failed synchronous mutations must not poison durable replay history.
          // Transport promises record only after successful application.
          if (result?.then)
            result.then(
              () => {
                if (captureStartedAt != null && this.performanceStartedAt === captureStartedAt)
                  this.capturePerformanceEvent(name, args);
              },
              () => {}
            );
          else this.capturePerformanceEvent(name, args);
        } finally {
          this.performanceParameterTime = previousTime;
        }
        if (['playDeck', 'pauseDeck', 'stopDeck', 'seekDeck', 'setPlaybackRate'].includes(name)) {
          const confirmed = () => {
            const deck = this.decks.get(args[0]);
            const transition = deck?.transportTransition;
            if (
              !transition ||
              transition === previousTransition ||
              this.performanceStartedAt == null ||
              this.performanceStartedAt !== captureStartedAt
            )
              return;
            const { at, ...state } = transition;
            const event = {
              time: Math.max(0, at - this.performanceStartedAt),
              type: 'deckTransport',
              args: [args[0], state],
            };
            event.clockVersion = 1;
            event.sampleRate = this.getAudioContext().rawContext.sampleRate;
            event.frame = Math.round(event.time * event.sampleRate);
            event.sequence = this.performanceEvents.length;
            this.performanceEvents.push(event);
            this.performanceJournal?.append(event);
          };
          if (result?.then) result.then(confirmed, () => {});
          else confirmed();
        }
        return result;
      };
    }
  }

  capturePerformanceEvent(type, args = []) {
    if (this.performanceStartedAt == null) return;
    const key = `${type}:${typeof args[0] === 'string' ? args[0] : ''}`,
      serialized = JSON.stringify(args);
    if (
      (type.startsWith('set') || type === 'inputState') &&
      this.performanceLast.get(key) === serialized
    )
      return;
    this.performanceLast.set(key, serialized);
    const event = {
      time: Math.max(0, this.getAudioContext().rawContext.currentTime - this.performanceStartedAt),
      type,
      args: JSON.parse(serialized),
    };
    event.clockVersion = 1;
    event.sampleRate = this.getAudioContext().rawContext.sampleRate || 48000;
    event.frame = Math.round(event.time * event.sampleRate);
    event.sequence = this.performanceEvents.length;
    if (TIMED_PARAMETERS.has(type)) {
      event.scheduledTime = Math.max(
        0,
        (this.performanceParameterTime ?? Tone.now()) - this.performanceStartedAt
      );
      event.scheduledFrame = Math.round(event.scheduledTime * event.sampleRate);
    }
    this.performanceEvents.push(event);
    this.performanceJournal?.append(event);
  }

  capturedPerformance() {
    return this.performanceEvents || [];
  }

  async unlock() {
    await Tone.start();
    if (this.meteringEnabled && !this.loudnessPending && !this.loudness) {
      this.loudnessPending = connectLoudness(
        this.getAudioContext(),
        this.output,
        Tone.connect,
        Tone.disconnect
      )
        .then((meter) => {
          if (this.disposed) meter.dispose();
          else {
            this.loudness = meter;
            this.loudnessError = null;
          }
        })
        .catch((error) => {
          this.loudnessError = error.message;
        })
        .finally(() => {
          this.loudnessPending = null;
        });
    }
  }

  resetLoudness() {
    this.loudness?.reset();
  }
  setLoudnessRunning(running) {
    this.loudness?.setRunning(running);
  }

  setTempoFollow(id, beats, targetBpm) {
    this.tempoFollowers ||= new Map();
    if (beats?.length > 1) this.tempoFollowers.set(id, { beats, targetBpm });
    else this.tempoFollowers.delete(id);
    if (!this.tempoFollowers.size) {
      clearInterval(this.tempoTimer);
      this.tempoTimer = null;
    } else if (!this.tempoTimer)
      this.tempoTimer = setInterval(() => {
        for (const [id, { beats, targetBpm }] of this.tempoFollowers) {
          const deck = this.decks.get(id);
          if (!deck?.playing) continue;
          if (this.syncFollowers?.has(id)) continue; // one owner of the playback rate
          const rate = clamp(targetBpm / tempoAt(beats, this.getDeckPosition(id)), 0.5, 2);
          if (Math.abs(rate - deck.playbackRate) > 0.001) this.setPlaybackRate(id, rate);
        }
      }, 100);
  }

  setProjectTempo(bpm) {
    const now = Tone.now();
    this.syncClock ||= new SyncClock(bpm, now);
    this.syncClock.setTempo(bpm, now);
  }

  setDeckSync(id, enabled, grid, reference = null) {
    this.syncFollowers ||= new Map();
    if (enabled && grid?.bpm > 0) this.syncFollowers.set(id, { grid, reference });
    else this.syncFollowers.delete(id);
    if (this.syncFollowers.size && this.syncTimer == null)
      this.syncTimer = Tone.getContext().setInterval(() => this.updateBeatSync(), 0.025);
    if (!this.syncFollowers.size && this.syncTimer != null) {
      Tone.getContext().clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  updateBeatSync() {
    if (!this.syncClock) return;
    const now = Tone.now();
    for (const [id, { grid, reference }] of this.syncFollowers || []) {
      const deck = this.decks.get(id);
      if (!deck?.playing || now < deck.startedAt) continue;
      const position = this.getDeckPosition(id);
      const master = reference && this.decks.get(reference.id);
      const target = master?.playing
        ? sourceBeat(this.getDeckPosition(reference.id), reference)
        : this.syncClock.beatAt(now);
      const actual = sourceBeat(position, grid);
      const error = phaseError(target, actual, grid.syncQuantum === 4 ? 4 : 1);
      const localBpm =
        grid.followTempoMap && grid.analysis?.tempoMap?.beats?.length > 1
          ? tempoAt(grid.analysis.tempoMap.beats, position)
          : grid.bpm;
      const masterPosition = master?.playing ? this.getDeckPosition(reference.id) : 0;
      const leaderBpm = master?.playing
        ? (reference.followTempoMap && reference.analysis?.tempoMap?.beats?.length > 1
            ? tempoAt(reference.analysis.tempoMap.beats, masterPosition)
            : reference.bpm) * master.playbackRate
        : this.syncClock.bpm;
      const base = leaderBpm / localBpm;
      // No repeated seek/restart: bounded phase slew, max +/-2% pitch-preserved.
      const rate = clamp(base * (1 + clamp(error * 0.5, -0.02, 0.02)), 0.5, 2);
      deck.syncErrorBeats = error;
      deck.syncLocked = Math.abs(error) < 0.02;
      if (Math.abs(rate - deck.playbackRate) > 0.00005) this.setPlaybackRate(id, rate);
    }
  }

  ensureDeck(deckId, side = 'left') {
    if (!this.decks.has(deckId)) {
      const output = new Tone.Gain(1).connect(this.master);
      const meter = new Tone.Meter({ normalRange: true, smoothing: 0.82 });
      const reverb = performanceReverb().connect(output);
      const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.24, wet: 0 }).connect(
        reverb.input
      );
      const filter = new Tone.Filter({ frequency: 20000, type: 'lowpass', rolloff: -24 }).connect(
        delay
      );
      const eq = new Tone.EQ3({ low: 0, mid: 0, high: 0 }).connect(filter);
      const input = new Tone.Gain(1).connect(eq);
      output.connect(meter);
      this.decks.set(deckId, {
        side,
        input,
        eq,
        filter,
        delay,
        reverb,
        output,
        meter,
        lanes: new Map(),
        gain: 82,
        fader: 82,
        playing: false,
        startedAt: 0,
        offset: 0,
        playbackRate: 1,
        pitch: 0,
        keyLock: true,
        looping: false,
        loopStart: 0,
        loopEnd: 0,
      });
      this.updateDeckOutput(deckId);
    }
    return this.decks.get(deckId);
  }

  async loadLane(deckId, side, laneId, url) {
    // Decoding does not require playback permission. Waiting for Tone.start()
    // here can leave session restoration pending until a user gesture occurs.
    // playDeck/triggerPad remain responsible for resuming the output context.
    const deck = this.ensureDeck(deckId, side);
    this.pendingLaneLoads ??= new Map();
    const loadKey = `${deckId}:${laneId}`;
    const token = Symbol(loadKey);
    this.pendingLaneLoads.set(loadKey, token);

    const laneGain = new Tone.Gain(1).connect(deck.input);
    const laneDelay = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.22,
      wet: 0,
    }).connect(laneGain);
    const laneFilter = new Tone.Filter({
      frequency: 20000,
      type: 'lowpass',
      rolloff: -24,
    }).connect(laneDelay);
    const playerOptions = {
      fadeIn: 0.008,
      fadeOut: 0.015,
      grainSize: 0.085,
      overlap: 0.035,
    };
    const windowed = url?.kind === 'windowed-audio';
    const WindowedGrainPlayer = windowed
      ? (await import('./windowedGrainPlayer')).WindowedGrainPlayer
      : null;
    if (windowed) this.sourceWindowPool ||= new SourceWindowPool(this.getAudioContext().rawContext);
    const player = (
      windowed
        ? new WindowedGrainPlayer(url, this.sourceWindowPool, playerOptions)
        : new Tone.GrainPlayer(playerOptions)
    ).connect(laneFilter);
    try {
      if (windowed) await player.prepareWindow(0);
      else if (typeof url === 'string') await player.buffer.load(url);
      else player.buffer.set(url);
      if (this.disposed || this.pendingLaneLoads.get(loadKey) !== token)
        throw new Error('Audio load was superseded.');
    } catch (error) {
      player.dispose();
      laneFilter.dispose();
      laneDelay.dispose();
      laneGain.dispose();
      if (this.pendingLaneLoads.get(loadKey) === token) this.pendingLaneLoads.delete(loadKey);
      throw error;
    }
    this.pendingLaneLoads.delete(loadKey);
    // Keep the current source alive until its replacement has decoded.
    const existing = deck.lanes.get(laneId);
    this.stopDeck(deckId);
    if (existing) {
      existing.player.dispose();
      existing.filterNode.dispose();
      existing.delayNode.dispose();
      existing.gain.dispose();
    }
    player.playbackRate = deck.playbackRate;
    player.detune = deck.pitch * 100;
    deck.lanes.set(laneId, {
      player,
      gain: laneGain,
      filterNode: laneFilter,
      delayNode: laneDelay,
      level: 100,
      muted: false,
      solo: false,
      pitch: 0,
      filter: 50,
      send: 0,
      duration: windowed ? url.duration : player.buffer.duration,
    });
    this.applyPlaybackRates(deck);
    this.applyLaneMix(deckId);
    this.applyLoop(deckId);
    return windowed ? url.duration : player.buffer.duration;
  }

  removeLane(deckId, laneId) {
    const deck = this.decks.get(deckId);
    const lane = deck?.lanes.get(laneId);
    if (!lane) return;
    lane.player.stop();
    lane.player.dispose();
    lane.filterNode.dispose();
    lane.delayNode.dispose();
    lane.gain.dispose();
    deck.lanes.delete(laneId);
  }

  setMasterLevel(level) {
    parameterRamp(this, this.master.gain, masterGain(level), 0.04);
  }

  setMasterProcessing(value) {
    this.setMasterStems?.(value?.stems);
    const settings = normalizeMasterProcessing(value);
    this.masterInserts?.update(settings.effects || []);
    parameterRamp(this, this.masterInputTrim.gain, trimGain(settings.inputTrim), 0.04);
    parameterRamp(this, this.masterLimiterDrive.gain, trimGain(settings.limiterDrive), 0.04);
    parameterRamp(this, this.masterEq.lowFrequency, settings.lowFrequency, 0.04);
    parameterRamp(this, this.masterEq.highFrequency, settings.highFrequency, 0.04);
    parameterRamp(this, this.masterEq.low, settings.bypass ? 0 : settings.low, 0.04);
    parameterRamp(this, this.masterEq.mid, settings.bypass ? 0 : settings.mid, 0.04);
    parameterRamp(this, this.masterEq.high, settings.bypass ? 0 : settings.high, 0.04);
    parameterRamp(this, this.masterLowCut.frequency, settings.bypass ? 20 : settings.lowCut, 0.04);
    parameterRamp(this, this.masterWidth.width, settings.bypass ? 0.5 : settings.width / 200, 0.04);
    parameterRamp(this, this.limiter.threshold, settings.ceiling, 0.04);
  }

  setMasterMonitor({ mono = false, dimmed = false, muted = false } = {}) {
    this.monitor.gain.rampTo(monitorGain({ dimmed, muted }), 0.04);
    this.monitorMonoGain.gain.rampTo(mono ? 1 : 0, 0.04);
    this.monitorStereoGain.gain.rampTo(mono ? 0 : 1, 0.04);
  }

  getMasterStatus() {
    const [left, right] = this.masterAnalyser.getValue();
    return {
      ...measureMasterChannels(left, right),
      reduction: Math.max(
        0,
        -(this.masterCompressor.reduction || 0),
        this.arrangementReduction?.() || 0
      ),
      state: this.output.context.state,
      sampleRate: this.output.context.sampleRate,
      latency: audioLatency(this.output.context.rawContext),
      loudness: this.loudness?.read() || { available: false, error: this.loudnessError },
    };
  }

  setLimiter(enabled) {
    parameterRamp(this, this.limitedGain.gain, enabled ? 1 : 0, 0.04);
    parameterRamp(this, this.dryGain.gain, enabled ? 0 : 1, 0.04);
  }

  setMasterAssist(enabled, mode = 'Streaming -14') {
    const profile = masterAssistProfile(enabled, mode);
    if (this.performanceParameterTime != null) {
      for (const key of ['threshold', 'ratio', 'attack', 'release'])
        this.masterCompressor[key].setValueAtTime(profile[key], this.performanceParameterTime);
      return;
    }
    this.masterCompressor.threshold.value = profile.threshold;
    this.masterCompressor.ratio.value = profile.ratio;
    this.masterCompressor.attack.value = profile.attack;
    this.masterCompressor.release.value = profile.release;
  }

  setCrossfader(value) {
    this.crossfader = value;
    this.decks.forEach((_, deckId) => this.updateDeckOutput(deckId));
  }

  setCrossfaderCurve(curve) {
    this.crossfaderCurve = ['Smooth', 'Sharp', 'Linear'].includes(curve) ? curve : 'Smooth';
    this.decks.forEach((_, deckId) => this.updateDeckOutput(deckId));
  }

  setDeckGain(deckId, level) {
    const deck = this.ensureDeck(deckId);
    deck.gain = level;
    this.updateDeckOutput(deckId);
  }

  setDeckFader(deckId, level) {
    const deck = this.ensureDeck(deckId);
    deck.fader = level;
    this.updateDeckOutput(deckId);
  }

  setDeckSide(deckId, side) {
    const deck = this.ensureDeck(deckId);
    deck.side = side;
    this.updateDeckOutput(deckId);
  }

  updateDeckOutput(deckId) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    const gains = crossfaderGains(this.crossfader, this.crossfaderCurve);
    const sideGain = deck.side === 'left' ? gains.left : deck.side === 'right' ? gains.right : 1;
    parameterRamp(
      this,
      deck.output.gain,
      gainFromPercent(deck.gain) * gainFromPercent(deck.fader) * sideGain,
      0.025
    );
  }

  setDeckEq(deckId, { low = 50, mid = 50, high = 50 }) {
    const deck = this.ensureDeck(deckId);
    parameterRamp(this, deck.eq.low, ((clamp(low, 0, 100) - 50) / 50) * 12, 0.035);
    parameterRamp(this, deck.eq.mid, ((clamp(mid, 0, 100) - 50) / 50) * 12, 0.035);
    parameterRamp(this, deck.eq.high, ((clamp(high, 0, 100) - 50) / 50) * 12, 0.035);
  }

  setDeckFilter(deckId, value) {
    const deck = this.ensureDeck(deckId);
    const settings = performanceFilter(value);
    deck.filter.type = settings.type;
    parameterRamp(this, deck.filter.frequency, settings.frequency, 0.035);
  }

  setDeckFx(deckId, { reverb = 0, echo = 0 }) {
    const deck = this.ensureDeck(deckId);
    parameterRamp(this, deck.reverb.wet, clamp(reverb, 0, 100) / 100, 0.04);
    parameterRamp(this, deck.delay.wet, clamp(echo, 0, 100) / 100, 0.04);
  }

  setLaneState(deckId, laneId, updates) {
    const deck = this.decks.get(deckId);
    const lane = deck?.lanes.get(laneId);
    if (!deck || !lane) return;
    Object.assign(lane, updates);
    if ('pitch' in updates) this.applyPlaybackRates(deck);
    if ('filter' in updates || 'send' in updates) this.applyLaneFx(lane);
    this.applyLaneMix(deckId);
  }

  setLaneFx(deckId, laneId, updates) {
    const lane = this.decks.get(deckId)?.lanes.get(laneId);
    if (!lane) return;
    Object.assign(lane, updates);
    this.applyLaneFx(lane);
  }

  applyLaneFx(lane) {
    const filter = clamp(lane.filter ?? 50, 0, 100);
    if (filter < 48) {
      lane.filterNode.type = 'lowpass';
      lane.filterNode.frequency.rampTo(70 * Math.pow(20000 / 70, filter / 48), 0.035);
    } else if (filter > 52) {
      lane.filterNode.type = 'highpass';
      lane.filterNode.frequency.rampTo(20 * Math.pow(7500 / 20, (filter - 52) / 48), 0.035);
    } else {
      lane.filterNode.type = 'lowpass';
      lane.filterNode.frequency.rampTo(20000, 0.035);
    }
    lane.delayNode.wet.rampTo(clamp(lane.send ?? 0, 0, 100) / 100, 0.04);
  }

  applyLaneMix(deckId) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    const lanes = [...deck.lanes.values()];
    const hasSolo = lanes.some((lane) => lane.solo);
    deck.lanes.forEach((lane, laneId) => {
      const audible = !lane.muted && (!hasSolo || lane.solo);
      parameterRamp(
        this,
        lane.gain.gain,
        audible ? gainFromPercent(lane.level) * masterStemGain(this.masterStems, laneId) : 0,
        0.025
      );
    });
  }

  setMasterStems(value) {
    this.masterStems = normalizeMasterStems(value);
    for (const id of this.decks.keys()) this.applyLaneMix(id);
    if (this.unseparated)
      parameterRamp(
        this,
        this.unseparated.gain,
        masterStemGain(this.masterStems, 'unseparated'),
        0.025
      );
  }

  getMasterStemSources() {
    const counts = { vocals: 0, drums: 0, bass: 0, other: 0, unseparated: 0 };
    for (const deck of this.decks.values())
      for (const id of deck.lanes.keys()) counts[masterStemId(id)]++;
    return counts;
  }

  setPlaybackRate(deckId, rate) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    if (Math.abs(deck.playbackRate - clamp(rate, 0.5, 2)) < 0.000001) return;
    if (deck.playing) {
      deck.offset = this.getDeckPosition(deckId);
      deck.startedAt = Tone.now();
    }
    deck.playbackRate = clamp(rate, 0.5, 2);
    this.applyPlaybackRates(deck);
    markTransport(deck, 'rate', Tone.now());
  }

  setDeckPitch(deckId, semitones) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    if (deck.playing) {
      deck.offset = this.getDeckPosition(deckId);
      deck.startedAt = Tone.now();
    }
    deck.pitch = clamp(semitones, -12, 12);
    this.applyPlaybackRates(deck);
  }

  setDeckKeyLock(deckId, enabled) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    deck.keyLock = Boolean(enabled);
    this.applyPlaybackRates(deck);
  }

  setStemPitch(deckId, laneId, semitones) {
    const deck = this.decks.get(deckId);
    const lane = deck?.lanes.get(laneId);
    if (!deck || !lane) return;
    lane.pitch = clamp(semitones, -12, 12);
    this.applyPlaybackRates(deck);
  }

  applyPlaybackRates(deck) {
    const transportPitch = deck.keyLock ? 0 : 12 * Math.log2(Math.max(0.01, deck.playbackRate));
    deck.lanes.forEach((lane) => {
      lane.player.playbackRate = deck.playbackRate;
      lane.player.detune = (deck.pitch + (lane.pitch || 0) + transportPitch) * 100;
    });
  }

  setLoop(deckId, enabled, bpm) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    deck.looping = enabled;
    deck.loopStart = 0;
    deck.loopEnd = Math.max(0.25, (60 / Math.max(1, bpm)) * 4);
    this.applyLoop(deckId);
  }

  setLoopRegion(deckId, enabled, start, end) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    deck.looping = enabled;
    deck.loopStart = Math.max(0, Number(start) || 0);
    deck.loopEnd = Math.max(deck.loopStart + 0.05, Number(end) || deck.loopStart + 1);
    this.applyLoop(deckId);
  }

  applyLoop(deckId) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    deck.lanes.forEach((lane) => {
      lane.player.loop = deck.looping;
      if (deck.looping) {
        lane.player.loopStart = deck.loopStart;
        lane.player.loopEnd = Math.min(lane.duration, deck.loopEnd);
      }
    });
  }

  async playDeck(deckId, offset = null, when = undefined) {
    await this.unlock();
    const deck = this.decks.get(deckId);
    if (!deck || !deck.lanes.size) return false;
    if (deck.playing) return true;
    const requestedOffset = offset === null ? deck.offset : offset;
    const startTime = when ?? Tone.now() + 0.035;

    deck.lanes.forEach((lane) => {
      const safeOffset = lane.duration ? requestedOffset % lane.duration : 0;
      // Tone 15 GrainPlayer converts the start offset to ticks using its
      // rate-scaled grain interval, then reads ticks * unscaled grainSize.
      // Compensate here so our public transport always uses SOURCE seconds.
      lane.player.start(startTime, safeOffset / deck.playbackRate);
    });
    deck.offset = requestedOffset;
    deck.startedAt = startTime;
    deck.playing = true;
    markTransport(deck, 'play', startTime);
    return true;
  }

  async alignDeck(deckId, grid, reference, tempo, start = false) {
    await this.unlock();
    const deck = this.decks.get(deckId);
    if (!deck?.lanes.size) return false;
    const now = Tone.now(),
      when = now + 0.06;
    const master = reference && this.decks.get(reference.id);
    const referenceBpm = master?.playing ? reference.bpm : tempo;
    const referencePosition = master?.playing
      ? this.getDeckPosition(reference.id) + (when - now) * master.playbackRate
      : this.syncClock
        ? (this.syncClock.beatAt(when) * 60) / tempo
        : when;
    const position =
      this.getDeckPosition(deckId) + (deck.playing ? (when - now) * deck.playbackRate : 0);
    let offset = alignedBeatPosition(
      position,
      grid.bpm,
      grid.beatOffset || 0,
      referencePosition,
      referenceBpm,
      master?.playing ? reference.beatOffset || 0 : 0,
      grid.syncQuantum === 4 ? 4 : 1
    );
    if (grid.followTempoMap || reference?.followTempoMap) {
      const quantum = grid.syncQuantum === 4 ? 4 : 1;
      const target = master?.playing
        ? sourceBeat(referencePosition, reference)
        : (this.syncClock?.beatAt(when) ?? (when * tempo) / 60);
      let beat = sourceBeat(position, grid);
      beat += phaseError(target, beat, quantum);
      offset = sourceTime(beat, grid);
      while (offset < 0) {
        beat += quantum;
        offset = sourceTime(beat, grid);
      }
    }
    this.setPlaybackRate(deckId, tempo / grid.bpm);
    const playing = deck.playing || start;
    for (const lane of deck.lanes.values()) {
      if (deck.playing) lane.player.stop(when);
      if (playing) lane.player.start(when, (offset % lane.duration) / deck.playbackRate);
    }
    deck.offset = offset;
    deck.startedAt = when;
    deck.playing = playing;
    if (this.performanceStartedAt != null) {
      const event = {
        type: 'deckTransport',
        time: Math.max(0, when - this.performanceStartedAt),
        args: [deckId, { position: offset, playing, rate: deck.playbackRate, action: 'align' }],
      };
      event.clockVersion = 1;
      event.sampleRate = this.getAudioContext().rawContext.sampleRate;
      event.frame = Math.round(event.time * event.sampleRate);
      event.sequence = this.performanceEvents.length;
      this.performanceEvents.push(event);
      this.performanceJournal?.append(event);
    }
    return true;
  }

  pauseDeck(deckId) {
    const deck = this.decks.get(deckId);
    if (!deck?.playing) return;
    deck.offset = this.getDeckPosition(deckId);
    const when = Tone.now();
    deck.lanes.forEach((lane) => lane.player.stop(when));
    deck.playing = false;
    markTransport(deck, 'pause', when);
  }

  stopDeck(deckId, reset = true) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    const position = this.getDeckPosition(deckId);
    const when = Tone.now();
    deck.lanes.forEach((lane) => lane.player.stop(when));
    deck.playing = false;
    deck.offset = reset ? 0 : position;
    markTransport(deck, 'stop', when);
  }

  seekDeck(deckId, seconds) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    const when = Tone.now() + 0.035;
    deck.offset = Math.max(0, Number(seconds) || 0);
    // One atomic seek, not a nested stop plus asynchronous play with three
    // contradictory confirmations and a gap in the captured transport history.
    if (deck.playing)
      for (const lane of deck.lanes.values()) {
        lane.player.stop(when);
        lane.player.start(
          when,
          lane.duration ? (deck.offset % lane.duration) / deck.playbackRate : 0
        );
      }
    deck.startedAt = when;
    markTransport(deck, 'seek', when);
  }

  async playAll() {
    await this.unlock();
    const startTime = Tone.now() + 0.055;
    const ids = [...this.decks.keys()];
    const results = await Promise.all(ids.map((deckId) => this.playDeck(deckId, null, startTime)));
    return ids.filter((_, index) => results[index]);
  }

  async playArrangement(clips, cursorSeconds = 0) {
    await this.unlock();
    const transportStart = Tone.now() + 0.055;
    const started = [];
    for (const item of buildArrangementSchedule(clips, cursorSeconds)) {
      if (await this.playDeck(item.deckId, item.sourceOffset, transportStart + item.delay)) {
        started.push(item.deckId);
      }
    }
    return started;
  }

  pauseAll() {
    this.decks.forEach((_, deckId) => this.pauseDeck(deckId));
  }

  stopAll() {
    this.decks.forEach((_, deckId) => this.stopDeck(deckId));
  }

  getDeckPosition(deckId) {
    const deck = this.decks.get(deckId);
    if (!deck) return 0;
    let position = deck.offset;
    if (deck.playing) position += Math.max(0, Tone.now() - deck.startedAt) * deck.playbackRate;
    if (deck.looping && deck.loopEnd > deck.loopStart) {
      position = deck.loopStart + ((position - deck.loopStart) % (deck.loopEnd - deck.loopStart));
    }
    return Math.max(0, position);
  }

  isDeckPlaying(deckId) {
    return Boolean(this.decks.get(deckId)?.playing);
  }

  getMeterLevel() {
    const value = this.meter.getValue();
    return Array.isArray(value) ? Math.max(...value) : Number(value) || 0;
  }

  getDeckMeterLevel(deckId) {
    const value = this.decks.get(deckId)?.meter.getValue() ?? 0;
    return Array.isArray(value) ? Math.max(...value) : Number(value) || 0;
  }

  async startRecording({ sources = true, timelineStart = 0, longSession = false } = {}) {
    if (!this.recorder && !longSession)
      throw new Error(
        'Compressed audio recording is not supported by this browser. Use long-session WAV capture.'
      );
    await this.unlock();
    await this.loudnessPending;
    this.recordingClock = this.getAudioContext().rawContext.currentTime;
    this.resetLoudness();
    this.recordingWallClock = performance.now();
    this.stopRecordingDiagnostics?.();
    this.recordingDiagnostics = [];
    const raw = this.getAudioContext().rawContext;
    const sampleState = () => {
      const state = {
        wallSeconds: (performance.now() - this.recordingWallClock) / 1000,
        audioSeconds: raw.currentTime - this.recordingClock,
        state: raw.state,
        visibility: globalThis.document?.visibilityState || 'unknown',
      };
      if (this.recordingDiagnostics.length >= 64) this.recordingDiagnostics.shift();
      this.recordingDiagnostics.push(state);
      if (this.performanceJournal?.take)
        this.performanceJournal.take.diagnostics = [...this.recordingDiagnostics];
    };
    raw.addEventListener?.('statechange', sampleState);
    globalThis.document?.addEventListener('visibilitychange', sampleState);
    this.stopRecordingDiagnostics = () => {
      raw.removeEventListener?.('statechange', sampleState);
      globalThis.document?.removeEventListener('visibilitychange', sampleState);
    };
    sampleState();
    this.lastRecordingDuration = 0;
    this.performanceEvents = [];
    this.performanceLast?.clear();
    this.performanceStartedAt = this.recordingClock;
    this.recordingFault = null;
    this.performanceJournal?.dispose();
    this.performanceJournal = new PerformanceJournal({
      clock: () =>
        this.performanceStartedAt == null
          ? this.lastRecordingDuration
          : Math.max(0, this.getAudioContext().rawContext.currentTime - this.recordingClock),
      onError: (error) => {
        this.recordingFault = `Event recovery: ${error}`;
      },
    });
    try {
      await this.performanceJournal.start({
        timelineStart,
        diagnostics: this.recordingDiagnostics,
      });
    } catch (error) {
      this.recordingFault = `Event recovery unavailable: ${error.message}`;
    }
    this.longSession = longSession;
    if (!longSession) {
      try {
        await this.recorder.start();
      } catch (error) {
        this.performanceStartedAt = null;
        this.stopRecordingDiagnostics?.();
        this.performanceJournal?.dispose();
        throw error;
      }
    }
    this.sourceCaptureResult = null;
    {
      const inputs = (sources ? [...this.decks.entries()] : [])
        .filter(([, deck]) => deck.lanes.size)
        .map(([id, deck]) => ({ name: `Deck ${id} · performed`, nodes: [deck.output] }));
      // Reserve a stable lane even when the input connects or reconnects mid-take.
      inputs.push({
        name: 'Mic / input · armed dry',
        omitSilence: true,
        nodes: [this.ensureLiveInput().record],
      });
      inputs.push({
        name: 'Mic / input · performed monitor',
        replayInput: 'microphone',
        omitSilence: true,
        keepEmpty: true,
        nodes: [this.ensureLiveInput().monitor],
      });
      inputs.push({
        name: 'Mic / input · editable source',
        replayInput: 'microphoneRaw',
        omitSilence: true,
        keepEmpty: true,
        nodes: [this.ensureLiveInput().rawRecord],
      });
      inputs.push({
        name: 'Pad instruments',
        replayInput: 'pads',
        nodes: [this.padSynth, this.padKick, this.padNoise, this.padHat],
      });
      for (const [id, pad] of this.padPlayers)
        inputs.push({ name: `Pad ${id + 1}`, replayInput: `pad:${id}`, nodes: [pad.gain] });
      inputs.unshift({ name: 'Master safety', role: 'reference', nodes: [this.output] });
      this.sourceCapture = new SourceCapture();
      try {
        await this.sourceCapture.start(
          this.getAudioContext(),
          inputs,
          (from, to, index) => Tone.connect(from, to, 0, index),
          (from, to) => Tone.disconnect(from, to),
          { timelineStart, referenceClock: this.recordingClock }
        );
        await this.performanceJournal
          ?.attach({ sourceCaptureId: this.sourceCapture.id })
          .catch((error) => {
            this.recordingFault = `Event recovery: ${error.message}`;
          });
      } catch (error) {
        this.sourceCapture?.dispose();
        this.sourceCapture = null;
        this.sourceCaptureResult = { tracks: [], error: `Master recording only: ${error.message}` };
        if (longSession) {
          this.performanceStartedAt = null;
          this.stopRecordingDiagnostics?.();
          this.performanceJournal?.dispose();
          this.longSession = false;
          throw new Error(`Long-session capture could not start: ${error.message}`);
        }
      }
    }
  }

  async triggerPad(index, frequency) {
    await this.unlock();
    const loadedPad = this.padPlayers.get(index);
    if (loadedPad) {
      loadedPad.player.stop();
      loadedPad.player.start();
    } else if (index === 0) this.padKick.triggerAttackRelease('C1', '8n', undefined, 0.86);
    else if (index === 1 || index === 3) this.padNoise.triggerAttackRelease('16n', undefined, 0.52);
    else if (index === 2) this.padHat.triggerAttackRelease('32n', undefined, 0.32);
    else this.padSynth.triggerAttackRelease(frequency, '16n', undefined, 0.46);
  }

  async loadPad(index, url, level = 82) {
    this.pendingPadLoads ??= new Map();
    const token = Symbol('pad');
    this.pendingPadLoads.set(index, token);
    const gain = new Tone.Gain(gainFromPercent(level)).connect(this.unseparated || this.master);
    const player = new Tone.Player().connect(gain);
    try {
      await player.load(url);
      if (this.disposed || this.pendingPadLoads.get(index) !== token)
        throw new Error('Pad load was superseded.');
    } catch (error) {
      player.dispose();
      gain.dispose();
      if (this.pendingPadLoads.get(index) === token) this.pendingPadLoads.delete(index);
      throw error;
    }
    this.pendingPadLoads.delete(index);
    const existing = this.padPlayers.get(index);
    if (existing) {
      existing.player.stop();
      existing.player.dispose();
      existing.gain.dispose();
    }
    this.padPlayers.set(index, { player, gain, level });
  }

  setPadGain(index, level) {
    const pad = this.padPlayers.get(index);
    if (!pad) return;
    pad.level = level;
    pad.gain.gain.rampTo(gainFromPercent(level), 0.025);
  }

  async stopRecording() {
    if (!this.longSession && (!this.recorder || this.recorder.state === 'stopped')) return null;
    this.lastRecordingDuration = Math.max(
      0,
      this.getAudioContext().rawContext.currentTime - this.recordingClock
    );
    this.lastClockLag = Math.max(
      0,
      (performance.now() - this.recordingWallClock) / 1000 - this.lastRecordingDuration
    );
    if (this.lastClockLag > 1)
      this.recordingFault = `Audio clock fell ${this.lastClockLag.toFixed(1)}s behind wall time. Review this take for dropouts or suspension.`;
    this.performanceStartedAt = null;
    this.stopRecordingDiagnostics?.();
    // Stop both paths immediately; chunk encoding/storage may finish afterwards.
    const [masterResult, capturedResult] = await Promise.allSettled([
      this.longSession ? Promise.resolve(null) : this.recorder.stop(),
      this.sourceCapture?.stop().catch((error) => ({
        tracks: [],
        error: `Source capture interrupted: ${error.message}. Recover completed chunks.`,
      })),
    ]);
    const master = masterResult.status === 'fulfilled' ? masterResult.value : null;
    const captured = capturedResult.status === 'fulfilled' ? capturedResult.value : null;
    if (masterResult.status === 'rejected')
      this.recordingFault = `Compressed recording failed: ${masterResult.reason?.message}. Recover the WAV safety chunks.`;
    await this.performanceJournal
      ?.finish({
        duration: this.lastRecordingDuration,
        clockLag: this.lastClockLag,
        warning: this.recordingFault,
        diagnostics: this.recordingDiagnostics,
      })
      .catch((error) => {
        this.recordingFault = `Event recovery: ${error.message}`;
      });
    if (captured)
      this.sourceCaptureResult = {
        ...captured,
        error: captured.error || this.recordingFault,
        offset: Math.max(0, (captured.startTime || this.recordingClock) - this.recordingClock),
      };
    this.sourceCapture = null;
    this.longSession = false;
    return master;
  }
  getRecordingHealth() {
    const duration =
      this.performanceStartedAt == null
        ? this.lastRecordingDuration || 0
        : Math.max(0, this.getAudioContext().rawContext.currentTime - this.recordingClock);
    const clockLag =
      this.performanceStartedAt == null
        ? this.lastClockLag || 0
        : Math.max(0, (performance.now() - this.recordingWallClock) / 1000 - duration);
    return {
      contextState: this.getAudioContext().rawContext.state,
      visibility: globalThis.document?.visibilityState || 'unknown',
      wallSeconds:
        this.performanceStartedAt == null
          ? duration + (this.lastClockLag || 0)
          : (performance.now() - this.recordingWallClock) / 1000,
      capturedFrames: this.sourceCapture?.totalFrames || 0,
      error:
        this.sourceCapture?.error ||
        this.performanceJournal?.error ||
        this.recordingFault ||
        (clockLag > 1
          ? `Audio clock is ${clockLag.toFixed(1)}s behind wall time. Keep Studio foreground and reduce system load; this take needs review.`
          : null),
      clockLag,
      duration:
        this.performanceStartedAt == null
          ? this.lastRecordingDuration || 0
          : Math.max(0, this.getAudioContext().rawContext.currentTime - this.recordingClock),
      pendingBytes: this.sourceCapture?.pendingBytes || 0,
      pendingEvents: this.performanceJournal?.pending.length || 0,
      committedEvents: this.performanceJournal?.take?.committedEvents || 0,
      durableAudioSeconds:
        this.sourceCapture?.committedFrames / this.getAudioContext().rawContext.sampleRate || 0,
    };
  }
  capturedSources() {
    return this.sourceCaptureResult;
  }

  async openMicrophone(deviceId) {
    const request = (this.inputRequest = (this.inputRequest || 0) + 1);
    await this.unlock();
    if (this.disposed || request !== this.inputRequest)
      throw new Error('Input connection cancelled.');
    await this.ensureLiveInput().open(deviceId);
  }

  ensureLiveInput() {
    if (!this.liveInput) {
      this.liveInput = new LiveInput(this.getAudioContext().rawContext);
      this.liveInput.onStateChange = (state) => this.capturePerformanceEvent('inputState', [state]);
      Tone.connect(this.liveInput.monitor, this.unseparated || this.master);
    }
    return this.liveInput;
  }

  setInputSettings(patch) {
    this.ensureLiveInput().update(patch);
  }

  getInputState() {
    return (
      this.liveInput?.snapshot() || {
        status: 'disconnected',
        channel: -1,
        gainDb: 0,
        armed: false,
        monitor: false,
        lowLatency: false,
        highpass: 80,
        compression: false,
        peak: 0,
        channelCount: 0,
      }
    );
  }

  closeMicrophone() {
    this.inputRequest = (this.inputRequest || 0) + 1;
    this.liveInput?.close();
  }

  dispose() {
    this.disposed = true;
    this.sourceWindowPool?.dispose();
    if (this.syncTimer != null) Tone.getContext().clearInterval(this.syncTimer);
    clearInterval(this.tempoTimer);
    this.loudness?.dispose();
    this.stopRecordingDiagnostics?.();
    this.performanceJournal?.dispose();
    this.sourceCapture?.dispose();
    this.decks.forEach((deck) => {
      deck.lanes.forEach((lane) => {
        lane.player.stop();
        lane.player.dispose();
        lane.filterNode.dispose();
        lane.delayNode.dispose();
        lane.gain.dispose();
      });
      deck.input.dispose();
      deck.eq.dispose();
      deck.filter.dispose();
      deck.delay.dispose();
      deck.reverb.dispose();
      deck.meter.dispose();
      deck.output.dispose();
    });
    this.closeMicrophone();
    this.liveInput?.dispose();
    this.padPlayers.forEach(({ player, gain }) => {
      player.stop();
      player.dispose();
      gain.dispose();
    });
    this.padPlayers.clear();
    this.recorder?.dispose();
    this.padSynth.dispose();
    this.padKick.dispose();
    this.padNoise.dispose();
    this.padHat.dispose();
    this.meter.dispose();
    this.masterAnalyser.dispose();
    this.masterLowCut.dispose();
    this.masterInputTrim.dispose();
    this.masterLimiterDrive.dispose();
    this.masterEq.dispose();
    this.masterWidth.dispose();
    this.masterInserts?.dispose();
    this.monitorMono.dispose();
    this.monitorMonoGain.dispose();
    this.monitorStereoGain.dispose();
    this.monitor.dispose();
    this.masterCompressor.dispose();
    this.limiter.dispose();
    this.limitedGain.dispose();
    this.dryGain.dispose();
    this.output.dispose();
    this.master.dispose();
    this.unseparated?.dispose();
    this.decks.clear();
  }
}
