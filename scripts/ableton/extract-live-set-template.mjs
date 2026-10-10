// Rebuilds the two XML templates the "Export for Ableton" Live Set generator
// fills in (src/utils/abletonExport/templates/). Run on a Mac with Ableton
// Live 12 installed:
//
//   node scripts/ableton/extract-live-set-template.mjs [path/to/DefaultLiveSet.als]
//
// Source: Live's own empty default Set (Builtin/Templates/DefaultLiveSet.als,
// schema 12.0_12117, the oldest Live 12 schema shipped with the app, so the
// generated Set opens in every Live 12 release that can read it). We keep the
// document as-is and only lift the four demo tracks out of <Tracks>: the
// return tracks, main track, scenes and transport stay exactly as Live wrote
// them. One of the audio tracks becomes the per-stem track template.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source =
  process.argv[2] ||
  '/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Builtin/Templates/DefaultLiveSet.als';
const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/utils/abletonExport/templates'
);

const xml = gunzipSync(readFileSync(source)).toString('utf8');

function element(text, name, from = 0) {
  const start = text.indexOf(`<${name} `, from);
  if (start < 0) return null;
  const close = `</${name}>`;
  const end = text.indexOf(close, start);
  if (end < 0) throw new Error(`Unclosed <${name}>`);
  // Back up to the start of the line so indentation stays with the element.
  const lineStart = text.lastIndexOf('\n', start) + 1;
  return {
    start: lineStart,
    end: end + close.length + 1,
    text: text.slice(lineStart, end + close.length + 1),
  };
}

const tracksOpen = xml.indexOf('<Tracks>') + '<Tracks>'.length + 1;
const firstReturn = element(xml, 'ReturnTrack');
if (!firstReturn) throw new Error('No return track in the template');
const playerTracks = xml.slice(tracksOpen, firstReturn.start);
const audio = element(playerTracks, 'AudioTrack');
if (!audio) throw new Error('No audio track in the template');
if (/<AudioClip |<MidiClip /.test(playerTracks.slice(audio.start, audio.end)))
  throw new Error('Template audio track already holds clips');

const set = `${xml.slice(0, tracksOpen)}<!--SATTARI_TRACKS-->\n${xml.slice(firstReturn.start)}`;
writeFileSync(join(outDir, 'liveSet.xml'), set);
writeFileSync(join(outDir, 'audioTrack.xml'), audio.text);
console.log(
  `liveSet.xml ${set.length} chars, audioTrack.xml ${audio.text.length} chars (from ${source})`
);
