import { beforeEach, expect, it, vi } from 'vitest';
import { ArrangementEngine } from './arrangementEngine';
import { audioClip, audioTrack, emptyArrangement } from './arrangementModel';
import { createExportSink } from './arrangementStreamExport';
import { packageAudio } from './arrangementPackaging';
import { newEffect, rackTail } from './arrangementEffects';
vi.mock('tone', () => ({}));
vi.mock('./arrangementPackaging', () => ({ packageAudio: vi.fn() }));
vi.mock('./arrangementStreamExport', async (original) => ({
  ...(await original()),
  createExportSink: vi.fn(),
}));
let sink;
beforeEach(() => {
  vi.clearAllMocks();
  sink = { write: vi.fn(), finish: vi.fn(async () => 'disk-file'), abort: vi.fn() };
  createExportSink.mockResolvedValue(sink);
  packageAudio.mockImplementation(async ({ channels }) => ({
    bytes: { byteLength: channels[0].length * 6 },
    crc: 1,
  }));
});
function setup(duration) {
  const engine = new ArrangementEngine({}, {}),
    track = audioTrack('Long set');
  track.kind = 'midi';
  track.clips = [{ ...audioClip('', 'Notes', duration), kind: 'midi', notes: [] }];
  engine.renderSection = vi.fn(async (_project, _settings, _track, _first, count) => [
    { length: count },
    { length: count },
  ]);
  return { engine, project: { ...emptyArrangement(), tracks: [track] } };
}
it('exports a tail-only range at absolute sample coordinates with no extra 100 ms', async () => {
  const { engine, project } = setup(1);
  project.tracks[0].effects = [newEffect('echo')];
  await engine.export(
    project,
    {},
    false,
    () => {},
    () => false,
    { start: 1.1, end: 1.6 }
  );
  expect(engine.renderSection).toHaveBeenCalledWith(
    expect.objectContaining({ tracks: project.tracks }),
    {},
    null,
    52800,
    24000
  );
  const header = sink.write.mock.calls[0][0];
  expect(new DataView(header.buffer).getUint32(40, true)).toBe(24000 * 6);
});
it('rejects reversed or non-finite ranges before allocating export storage', async () => {
  const { engine, project } = setup(10);
  await expect(
    engine.export(
      project,
      {},
      false,
      () => {},
      () => false,
      { start: 3, end: 2 }
    )
  ).rejects.toThrow('Choose an export range');
  expect(createExportSink).not.toHaveBeenCalled();
});
it('extends mixdowns for master tails, keeps stems pre-master, and refuses empty exports', async () => {
  const { engine, project } = setup(1);
  const effects = [newEffect('echo')],
    settings = { processing: { effects } };
  await engine.export(project, settings);
  expect(engine.renderSection.mock.calls.reduce((sum, call) => sum + call[4], 0)).toBe(
    Math.round((1.1 + rackTail(effects)) * 48000)
  );
  engine.renderSection.mockClear();
  await engine.export(project, settings, true);
  expect(engine.renderSection.mock.calls.reduce((sum, call) => sum + call[4], 0)).toBe(52800);
  await expect(engine.export(emptyArrangement(), settings)).rejects.toThrow('Add a clip');
});
it('plans an eight-hour export without a whole-set allocation or 32-bit size overflow', async () => {
  const { engine, project } = setup(8 * 3600);
  expect(await engine.export(project, {})).toBe('disk-file');
  const calls = engine.renderSection.mock.calls;
  expect(calls).toHaveLength(961);
  expect(calls.every((call) => call[4] <= 30 * 48000)).toBe(true);
  expect(calls.reduce((sum, call) => sum + call[4], 0)).toBe(Math.round(28800.1 * 48000));
  expect(createExportSink).toHaveBeenCalledWith(expect.any(Number), 'wav');
  expect(createExportSink.mock.calls.at(-1)[0]).toBeGreaterThan(2 ** 32);
  expect(sink.write.mock.calls[0][0].length).toBe(80);
  expect(sink.abort).not.toHaveBeenCalled();
});
it('aborts partial output on cancellation or encoder failure', async () => {
  const { engine, project } = setup(100);
  let cancelled = false;
  engine.renderSection.mockImplementation(async () => {
    cancelled = true;
    return [];
  });
  await expect(
    engine.export(
      project,
      {},
      false,
      () => {},
      () => cancelled
    )
  ).rejects.toThrow(/cancelled/);
  expect(sink.abort).toHaveBeenCalledOnce();
  expect(sink.finish).not.toHaveBeenCalled();
});
it('exports independently aligned long stems incrementally', async () => {
  const { engine, project } = setup(300);
  project.tracks = Array.from({ length: 8 }, (_, index) => ({
    ...structuredClone(project.tracks[0]),
    id: `track-${index}`,
    name: `Track ${index}`,
    clips: project.tracks[0].clips.map((clip) => ({
      ...structuredClone(clip),
      id: `clip-${index}`,
    })),
  }));
  expect(await engine.export(project, {}, true)).toBe('disk-file');
  expect(engine.renderSection).toHaveBeenCalledTimes(88);
  for (const track of project.tracks)
    expect(
      engine.renderSection.mock.calls
        .filter((call) => call[2] === track.id)
        .reduce((sum, call) => sum + call[4], 0)
    ).toBe(14404800);
  expect(createExportSink.mock.calls.at(-1)[0]).toBeGreaterThan(512 * 1024 * 1024);
});
