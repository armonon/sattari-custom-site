import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { gunzipSync, strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { wavBytes } from '../arrangementExport';
import { buildAbletonPack, safeName, wavInfo } from './abletonPack';
import {
  buildLiveSet,
  buildLiveSetXml,
  liveColorIndex,
  LIVE_COLORS,
  normalizeTempo,
  WARP_MODES,
} from './liveSet';

const RATE = 44100;

/** AudioBuffer-like test tone: `seconds` long, a short burst on every beat. */
function toneBuffer({ seconds, bpm, frequency, channels = 2, everyBeat = true, rate = RATE }) {
  const length = Math.round(seconds * rate);
  const data = Array.from({ length: channels }, () => new Float32Array(length));
  const beat = (60 / bpm) * rate;
  for (let i = 0; i < length; i++) {
    const inBurst = !everyBeat || i % beat < rate * 0.12;
    const value = inBurst ? 0.4 * Math.sin((2 * Math.PI * frequency * i) / rate) : 0;
    for (const channel of data) channel[i] = value;
  }
  return {
    numberOfChannels: channels,
    length,
    sampleRate: rate,
    getChannelData: (channel) => data[channel],
  };
}

const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
const values = (doc, selector) =>
  Array.from(doc.querySelectorAll(selector)).map((node) => node.getAttribute('Value'));

describe('wavInfo', () => {
  it('reads PCM and float WAV headers', () => {
    const buffer = toneBuffer({ seconds: 1, bpm: 120, frequency: 220 });
    expect(wavInfo(wavBytes(buffer))).toEqual({
      format: 'pcm',
      channels: 2,
      sampleRate: RATE,
      bitsPerSample: 24,
      frames: RATE,
    });
    expect(wavInfo(wavBytes(buffer, true))).toMatchObject({
      format: 'float',
      bitsPerSample: 32,
      frames: RATE,
    });
  });

  it('skips unknown chunks and reads WAVE_FORMAT_EXTENSIBLE', () => {
    const plain = wavBytes(toneBuffer({ seconds: 0.5, bpm: 120, frequency: 220, channels: 1 }));
    // RIFF header + a LIST chunk + a 40-byte extensible fmt + the original data chunk.
    const list = new Uint8Array(
      [...'LIST'].map((c) => c.charCodeAt(0)).concat([4, 0, 0, 0, 1, 2, 3, 4])
    );
    const fmt = new Uint8Array(48);
    const view = new DataView(fmt.buffer);
    fmt.set([...'fmt '].map((c) => c.charCodeAt(0)));
    view.setUint32(4, 40, true);
    view.setUint16(8, 0xfffe, true);
    view.setUint16(10, 1, true);
    view.setUint32(12, 48000, true);
    view.setUint16(22, 24, true);
    view.setUint16(32, 1, true); // sub-format: PCM
    const data = plain.subarray(36);
    const bytes = new Uint8Array(12 + list.length + fmt.length + data.length);
    bytes.set(plain.subarray(0, 12));
    bytes.set(list, 12);
    bytes.set(fmt, 12 + list.length);
    bytes.set(data, 12 + list.length + fmt.length);
    expect(wavInfo(bytes)).toMatchObject({ format: 'pcm', sampleRate: 48000, frames: RATE / 2 });
  });

  it('rejects files that are not WAV', () => {
    expect(() => wavInfo(new TextEncoder().encode('ID3 not a wav file'))).toThrow(/Not a WAV/);
  });
});

describe('Live Set XML', () => {
  const tracks = [
    {
      name: 'Vocals',
      file: 'Stems/01 Vocals.wav',
      frames: RATE * 8,
      sampleRate: RATE,
      color: '#d4537e',
    },
    {
      name: 'Drums',
      file: 'Stems/02 Drums.wav',
      frames: RATE * 8,
      sampleRate: RATE,
      color: '#4a9eff',
      warpMode: WARP_MODES.beats,
    },
    {
      name: 'Full mix',
      file: 'Stems/03 Full mix.wav',
      frames: RATE * 8,
      sampleRate: RATE,
      muted: true,
    },
  ];

  it('is well-formed XML from Live 12 with one audio track per stem', () => {
    const doc = parse(buildLiveSetXml({ bpm: 128, tracks }));
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('MajorVersion')).toBe('5');
    expect(doc.documentElement.getAttribute('MinorVersion')).toMatch(/^12\./);
    const audioTracks = Array.from(doc.querySelectorAll('LiveSet > Tracks > AudioTrack'));
    expect(audioTracks).toHaveLength(3);
    expect(doc.querySelectorAll('LiveSet > Tracks > MidiTrack')).toHaveLength(0);
    // The template's return tracks stay.
    expect(doc.querySelectorAll('LiveSet > Tracks > ReturnTrack').length).toBeGreaterThan(0);
    expect(
      audioTracks.map((track) => track.querySelector('Name > UserName').getAttribute('Value'))
    ).toEqual(['Vocals', 'Drums', 'Full mix']);
    const ids = audioTracks.map((track) => track.getAttribute('Id'));
    expect(new Set(ids).size).toBe(3);
  });

  it('sets the project tempo in both the tempo parameter and its arrangement envelope', () => {
    const doc = parse(buildLiveSetXml({ bpm: 92.5, tracks }));
    const tempo = doc.querySelector('MainTrack Mixer > Tempo');
    expect(tempo.querySelector('Manual').getAttribute('Value')).toBe('92.5');
    const target = tempo.querySelector('AutomationTarget').getAttribute('Id');
    const envelope = Array.from(doc.querySelectorAll('MainTrack AutomationEnvelope')).find(
      (node) => node.querySelector('EnvelopeTarget > PointeeId').getAttribute('Value') === target
    );
    expect(envelope.querySelector('FloatEvent').getAttribute('Value')).toBe('92.5');
  });

  it('places one warped clip per track at bar 1, length in beats at the song tempo', () => {
    const doc = parse(buildLiveSetXml({ bpm: 120, tracks }));
    const clips = Array.from(
      doc.querySelectorAll('MainSequencer > Sample > ArrangerAutomation > Events > AudioClip')
    );
    expect(clips).toHaveLength(3);
    for (const clip of clips) {
      expect(clip.getAttribute('Time')).toBe('0');
      expect(clip.querySelector('CurrentStart').getAttribute('Value')).toBe('0');
      // 8 s at 120 BPM = 16 beats = 4 bars.
      expect(clip.querySelector('CurrentEnd').getAttribute('Value')).toBe('16');
      expect(clip.querySelector('Loop > LoopEnd').getAttribute('Value')).toBe('16');
      expect(clip.querySelector('IsWarped').getAttribute('Value')).toBe('true');
      const markers = Array.from(clip.querySelectorAll('WarpMarkers > WarpMarker')).map((m) => [
        m.getAttribute('SecTime'),
        m.getAttribute('BeatTime'),
      ]);
      expect(markers).toEqual([
        ['0', '0'],
        ['8', '16'],
      ]);
      expect(clip.querySelector('SampleRef DefaultDuration').getAttribute('Value')).toBe(
        String(RATE * 8)
      );
      expect(clip.querySelector('SampleRef DefaultSampleRate').getAttribute('Value')).toBe(
        String(RATE)
      );
    }
    expect(values(doc, 'AudioClip FileRef > RelativePath')).toEqual(tracks.map((t) => t.file));
    expect(values(doc, 'AudioClip FileRef > RelativePathType')).toEqual(['1', '1', '1']);
    expect(values(doc, 'AudioClip > WarpMode')).toEqual(['4', '0', '4']);
    // Opens in Arrangement view, where the clips are.
    expect(values(doc, 'LiveSet > SelectedDocumentViewInMainWindow')).toEqual(['0']);
    // The freeze lane stays empty.
    expect(doc.querySelectorAll('FreezeSequencer AudioClip')).toHaveLength(0);
  });

  it('names, colours and mutes tracks', () => {
    const doc = parse(buildLiveSetXml({ bpm: 120, tracks }));
    const audioTracks = Array.from(doc.querySelectorAll('LiveSet > Tracks > AudioTrack'));
    const colors = audioTracks.map((track) =>
      track.querySelector(':scope > Color').getAttribute('Value')
    );
    expect(colors).toEqual([
      String(liveColorIndex('#d4537e')),
      String(liveColorIndex('#4a9eff')),
      '13',
    ]);
    const speakers = audioTracks.map((track) =>
      track.querySelector('DeviceChain > Mixer > Speaker > Manual').getAttribute('Value')
    );
    expect(speakers).toEqual(['true', 'true', 'false']);
    expect(values(doc, 'AudioClip > Name')).toEqual(['Vocals', 'Drums', 'Full mix']);
  });

  it('keeps every automation and modulation target id unique and below NextPointeeId', () => {
    const xml = buildLiveSetXml({ bpm: 120, tracks: [...tracks, ...tracks, ...tracks] });
    const ids = [...xml.matchAll(/<(\w*Target|Pointee) Id="(\d+)"/g)].map((match) =>
      Number(match[2])
    );
    expect(new Set(ids).size).toBe(ids.length);
    const next = Number(/<NextPointeeId Value="(\d+)"/.exec(xml)[1]);
    expect(Math.max(...ids)).toBeLessThan(next);
  });

  it('falls back to 120 BPM and unwarped clips when the tempo is unknown', () => {
    for (const bpm of [null, undefined, 0, NaN, 5000, 'fast']) {
      const doc = parse(buildLiveSetXml({ bpm, tracks: tracks.slice(0, 1) }));
      expect(doc.querySelector('MainTrack Mixer > Tempo > Manual').getAttribute('Value')).toBe(
        '120'
      );
      const clip = doc.querySelector('AudioClip');
      expect(clip.querySelector('IsWarped').getAttribute('Value')).toBe('false');
      // Live rejects a clip without warp markers even when warping is off.
      expect(clip.querySelectorAll('WarpMarker')).toHaveLength(2);
      // Unwarped loops are measured in seconds; the arrangement length is still in beats.
      expect(clip.querySelector('Loop > LoopEnd').getAttribute('Value')).toBe('8');
      expect(clip.querySelector('CurrentEnd').getAttribute('Value')).toBe('16');
    }
  });

  it('snaps a loop that is a sample off the grid to the exact bar', () => {
    // 2 bars at 92 BPM = 5.2173913… s; rendered as a whole number of samples.
    const frames = Math.round((60 / 92) * 8 * RATE);
    const doc = parse(
      buildLiveSetXml({
        bpm: 92,
        tracks: [{ name: 'Loop', file: 'l.wav', frames, sampleRate: RATE }],
      })
    );
    expect(doc.querySelector('CurrentEnd').getAttribute('Value')).toBe('8');
    expect(doc.querySelectorAll('WarpMarker')[1].getAttribute('BeatTime')).toBe('8');
  });

  it('escapes names and paths', () => {
    const xml = buildLiveSetXml({
      bpm: 100,
      tracks: [
        { name: 'Lead "A" & <B>', file: 'Stems/01 A & B.wav', frames: 100, sampleRate: RATE },
      ],
    });
    const doc = parse(xml);
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('AudioTrack UserName').getAttribute('Value')).toBe('Lead "A" & <B>');
    expect(doc.querySelector('AudioClip FileRef > RelativePath').getAttribute('Value')).toBe(
      'Stems/01 A & B.wav'
    );
  });

  it('refuses empty exports', () => {
    expect(() => buildLiveSetXml({ bpm: 120, tracks: [] })).toThrow(/no stems/);
    expect(() =>
      buildLiveSetXml({
        bpm: 120,
        tracks: [{ name: 'x', file: 'x.wav', frames: 0, sampleRate: RATE }],
      })
    ).toThrow(/no audio/);
  });

  it('gzips the Set the way Live stores it', () => {
    const bytes = buildLiveSet({ bpm: 120, tracks });
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
    expect(strFromU8(gunzipSync(bytes))).toBe(buildLiveSetXml({ bpm: 120, tracks }));
  });
});

describe('helpers', () => {
  it('maps colours to the closest Live swatch', () => {
    expect(liveColorIndex('#ff3636')).toBe(LIVE_COLORS.indexOf('#ff3636'));
    expect(liveColorIndex('#fe3535')).toBe(LIVE_COLORS.indexOf('#ff3636'));
    expect(liveColorIndex('not a colour', 7)).toBe(7);
  });

  it('normalizes tempo', () => {
    expect(normalizeTempo('128')).toBe(128);
    expect(normalizeTempo(127.99999)).toBe(128);
    expect(normalizeTempo(-1)).toBeNull();
  });

  it('makes safe file names', () => {
    expect(safeName('My/Song: "Mix"?')).toBe('My Song Mix');
    expect(safeName('  ...  ')).toBe('Sattari export');
    expect(safeName('a'.repeat(200))).toHaveLength(80);
  });
});

describe('Ableton pack', () => {
  const bpm = 128;
  const seconds = (60 / bpm) * 4 * 4; // 4 bars
  const stems = [
    {
      name: 'Vocals',
      color: '#d4537e',
      data: wavBytes(toneBuffer({ seconds, bpm, frequency: 660 }), true),
    },
    {
      name: 'Drums',
      color: '#4a9eff',
      warpMode: WARP_MODES.beats,
      data: wavBytes(toneBuffer({ seconds, bpm, frequency: 110 })),
    },
    { name: 'Bass', color: '#4ad9c4', data: wavBytes(toneBuffer({ seconds, bpm, frequency: 55 })) },
    {
      name: 'Instruments',
      color: '#888780',
      data: wavBytes(toneBuffer({ seconds, bpm, frequency: 330, everyBeat: false })),
    },
  ];

  it('zips a Live project folder: Set, numbered stems and README', async () => {
    const pack = buildAbletonPack({
      title: 'Night Drive',
      bpm,
      source: { app: 'Split', tempoIsEstimate: true },
      stems,
    });
    expect(pack.fileName).toBe('Night Drive (Ableton Live Set).zip');
    const files = unzipSync(new Uint8Array(await pack.blob.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual([
      'Night Drive Project/Night Drive.als',
      'Night Drive Project/README.txt',
      'Night Drive Project/Stems/01 Vocals.wav',
      'Night Drive Project/Stems/02 Drums.wav',
      'Night Drive Project/Stems/03 Bass.wav',
      'Night Drive Project/Stems/04 Instruments.wav',
    ]);
    // WAVs are stored byte-for-byte.
    expect(files['Night Drive Project/Stems/02 Drums.wav']).toEqual(stems[1].data);
    const doc = parse(strFromU8(gunzipSync(files['Night Drive Project/Night Drive.als'])));
    expect(values(doc, 'AudioClip FileRef > RelativePath')).toEqual([
      'Stems/01 Vocals.wav',
      'Stems/02 Drums.wav',
      'Stems/03 Bass.wav',
      'Stems/04 Instruments.wav',
    ]);
    expect(doc.querySelector('MainTrack Mixer > Tempo > Manual').getAttribute('Value')).toBe('128');
    // 4 bars of 4/4 = 16 beats.
    expect(values(doc, 'AudioClip > CurrentEnd')).toEqual(['16', '16', '16', '16']);
    const readme = strFromU8(files['Night Drive Project/README.txt']);
    expect(readme).toContain('Tempo: 128 BPM (detected');
    expect(readme).toContain('01 Vocals.wav  (44.1 kHz, 32-bit float)');
    expect(readme).toContain('double-click "Night Drive.als"');

    // ABLETON_PACK_OUT=/some/dir writes the pack for opening in Live by hand.
    const out = process.env.ABLETON_PACK_OUT;
    if (out) {
      mkdirSync(out, { recursive: true });
      for (const [path, data] of Object.entries(files)) {
        mkdirSync(join(out, path, '..'), { recursive: true });
        writeFileSync(join(out, path), data);
      }
    }
  }, 30000);

  it('packs a song with no known tempo, a muted full mix and awkward names', async () => {
    const pack = buildAbletonPack({
      title: 'Ballad: "B&W" (demo)',
      bpm: null,
      source: { app: 'StemDeck' },
      stems: [
        {
          name: 'Full mix',
          muted: true,
          data: wavBytes(toneBuffer({ seconds: 3, bpm: 90, frequency: 440, rate: 48000 })),
        },
        {
          name: 'Lead <vox> & pad',
          data: wavBytes(toneBuffer({ seconds: 3, bpm: 90, frequency: 880, rate: 48000 }), true),
        },
      ],
    });
    const files = unzipSync(new Uint8Array(await pack.blob.arrayBuffer()));
    const root = 'Ballad B&W (demo) Project';
    expect(Object.keys(files).sort()).toEqual([
      `${root}/Ballad B&W (demo).als`,
      `${root}/README.txt`,
      `${root}/Stems/01 Full mix.wav`,
      `${root}/Stems/02 Lead vox & pad.wav`,
    ]);
    const doc = parse(strFromU8(gunzipSync(files[`${root}/Ballad B&W (demo).als`])));
    expect(doc.querySelector('MainTrack Mixer > Tempo > Manual').getAttribute('Value')).toBe('120');
    expect(values(doc, 'AudioClip > IsWarped')).toEqual(['false', 'false']);
    expect(values(doc, 'AudioClip SampleRef DefaultSampleRate')).toEqual(['48000', '48000']);
    // 3 s at the 120 BPM fallback = 6 beats in the arrangement.
    expect(values(doc, 'AudioClip > CurrentEnd')).toEqual(['6', '6']);
    expect(strFromU8(files[`${root}/README.txt`])).toContain('Tempo: not known');
    const out = process.env.ABLETON_PACK_OUT;
    if (out) {
      for (const [path, data] of Object.entries(files)) {
        mkdirSync(join(`${out}-untimed`, path, '..'), { recursive: true });
        writeFileSync(join(`${out}-untimed`, path), data);
      }
    }
  }, 30000);

  it('rejects non-WAV stems', () => {
    expect(() =>
      buildAbletonPack({
        title: 'x',
        bpm,
        source: { app: 'Split' },
        stems: [{ name: 'x', data: new Uint8Array(64) }],
      })
    ).toThrow(/Not a WAV/);
  });
});
