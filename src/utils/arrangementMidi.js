import { audioClip, audioTrack } from './arrangementModel';

const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiPitch = (key) =>
  key >= 12 && key <= 119 ? `${names[key % 12]}${Math.floor(key / 12) - 1}` : null;

// Used by file import and device capture: note-offs, sustain and overlapping
// retriggers follow the same rules. Times are supplied by the caller's clock.
export class MidiNoteCapture {
  constructor() {
    this.active = new Map();
    this.sustain = new Set();
    this.notes = [];
  }
  finish(key, time) {
    const note = this.active.get(key);
    if (!note) return;
    this.active.delete(key);
    if (time - note.time >= 0.001)
      this.notes.push({
        pitch: note.pitch,
        time: note.time,
        duration: time - note.time,
        velocity: note.velocity,
      });
  }
  message(data, time) {
    const [status, key, value = 0] = data,
      channel = status & 15,
      command = status & 240;
    const id = `${channel}:${key}`;
    if (command === 144 && value > 0) {
      this.finish(id, time);
      const pitch = midiPitch(key);
      if (pitch)
        this.active.set(id, { pitch, time, velocity: value / 127, channel, released: false });
    } else if (command === 128 || (command === 144 && value === 0)) {
      if (this.sustain.has(channel) && this.active.has(id)) this.active.get(id).released = true;
      else this.finish(id, time);
    } else if (command === 176 && key === 64) {
      if (value >= 64) this.sustain.add(channel);
      else {
        this.sustain.delete(channel);
        for (const [id, note] of this.active)
          if (note.channel === channel && note.released) this.finish(id, time);
      }
    } else if (command === 176 && (key === 120 || key === 123)) {
      for (const [id, note] of this.active) if (note.channel === channel) this.finish(id, time);
    }
  }
  stop(time) {
    for (const id of this.active.keys()) this.finish(id, time);
    this.sustain.clear();
    return this.notes.sort((a, b) => a.time - b.time);
  }
}

// Standard MIDI files 0/1, PPQ timing. Imported notes follow the current project
// tempo; tempo-map/audio warping is deliberately not implied by this importer.
export function importMidi(bytes, { bpm = 120, start = 0, name = 'MIDI' } = {}) {
  const data = new Uint8Array(bytes);
  if (data.length > 16 * 1024 * 1024) throw new Error('MIDI files must be under 16 MB.');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0,
    limit = data.length;
  const need = (n) => {
    if (pos + n > limit) throw new Error('Truncated MIDI file.');
  };
  const u8 = () => {
    need(1);
    return data[pos++];
  };
  const u16 = () => {
    need(2);
    const n = view.getUint16(pos);
    pos += 2;
    return n;
  };
  const u32 = () => {
    need(4);
    const n = view.getUint32(pos);
    pos += 4;
    return n;
  };
  const tag = () => String.fromCharCode(u8(), u8(), u8(), u8());
  const vlq = () => {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const n = u8();
      value = value * 128 + (n & 127);
      if (!(n & 128)) return value;
    }
    throw new Error('Invalid MIDI variable-length value.');
  };
  if (tag() !== 'MThd') throw new Error('Not a Standard MIDI file.');
  const header = u32(),
    headerEnd = pos + header;
  if (header < 6 || headerEnd > data.length) throw new Error('Invalid MIDI header.');
  const format = u16(),
    count = u16(),
    ppq = u16();
  if (format > 1 || !count || count > 256 || !ppq || ppq & 32768)
    throw new Error('Use MIDI format 0 or 1 with PPQ timing (not SMPTE).');
  pos = headerEnd;
  const tracks = [];
  let ignored = 0,
    notes = 0;
  for (let i = 0; i < count; i++) {
    limit = data.length;
    if (tag() !== 'MTrk') throw new Error('Missing MIDI track.');
    const size = u32();
    need(size);
    limit = pos + size;
    let tick = 0,
      running = null,
      title = `${name} ${i + 1}`;
    const capture = new MidiNoteCapture();
    while (pos < limit) {
      tick += vlq();
      const time = ((tick / ppq) * 60) / bpm;
      if (time + start > 86400) throw new Error('MIDI exceeds the 24-hour timeline limit.');
      let status = u8();
      if (status < 128) {
        if (running == null) throw new Error('Invalid MIDI running status.');
        pos--;
        status = running;
      }
      if (status === 255) {
        running = null;
        const type = u8(),
          size = vlq();
        need(size);
        if (type === 3)
          title =
            new TextDecoder()
              .decode(data.subarray(pos, pos + size))
              .replace(/\p{Cc}/gu, '')
              .slice(0, 80) || title;
        if (type === 81) ignored++;
        pos += size;
        if (type === 47) {
          pos = limit;
          break;
        }
      } else if (status === 240 || status === 247) {
        running = null;
        const size = vlq();
        need(size);
        pos += size;
        ignored++;
      } else if (status < 240) {
        running = status;
        const command = status & 240,
          a = u8(),
          b = command === 192 || command === 208 ? 0 : u8();
        if (a > 127 || b > 127) throw new Error('Invalid MIDI data byte.');
        capture.message([status, a, b], time);
        if (![128, 144].includes(command) && !(command === 176 && [64, 120, 123].includes(a)))
          ignored++;
        if (command === 144 && b > 0 && ++notes > 100000)
          throw new Error('MIDI exceeds 100,000 notes.');
      } else throw new Error('Unsupported MIDI event.');
    }
    const events = capture.stop(((tick / ppq) * 60) / bpm);
    if (events.length) {
      const track = audioTrack(title);
      track.kind = 'midi';
      const duration = events.reduce(
        (end, note) => Math.max(end, note.time + note.duration),
        60 / bpm
      );
      track.clips.push({
        ...audioClip('', title, duration, start),
        kind: 'midi',
        timebase: 'beats',
        instrument: 'triangle',
        notes: events,
      });
      tracks.push(track);
    }
  }
  if (!tracks.length) throw new Error('No supported pitched notes (C0–B8) were found.');
  return { tracks, ignored };
}
