# Practice memory, saved loops and keyboard shortcuts (2026-11-24)

Branch `feat/practice-memory`.

## What changes

Before this, a reload kept a separated song but forgot everything set in the
player. Now the Stem Separator (and its Split alias) remembers, per song, in this
browser:

- the mix: levels, mute, solo, master and Prevent clipping
- speed and key
- the current A–B loop
- **saved loops**: up to 12 named loops ("Verse", "Solo") to jump between
- click, count-in, snap-to-beats and the bar start

**Keyboard shortcuts** for hands-on-instrument practice: Space, ← →, `[` `]`, `\`,
1–9, 0 and C (listed in the player under "Keyboard shortcuts").

## How it is stored

A separate small IndexedDB database (`sattari-practice-state`): JSON only, no
audio, never sent anywhere. Removing a song forgets its setup and **Clear saved
work** clears all of them. Stored values are validated and clamped on the way
back in; anything that does not fit the audio is dropped.

## Verification

- Real-model QA (CPU): 38/38, evidence in `2026-11-practice-memory-evidence/`. New
  check: mute the bass, set a 0:02–0:04 loop, save it as "Riff", turn snap off,
  reload; all of it is restored, the `\`, `1` and Space shortcuts work, and Clear
  saved work leaves no practice setups in storage.
- Unit tests: new `practiceState.test.js` and five player tests (restore, damaged
  record, save/rename/recall/remove loops, shortcuts, preview player). Every test
  file passes; the full parallel run had load timeouts in 11 files that all pass
  when rerun on their own.
- ESLint, `tsc` and the production build pass.
- Not verified: Safari/Firefox, phones (the
shortcuts need a hardware keyboard), and behaviour when two tabs edit the same
song at once (the last write wins).
