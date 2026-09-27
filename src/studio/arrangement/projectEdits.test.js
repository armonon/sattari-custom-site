import { expect, it } from 'vitest';
import { audioClip, audioTrack, emptyArrangement } from '../../utils/arrangementModel';
import * as edits from './projectEdits';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function fixture() {
  const song = audioTrack('Song');
  song.clips = [audioClip('a', 'Intro', 4), audioClip('b', 'Verse', 4, 6)];
  const vox = audioTrack('Vox');
  vox.clips = [audioClip('c', 'Take', 2, 1)];
  return deepFreeze({
    ...emptyArrangement(),
    tracks: [song, vox],
    locators: [{ id: 'm', name: 'Drop', time: 2 }],
    captures: [{ id: 'cap', assetId: 'x', name: 'Take', events: [] }],
  });
}

it('applies every editor operation to frozen projects without mutating them', () => {
  const project = fixture();
  const snapshot = JSON.stringify(project);
  const [song, vox] = project.tracks;
  const [intro, verse] = song.clips;
  const recovered = { ...audioTrack('Rescued'), clips: [audioClip('r', 'Rescued', 1)] };
  const results = [
    edits.appendTracks(project, [audioTrack()]),
    edits.updateTrack(project, song.id, { gain: 150 }),
    edits.toggleTrackOffline(project, vox.id),
    edits.duplicateTrack(project, song.id),
    edits.moveTrack(project, vox.id, -1),
    edits.deleteTrack(project, song.id),
    edits.appendClip(project, vox.id, audioClip('d', 'New', 1, 5)),
    edits.removeClips(project, [intro.id, vox.clips[0].id]),
    edits.replaceClip(project, vox.id, { ...verse, start: 9 }),
    edits.dropClip(project, intro.id, vox.id, 3),
    edits.splitClipAt(project, verse.id, 7),
    edits.pasteClips(
      project,
      [
        { trackId: 'gone', clip: intro },
        { trackId: song.id, clip: verse },
      ],
      20
    ),
    edits.relinkAsset(project, 'a', { assetId: 'a2', sourceDuration: 9, waveform: [1, 2] }),
    edits.addLocator(project, 5),
    edits.renameLocator(project, 'm', 'Break'),
    edits.deleteLocator(project, 'm'),
    edits.replaceCapture(project, 0, { ...project.captures[0], name: 'Edited' }),
    edits.recoverEvents(project, { id: 'j', sourceCaptureId: 's', events: [] }, [
      { id: 's', tracks: [recovered] },
    ]),
    edits.recoverSourceTake(project, { tracks: [{ ...song, clips: [audioClip('e', 'More', 1)] }] }),
    edits.addReferenceTake(project, audioTrack('Reference')),
  ];
  expect(results.every((result) => result !== project)).toBe(true);
  expect(JSON.stringify(project)).toBe(snapshot);
});

it('returns the same project for no-op edits and shares untouched tracks otherwise', () => {
  const project = fixture();
  const [song, vox] = project.tracks;
  expect(edits.updateTrack(project, song.id, { gain: song.gain })).toBe(project);
  expect(edits.removeClips(project, ['missing'])).toBe(project);
  expect(edits.relinkAsset(project, 'missing', { assetId: 'z' })).toBe(project);
  expect(edits.splitClipAt(project, song.clips[0].id, 0)).toBe(project);
  expect(edits.moveTrack(project, song.id, -1)).toBe(project);
  expect(edits.replaceClip(project, 'missing', song.clips[0])).toBe(project);
  const edited = edits.updateTrack(project, song.id, { muted: true });
  expect(edited.tracks[1]).toBe(vox);
  expect(edited.tracks[0].clips).toBe(song.clips);
  const trimmed = edits.replaceClip(project, song.id, { ...song.clips[0], duration: 2 });
  expect(trimmed.tracks[1]).toBe(vox);
  expect(trimmed.tracks[0].clips.map((clip) => clip.name)).toEqual(['Verse', 'Intro']);
});

it('pastes relative to the earliest copied clip and recreates a deleted source track', () => {
  const project = fixture();
  const [song] = project.tracks;
  const pasted = edits.pasteClips(
    project,
    [
      { trackId: 'gone', clip: song.clips[1] },
      { trackId: song.id, clip: song.clips[0] },
    ],
    10
  );
  expect(pasted.tracks[0].clips.at(-1)).toMatchObject({ name: 'Intro', start: 10 });
  expect(pasted.tracks.at(-1)).toMatchObject({ id: 'gone', name: 'Pasted clips' });
  expect(pasted.tracks.at(-1).clips[0]).toMatchObject({ name: 'Verse', start: 16 });
  expect(pasted.tracks.at(-1).clips[0].id).not.toBe(song.clips[1].id);
});
