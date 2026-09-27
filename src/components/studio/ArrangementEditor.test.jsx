import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ArrangementEditor from './ArrangementEditor';
import { audioClip, audioTrack, emptyArrangement } from '../../utils/arrangementModel';
import { clearExportFile } from '../../utils/arrangementStreamExport';
vi.mock('../../utils/arrangementStreamExport', () => ({
  savedExportFiles: vi.fn(async () => []),
  clearExportFile: vi.fn(async () => {}),
}));

const audio = vi.hoisted(() => ({
  play: vi.fn(async () => true),
  pause: vi.fn(() => 0),
  stop: vi.fn(),
  dispose: vi.fn(),
  audition: vi.fn(),
  revise: vi.fn(async () => true),
  updateMix: vi.fn(),
  setMasterSettings: vi.fn(),
  export: vi.fn(),
}));
vi.mock('../../utils/arrangementEngine', () => ({
  ArrangementEngine: class {
    constructor() {
      Object.assign(this, audio);
      this.playing = false;
      this.end = 30;
      this.play = async (...args) => {
        const result = await audio.play(...args);
        this.playing = true;
        return result;
      };
    }
    position() {
      return 0;
    }
  },
}));
const live = { getAudioContext: () => ({}), pauseAll: vi.fn(), unlock: vi.fn(async () => {}) };
let saved;
function Host({ initial = emptyArrangement() }) {
  const [project, setProject] = useState(initial);
  saved = project;
  return (
    <ArrangementEditor
      project={project}
      onChange={setProject}
      getEngine={() => live}
      bpm={120}
      master={{}}
      decks={[]}
      visible
      onBusy={() => {}}
      onPlaying={() => {}}
    />
  );
}
beforeEach(() => vi.clearAllMocks());
// Whole-document role queries walk hundreds of step, key and cell buttons;
// each lookup is scoped to the panel that owns the control.
const actionsBar = () => within(screen.getByRole('group', { name: 'Arrangement actions' }));
const beatTools = () => within(screen.getByRole('group', { name: 'Beat pattern tools' }));
const stepSequencer = () => within(screen.getByRole('region', { name: 'Drum step sequencer' }));
const pianoRoll = () => within(screen.getByRole('region', { name: 'Piano roll' }));
const editTools = () => within(screen.getByRole('group', { name: 'Editing and export tools' }));
const editorTabs = () => within(screen.getByRole('navigation', { name: 'Lower editor' }));
const instrumentSettings = () => within(screen.getByRole('group', { name: 'Instrument settings' }));
const editorNav = () => within(screen.getByRole('group', { name: 'Editor navigation' }));
// The piano roll has a key and an add-note row per pitch: find its buttons by
// label rather than computing every button's accessible name.
const labelled = (name) => screen.getByLabelText(name, { selector: 'button' });
it('keeps the context editor collapsed until selected and restores the timeline on return', () => {
  render(<Host />);
  const workspace = screen.getByRole('region', { name: 'Multitrack arrangement' });
  expect(workspace).toHaveAttribute('data-editor-open', 'false');
  expect(
    screen.queryByRole('separator', { name: 'Resize context editor' })
  ).not.toBeInTheDocument();
  fireEvent.click(actionsBar().getByRole('button', { name: 'Add instrument' }));
  expect(workspace).toHaveAttribute('data-editor-open', 'true');
  expect(labelled('Add C4 note')).toBeInTheDocument();
  expect(screen.getByText('Instrument settings').closest('details')).not.toHaveAttribute('open');
  const divider = screen.getByRole('separator', { name: 'Resize context editor' });
  fireEvent.keyDown(divider, { key: 'ArrowUp' });
  expect(divider).toHaveAttribute('aria-valuenow', '400');
  fireEvent.keyDown(divider, { key: 'Home' });
  expect(divider).toHaveAttribute('aria-valuenow', '260');
  fireEvent.click(editorNav().getByRole('button', { name: '← Arrangement' }));
  expect(workspace).toHaveAttribute('data-editor-open', 'false');
  expect(screen.getByRole('region', { name: 'Arrangement timeline' })).toBeInTheDocument();
  expect(saved.tracks[0].clips).toHaveLength(1);
});
it('changes supported insert effects through live mix updates without pausing or revising clips', async () => {
  const project = emptyArrangement(),
    track = audioTrack('Song');
  track.clips.push(audioClip('a', 'Audio', 10));
  project.tracks.push(track);
  render(<Host initial={project} />);
  fireEvent.click(screen.getByRole('button', { name: 'Play arrangement' }));
  await waitFor(() => expect(audio.play).toHaveBeenCalled());
  expect(screen.getByText('Editing & export').closest('details')).not.toHaveAttribute('open');
  audio.pause.mockClear();
  audio.revise.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Effects rack' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Sattari EQ' }));
  expect(saved.tracks[0].effects[0].type).toBe('eq');
  expect(audio.updateMix).toHaveBeenCalledWith(saved);
  expect(audio.pause).not.toHaveBeenCalled();
  expect(audio.revise).not.toHaveBeenCalled();
  const savedBeforeFailure = saved;
  audio.updateMix.mockImplementationOnce(() => {
    throw new Error('Effect resources unavailable');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add Sattari Comp' }));
  expect(saved).toBe(savedBeforeFailure);
  expect(screen.getByText('Effect resources unavailable')).toHaveAttribute('role', 'status');
  expect(audio.pause).not.toHaveBeenCalled();
});
it('edits the selected captured take without touching another take or the original events', () => {
  const project = emptyArrangement();
  project.captures = [1, 2].map((index) => ({
    assetId: '',
    name: `Take ${index}`,
    duration: 4,
    events: [{ time: 1, type: 'setDeckGain', args: ['A', 50] }],
  }));
  render(<Host initial={project} />);
  fireEvent.click(screen.getByRole('button', { name: 'Show performance editor' }));
  expect(screen.getByRole('combobox', { name: 'Edit captured take' })).toHaveValue('1');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Event 1 time' }), {
    target: { value: '2' },
  });
  expect(saved.captures[0].events[0].time).toBe(1);
  expect(saved.captures[1].events[0].time).toBe(2);
  expect(saved.captures[1].originalEvents[0].time).toBe(1);
});

it('opens a connected beat sequencer without converting melodic clips', async () => {
  renderWithTools();
  fireEvent.click(actionsBar().getByRole('button', { name: 'Add instrument' }));
  fireEvent.click(actionsBar().getByRole('button', { name: 'Beat sequencer', exact: true }));
  expect(saved.tracks).toHaveLength(2);
  expect(saved.tracks[0].clips[0].instrument).toBe('piano');
  expect(saved.tracks[1].clips[0]).toMatchObject({
    kind: 'midi',
    instrument: 'drums',
    timebase: 'beats',
  });
  fireEvent.click(stepSequencer().getByRole('button', { name: 'Kick step 1', exact: true }));
  expect(saved.tracks[1].clips[0].notes[0]).toMatchObject({ pitch: 'C2', time: 0 });
  await waitFor(() => expect(audio.audition).toHaveBeenCalled());
  fireEvent.click(beatTools().getByRole('button', { name: 'Set pattern loop' }));
  fireEvent.click(
    beatTools().getByRole('button', { name: 'Play arrangement from sequencer', exact: true })
  );
  await waitFor(() => expect(audio.play).toHaveBeenCalledWith(saved, 0, {}, { start: 0, end: 2 }));
  fireEvent.click(beatTools().getByRole('button', { name: 'Open piano roll' }));
  expect(
    within(pianoRoll().getByRole('region', { name: /^Piano notes/ })).getByLabelText(
      'Select C2 note 1',
      { selector: 'button' }
    )
  ).toBeInTheDocument();
  fireEvent.click(editorTabs().getByRole('button', { name: 'Show sequencer editor' }));
  expect(saved.tracks).toHaveLength(2);
  fireEvent.click(stepSequencer().getByRole('button', { name: 'Add empty bar' }));
  expect(saved.tracks[1].clips[0].duration).toBe(4);
  expect(saved.tracks[1].clips[0].notes).toHaveLength(1);
  expect(stepSequencer().getByRole('spinbutton', { name: 'Beat bar' })).toHaveValue(2);
  fireEvent.click(editTools().getByRole('button', { name: 'Undo edit' }));
  expect(saved.tracks[1].clips[0].duration).toBe(2);
  expect(stepSequencer().getByRole('spinbutton', { name: 'Beat bar' })).toHaveValue(1);
  fireEvent.click(editTools().getByRole('button', { name: 'Undo edit' }));
  expect(saved.tracks[1].clips[0].notes).toEqual([]);
  fireEvent.click(actionsBar().getByRole('button', { name: 'Add instrument' }));
  expect(labelled('Add C4 note')).toBeInTheDocument();
});
it('retains completed export downloads and clears only their temporary copy', async () => {
  const project = emptyArrangement(),
    track = audioTrack('Song');
  track.clips.push(audioClip('a', 'Audio', 1));
  project.tracks.push(track);
  const file = new Blob(['audio'], { type: 'audio/wav' });
  audio.export.mockResolvedValueOnce(file);
  const originalUrl = globalThis.URL,
    originalTimeout = globalThis.setTimeout;
  globalThis.URL = class extends originalUrl {
    static createObjectURL() {
      return 'blob:test-export';
    }
    static revokeObjectURL() {}
  };
  const timeout = vi
    .spyOn(globalThis, 'setTimeout')
    .mockImplementation((callback, delay, ...args) =>
      delay === 60000 ? 0 : originalTimeout(callback, delay, ...args)
    );
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    renderWithTools(project);
    fireEvent.click(screen.getByRole('button', { name: 'Export mixdown' }));
    await waitFor(() => expect(audio.export).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Export range & filename'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Download again' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download again' }));
    expect(click).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Clear temporary copy' }));
    await waitFor(() => expect(clearExportFile).toHaveBeenCalledWith(file));
    expect(saved.tracks[0].clips[0].assetId).toBe('a');
  } finally {
    click.mockRestore();
    globalThis.URL = originalUrl;
    timeout.mockRestore();
  }
});
function renderWithTools(initial) {
  render(<Host initial={initial} />);
  fireEvent.click(screen.getByText('Editing & export'));
}

it('adds more than four independent tracks and creates audible instrument notes', async () => {
  render(<Host />);
  for (let i = 0; i < 6; i++)
    fireEvent.click(actionsBar().getByRole('button', { name: 'Add audio track' }));
  expect(saved.tracks).toHaveLength(6);
  fireEvent.click(actionsBar().getByRole('button', { name: 'Add instrument' }));
  fireEvent.click(labelled('Add C4 note'));
  expect(saved.tracks[6].clips[0].notes[0]).toMatchObject({ pitch: 'C4', time: 0 });
  await waitFor(() =>
    expect(audio.audition).toHaveBeenCalledWith(
      expect.objectContaining({ pitch: 'C4', velocity: 0.7, duration: 0.125 }),
      expect.objectContaining({ instrument: 'piano' }),
      expect.objectContaining({ kind: 'midi' }),
      expect.objectContaining({ version: 1 }),
      {}
    )
  );
  expect(screen.getByText('Instrument clip · included in playback & export')).toBeInTheDocument();
});
it('splits, duplicates, deletes and undoes clips without consuming another track', () => {
  const project = emptyArrangement(),
    track = audioTrack('Song');
  track.clips.push(audioClip('a', 'Audio', 10));
  project.tracks.push(track);
  renderWithTools(project);
  fireEvent.click(screen.getByRole('button', { name: 'Select clip Audio' }));
  fireEvent.change(screen.getByLabelText('Arrangement playhead seconds'), {
    target: { value: '4' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Split at playhead' }));
  expect(saved.tracks).toHaveLength(1);
  expect(saved.tracks[0].clips.map((clip) => clip.duration)).toEqual([4, 6]);
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate clip' }));
  expect(saved.tracks[0].clips).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Delete clip' }));
  expect(saved.tracks[0].clips).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Undo edit' }));
  expect(saved.tracks[0].clips).toHaveLength(3);
});
it('persists clip automation and includes it in playback scheduling', async () => {
  const project = emptyArrangement(),
    track = audioTrack('Song');
  track.clips.push(audioClip('a', 'Audio', 10));
  project.tracks.push(track);
  renderWithTools(project);
  fireEvent.click(screen.getByRole('button', { name: 'Select clip Audio' }));
  const editor = within(screen.getByRole('region', { name: 'Clip editor' }));
  fireEvent.click(editor.getByText('Automation', { exact: true }));
  fireEvent.change(editor.getByLabelText('Time in clip (s)'), { target: { value: '2' } });
  fireEvent.change(editor.getByLabelText('Value'), { target: { value: '200' } });
  fireEvent.click(editor.getByRole('button', { name: 'Set point' }));
  expect(saved.tracks[0].clips[0].automation.volume).toEqual([{ time: 2, value: 200 }]);
  fireEvent.click(screen.getByRole('button', { name: 'Play arrangement' }));
  await waitFor(() => expect(audio.play).toHaveBeenCalledWith(saved, 0, {}));
});

it('copies several selected clips together and pastes them relative to the playhead', () => {
  const project = emptyArrangement(),
    track = audioTrack('Songs');
  track.clips = [audioClip('a', 'First', 2), audioClip('b', 'Second', 2, 3)];
  project.tracks.push(track);
  renderWithTools(project);
  fireEvent.click(screen.getByRole('button', { name: 'Select clip First' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select clip Second' }), { shiftKey: true });
  fireEvent.click(screen.getByRole('button', { name: 'Copy clips' }));
  fireEvent.change(screen.getByLabelText('Arrangement playhead seconds'), {
    target: { value: '10' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Paste clips at playhead' }));
  expect(saved.tracks[0].clips.map((clip) => clip.start)).toEqual([0, 3, 10, 13]);
});

it('deletes tracks non-destructively and restores them through undo', () => {
  const project = emptyArrangement(),
    track = audioTrack('Songs');
  track.clips = [audioClip('a', 'First', 2)];
  project.tracks.push(track);
  renderWithTools(project);
  fireEvent.click(screen.getByText('Track options'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete track' }));
  expect(saved.tracks).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Undo edit' }));
  expect(saved.tracks[0].clips[0].assetId).toBe('a');
});

it('keeps an empty timeline and zoom controls visible before adding tracks', () => {
  render(<Host />);
  expect(screen.getByRole('region', { name: 'Arrangement timeline' })).toBeVisible();
  expect(screen.getByText('Drop audio or MIDI onto the timeline')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Seek arrangement timeline' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Play arrangement' })).toBeDisabled();
  const slider = screen.getByRole('slider', { name: 'Timeline zoom' });
  const initial = Number(slider.value);
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in timeline' }));
  expect(Number(slider.value)).toBeGreaterThan(initial);
  fireEvent.click(screen.getByRole('button', { name: 'Zoom out timeline' }));
  expect(Number(slider.value)).toBeCloseTo(initial);
  fireEvent.click(screen.getByRole('button', { name: 'New audio track' }));
  expect(saved.tracks).toHaveLength(1);
  expect(screen.getByRole('region', { name: 'Arrangement timeline' })).toBeVisible();
});

it('fits selected clips and zooms from the keyboard without changing clip timing', () => {
  const project = emptyArrangement(),
    track = audioTrack('Song');
  track.clips.push(audioClip('a', 'Audio', 2, 10));
  project.tracks.push(track);
  render(<Host initial={project} />);
  fireEvent.click(screen.getByRole('button', { name: 'Select clip Audio' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fit selection' }));
  expect(Number(screen.getByRole('slider', { name: 'Timeline zoom' }).value)).toBeCloseTo(
    Math.log2(370)
  );
  fireEvent.keyDown(screen.getByRole('region', { name: 'Multitrack arrangement' }), { key: '-' });
  expect(Number(screen.getByRole('slider', { name: 'Timeline zoom' }).value)).toBeCloseTo(
    Math.log2(370 / 1.5)
  );
  expect(saved.tracks[0].clips[0]).toMatchObject({ start: 10, duration: 2 });
});

it('adds new patterns on the same instrument track', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'New instrument track' }));
  fireEvent.click(screen.getByRole('button', { name: '+ Pattern', exact: true }));
  expect(saved.tracks).toHaveLength(1);
  expect(saved.tracks[0].clips).toHaveLength(2);
  expect(saved.tracks[0].clips[1]).toMatchObject({ kind: 'midi', instrument: 'piano' });
});

it('expands the piano workspace without changing patterns and restores its dock on reopen', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'New instrument track' }));
  fireEvent.click(labelled('Add C4 note'));
  const before = JSON.stringify(saved);
  fireEvent.click(labelled('Expand piano roll'));
  expect(screen.getByRole('region', { name: 'Instrument editor' })).toHaveClass('is-expanded');
  fireEvent.click(labelled('Close instrument editor'));
  fireEvent.click(actionsBar().getByRole('button', { name: 'Piano roll', exact: true }));
  expect(screen.getByRole('region', { name: 'Instrument editor' })).not.toHaveClass('is-expanded');
  expect(JSON.stringify(saved)).toBe(before);
});

it('opens a dock from the toolbar and propagates linked notes with independent-copy escape', () => {
  render(<Host />);
  fireEvent.click(actionsBar().getByRole('button', { name: 'Piano roll', exact: true }));
  expect(screen.getByRole('region', { name: 'Instrument editor' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add instrument pattern' }));
  fireEvent.click(labelled('Add C4 note'));
  fireEvent.click(instrumentSettings().getByRole('button', { name: 'Repeat linked pattern' }));
  fireEvent.click(labelled('Add E4 note'));
  expect(saved.tracks[0].clips.map((clip) => clip.notes.length)).toEqual([2, 2]);
  fireEvent.change(screen.getByLabelText('Instrument', { exact: true }), {
    target: { value: 'synth' },
  });
  expect(saved.tracks[0].clips.every((clip) => clip.instrument === 'synth')).toBe(true);
  fireEvent.click(instrumentSettings().getByRole('button', { name: 'Make independent' }));
  fireEvent.click(labelled('Add G4 note'));
  expect(saved.tracks[0].clips.map((clip) => clip.notes.length)).toEqual([2, 3]);
  fireEvent.click(labelled('Close instrument editor'));
  expect(screen.queryByRole('region', { name: 'Instrument editor' })).not.toBeInTheDocument();
});
