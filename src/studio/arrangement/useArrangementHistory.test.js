import { describe, expect, it, vi } from 'vitest';
import { audioClip, audioTrack, emptyArrangement } from '../../utils/arrangementModel';
import { ArrangementHistory, HISTORY_LIMIT, sameContent } from './useArrangementHistory';
import { updateTrack } from './projectEdits';

function setup() {
  const track = audioTrack('Song');
  track.clips.push(audioClip('a', 'Audio', 4));
  const project = Object.freeze({ ...emptyArrangement(), tracks: [track] });
  const host = {
    publish: vi.fn(),
    sync: vi.fn(),
    onError: vi.fn(),
    onStatus: vi.fn(),
  };
  const history = new ArrangementHistory({ current: project }, host);
  const gain = (value, options) =>
    history.commit(updateTrack(history.project, track.id, { gain: value }), options);
  return { project, track, host, history, gain };
}

describe('arrangement history', () => {
  it('stores previous project references and walks them back and forth', () => {
    const { project, host, history, gain } = setup();
    gain(120);
    const edited = history.project;
    expect(edited.tracks[0].clips).toBe(project.tracks[0].clips);
    expect(history.status).toEqual({ undo: true, redo: false });
    history.undo();
    expect(history.project).toBe(project);
    expect(host.publish).toHaveBeenLastCalledWith(project);
    history.undo(true);
    expect(history.project).toBe(edited);
    expect(history.status).toEqual({ undo: true, redo: false });
  });

  it('keeps at most the configured number of steps and ignores unchanged projects', () => {
    const { history, gain } = setup();
    for (let step = 1; step <= HISTORY_LIMIT + 5; step++) gain(step);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.commit(history.project)).toBe(false);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });

  it('rejects an invalid project without touching the project, history or playback', () => {
    const { project, host, history } = setup();
    expect(history.commit({ ...project, version: 2 })).toBe(false);
    expect(host.onError).toHaveBeenCalledWith(expect.any(Error));
    expect(history.project).toBe(project);
    expect(history.past).toEqual([]);
    expect(host.sync).not.toHaveBeenCalled();
  });

  it('records a live transaction once, and not at all when it ends where it started', () => {
    const { project, history, gain } = setup();
    for (const value of [110, 120, 130]) gain(value, { live: true });
    expect(history.past).toHaveLength(0);
    expect(history.status.undo).toBe(true);
    expect(history.end()).toBe(true);
    expect(history.past).toHaveLength(1);
    history.undo();
    expect(history.project).toBe(project);
    gain(140, { live: true });
    gain(100, { live: true });
    expect(history.end()).toBe(false);
    expect(history.past).toHaveLength(0);
    expect(history.end()).toBe(false);
  });

  it('cancels a transaction back to the exact starting project', () => {
    const { project, host, history, gain } = setup();
    history.begin();
    gain(150, { live: true });
    gain(160, { live: true });
    expect(history.cancel()).toBe(true);
    expect(history.project).toBe(project);
    expect(host.publish).toHaveBeenLastCalledWith(project);
    expect(history.past).toEqual([]);
  });

  it('closes an open transaction before an unrelated edit or an undo', () => {
    const { project, history, gain } = setup();
    gain(150, { live: true });
    const live = history.project;
    gain(90);
    expect(history.past.map((entry) => entry.project)).toEqual([project, live]);
    gain(80, { live: true });
    history.undo();
    expect(history.project.tracks[0].gain).toBe(90);
  });

  it('replays mix-only steps as mix updates and structural steps as full revisions', () => {
    const { history, host, track } = setup();
    history.commit(updateTrack(history.project, track.id, { gain: 50 }), { mix: true });
    history.commit(updateTrack(history.project, track.id, { offline: true }));
    host.sync.mockClear();
    history.undo();
    expect(host.sync).toHaveBeenCalledWith(expect.anything(), false);
    host.sync.mockClear();
    history.undo();
    expect(host.sync).toHaveBeenCalledWith(expect.anything(), true);
    host.sync.mockClear();
    history.undo(true);
    expect(host.sync).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('starts over when a project arrives from outside and reports that once', () => {
    const { history, gain } = setup();
    gain(120);
    const replacement = emptyArrangement();
    expect(history.adopt(history.project)).toBe(false);
    expect(history.adopt(replacement)).toBe(true);
    expect(history.project).toBe(replacement);
    expect(history.status).toEqual({ undo: false, redo: false });
    expect(history.takeAdoption(replacement)).toBe(true);
    expect(history.takeAdoption(replacement)).toBe(false);
  });

  it('compares content with JSON semantics', () => {
    const shared = { notes: [1, 2] };
    expect(sameContent({ a: shared, b: undefined }, { a: shared })).toBe(true);
    expect(sameContent({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(sameContent({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
    expect(sameContent({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameContent([1], { 0: 1 })).toBe(false);
  });
});
