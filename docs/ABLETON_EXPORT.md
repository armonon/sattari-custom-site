# Export for Ableton

StemDeck (per deck, STEMS tab → **Ableton**), Split (**Export for Ableton** after a split) and
Pocket (**Export for Ableton**) download one ZIP:

```
<Title> Project/
  <Title>.als          Ableton Live Set (Live 12+), opens in Arrangement view
  README.txt           tempo, file list, how to open it
  Stems/01 Vocals.wav  one WAV per track, numbered in track order
```

- One audio track per stem, named and coloured (nearest of Live's 70 colours), each with one
  clip at bar 1. Full mixes/originals ride along muted, for reference.
- Project tempo = the known (Pocket) or detected (Split, StemDeck deck BPM) tempo. Clips are
  warped at that tempo (two warp markers: 0 s → beat 0, file end → its length in beats), Beats
  mode for drums, Complex for everything else. Unknown tempo → 120 BPM, warping off.
- WAVs pass through untouched when they already are PCM/float WAV; anything else (MP3, M4A…) is
  decoded in the browser to 24-bit WAV.

## How the .als is made

`src/utils/abletonExport/liveSet.js` fills two templates extracted from Live's own empty default
Set (`scripts/ableton/extract-live-set-template.mjs`, schema `12.0_12117`): the Set minus its demo
tracks, and one audio track that is cloned per stem with every automation/modulation target id
renumbered. Live rejects a clip without warp markers ("Empty warp marker array"), even unwarped.

## Verification

- Unit tests: `src/utils/abletonExport/abletonExport.test.js`, `src/studio/abletonDeckExport.test.js`.
- Browser: `node scripts/qualify-ableton-export.mjs` clicks the real Pocket and StemDeck buttons and
  checks the downloaded ZIPs (`ABLETON_QA_OUTPUT` keeps the unzipped projects).
- In Ableton Live 12.4.3 (2026-10-06): generated Sets (warped 128 BPM, unwarped/no tempo at 48 kHz
  with a muted track and `&<>"` in names, and the Pocket and StemDeck browser downloads) opened
  without errors. A temporary MIDI Remote Script read the Live Object Model back: tempo, track
  names/colours/mute, one arrangement clip per track at beat 0 with the expected length, warp
  on/off and mode, warp markers, and every clip's `file_path` resolved to the WAV in `Stems/`.
