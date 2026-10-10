// "Export for Ableton": a ZIP holding a Live Project folder —
//   <Title> Project/<Title>.als      Live Set, one audio track per stem
//   <Title> Project/Stems/01 Vocals.wav …
//   <Title> Project/README.txt
// The Set references the WAVs relative to itself, so the folder can be
// unzipped anywhere and opened with a double-click.
import { Zip, ZipPassThrough, ZipDeflate, strToU8 } from 'fflate';
import { buildLiveSet, normalizeTempo } from './liveSet';

/** Reads the format of a RIFF/WAVE file. Throws if it is not a WAV Live can read. */
export function wavInfo(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tag = (offset) => String.fromCharCode(...data.subarray(offset, offset + 4));
  if (data.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file');
  let offset = 12;
  let format = null;
  while (offset + 8 <= data.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      let code = view.getUint16(body, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format is the first two bytes of the sub-format GUID.
      if (code === 0xfffe && size >= 26) code = view.getUint16(body + 24, true);
      format = {
        format: code === 3 ? 'float' : code === 1 ? 'pcm' : `0x${code.toString(16)}`,
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      if (!format) throw new Error('WAV data before format');
      // A streamed WAV may leave the size open (0 or 0xffffffff): use what is there.
      const available = data.length - body;
      const bytesInData = size === 0 || size > available ? available : size;
      const frameBytes = format.channels * (format.bitsPerSample / 8);
      if (!(frameBytes > 0)) throw new Error('Unsupported WAV format');
      return { ...format, frames: Math.floor(bytesInData / frameBytes) };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV has no audio data');
}

/** A file/folder name that works on macOS, Windows and inside the Set. */
export function safeName(value, fallback = 'Sattari export') {
  const cleaned = String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

const pad = (index) => String(index + 1).padStart(2, '0');

export function readmeText({ title, tempo, source, stems, notes = [] }) {
  const tempoLine = tempo
    ? `Tempo: ${tempo} BPM${source?.tempoIsEstimate ? ' (detected — an estimate; it can be half or double the real tempo)' : ''}. Clips are warped at this tempo, so they play at their original speed and follow the grid; change the tempo and Live time-stretches them.`
    : 'Tempo: not known, so the Set opens at 120 BPM with warping off. The stems play at their original speed; set the tempo yourself, then turn Warp on per clip if you need it.';
  return [
    `${title} — exported from ${source?.app || 'Sattari'} for Ableton Live`,
    '',
    'Open it',
    `1. Unzip, then double-click "${title}.als" (Ableton Live 12 or later).`,
    '2. Every stem is its own audio track, with its clip at bar 1 of the Arrangement.',
    '3. Live may write analysis files (.asd) next to the WAVs the first time. That is normal.',
    '',
    tempoLine,
    '',
    'Stems (in the Stems folder):',
    ...stems.map((stem) => `  ${stem}`),
    '',
    'Live 11, Logic, FL Studio and other apps: drag the WAVs from the Stems folder to bar 1',
    'of an empty project and set the tempo above. They all start at the same moment.',
    ...(notes.length ? ['', ...notes] : []),
    '',
    'Made in your browser by Sattari (sattarimusic.com). Nothing was uploaded.',
    '',
  ].join('\n');
}

/**
 * Builds the ZIP.
 *
 * @param {object} options
 * @param {string} options.title Song/project name.
 * @param {number|null} options.bpm Known or detected tempo; null when unknown.
 * @param {{app: string, tempoIsEstimate?: boolean}} options.source Who made it.
 * @param {Array<{name: string, data: Uint8Array, color?: string, muted?: boolean,
 *   warpMode?: number}>} options.stems WAV bytes per stem, in track order.
 * @param {Array<{name: string, data: Uint8Array}>} [options.extraFiles] Added to the project folder.
 * @param {string[]} [options.notes] Extra README lines.
 * @returns {{blob: Blob, fileName: string, setName: string, files: string[]}}
 */
export function buildAbletonPack({ title, bpm, source, stems, extraFiles = [], notes = [] }) {
  if (!stems?.length) throw new Error('Nothing to export yet: no stems');
  const name = safeName(title);
  const folder = `${name} Project`;
  const tempo = normalizeTempo(bpm);

  const entries = stems.map((stem, index) => {
    const info = wavInfo(stem.data);
    if (info.format !== 'pcm' && info.format !== 'float')
      throw new Error(`${stem.name}: Live needs PCM or float WAV`);
    // The number prefix keeps names unique and in track order in any file browser.
    const fileName = `${pad(index)} ${safeName(stem.name, `Stem ${index + 1}`)}.wav`;
    return { stem, info, fileName };
  });

  const als = buildLiveSet({
    bpm: tempo,
    tracks: entries.map(({ stem, info, fileName }) => ({
      name: safeName(stem.name, 'Audio'),
      file: `Stems/${fileName}`,
      frames: info.frames,
      sampleRate: info.sampleRate,
      color: stem.color,
      muted: stem.muted,
      warpMode: stem.warpMode,
    })),
  });

  const readme = readmeText({
    title: name,
    tempo,
    source,
    stems: entries.map(
      ({ fileName, stem, info }) =>
        `${fileName}  (${info.sampleRate / 1000} kHz, ${info.bitsPerSample}-bit${info.format === 'float' ? ' float' : ''}${stem.muted ? ', track muted in the Set' : ''})`
    ),
    notes,
  });

  const parts = [];
  const files = [];
  let failure = null;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else parts.push(chunk);
  });
  const add = (path, data, compress) => {
    const entry = compress ? new ZipDeflate(path, { level: 6 }) : new ZipPassThrough(path);
    entry.mtime = new Date();
    zip.add(entry);
    entry.push(data, true);
    files.push(path);
  };
  add(`${folder}/${name}.als`, als, false);
  add(`${folder}/README.txt`, strToU8(readme), true);
  for (const { stem, fileName } of entries) add(`${folder}/Stems/${fileName}`, stem.data, false);
  for (const extra of extraFiles) add(`${folder}/${safeName(extra.name)}`, extra.data, false);
  zip.end();
  if (failure) throw failure;

  return {
    blob: new Blob(parts, { type: 'application/zip' }),
    fileName: `${name} (Ableton Live Set).zip`,
    setName: `${name}.als`,
    files,
  };
}
