import * as Tone from 'tone';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function gainFromPercent(value) {
  return Math.pow(clamp(value, 0, 100) / 100, 1.35);
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

export class StudioAudioEngine {
  constructor() {
    this.master = new Tone.Gain(0.82);
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
    this.meter = new Tone.Meter({ normalRange: true, smoothing: 0.84 });
    this.recorder = Tone.Recorder.supported ? new Tone.Recorder() : null;
    this.microphone = null;
    this.decks = new Map();
    this.padPlayers = new Map();
    this.crossfader = 50;
    this.crossfaderCurve = 'Smooth';
    this.padSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.004, decay: 0.12, sustain: 0.08, release: 0.16 },
    }).connect(this.master);
    this.padKick = new Tone.MembraneSynth({
      pitchDecay: 0.035,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 },
    }).connect(this.master);
    this.padNoise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    }).connect(this.master);
    this.padHat = new Tone.MetalSynth({
      frequency: 260,
      envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      harmonicity: 4.8,
      modulationIndex: 25,
      resonance: 4200,
    }).connect(this.master);

    this.master.connect(this.masterCompressor);
    this.masterCompressor.connect(this.limiter);
    this.masterCompressor.connect(this.dryGain);
    this.limiter.connect(this.limitedGain);
    this.limitedGain.connect(this.output);
    this.dryGain.connect(this.output);
    this.output.toDestination();
    this.output.connect(this.meter);
    if (this.recorder) this.output.connect(this.recorder);
  }

  async unlock() {
    await Tone.start();
  }

  ensureDeck(deckId, side = 'left') {
    if (!this.decks.has(deckId)) {
      const output = new Tone.Gain(1).connect(this.master);
      const meter = new Tone.Meter({ normalRange: true, smoothing: 0.82 });
      const reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.012, wet: 0 }).connect(output);
      const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.24, wet: 0 }).connect(
        reverb
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
    await this.unlock();
    const deck = this.ensureDeck(deckId, side);
    const existing = deck.lanes.get(laneId);
    if (existing) {
      existing.player.stop();
      existing.player.dispose();
      existing.filterNode.dispose();
      existing.delayNode.dispose();
      existing.gain.dispose();
    }

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
    const player = new Tone.GrainPlayer({
      fadeIn: 0.008,
      fadeOut: 0.015,
      grainSize: 0.085,
      overlap: 0.035,
    }).connect(laneFilter);
    await player.buffer.load(url);
    player.playbackRate = deck.playbackRate;
    player.detune = deck.pitch * 100;
    deck.lanes.set(laneId, {
      player,
      gain: laneGain,
      filterNode: laneFilter,
      delayNode: laneDelay,
      level: 76,
      muted: false,
      solo: false,
      pitch: 0,
      filter: 50,
      send: 0,
      duration: player.buffer.duration,
    });
    this.applyPlaybackRates(deck);
    this.applyLaneMix(deckId);
    this.applyLoop(deckId);
    return player.buffer.duration;
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
    this.master.gain.rampTo(gainFromPercent(level), 0.04);
  }

  setLimiter(enabled) {
    this.limitedGain.gain.rampTo(enabled ? 1 : 0, 0.04);
    this.dryGain.gain.rampTo(enabled ? 0 : 1, 0.04);
  }

  setMasterAssist(enabled, mode = 'Streaming -14') {
    const profile = masterAssistProfile(enabled, mode);
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
    deck.output.gain.rampTo(
      gainFromPercent(deck.gain) * gainFromPercent(deck.fader) * sideGain,
      0.025
    );
  }

  setDeckEq(deckId, { low = 50, mid = 50, high = 50 }) {
    const deck = this.ensureDeck(deckId);
    deck.eq.low.rampTo(((clamp(low, 0, 100) - 50) / 50) * 12, 0.035);
    deck.eq.mid.rampTo(((clamp(mid, 0, 100) - 50) / 50) * 12, 0.035);
    deck.eq.high.rampTo(((clamp(high, 0, 100) - 50) / 50) * 12, 0.035);
  }

  setDeckFilter(deckId, value) {
    const deck = this.ensureDeck(deckId);
    const normalized = clamp(value, 0, 100);
    if (normalized < 48) {
      deck.filter.type = 'lowpass';
      const frequency = 70 * Math.pow(20000 / 70, normalized / 48);
      deck.filter.frequency.rampTo(frequency, 0.035);
    } else if (normalized > 52) {
      deck.filter.type = 'highpass';
      const frequency = 20 * Math.pow(7500 / 20, (normalized - 52) / 48);
      deck.filter.frequency.rampTo(frequency, 0.035);
    } else {
      deck.filter.type = 'lowpass';
      deck.filter.frequency.rampTo(20000, 0.035);
    }
  }

  setDeckFx(deckId, { reverb = 0, echo = 0 }) {
    const deck = this.ensureDeck(deckId);
    deck.reverb.wet.rampTo(clamp(reverb, 0, 100) / 100, 0.04);
    deck.delay.wet.rampTo(clamp(echo, 0, 100) / 100, 0.04);
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
    lanes.forEach((lane) => {
      const audible = !lane.muted && (!hasSolo || lane.solo);
      lane.gain.gain.rampTo(audible ? gainFromPercent(lane.level) : 0, 0.025);
    });
  }

  setPlaybackRate(deckId, rate) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    if (deck.playing) {
      deck.offset = this.getDeckPosition(deckId);
      deck.startedAt = Tone.now();
    }
    deck.playbackRate = clamp(rate, 0.5, 2);
    this.applyPlaybackRates(deck);
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
      lane.player.start(startTime, safeOffset);
    });
    deck.offset = requestedOffset;
    deck.startedAt = startTime;
    deck.playing = true;
    return true;
  }

  pauseDeck(deckId) {
    const deck = this.decks.get(deckId);
    if (!deck?.playing) return;
    deck.offset = this.getDeckPosition(deckId);
    deck.lanes.forEach((lane) => lane.player.stop());
    deck.playing = false;
  }

  stopDeck(deckId, reset = true) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    deck.lanes.forEach((lane) => lane.player.stop());
    deck.playing = false;
    deck.offset = reset ? 0 : this.getDeckPosition(deckId);
  }

  seekDeck(deckId, seconds) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    const wasPlaying = deck.playing;
    this.stopDeck(deckId);
    deck.offset = Math.max(0, seconds);
    if (wasPlaying) void this.playDeck(deckId);
  }

  async playAll() {
    await this.unlock();
    const startTime = Tone.now() + 0.055;
    await Promise.all(
      [...this.decks.keys()].map((deckId) => this.playDeck(deckId, null, startTime))
    );
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

  async startRecording() {
    if (!this.recorder) throw new Error('Audio recording is not supported by this browser.');
    await this.unlock();
    await this.recorder.start();
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
    await this.unlock();
    const existing = this.padPlayers.get(index);
    if (existing) {
      existing.player.stop();
      existing.player.dispose();
      existing.gain.dispose();
    }
    const gain = new Tone.Gain(gainFromPercent(level)).connect(this.master);
    const player = new Tone.Player().connect(gain);
    await player.load(url);
    this.padPlayers.set(index, { player, gain, level });
  }

  setPadGain(index, level) {
    const pad = this.padPlayers.get(index);
    if (!pad) return;
    pad.level = level;
    pad.gain.gain.rampTo(gainFromPercent(level), 0.025);
  }

  async stopRecording() {
    if (!this.recorder || this.recorder.state === 'stopped') return null;
    return this.recorder.stop();
  }

  async openMicrophone() {
    await this.unlock();
    if (!this.microphone) this.microphone = new Tone.UserMedia().connect(this.master);
    await this.microphone.open();
  }

  closeMicrophone() {
    this.microphone?.close();
  }

  dispose() {
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
    this.microphone?.close();
    this.microphone?.dispose();
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
    this.masterCompressor.dispose();
    this.limiter.dispose();
    this.limitedGain.dispose();
    this.dryGain.dispose();
    this.output.dispose();
    this.master.dispose();
    this.decks.clear();
  }
}
