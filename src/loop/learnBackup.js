import { readLibrary, mergeSongs } from './library';
import { SONGS } from './catalog';
import { mediaStore, mergeMedia } from './lessonMedia';
import { readBlob, hashLibraryAudio } from '../utils/libraryFiles';

const MAGIC = 'SATTLEA1';
const MAX_MANIFEST = 8 * 1024 * 1024;
const MAX_BYTES = 512 * 1024 * 1024;
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
const stateKey = (key) =>
  [
    'loop-guitar-profile-v1',
    'loop-practice-progress-v1',
    'loop-practice-history-v1',
    'loop-feedback-v1',
  ].includes(key) || /^loop-(checkpoint-v2:|reviewed:).{1,300}$/.test(key);
const fail = (message = 'This Learn backup is damaged or unsupported.') => {
  throw new Error(message);
};
const text = (value, max = 300) =>
  typeof value === 'string' && value.length > 0 && value.length <= max;
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
function safeJSON(raw) {
  return JSON.parse(raw, (key, value) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
    return value;
  });
}
const digest = hashLibraryAudio;
function validateLesson(lesson) {
  if (
    !lesson ||
    !text(lesson.id) ||
    SONGS.some((song) => song.id === lesson.id) ||
    !text(lesson.title) ||
    !text(lesson.artist || 'Unknown') ||
    !text(lesson.key, 80) ||
    !['estimate', 'score'].includes(lesson.source) ||
    !finite(lesson.bpm, 20, 400) ||
    !finite(lesson.duration, 0.01, 480)
  )
    fail('A lesson in this backup is invalid.');
  const notes = (items, positions = true) =>
    Array.isArray(items) &&
    items.length <= 12000 &&
    items.every(
      (n) =>
        n &&
        Number.isInteger(n.midi) &&
        finite(n.midi, 0, 127) &&
        finite(n.start, 0, lesson.duration) &&
        finite(n.end, n.start + 0.00001, lesson.duration + 0.1) &&
        (!positions ||
          (Number.isInteger(n.string) &&
            finite(n.string, -1, 5) &&
            Number.isInteger(n.fret) &&
            finite(n.fret, -1, 24)))
    );
  if (
    !notes(lesson.notes) ||
    (lesson.polyphonicNotes && !notes(lesson.polyphonicNotes, false)) ||
    !Array.isArray(lesson.chords) ||
    lesson.chords.length > 12000 ||
    lesson.chords.some(
      (c) =>
        !text(c.name, 30) ||
        !finite(c.start, 0, lesson.duration) ||
        !finite(c.end, c.start, lesson.duration + 0.1)
    )
  )
    fail('A note or chord in this backup is invalid.');
  if (
    lesson.phraseStarts &&
    (!Array.isArray(lesson.phraseStarts) ||
      !lesson.phraseStarts.length ||
      lesson.phraseStarts.length > 12000 ||
      lesson.phraseStarts.some(
        (n, i, a) =>
          !Number.isInteger(n) ||
          n < 0 ||
          n >= lesson.notes.length ||
          (i === 0 ? n !== 0 : n <= a[i - 1])
      ))
  )
    fail();
  if (
    lesson.waveform &&
    (!Array.isArray(lesson.waveform) ||
      lesson.waveform.length > 8192 ||
      lesson.waveform.some((n) => !finite(n, 0, 100)))
  )
    fail();
  if (
    lesson.warnings &&
    (!Array.isArray(lesson.warnings) || lesson.warnings.some((v) => !text(v, 2000)))
  )
    fail();
  for (const key of ['description', 'difficulty', 'category', 'color', 'motif', 'trackName']) {
    if (lesson[key] != null && (typeof lesson[key] !== 'string' || lesson[key].length > 2000))
      fail('A lesson description is invalid.');
  }
  if (lesson.practiceStart != null && !finite(lesson.practiceStart, 0, lesson.duration)) fail();
  for (const note of [...lesson.notes, ...(lesson.polyphonicNotes || [])]) {
    for (const key of ['confidence', 'beatStart', 'beatDuration']) {
      if (note[key] != null && !finite(note[key], 0, key === 'confidence' ? 1 : 100000)) fail();
    }
  }
  if (lesson.quality) {
    if (typeof lesson.quality !== 'object' || Array.isArray(lesson.quality)) fail();
    if (lesson.quality.coverage != null && !finite(lesson.quality.coverage, 0, 1)) fail();
  }
  if (lesson.keyAnalysis) {
    if (typeof lesson.keyAnalysis !== 'object' || Array.isArray(lesson.keyAnalysis)) fail();
    if (lesson.keyAnalysis.key != null && !text(lesson.keyAnalysis.key, 80)) fail();
    if (lesson.keyAnalysis.alternative && !text(lesson.keyAnalysis.alternative.key, 80)) fail();
  }
  if (
    lesson.scoreAlignment &&
    (!finite(lesson.scoreAlignment.offset, 0, 120) || !finite(lesson.scoreAlignment.tempo, 20, 400))
  )
    fail();
  // Playback must come from the included bytes, never an imported remote URL.
  const result = { ...lesson };
  delete result.audioUrl;
  result.category = 'imported';
  delete result.completeSong;
  delete result.difficulty;
  delete result.teaching;
  delete result.plan;
  delete result.rootId;
  delete result.rootFingerprint;
  return result;
}
function validateState(key, value) {
  if (!stateKey(key) || typeof value !== 'string' || value.length > MAX_MANIFEST)
    fail('The backup contains unsupported settings.');
  const parsed = safeJSON(value);
  if (key.startsWith('loop-reviewed:')) {
    if (!Array.isArray(parsed)) fail();
  } else if (['loop-practice-history-v1', 'loop-feedback-v1'].includes(key)) {
    if (
      !Array.isArray(parsed) ||
      parsed.length > 200 ||
      parsed.some((v) => !v || !text(v.lessonId) || !Number.isFinite(v.at))
    )
      fail();
  } else if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail();
  if (
    key === 'loop-guitar-profile-v1' &&
    (!['left', 'right'].includes(parsed.handedness) ||
      !['standard', 'dropD', 'dadgad'].includes(parsed.tuning) ||
      !Number.isInteger(parsed.capo) ||
      !finite(parsed.capo, 0, 7))
  )
    fail();
  return value;
}
export async function createLearnBackup({
  songs,
  media,
  storage = localStorage,
  progress = () => {},
} = {}) {
  songs ??= await readLibrary();
  media ??= await mediaStore('list');
  const assets = [],
    blobs = [],
    state = [];
  let total = 0;
  async function asset(blob) {
    if (!(blob instanceof Blob) || !blob.size)
      fail('A saved recording is missing. The backup was not created.');
    total += blob.size;
    if (total > MAX_BYTES)
      fail(
        'This backup exceeds 512 MB. Download large videos or takes separately before trying again.'
      );
    progress(`Checking recording ${assets.length + 1}…`);
    const index = assets.length;
    assets.push({
      bytes: blob.size,
      type: blob.type,
      name: blob.name || '',
      hash: await digest(blob),
    });
    blobs.push(blob);
    return index;
  }
  const entries = [];
  for (const record of songs) {
    const lesson = validateLesson(record.lesson);
    entries.push({
      id: record.id,
      lesson,
      savedAt: record.savedAt,
      file: await asset(record.file),
      practiceFile: record.practiceFile ? await asset(record.practiceFile) : null,
    });
  }
  const clips = [];
  for (const record of media) {
    const { blob, ...metadata } = record;
    clips.push({ ...metadata, asset: await asset(blob) });
  }
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (stateKey(key)) state.push([key, validateState(key, storage.getItem(key))]);
  }
  const manifest = encoder.encode(
    JSON.stringify({
      format: MAGIC,
      version: 1,
      createdAt: new Date().toISOString(),
      songs: entries,
      media: clips,
      state,
      assets,
    })
  );
  if (manifest.length > MAX_MANIFEST) fail('This backup has too much lesson data.');
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, manifest.length, true);
  return new Blob([encoder.encode(MAGIC), length, manifest, ...blobs], {
    type: 'application/octet-stream',
  });
}
export async function inspectLearnBackup(file, progress = () => {}) {
  if (!file || file.size > MAX_BYTES + MAX_MANIFEST + 12)
    fail('Choose a Learn backup no larger than 520 MB.');
  const header = await readBlob(file.slice(0, 12));
  if (header.byteLength !== 12 || decoder.decode(new Uint8Array(header, 0, 8)) !== MAGIC)
    fail('Choose a .sattarilearn backup exported from Sattari Learn.');
  const length = new DataView(header).getUint32(8, true);
  if (!length || length > MAX_MANIFEST || length + 12 > file.size) fail();
  const manifest = safeJSON(decoder.decode(await readBlob(file.slice(12, 12 + length))));
  if (
    manifest.format !== MAGIC ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.songs) ||
    manifest.songs.length > 500 ||
    !Array.isArray(manifest.media) ||
    manifest.media.length > 2000 ||
    !Array.isArray(manifest.state) ||
    manifest.state.length > 3000 ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length > 3000
  )
    fail();
  let offset = 12 + length;
  const blobs = [];
  for (const [index, asset] of manifest.assets.entries()) {
    if (
      !asset ||
      !Number.isSafeInteger(asset.bytes) ||
      asset.bytes <= 0 ||
      asset.bytes > file.size - offset ||
      !/^audio-tree-v1:\d+:[a-f0-9]{64}$/.test(asset.hash) ||
      typeof asset.type !== 'string' ||
      asset.type.length > 100 ||
      typeof asset.name !== 'string' ||
      asset.name.length > 1000
    )
      fail();
    const blob = file.slice(offset, offset + asset.bytes, asset.type);
    offset += asset.bytes;
    progress(`Verifying recording ${index + 1} of ${manifest.assets.length}…`);
    if ((await digest(blob)) !== asset.hash)
      fail('A recording in this backup is damaged. Nothing has been restored.');
    blobs.push(new File([blob], asset.name || `recording-${index}`, { type: asset.type }));
  }
  if (offset !== file.size) fail('The backup has missing or unexpected data.');
  const referenced = new Set();
  function assetAt(index) {
    if (!Number.isInteger(index) || !blobs[index]) fail();
    referenced.add(index);
    return blobs[index];
  }
  const ids = new Set();
  const songs = manifest.songs.map((row) => {
    if (
      !row ||
      !text(row.id) ||
      ids.has(row.id) ||
      row.id !== row.lesson?.id ||
      !finite(row.savedAt, 0, Number.MAX_SAFE_INTEGER)
    )
      fail();
    ids.add(row.id);
    return {
      ...row,
      lesson: validateLesson(row.lesson),
      file: assetAt(row.file),
      practiceFile: row.practiceFile == null ? null : assetAt(row.practiceFile),
    };
  });
  const mediaIds = new Set();
  const media = manifest.media.map((row) => {
    if (
      !row ||
      !text(row.id, 700) ||
      mediaIds.has(row.id) ||
      !['take', 'video'].includes(row.kind) ||
      !text(row.fingerprint, MAX_MANIFEST)
    )
      fail();
    if (
      row.kind === 'take' &&
      (!text(row.key, 700) ||
        !finite(row.seconds, 0.01, 60.1) ||
        ![0.5, 0.75, 1].includes(row.speed) ||
        !finite(row.at, 0, Number.MAX_SAFE_INTEGER))
    )
      fail();
    if (row.kind === 'video' && (!finite(row.offset, 0, 86400) || !row.id.startsWith('video:')))
      fail();
    mediaIds.add(row.id);
    const { asset, ...metadata } = row;
    return { ...metadata, blob: assetAt(asset) };
  });
  if (referenced.size !== blobs.length) fail();
  const keys = new Set();
  const state = manifest.state.map((row) => {
    if (!Array.isArray(row) || row.length !== 2 || keys.has(row[0])) fail();
    keys.add(row[0]);
    return [row[0], validateState(row[0], row[1])];
  });
  return { songs, media, state, createdAt: manifest.createdAt };
}
export async function restoreLearnBackup(
  backup,
  { storage = localStorage, addSongs = mergeSongs, addMedia = mergeMedia } = {}
) {
  // Non-destructive merge: existing IDs/settings win, including writes from
  // another tab. Each database merge is atomic; cross-store failures are explicit.
  const report = { songs: 0, media: 0, settings: 0, skipped: 0 };
  try {
    report.songs = (await addSongs(backup.songs)).length;
    report.media = (await addMedia(backup.media)).length;
    report.skipped = backup.songs.length - report.songs + backup.media.length - report.media;
    for (const [key, value] of backup.state) {
      const existing = storage.getItem(key);
      if (existing !== null) {
        if (key === 'loop-practice-progress-v1') {
          const saved = safeJSON(existing),
            incoming = safeJSON(value);
          const missing = Object.entries(incoming).filter(([id]) => !Object.hasOwn(saved, id));
          if (missing.length) {
            storage.setItem(key, JSON.stringify({ ...Object.fromEntries(missing), ...saved }));
            report.settings++;
          } else report.skipped++;
        } else if (['loop-practice-history-v1', 'loop-feedback-v1'].includes(key)) {
          const saved = safeJSON(existing),
            incoming = safeJSON(value),
            seen = new Set(saved.map((row) => JSON.stringify(row)));
          const added = incoming.filter((row) => !seen.has(JSON.stringify(row)));
          if (added.length) {
            storage.setItem(
              key,
              JSON.stringify(
                [...saved, ...added]
                  .sort((a, b) => a.at - b.at)
                  .slice(key === 'loop-feedback-v1' ? -100 : -200)
              )
            );
            report.settings++;
          } else report.skipped++;
        } else report.skipped++;
        continue;
      }
      storage.setItem(key, value);
      report.settings++;
    }
  } catch {
    throw new Error(
      `Restore stopped because device storage could not finish. Added ${report.songs} lessons, ${report.media} media files and ${report.settings} settings. Existing data was kept. Free device space and retry; existing entries are skipped.`
    );
  }
  return report;
}
