# Key & BPM: measurements and portable reports

Status: alpha. This is a local, browser-decoded analysis utility, not a certified
music-corpus key/tempo detector. No microphone permission or audio upload is
needed for its core workflow. Existing shared suite/account features are separate.

## Core workflow

1. Choose audio files (mono/stereo, browser-decodable, at most 10 minutes and
   200 MiB per file; at most 200 listed tracks). The worker measures files one at
   a time. Stop preserves completed rows and leaves unfinished files queued;
   Resume restarts that work. An unavailable analysis is an error, not success.
2. Inspect key, Camelot, BPM, evidence flags, alternate key, and level. Silence,
   insufficient harmony, or a missing pulse should not be read as a confident
   estimate. Rough BPM is explicitly marked and may be half/double time.
3. Sort results. On narrow displays the labelled results region scrolls
   horizontally; focus it and use Left/Right arrow keys to see later columns.
4. **Save report** downloads `sattari-key-bpm.keybpm.json` for completed
   measurements and per-file errors. Pending source files are not saved. Save
   after the queue finishes if you need all its results.
5. Close the tab or browser. **Open report** reads that real file and adds its
   results to the current list. Existing rows are preserved. Reopened rows say
   **Report · audio not included**. They can be sorted, saved again and exported
   to CSV; they cannot replay or reanalyze nonexistent audio. Select original
   source files to run a fresh measurement.
6. **Export CSV** remains available for DJ crates/spreadsheets. Every cell is
   quoted and spreadsheet-formula prefixes are neutralized. CSV is an output
   format, not an analysis-report input format.

Results are not automatically persisted or synced. Keep a downloaded report
before closing the tab; source audio must be retained separately. Only actual
byte-identical files with the same name/size are treated as duplicates; different
mixes that happen to share a filename and length are both admitted.

## Report format and failure behavior

Schema `SattariKeyBpm.report`, version 1, UTF-8 JSON, maximum 2 MiB. Records preserve
source filename/size/type/modification time, measurement timestamp, measurements,
confidence/evidence and notes. No audio bytes, credentials or server state are
included. Report limits are supplied by the app, not trusted arbitrary file claims.

All rows are validated before any are imported. Unsupported versions, malformed
JSON, inconsistent key/Camelot data, invalid numeric/evidence values, oversized
reports, or imports exceeding the 200-track limit are rejected without replacing
existing results. Report validation is structural, not proof that a third party's
saved measurements are genuine or accurate. Imported values are not re-verified
without the original audio.

## Reproducible qualification

Use Node 22. Build with `npm run build`; serve the built artifact using
`npm run preview -- --host 127.0.0.1 --port 4293 --strictPort`. Then:

```sh
KEYBPM_URL=http://127.0.0.1:4293 KEYBPM_BROWSER=chromium KEYBPM_EXTENDED=1 node scripts/qualify-key-bpm.mjs
KEYBPM_URL=http://127.0.0.1:4293 KEYBPM_BROWSER=firefox node scripts/qualify-key-bpm.mjs
KEYBPM_URL=http://127.0.0.1:4293 KEYBPM_BROWSER=webkit node scripts/qualify-key-bpm.mjs
```

The harness creates original synthetic WAVs, drives the real file picker,
decoder and worker, reads actual downloaded CSV/report files, and opens a saved
report in a fresh context. It verifies malformed/oversized report atomicity,
malformed audio, content-identity collisions, keyboard scrolling and three CSS
widths. `KEYBPM_FORMATS=1` additionally uses installed FFmpeg to encode the generated
reference into MP3/FLAC/M4A/OGG/AIFF and checks actual decoding and measurements.
AIFF is not available in every browser: a clear decoder rejection is recorded as
unsupported, not successful analysis. Use WAV/MP3/FLAC when that occurs.
Extended coverage adds real 600/601-second input boundaries and a stopped
then resumed 20-file queue. `KEYBPM_QA_DIR` selects evidence output. Browser version
and Git state are recorded; use a frozen exact commit for release evidence.

This is not a labelled-music accuracy benchmark. WebKit automation is not a
physical iPhone or the Safari application; responsive widths are not physical
device qualification. Public-deployment/source mapping and normal repository
release gates remain separate from local browser tests.

### Observed format limits (October 7, 2026)

Generated-reference checks on macOS found:

- Chromium 151.0.7922.34 and Firefox 153: WAV, MP3, FLAC, M4A/AAC and OGG/Vorbis
  decoded and measured; AIFF was clearly rejected by the browser decoder.
- Playwright WebKit 26.5: WAV, MP3, FLAC, OGG/Vorbis and AIFF decoded and measured;
  M4A/AAC was clearly rejected. This is the automation engine, not certification
  of the Safari application or iOS hardware.

A rejected format is unsupported on that tested runtime, not successful analysis.
Use a WAV, MP3 or FLAC copy when necessary. The optional all-format WebKit test
therefore remains a documented failure; its successful core/report workflow is
recorded separately. There is no universal codec-support claim.
