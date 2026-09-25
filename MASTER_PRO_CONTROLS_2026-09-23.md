# Master output: gain staging, comparison and delivery references

## Implemented

- Input trim: −18 to +12 dB before tone and inserts.
- Pre-limiter trim: −18 to +6 dB after inserts/compression, before either the limiter or its bypass path. Positive trim can clip when limiting is off.
- Three-band EQ crossover controls: low boundary 80–800 Hz; high boundary 1–12 kHz. Nonoverlapping bounds protect imported projects.
- Session-only A/B tone/dynamics snapshots, including trims, output gain, limiter and compression switches. Recall preserves current inserts, stem routing and delivery targets. Store/recall is disabled during recording. Snapshots are not level-matched and are not saved in the project.
- Custom loudness and true-peak references with measured loudness delta and true-peak headroom. Unavailable/silent measurements display a dash. References do not normalize or otherwise alter audio.
- Compact main strip retained; advanced controls remain in expanded master panels, with crossover and comparison disclosures.

## Signal paths and compatibility

New processing settings are normalized with neutral defaults for older sessions and persist in the existing project master-processing object. Live playback, recorded master-control event scheduling and offline arrangement mixdown use the same trim conversions and crossover values. Raw pre-master stem export remains unaffected. Speaker mute, dim and mono remain monitor-only. Tone-neutral audition does not bypass trims or inserts.

## Verification

- 87 focused automated tests passed before the broader regression run.
- Production build, TypeScript and ESLint passed.
- `scripts/master-pro-browser-qa.html`: seven offline generated-audio checks passed in Chromium: exact −6 dB trims, inverse trim cancellation, audible crossover change, live/export agreement, monitor isolation, raw stem isolation and non-processing delivery references. No microphone or speaker output; generated asset cleaned up.
- Expanded controls visually checked at desktop and 390 px phone width; no horizontal page overflow. Browser A/B store state verified.
- Full suite: **467/467 tests passed across 74 files** with `npx vitest run --maxWorkers=2` (111 s). The initial default-worker run passed 465 tests but timed out two UI cases at the existing five-second limit. Both passed with bounded concurrency; no timeout limits were relaxed. The bounded run also checks reopening and autosaving the new processing settings.

## Limits

This does not provide an EBU-certified meter, a guaranteed true-peak limiter, automatic loudness normalization, native browser plugin hosting or hardware-session sign-off. Existing release gates remain open. No production deployment or native-app update was performed.
