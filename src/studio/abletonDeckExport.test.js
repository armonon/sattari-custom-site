import { gunzipSync, strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { wavBytes } from '../utils/arrangementExport';

const assets = new Map();
vi.mock('../utils/audioProjectStore', () => ({
  getAudioAsset: async (id) => assets.get(id),
}));

const { exportableLanes, exportDeckForAbleton } = await import('./abletonDeckExport');

const wav = (seconds) => {
  const data = new Float32Array(Math.round(seconds * 44100));
  return new Blob(
    [
      wavBytes({
        numberOfChannels: 1,
        length: data.length,
        sampleRate: 44100,
        getChannelData: () => data,
      }),
    ],
    { type: 'audio/wav' }
  );
};
const lane = (assetId) => ({ status: assetId ? 'ready' : 'empty', assetId });

function deck(lanes, extra = {}) {
  return {
    id: 'A',
    title: 'Night Drive',
    bpm: 124,
    analysis: { bpm: 124 },
    lanes: {
      fullMix: lane(lanes.fullMix),
      drums: lane(lanes.drums),
      bass: lane(lanes.bass),
      music: lane(lanes.music),
      vocals: lane(lanes.vocals),
    },
    ...extra,
  };
}

describe('StemDeck Ableton export', () => {
  it('exports stems in a fixed order with the full mix muted', async () => {
    for (const id of ['mix', 'd', 'b', 'v']) assets.set(id, { blob: wav(1) });
    const source = deck({ fullMix: 'mix', drums: 'd', bass: 'b', vocals: 'v' });
    expect(exportableLanes(source).map((item) => item.id)).toEqual([
      'vocals',
      'drums',
      'bass',
      'fullMix',
    ]);
    const pack = await exportDeckForAbleton(source);
    const files = unzipSync(new Uint8Array(await pack.blob.arrayBuffer()));
    const root = 'Night Drive Project';
    expect(Object.keys(files).filter((name) => name.endsWith('.wav'))).toEqual([
      `${root}/Stems/01 Vocals.wav`,
      `${root}/Stems/02 Drums.wav`,
      `${root}/Stems/03 Bass.wav`,
      `${root}/Stems/04 Full mix.wav`,
    ]);
    const xml = strFromU8(gunzipSync(files[`${root}/Night Drive.als`]));
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('MainTrack Mixer > Tempo > Manual').getAttribute('Value')).toBe('124');
    const speakers = Array.from(doc.querySelectorAll('LiveSet > Tracks > AudioTrack')).map(
      (track) => track.querySelector('Mixer > Speaker > Manual').getAttribute('Value')
    );
    expect(speakers).toEqual(['true', 'true', 'true', 'false']);
    expect(strFromU8(files[`${root}/README.txt`])).toContain('124 BPM (detected');
  });

  it('keeps a lone full mix audible and treats a typed tempo as exact', async () => {
    assets.set('solo', { blob: wav(1) });
    const pack = await exportDeckForAbleton(deck({ fullMix: 'solo' }, { bpm: 90 }));
    const files = unzipSync(new Uint8Array(await pack.blob.arrayBuffer()));
    const xml = strFromU8(gunzipSync(files['Night Drive Project/Night Drive.als']));
    expect(xml).toContain('<Manual Value="90" />');
    expect(xml).not.toMatch(/<Speaker>\s*<LomId Value="0" \/>\s*<Manual Value="false"/);
    expect(strFromU8(files['Night Drive Project/README.txt'])).not.toContain('detected');
  });

  it('refuses an empty deck', async () => {
    await expect(exportDeckForAbleton(deck({}))).rejects.toThrow(/no audio/);
  });
});
