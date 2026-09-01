import * as Tone from 'tone';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function gainFromPercent(value) {
  return Math.pow(clamp(value, 0, 100) / 100, 1.35);
}

export class StudioAudioEngine {
  constructor() {
    this.master = new Tone.Gain(0.82);
    this.limiter = new Tone.Limiter(-1);
    this.limitedGain = new Tone.Gain(1);
    this.dryGain = new Tone.Gain(0);
    this.output = new Tone.Gain(1);
    this.meter = new Tone.Meter({ normalRange: true, smoothing: 0.84 });
    this.recorder = Tone.Recorder.supported ? new Tone.Recorder() : null;
    this.microphone = null;
    this.decks = new Map();
    this.crossfader = 50;
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

    this.master.connect(this.limiter);
    this.master.connect(this.dryGain);
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
      this.decks.set(deckId, {
        side,
        output,
        lanes: new Map(),
        gain: 82,
        playing: false,
        startedAt: 0,
        offset: 0,
        playbackRate: 1,
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
      existing.gain.dispose();
    }

    const laneGain = new Tone.Gain(1).connect(deck.output);
    const player = new Tone.Player({ fadeIn: 0.008, fadeOut: 0.015 }).connect(laneGain);
    await player.load(url);
    player.playbackRate = deck.playbackRate;
    deck.lanes.set(laneId, {
      player,
      gain: laneGain,
      level: 76,
      muted: false,
      solo: false,
      duration: player.buffer.duration,
    });
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

  setCrossfader(value) {
    this.crossfader = value;
    this.decks.forEach((_, deckId) => this.updateDeckOutput(deckId));
  }

  setDeckGain(deckId, level) {
    const deck = this.ensureDeck(deckId);
    deck.gain = level;
    this.updateDeckOutput(deckId);
  }

  updateDeckOutput(deckId) {
    const deck = this.decks.get(deckId);
    if (!deck) return;
    const normalized = clamp(this.crossfader / 100, 0, 1);
    const sideGain =
      deck.side === 'left'
        ? Math.cos(normalized * Math.PI * 0.5)
        : Math.sin(normalized * Math.PI * 0.5);
    deck.output.gain.rampTo(gainFromPercent(deck.gain) * sideGain, 0.025);
  }

  setLaneState(deckId, laneId, updates) {
    const lane = this.decks.get(deckId)?.lanes.get(laneId);
    if (!lane) return;
    Object.assign(lane, updates);
    this.applyLaneMix(deckId);
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
    deck.lanes.forEach((lane) => {
      lane.player.playbackRate = deck.playbackRate;
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

  async startRecording() {
    if (!this.recorder) throw new Error('Audio recording is not supported by this browser.');
    await this.unlock();
    await this.recorder.start();
  }

  async triggerPad(index, frequency) {
    await this.unlock();
    if (index === 0) this.padKick.triggerAttackRelease('C1', '8n', undefined, 0.86);
    else if (index === 1 || index === 3) this.padNoise.triggerAttackRelease('16n', undefined, 0.52);
    else if (index === 2) this.padHat.triggerAttackRelease('32n', undefined, 0.32);
    else this.padSynth.triggerAttackRelease(frequency, '16n', undefined, 0.46);
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
        lane.gain.dispose();
      });
      deck.output.dispose();
    });
    this.microphone?.close();
    this.microphone?.dispose();
    this.recorder?.dispose();
    this.padSynth.dispose();
    this.padKick.dispose();
    this.padNoise.dispose();
    this.padHat.dispose();
    this.meter.dispose();
    this.limiter.dispose();
    this.limitedGain.dispose();
    this.dryGain.dispose();
    this.output.dispose();
    this.master.dispose();
    this.decks.clear();
  }
}
