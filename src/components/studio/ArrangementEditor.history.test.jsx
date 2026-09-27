import '@testing-library/jest-dom/vitest';
import { useRef, useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ArrangementEditor from './ArrangementEditor';
import { audioClip, audioTrack, emptyArrangement, resizeClip } from '../../utils/arrangementModel';

vi.mock('../../utils/arrangementStreamExport', () => ({
  savedExportFiles: vi.fn(async () => []),
  clearExportFile: vi.fn(async () => {}),
}));
const renders = vi.hoisted(() => ({ editor: 0 }));
vi.mock('../../studio/arrangement/useArrangementPlayback', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // Called exactly once per render of the editor itself.
    useArrangementPlayback: (options) => {
      renders.editor++;
      return actual.useArrangementPlayback(options);
    },
  };
});
vi.mock('../../utils/arrangementEngine', () => ({
  ArrangementEngine: class {
    constructor() {
      Object.assign(this, {
        play: vi.fn(async () => true),
        pause: vi.fn(() => 0),
        stop: vi.fn(),
        dispose: vi.fn(),
        audition: vi.fn(),
        revise: vi.fn(async () => true),
        updateMix: vi.fn(),
        setMasterSettings: vi.fn(),
      });
      this.playing = false;
    }
    position() {
      return 0;
    }
  },
}));

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const live = { getAudioContext: () => ({}), pauseAll: vi.fn(), unlock: vi.fn(async () => {}) };
const getEngine = () => live;
const noop = () => {};
const DECKS = [];
const PROCESSING = { effects: [] };
let saved, editor, setProject, rerender;

function Host({ initial }) {
  const [project, setState] = useState(initial);
  const [, setTick] = useState(0);
  const ref = useRef(null);
  saved = project;
  editor = ref;
  setProject = setState;
  rerender = () => setTick((tick) => tick + 1);
  return (
    <ArrangementEditor
      ref={ref}
      project={project}
      onChange={setState}
      getEngine={getEngine}
      bpm={120}
      master={{ level: 100, processing: PROCESSING }}
      decks={DECKS}
      visible
      onBusy={noop}
      onPlaying={noop}
    />
  );
}

// Frozen: any mutation of project state anywhere in the editor throws.
function fixture() {
  const song = audioTrack('Song');
  const intro = audioClip('a', 'Intro', 4);
  intro.automation.volume = [
    { time: 0, value: 100 },
    { time: 4, value: 100 },
  ];
  song.clips = [intro, resizeClip({ ...audioClip('b', 'Verse', 8, 6), fadeIn: 0.5 }, 6)];
  return deepFreeze({ ...emptyArrangement(), tracks: [song] });
}

function pointer(target, type, x, y = 50) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(target, event);
}

// Scoped: a whole-editor role query checks the visibility of every button.
const undoButton = () =>
  within(screen.getByRole('group', { name: 'Editing and export tools' })).getByRole('button', {
    name: 'Undo edit',
  });
const clip = (name) =>
  within(screen.getByRole('region', { name: 'Arrangement timeline' })).getByRole('button', {
    name: `Select clip ${name}`,
  });
const addAudioTrack = () =>
  within(screen.getByRole('group', { name: 'Arrangement actions' })).getByRole('button', {
    name: 'Add audio track',
  });
const clipState = (name) => saved.tracks[0].clips.find((item) => item.name === name);

function start(initial = fixture()) {
  render(<Host initial={initial} />);
  fireEvent.click(screen.getByText('Editing & export'));
  return initial;
}

beforeEach(() => {
  renders.editor = 0;
});
afterEach(() => vi.restoreAllMocks());

it.each([
  ['moves', 'Intro', null, 140, { start: 1, duration: 4 }],
  ['trims the start of', 'Verse', 'start', 140, { start: 7, duration: 5, offset: 1 }],
  ['trims the end of', 'Verse', 'end', 60, { start: 6, duration: 5 }],
])('%s a clip with one undo step', (_, name, handle, to, expected) => {
  const before = start();
  expect(undoButton()).toBeDisabled();
  const target = handle ? clip(name).querySelector(`[data-clip-handle="${handle}"]`) : clip(name);
  pointer(target, 'pointerdown', 100);
  for (const x of [104, 120, to]) pointer(clip(name), 'pointermove', x);
  expect(saved).toBe(before);
  pointer(clip(name), 'pointerup', to);
  expect(clipState(name)).toMatchObject(expected);
  fireEvent.click(undoButton());
  expect(saved).toBe(before);
  expect(undoButton()).toBeDisabled();
});

it.each([
  ['Escape', (name) => fireEvent.keyDown(clip(name), { key: 'Escape' })],
  ['pointercancel', (name) => pointer(clip(name), 'pointercancel', 160)],
])('restores the exact pre-gesture project when %s ends a drag', (_, cancel) => {
  const before = start();
  const snapshot = JSON.stringify(before);
  for (const [name, handle] of [
    ['Intro', null],
    ['Verse', 'start'],
    ['Verse', 'end'],
  ]) {
    const target = handle ? clip(name).querySelector(`[data-clip-handle="${handle}"]`) : clip(name);
    const style = clip(name).getAttribute('style');
    pointer(target, 'pointerdown', 100);
    pointer(clip(name), 'pointermove', 160);
    expect(clip(name).getAttribute('style')).not.toBe(style);
    cancel(name);
    expect(clip(name).getAttribute('style')).toBe(style);
    pointer(clip(name), 'pointerup', 160);
  }
  expect(saved).toBe(before);
  expect(JSON.stringify(saved)).toBe(snapshot);
  expect(saved.tracks[0].clips[1].trimSource.fadeInCurve).toBeUndefined();
  expect(clip('Verse')).toHaveStyle({ left: '240px', width: '240px' });
  expect(undoButton()).toBeDisabled();
});

it('commits a dragged automation point once and drops it on Escape', () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 800,
    bottom: 140,
    width: 800,
    height: 140,
  });
  const before = start();
  fireEvent.click(clip('Intro'));
  const inspector = within(screen.getByRole('region', { name: 'Clip editor' }));
  fireEvent.click(inspector.getByText('Automation', { exact: true }));
  const curve = inspector.getByRole('group', { name: 'volume automation curve' });
  const point = () => inspector.getByRole('button', { name: /^Automation point 1:/ });
  pointer(point(), 'pointerdown', 0, 93);
  pointer(curve, 'pointermove', 400, 70);
  fireEvent.keyDown(curve, { key: 'Escape' });
  pointer(curve, 'pointerup', 400, 70);
  expect(saved).toBe(before);
  pointer(point(), 'pointerdown', 0, 93);
  pointer(curve, 'pointermove', 200, 70);
  pointer(curve, 'pointermove', 400, 70);
  pointer(curve, 'pointerup', 400, 70);
  expect(clipState('Intro').automation.volume).toEqual([
    { time: 2, value: 150 },
    { time: 4, value: 100 },
  ]);
  fireEvent.click(undoButton());
  expect(saved).toBe(before);
  expect(undoButton()).toBeDisabled();
});

it('turns a slider drag into one undo step and restores it on Escape', () => {
  const before = start();
  fireEvent.click(screen.getByText('Track options'));
  const pan = screen.getByRole('slider', { name: 'Pan Song' });
  pointer(pan, 'pointerdown', 10);
  for (const value of ['0.2', '0.4', '0.6']) fireEvent.change(pan, { target: { value } });
  expect(saved.tracks[0].pan).toBe(0.6);
  expect(undoButton()).not.toBeDisabled();
  pointer(document.body, 'pointerup', 10);
  fireEvent.click(undoButton());
  expect(saved).toBe(before);
  expect(undoButton()).toBeDisabled();
  pointer(pan, 'pointerdown', 10);
  fireEvent.change(pan, { target: { value: '-0.5' } });
  fireEvent.keyDown(pan, { key: 'Escape' });
  fireEvent.change(pan, { target: { value: '-0.8' } });
  pointer(document.body, 'pointerup', 10);
  expect(saved).toBe(before);
  expect(undoButton()).toBeDisabled();
});

it('records a live track gesture from the page as one step, and nothing when unchanged', () => {
  const before = start();
  const id = before.tracks[0].id;
  act(() => {
    for (const gain of [110, 140, 180]) editor.current.updateTrack(id, { gain }, { live: true });
  });
  expect(saved.tracks[0].gain).toBe(180);
  act(() => editor.current.commitLiveEdit());
  fireEvent.click(undoButton());
  expect(saved.tracks[0].gain).toBe(100);
  expect(saved).toBe(before);
  expect(undoButton()).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('region', { name: 'Multitrack arrangement' }), {
    key: 'Z',
    ctrlKey: true,
    shiftKey: true,
  });
  expect(saved.tracks[0].gain).toBe(180);
  fireEvent.click(undoButton());
  act(() => editor.current.commitLiveEdit());
  expect(undoButton()).toBeDisabled();
  act(() => {
    editor.current.updateTrack(id, { gain: 150 }, { live: true });
    editor.current.updateTrack(id, { gain: 100 }, { live: true });
    editor.current.commitLiveEdit();
  });
  expect(undoButton()).toBeDisabled();
  act(() => editor.current.updateTrack(id, { muted: true }));
  fireEvent.click(undoButton());
  expect(saved.tracks[0].muted).toBe(false);
});

it('makes applyEdit undoable and keeps earlier history when the page adds a take', () => {
  const before = start();
  fireEvent.click(addAudioTrack());
  const withTrack = saved;
  let applied;
  act(() => {
    applied = editor.current.applyEdit((project) => ({
      ...project,
      tracks: [...project.tracks, { ...audioTrack('Recorded take'), role: 'reference' }],
    }));
  });
  expect(applied).toBe(true);
  expect(saved.tracks.map((track) => track.name)).toEqual(['Song', 'Audio track', 'Recorded take']);
  fireEvent.click(undoButton());
  expect(saved).toBe(withTrack);
  fireEvent.click(undoButton());
  expect(saved).toBe(before);
  act(() => {
    applied = editor.current.applyEdit((project) => ({ ...project, version: 3 }));
  });
  expect(applied).toBe(false);
  expect(saved).toBe(before);
});

it('clears history for a replaced project and on reset', () => {
  start();
  fireEvent.click(addAudioTrack());
  expect(undoButton()).not.toBeDisabled();
  act(() => setProject(emptyArrangement()));
  expect(undoButton()).toBeDisabled();
  fireEvent.click(addAudioTrack());
  act(() => editor.current.reset());
  expect(undoButton()).toBeDisabled();
  expect(saved.tracks).toHaveLength(1);
});

it('does not re-render when the page re-renders with unchanged props', () => {
  start();
  const count = renders.editor;
  act(() => rerender());
  act(() => rerender());
  expect(renders.editor).toBe(count);
  act(() => editor.current.updateTrack(saved.tracks[0].id, { gain: 90 }));
  expect(renders.editor).toBeGreaterThan(count);
});
