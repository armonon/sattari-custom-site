// Local, deterministic voices: no network, sample downloads, or AudioWorklet startup.
export const INSTRUMENTS = [
  ['piano', 'Studio piano · modeled'],
  ['electric', 'Electric keys'],
  ['bass', 'Analog bass'],
  ['pad', 'Warm pad'],
  ['synth', 'Analog synth'],
  ['drums', 'Drum kit · synthesized'],
  ['sampler', 'Sampler · your audio'],
  ['triangle', 'Triangle keys'],
  ['sine', 'Sine keys'],
];
export function frequency(pitch) {
  const match = /^([A-G])(#?)([0-8])$/.exec(pitch);
  if (!match) throw new Error(`Invalid note: ${pitch}`);
  const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] + (match[2] ? 1 : 0);
  return 440 * 2 ** (((Number(match[3]) + 1) * 12 + semitone - 69) / 12);
}

// Phase-anchored waves let an offline section resume a sustained note without
// resetting its oscillator at the file join. Live and offline use the same wave.
function voiceWave(raw, oscillator, type, hz, elapsed, cycles = hz * elapsed) {
  if (!raw.createPeriodicWave || !oscillator.setPeriodicWave) {
    oscillator.type = type;
    return;
  }
  const count =
    type === 'sine' ? 1 : Math.min(128, Math.max(1, Math.floor(raw.sampleRate / 2 / hz)));
  const real = new Float32Array(count + 1),
    imaginary = new Float32Array(count + 1);
  const phase = (cycles % 1) * Math.PI * 2;
  for (let harmonic = 1; harmonic <= count; harmonic++) {
    const value =
      type === 'sine'
        ? 1
        : type === 'sawtooth'
          ? -2 / (Math.PI * harmonic)
          : harmonic % 2 === 0
            ? 0
            : type === 'square'
              ? 4 / (Math.PI * harmonic)
              : (8 / (Math.PI ** 2 * harmonic ** 2)) * (harmonic % 4 === 1 ? 1 : -1);
    real[harmonic] = value * Math.sin(harmonic * phase);
    imaginary[harmonic] = value * Math.cos(harmonic * phase);
  }
  oscillator.setPeriodicWave(
    raw.createPeriodicWave(real, imaginary, { disableNormalization: true })
  );
}

// This exact voice builder is used by playback, offline export and note audition.
export function instrumentVoice(
  raw,
  output,
  clip,
  note,
  at,
  length,
  elapsed = 0,
  buffers = new Map(),
  naturalLength = length
) {
  const nodes = [],
    sources = [],
    instrument = clip.instrument || 'triangle';
  const base = frequency(note.pitch),
    velocity = Math.max(0, Math.min(1, note.velocity));
  if (instrument === 'sampler' && !buffers.has(clip.assetId))
    throw new Error('Load a sample before playing this sampler pattern.');
  const settings = clip.instrumentSettings || {};
  if (Number.isFinite(settings.cutoff) || ['synth', 'bass', 'pad'].includes(instrument)) {
    const filter = raw.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = instrument === 'synth' ? 1 : 0.5;
    filter.frequency.value = settings.cutoff ?? (instrument === 'bass' ? 1800 : 4000);
    filter.connect(output);
    output = filter;
    nodes.push(filter);
  }
  const add = (source, level, decay = 0, defaultAttack = 0.005, voiceLength = naturalLength) => {
    const attack = Math.max(0.001, settings.attack ?? defaultAttack);
    const envelope = raw.createGain();
    const amplitude = (t) =>
      level * velocity * Math.min(1, t / attack) * (decay ? Math.exp(-t / decay) : 1);
    const release = Math.min(settings.release ?? 0.04, voiceLength / 4),
      end = at + voiceLength;
    envelope.gain.setValueAtTime(amplitude(elapsed), at);
    const attackEnd = Math.min(voiceLength / 4, Math.max(0, attack - elapsed));
    envelope.gain.linearRampToValueAtTime(amplitude(elapsed + attackEnd), at + attackEnd);
    // End an exponential decay after sixteen time constants, then hold near silence.
    // This bounds event count even for indefinitely held MIDI keys.
    if (decay) {
      const decayEnd = Math.max(attackEnd, Math.min(voiceLength - release, decay * 16 - elapsed));
      envelope.gain.exponentialRampToValueAtTime(
        Math.max(1e-7, amplitude(elapsed + decayEnd)),
        at + decayEnd
      );
      envelope.gain.setValueAtTime(
        Math.max(1e-7, amplitude(elapsed + voiceLength - release)),
        end - release
      );
    } else
      envelope.gain.linearRampToValueAtTime(
        amplitude(elapsed + voiceLength - release),
        end - release
      );
    envelope.gain.linearRampToValueAtTime(0, end);
    source.connect(envelope).connect(output);
    nodes.push(source, envelope);
    sources.push(source);
    return { source, end: Math.min(end, at + length) };
  };
  if (instrument === 'sampler') {
    const buffer = buffers.get(clip.assetId);
    if (!buffer) throw new Error('Load a sample before playing this sampler pattern.');
    const source = raw.createBufferSource();
    source.buffer = buffer;
    const rate = base / frequency(clip.sampleRoot || 'C4');
    source.playbackRate.value = rate;
    const offset = elapsed * rate;
    if (offset >= buffer.duration) return { nodes, sources };
    const voice = add(
      source,
      0.8,
      0,
      0.005,
      Math.min(naturalLength, (buffer.duration - offset) / rate)
    );
    source.start(at, offset);
    source.stop(Math.min(voice.end, at + (buffer.duration - offset) / rate));
  } else {
    const profiles = {
      piano: [
        [1, 'sine', 0.18, 1.8],
        [2, 'sine', 0.07, 0.65],
        [3, 'sine', 0.035, 0.25],
      ],
      electric: [
        [1, 'sine', 0.19, 2.4],
        [3, 'sine', 0.05, 0.6],
      ],
      bass: [
        [1, 'triangle', 0.18, 0.8],
        [0.5, 'sine', 0.1, 0.9],
      ],
      pad: [
        [1, 'triangle', 0.12, 0],
        [1.003, 'sine', 0.1, 0],
      ],
      synth: [
        [1, 'sawtooth', 0.08, 0],
        [1.004, 'sawtooth', 0.07, 0],
        [0.5, 'sine', 0.08, 0],
      ],
      sine: [[1, 'sine', 0.22, 0]],
      triangle: [[1, 'triangle', 0.22, 0]],
    };
    // C = kick, D = snare, F#/A# = closed/open hats; other pitches = tuned toms.
    const drumPitch = note.pitch.replace(/[0-8]/g, '');
    const profile =
      instrument === 'drums'
        ? drumPitch === 'C'
          ? [[1, 'sine', 0.5, 0.09]]
          : drumPitch === 'D'
            ? [
                [1, 'triangle', 0.18, 0.07],
                [2.71, 'square', 0.06, 0.05],
                [4.13, 'square', 0.04, 0.05],
              ]
            : ['F#', 'A#'].includes(drumPitch)
              ? [
                  [1, 'square', 0.035, drumPitch === 'A#' ? 0.18 : 0.035],
                  [1.48, 'square', 0.025, 0.04],
                  [2.17, 'square', 0.02, 0.03],
                ]
              : [[1, 'sine', 0.3, 0.13]]
        : profiles[instrument] || profiles.triangle;
    for (const [ratio, type, level, decay] of profile) {
      const source = raw.createOscillator();
      source.type = type;
      const pitch =
        instrument === 'drums'
          ? drumPitch === 'C'
            ? 65
            : ['F#', 'A#'].includes(drumPitch)
              ? 3100
              : 180
          : base;
      source.frequency.value = Math.min(
        raw.sampleRate ? raw.sampleRate / 2 - 1 : 20000,
        pitch * ratio
      );
      if (instrument === 'drums' && drumPitch === 'C') {
        const ramp = Math.min(elapsed, 0.08);
        source.frequency.setValueAtTime(155 - (110 * ramp) / 0.08, at);
        source.frequency.linearRampToValueAtTime(
          45,
          at + Math.min(length, Math.max(0, 0.08 - elapsed))
        );
        voiceWave(
          raw,
          source,
          type,
          155,
          elapsed,
          155 * ramp - 687.5 * ramp * ramp + 45 * Math.max(0, elapsed - 0.08)
        );
      } else {
        voiceWave(raw, source, type, source.frequency.value, elapsed);
      }
      const voice = add(source, level, decay, instrument === 'pad' ? 0.16 : 0.005);
      source.start(at);
      source.stop(voice.end);
    }
  }
  return { nodes, sources };
}

// Shared across live MIDI clips. No silent dropped notes or unbounded polyphony.
export class VoiceBudget {
  constructor(limit = 96) {
    this.limit = limit;
    this.voices = [];
  }
  reserve(start, end) {
    if (this.voices.length >= this.limit * 4)
      throw new Error(
        'MIDI scheduling queue is full. Reduce note density or bounce this part to audio.'
      );
    const overlapping = this.voices.filter((voice) => voice.start < end && voice.end > start);
    const times = [start, ...overlapping.map((voice) => Math.max(start, voice.start))];
    if (
      times.some(
        (time) =>
          overlapping.filter((voice) => voice.start <= time && voice.end > time).length >=
          this.limit
      )
    )
      throw new Error(
        `MIDI voice limit (${this.limit}) reached. Reduce overlapping notes or bounce an instrument to audio.`
      );
    const voice = { start, end };
    this.voices.push(voice);
    return () => {
      this.voices = this.voices.filter((item) => item !== voice);
    };
  }
}

export function rollingNotes(notes, elapsed, when, duration, emit, budget = new VoiceBudget()) {
  const end = elapsed + duration;
  const pending = notes
    .filter((n) => n.time < end && n.time + n.duration > elapsed)
    .map((note) => ({
      note,
      start: when + Math.max(0, note.time - elapsed),
      end: when + Math.min(end, note.time + note.duration) - elapsed,
      elapsed: Math.max(0, elapsed - note.time),
    }))
    .sort((a, b) => a.start - b.start);
  let index = 0,
    cancelled = false;
  const active = new Set();
  return {
    pump(now) {
      if (cancelled) return;
      for (const voice of active)
        if (voice.end <= now) {
          voice.dispose();
          active.delete(voice);
        }
      while (index < pending.length && pending[index].start < now + 0.3) {
        const item = pending[index++];
        if (item.start < now - 0.08)
          throw new Error(
            'MIDI scheduling fell behind. Keep Studio active and reduce system load.'
          );
        const release = budget.reserve(item.start, item.end);
        try {
          const dispose = emit(item);
          active.add({
            end: item.end,
            dispose: () => {
              dispose();
              release();
            },
          });
        } catch (error) {
          release();
          throw error;
        }
      }
    },
    cancel() {
      cancelled = true;
      for (const voice of active) voice.dispose();
      active.clear();
    },
  };
}
