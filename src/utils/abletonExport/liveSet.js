// Ableton Live Set (.als) writer for "Export for Ableton".
//
// An .als file is gzip-compressed XML. Rather than invent the schema, we start
// from Live 12's own empty default Set (see
// scripts/ableton/extract-live-set-template.mjs) and only change what a stem
// export needs:
//   - project tempo (the main track's Tempo value and its arrangement envelope),
//   - one audio track per stem (name, colour, mute) cloned from the template's
//     audio track, with its automation/modulation target ids renumbered so
//     every id stays unique,
//   - one arrangement clip per track at bar 1 that points at the stem WAV next
//     to the Set and is warped at the song tempo (two warp markers: 0 s = beat
//     0, end of file = its length in beats), so the stems line up on Live's grid
//     and follow tempo changes.
// Verified by opening generated Sets in Ableton Live 12.4 (tracks, clips,
// tempo, warp and sample paths all resolve); see docs/ABLETON_EXPORT.md.
import { gzipSync, strToU8 } from 'fflate';
import setTemplate from './templates/liveSet.xml?raw';
import trackTemplate from './templates/audioTrack.xml?raw';

export const DEFAULT_TEMPO = 120;
export const MIN_TEMPO = 20;
export const MAX_TEMPO = 999;

/**
 * Live's 70-colour clip/track palette (index → RGB). Spot-checked against Live
 * 12.4 through the Live Object Model (track.color for indices 7, 9, 12, 16).
 * Used to pick the closest Live colour for a stem colour.
 */
// prettier-ignore
export const LIVE_COLORS = [
  '#ff94a6', '#ffa529', '#cc9927', '#f7f47c', '#bffb00', '#1aff2f', '#25ffa8',
  '#5cffe8', '#8bc5ff', '#5480e4', '#92a7ff', '#d86ce4', '#e553a0', '#ffffff',
  '#ff3636', '#f66c03', '#99724b', '#fff034', '#87ff67', '#3dc300', '#00bfaf',
  '#19e9ff', '#10a4ee', '#007dc0', '#886ce4', '#b677c6', '#ff39d4', '#d0d0d0',
  '#e2675a', '#ffa374', '#d3ad71', '#edffae', '#d2e498', '#bad074', '#9bc48d',
  '#d4fde1', '#cdf1f8', '#b9c1e3', '#bcb4e7', '#d2b6e3', '#e5dce1', '#a9a9a9',
  '#c6928b', '#b78256', '#99836a', '#bfba69', '#a6be00', '#7db04d', '#88c2ba',
  '#9bb3c4', '#85a5c2', '#8393cc', '#a595b5', '#bf9fbe', '#bc7196', '#7b7b7b',
  '#af3333', '#a95131', '#724f41', '#dbc300', '#85961f', '#539f31', '#0a9c8e',
  '#236384', '#1a2f96', '#2f52a2', '#624bad', '#a34bad', '#cc2e6e', '#3c3c3c',
];

/** Live warp modes (WarpMode values in the Set). */
export const WARP_MODES = { beats: 0, tones: 1, texture: 2, repitch: 3, complex: 4, complexPro: 6 };

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Characters XML 1.0 cannot carry at all.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** Round to a stable number of decimals and print without exponent noise. */
const num = (value) => {
  const rounded = Math.round(value * 1e9) / 1e9;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Closest Live palette index for a CSS hex colour (or `fallback`). */
export function liveColorIndex(hex, fallback = 13) {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  let best = fallback;
  let bestDistance = Infinity;
  LIVE_COLORS.forEach((candidate, index) => {
    const [r, g, b] = hexToRgb(candidate);
    // Weighted RGB distance: close enough to perceptual for picking a swatch.
    const distance = 2 * (r - rgb[0]) ** 2 + 4 * (g - rgb[1]) ** 2 + 3 * (b - rgb[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/** A tempo Live accepts, or null when the value is unusable. */
export function normalizeTempo(bpm) {
  const value = Number(bpm);
  if (!Number.isFinite(value) || value < MIN_TEMPO || value > MAX_TEMPO) return null;
  return Math.round(value * 1000) / 1000;
}

function audioClipXml(clip, id) {
  const { name, color, seconds, beats, warped, warpMode, relativePath, frames, sampleRate } = clip;
  // Warped clips measure their loop in beats, unwarped clips in seconds.
  const length = warped ? beats : seconds;
  // Live refuses a Set whose clip has no warp markers ("Empty warp marker
  // array"), even with warping off, so unwarped clips carry them too.
  const markers = `<WarpMarker Id="0" SecTime="0" BeatTime="0" />
<WarpMarker Id="1" SecTime="${num(seconds)}" BeatTime="${num(beats)}" />`;
  return `<AudioClip Id="${id}" Time="0">
<LomId Value="0" />
<LomIdView Value="0" />
<CurrentStart Value="0" />
<CurrentEnd Value="${num(beats)}" />
<Loop>
<LoopStart Value="0" />
<LoopEnd Value="${num(length)}" />
<StartRelative Value="0" />
<LoopOn Value="false" />
<OutMarker Value="${num(length)}" />
<HiddenLoopStart Value="0" />
<HiddenLoopEnd Value="${num(length)}" />
</Loop>
<Name Value="${xmlEscape(name)}" />
<Annotation Value="" />
<Color Value="${color}" />
<LaunchMode Value="0" />
<LaunchQuantisation Value="0" />
<TimeSignature>
<TimeSignatures>
<RemoteableTimeSignature Id="0">
<Numerator Value="4" />
<Denominator Value="4" />
<Time Value="0" />
</RemoteableTimeSignature>
</TimeSignatures>
</TimeSignature>
<Envelopes>
<Envelopes />
</Envelopes>
<ScrollerTimePreserver>
<LeftTime Value="0" />
<RightTime Value="${num(length)}" />
</ScrollerTimePreserver>
<TimeSelection>
<AnchorTime Value="0" />
<OtherTime Value="0" />
</TimeSelection>
<Legato Value="false" />
<Ram Value="false" />
<GrooveSettings>
<GrooveId Value="-1" />
</GrooveSettings>
<Disabled Value="false" />
<VelocityAmount Value="0" />
<FollowAction>
<FollowTime Value="4" />
<IsLinked Value="true" />
<LoopIterations Value="1" />
<FollowActionA Value="4" />
<FollowActionB Value="0" />
<FollowChanceA Value="100" />
<FollowChanceB Value="0" />
<JumpIndexA Value="1" />
<JumpIndexB Value="1" />
<FollowActionEnabled Value="false" />
</FollowAction>
<Grid>
<FixedNumerator Value="1" />
<FixedDenominator Value="16" />
<GridIntervalPixel Value="20" />
<Ntoles Value="2" />
<SnapToGrid Value="true" />
<Fixed Value="false" />
</Grid>
<FreezeStart Value="0" />
<FreezeEnd Value="0" />
<IsWarped Value="${warped}" />
<TakeId Value="${id + 1}" />
<IsInKey Value="false" />
<ScaleInformation>
<Root Value="0" />
<Name Value="0" />
</ScaleInformation>
<AutomationEnvelopesListWrapper LomId="0" />
<SampleRef>
<FileRef>
<RelativePathType Value="1" />
<RelativePath Value="${xmlEscape(relativePath)}" />
<Path Value="${xmlEscape(relativePath)}" />
<Type Value="1" />
<LivePackName Value="" />
<LivePackId Value="" />
<OriginalFileSize Value="0" />
<OriginalCrc Value="0" />
<SourceHint Value="" />
</FileRef>
<LastModDate Value="0" />
<SourceContext />
<SampleUsageHint Value="0" />
<DefaultDuration Value="${Math.round(frames)}" />
<DefaultSampleRate Value="${Math.round(sampleRate)}" />
<SamplesToAutoWarp Value="0" />
</SampleRef>
<Onsets>
<UserOnsets />
<HasUserOnsets Value="false" />
</Onsets>
<WarpMode Value="${warpMode}" />
<GranularityTones Value="30" />
<GranularityTexture Value="65" />
<FluctuationTexture Value="25" />
<TransientResolution Value="6" />
<TransientLoopMode Value="2" />
<TransientEnvelope Value="100" />
<ComplexProFormants Value="100" />
<ComplexProEnvelope Value="128" />
<Sync Value="true" />
<HiQ Value="true" />
<Fade Value="false" />
<Fades>
<FadeInLength Value="0" />
<FadeOutLength Value="0" />
<ClipFadesAreInitialized Value="true" />
<CrossfadeInState Value="0" />
<FadeInCurveSkew Value="0" />
<FadeInCurveSlope Value="0" />
<FadeOutCurveSkew Value="0" />
<FadeOutCurveSlope Value="0" />
<IsDefaultFadeIn Value="false" />
<IsDefaultFadeOut Value="false" />
</Fades>
<PitchCoarse Value="0" />
<PitchFine Value="0" />
<SampleVolume Value="1" />
<WarpMarkers>
${markers}
</WarpMarkers>
<SavedWarpMarkersForStretched />
<MarkersGenerated Value="false" />
<IsSongTempoLeader Value="false" />
</AudioClip>`;
}

function replaceOnce(text, search, replacement, label) {
  const index = text.indexOf(search);
  if (index < 0 || text.indexOf(search, index + search.length) >= 0)
    throw new Error(`Live Set template changed: expected one ${label}`);
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

function setChildValue(block, child, value, label) {
  const pattern = new RegExp(`<${child} Value="[^"]*" />`);
  if (!pattern.test(block)) throw new Error(`Live Set template changed: no ${label}`);
  return block.replace(pattern, `<${child} Value="${value}" />`);
}

function trackXml(track, trackId, clipId, nextPointee) {
  let pointee = nextPointee;
  // Every automation/modulation target and pointee id must be unique in the Set.
  let xml = trackTemplate.replace(/<(\w*Target|Pointee) Id="\d+"/g, (_, tag) => {
    const id = pointee;
    pointee += 1;
    return `<${tag} Id="${id}"`;
  });
  xml = xml.replace(/<AudioTrack Id="\d+"/, `<AudioTrack Id="${trackId}"`);
  // The track's own <Name> comes first; devices further down have their own.
  const trackName = /<Name>(\s*)<EffectiveName Value="[^"]*" \/>(\s*)<UserName Value="[^"]*" \/>/;
  if (!trackName.test(xml)) throw new Error('Live Set template changed: no track name');
  const escapedName = xmlEscape(track.name);
  xml = xml.replace(
    trackName,
    (_, a, b) =>
      `<Name>${a}<EffectiveName Value="${escapedName}" />${b}<UserName Value="${escapedName}" />`
  );
  xml = xml.replace(/(<\/Name>\s*<Color Value=")\d+(" \/>)/, `$1${track.color}$2`);
  if (track.muted) {
    xml = xml.replace(
      /(<Speaker>\s*<LomId Value="0" \/>\s*<Manual Value=")true(" \/>)/,
      '$1false$2'
    );
  }
  // The first <Sample> holds the arrangement clips; the second belongs to the
  // freeze sequencer and stays empty.
  const emptyEvents = /(<MainSequencer>[\s\S]*?<Sample>\s*<ArrangerAutomation>\s*)<Events \/>/;
  if (!emptyEvents.test(xml)) throw new Error('Live Set template changed: no arrangement lane');
  xml = xml.replace(emptyEvents, `$1<Events>\n${audioClipXml(track, clipId)}\n</Events>`);
  return { xml, nextPointee: pointee };
}

/**
 * Builds the Live Set XML.
 *
 * @param {object} options
 * @param {number|null} options.bpm Song tempo. Null/invalid: 120 BPM, clips unwarped.
 * @param {Array<{name: string, file: string, frames: number, sampleRate: number,
 *   color?: string, muted?: boolean, warpMode?: number}>} options.tracks
 *   `file` is the WAV path relative to the .als (forward slashes).
 */
export function buildLiveSetXml({ bpm, tracks }) {
  if (!Array.isArray(tracks) || tracks.length === 0) throw new Error('Nothing to export: no stems');
  const tempo = normalizeTempo(bpm);
  const warped = tempo !== null;
  const projectTempo = tempo ?? DEFAULT_TEMPO;

  let xml = setTemplate;
  // Project tempo: the main track's Tempo parameter and its arrangement
  // envelope (the envelope wins in Arrangement view, so both must agree).
  const tempoStart = xml.indexOf('<Tempo>');
  const tempoEnd = xml.indexOf('</Tempo>', tempoStart);
  if (tempoStart < 0 || tempoEnd < 0) throw new Error('Live Set template changed: no tempo');
  const tempoBlock = xml.slice(tempoStart, tempoEnd);
  const tempoTarget = /<AutomationTarget Id="(\d+)">/.exec(tempoBlock)?.[1];
  xml =
    xml.slice(0, tempoStart) +
    setChildValue(tempoBlock, 'Manual', num(projectTempo), 'tempo value') +
    xml.slice(tempoEnd);
  const envelope = new RegExp(
    `(<PointeeId Value="${tempoTarget}" />[\\s\\S]*?<FloatEvent Id="\\d+" Time="[^"]*" Value=")[^"]*(")`
  );
  if (!tempoTarget || !envelope.test(xml))
    throw new Error('Live Set template changed: no tempo envelope');
  xml = xml.replace(envelope, `$1${num(projectTempo)}$2`);

  let nextPointee = Number(/<NextPointeeId Value="(\d+)" \/>/.exec(xml)?.[1]);
  if (!Number.isFinite(nextPointee)) throw new Error('Live Set template changed: no NextPointeeId');

  const parts = tracks.map((track, index) => {
    const frames = Number(track.frames);
    const sampleRate = Number(track.sampleRate);
    if (!(frames > 0) || !(sampleRate > 0)) throw new Error(`Stem "${track.name}" has no audio`);
    const seconds = frames / sampleRate;
    // A rendered loop is a whole number of 16ths give or take a rounded
    // sample; snap it so the clip ends exactly on the grid in Live.
    const exactBeats = (seconds * projectTempo) / 60;
    const sixteenths = Math.round(exactBeats * 4) / 4;
    const beats = Math.abs(exactBeats - sixteenths) < 0.001 ? sixteenths : exactBeats;
    const built = trackXml(
      {
        name: track.name,
        color: liveColorIndex(track.color, 13),
        muted: Boolean(track.muted),
        seconds,
        beats,
        warped,
        warpMode: track.warpMode ?? WARP_MODES.complex,
        relativePath: track.file,
        frames,
        sampleRate,
      },
      // Track ids only need to be unique among tracks; the template's return
      // tracks use small ids, so start well clear of them.
      100 + index,
      index,
      nextPointee
    );
    nextPointee = built.nextPointee;
    return built.xml;
  });

  xml = replaceOnce(xml, '<!--SATTARI_TRACKS-->\n', parts.join(''), 'track marker');
  // Open in Arrangement view (0), where the clips are, not Session view (1).
  xml = replaceOnce(
    xml,
    '<SelectedDocumentViewInMainWindow Value="1" />',
    '<SelectedDocumentViewInMainWindow Value="0" />',
    'main view'
  );
  xml = xml.replace(/<NextPointeeId Value="\d+" \/>/, `<NextPointeeId Value="${nextPointee}" />`);
  return xml;
}

/** The gzip-compressed .als bytes. */
export function buildLiveSet(options) {
  return gzipSync(strToU8(buildLiveSetXml(options)), { level: 6, mtime: 0 });
}
