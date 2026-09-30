// Spotify Basic Pitch, Apache-2.0. Model pinned to upstream fa5997af0a8210982619003269994a1be25eddf3.
// This decoder is deliberately conservative: a note needs both an onset and sustained activation.
// The output is a draft, not a calibrated probability or an identification of the instrument.
export const POLYPHONIC_MODEL = {
  url: '/models/loop/basic-pitch.onnx',
  sha256: '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec',
};
const RATE = 22050;
const WINDOW = 43844;
const OVERLAP = 30;
const HOP = WINDOW - OVERLAP * 256;

export function decodePolyphonic(frames, onsets, times, duration) {
  const events = [];
  for (let midi = 40; midi <= 84; midi++) {
    const bin = midi - 21;
    let current = null;
    let quiet = 0;
    const close = (end) => {
      if (current && end - current.start >= 0.09 && current.frames >= 6)
        events.push({
          midi,
          start: current.start,
          end: Math.min(duration, end),
          confidence: current.sum / current.frames,
        });
      current = null;
      quiet = 0;
    };
    for (let i = 0; i < frames.length; i++) {
      const value = frames[i][bin];
      const onset = onsets[i][bin];
      const peak =
        onset >= 0.5 && onset > (onsets[i - 1]?.[bin] ?? 0) && onset >= (onsets[i + 1]?.[bin] ?? 0);
      if (peak && (!current || times[i] - current.start > 0.09)) {
        close(times[i]);
        current = { start: times[i], sum: 0, frames: 0, last: times[i] };
      }
      if (!current) continue;
      if (value >= 0.3) {
        current.sum += value;
        current.frames++;
        current.last = times[i] + 256 / RATE;
        quiet = 0;
      } else if (++quiet >= 8) close(current.last);
    }
    if (current) close(current.last);
  }
  return events.filter((n) => n.start < n.end).sort((a, b) => a.start - b.start || a.midi - b.midi);
}

export async function transcribePolyphonic(samples, rate, runtime, session, progress = () => {}) {
  // Audio decoding normally supplies 22.05 kHz. Linear conversion here supports callers
  // with other rates; the production importer uses the browser's band-limited decoder.
  const audio =
    rate === RATE
      ? samples
      : Float32Array.from({ length: Math.round((samples.length * RATE) / rate) }, (_, i) => {
          const at = (i * rate) / RATE,
            left = Math.floor(at),
            frac = at - left;
          return (samples[left] || 0) * (1 - frac) + (samples[left + 1] || 0) * frac;
        });
  const frames = [],
    onsets = [],
    times = [];
  const duration = samples.length / rate;
  for (let start = 0; start < audio.length + OVERLAP * 128; start += HOP) {
    const input = new Float32Array(WINDOW);
    const sourceStart = start - OVERLAP * 128;
    const from = Math.max(0, sourceStart),
      to = Math.min(audio.length, sourceStart + WINDOW);
    if (to > from) input.set(audio.subarray(from, to), from - sourceStart);
    const tensor = new runtime.Tensor('float32', input, [1, WINDOW, 1]);
    let result;
    try {
      result = await session.run({ 'serving_default_input_2:0': tensor });
      const note = result['StatefulPartitionedCall:1'];
      const onset = result['StatefulPartitionedCall:2'];
      if (note?.dims[1] !== 172 || onset?.dims[2] !== 88)
        throw new Error('Unexpected note model output.');
      for (let f = OVERLAP / 2; f < 172 - OVERLAP / 2; f++) {
        const time = (sourceStart + f * 256) / RATE;
        if (time >= duration) break;
        times.push(time);
        frames.push(note.data.slice(f * 88, (f + 1) * 88));
        onsets.push(onset.data.slice(f * 88, (f + 1) * 88));
      }
    } finally {
      tensor.dispose?.();
      if (result) Object.values(result).forEach((value) => value.dispose?.());
    }
    progress(Math.min(1, (start + HOP) / audio.length));
  }
  return decodePolyphonic(frames, onsets, times, duration);
}
