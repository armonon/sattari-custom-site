# Pocket pattern preservation

Pocket is the one-bar beat sketchpad at `/studio/pocket`, not the Community
voice-recorder Pocket Studio. This change does not modify other suite modules.

## Save behavior

- Named patterns are stored only in this browser. Save deliberately updates an
  existing identical name; a new name uses one of 40 slots.
- A 41st name is refused with an explanation. No older beat is automatically
  removed. Load/update an existing name or deliberately delete a saved pattern
  before saving a different name. Deleting a named save does not clear the
  currently edited pattern.
- Unreadable JSON, unsupported format/version or duplicate names are not treated
  as an empty library. Save/delete fail without replacing those bytes. Untouched
  valid records retain their existing fields. Existing oversized libraries are
  not truncated; updating a saved name remains possible.
- Complete v1 musical fields and exact step counts/types are checked before any
  write. Legacy data without a version is supported only when it has the entire
  v1 shape; normalization never certifies damaged notes. Empty/overlong names and
  duplicate names are refused so normalization cannot alias saved patterns.
- The automatic draft also refuses to replace unreadable or newer-format data.
  If draft or named storage fails, the page shows an error while keeping the
  current edit available. A **Download stored-data recovery backup** button saves
  original raw library/draft text without modifying it. This is a recovery archive,
  not an automatic pattern-import feature. Keep the tab open and export WAV/stems as an audio
  backup; audio exports do **not** preserve editable sequencer state.
- Clearing browser data still removes local patterns. There is no cloud sync,
  portable editable-pattern import/export, pattern chaining or undo/redo in this
  release. This repair must not be described as full product qualification.

## Verification

`npx vitest run src/labs/pocket/pocketPattern.test.js src/labs/pocket/PocketPage.test.jsx src/labs/LabPages.test.jsx`
checks capacity/no eviction, same-name updates, corrupt/unsupported/ambiguous
storage preservation, failed reads and writes, draft protection and surfaced
UI errors. Unit storage-quota exceptions are fault injection, not a physical
storage-exhaustion campaign.

For actual browser verification, run `npm run build` then
`npm run preview -- --host 127.0.0.1 --port 4188 --strictPort` and
`node scripts/pocket-persistence-check.mjs`. Optional environment variables:
`PLAYWRIGHT_PATH`, `POCKET_CHROMIUM_EXECUTABLE`, `POCKET_CHECK_URL`,
`POCKET_REPORT_DIR`. The harness uses an owned fresh profile and synthetic
patterns; it never opens a personal profile or records hardware audio.

The browser check edits and saves a beat, actually closes/reopens the page,
restores editable steps, starts real Web Audio synthesis, downloads a non-silent
24-bit stereo WAV with independently parsed duration/header, refuses a 41st
name without changing prior bytes, and preserves malformed library/draft data.
Source/harness hashes accompany each receipt. A phone-width screenshot is not
physical-device, Safari/Firefox or accessibility qualification.

Full release still requires supported-platform verification, storage-pressure
and interruption recovery, all agreed core-workflow gates, current deployment
provenance, independent review and normal required CI/PR checks. The live app is
not automatically updated by a branch push.
