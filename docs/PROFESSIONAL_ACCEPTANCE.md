# StemDeck professional acceptance ledger

Status: **in progress; not release-qualified**. Baseline scores below are retained
from the owner's brief. A feature implementation or passing isolated test does not
raise a score. This ledger supersedes neither historical failures nor release gates.

North star: prepare → perform → capture → editable arrangement → produce → save →
close/reopen → master and track-stem export, without undocumented sound changes.

Latest evidence: [September 25 engineering pass](evidence/NORTH_STAR_2026-09-25.md).
The final run passed all individual test stages, including 766 tests and a
120-second synthetic replay/recording soak, but concurrent edits invalidated its
source fingerprint. A stable-tree release gate and physical qualification remain
required. This is not a certified release snapshot.

## October 7 process-recovery addition

`scripts/run-process-recovery-qa.mjs` runs against an isolated local Vite origin
and creates its own temporary browser profile. It generates its own audio, kills
the actual Chromium process during capture, reopens the same profile, and checks
last-good project equality, committed audio SHA-256 hashes, event-journal recovery
and portable backup readability. CDP applies actual browser quota denial (no
storage API mocks); save/import rejection must preserve the last-good project,
and capture must stop with an actionable recording-health error while committed
chunks stay readable. Chromium may cache quota grants for roughly 30 seconds;
this check allows 65 seconds for failure to reach the capture pipeline. It does
not exhaust the host disk.

Run an isolated `npm run dev -- --host 127.0.0.1 --port 4291 --strictPort`, then
`node scripts/run-process-recovery-qa.mjs http://127.0.0.1:4291`.
`CHROMIUM_EXECUTABLE` selects an installed Chromium; `STUDIO_RECOVERY_REPORT`
selects the JSON evidence destination. Otherwise use the Playwright-installed
browser and `/tmp/stemdeck-process-recovery.json`. Evidence includes exact browser
version; pin it and record source commit when qualifying a release candidate.
No physical devices, Safari/mobile qualification, sudden-power-loss guarantee,
in-flight-save transaction kill or full Project A sign-off is implied.

## One action-support inventory

`src/utils/performanceSupport.js` is canonical for the five stage statuses,
destination representations and restrictions. The capture editor displays this
inventory for enabled events, distinguishes ordinary arrangement data from replay
controls, and identifies printed processing. Unknown actions fail closed as
unclassified/printed, never silently gain support. Disabled events do not affect
the current take's status. The reconstruction handler list uses this same module.

Read the complete matrix with:

```
node scripts/report-performance-support.mjs
```

Release cells: **PASS**, **PARTIAL**, **PRINTED ONLY**, **UNSUPPORTED**.
An implemented but unqualified code path remains PARTIAL; printed processing is
not independently editable. No current row is fully qualified. The commit-bound
matrix ships as `performance-support.json`; stage evidence is required before
promoting any cell to PASS. See [stable-candidate protocol](STABLE_CANDIDATE_PROTOCOL.md).
Volume from deck gain, faders, crossfader and stem state is a combined envelope,
not a claim that each original control becomes an independent automation lane.

## Acceptance projects and evidence boundaries

### A — stem performance (first priority)

Owner-selected, rights-cleared full-length songs; four stems per song; named audio
interface; input permission and monitoring topology recorded before capture.

1. Import and prepare both songs; log source hashes/sample rates and beat grids.
2. Perform with cue/seek, loops, tempo/key-lock/pitch, stem mute/solo/gain, filters,
   EQ, FX, crossfades, input and MIDI. Journal every supported action.
3. Stop; preserve original events, dry input, source stems and authoritative print.
4. Build ordinary editable lanes. Display any printed-only processing before build.
5. Split/trim/retime clips, add MIDI, edit device automation, save a portable project.
6. Close the app/browser completely; reopen and relink a deliberately moved source.
7. Continue editing; export master and aligned pre-master track stems.
8. Compare timings, control envelopes, printed sound and decoded export PCM.

Current automated **subset**, not Project A sign-off:
`scripts/reference-lifecycle-qa.html`. Uses two 180-second generated sources with
four stems each, an eight-second fabricated action history, a synthetic input
proxy, added MIDI, split clips and EQ automation. It performs a real document
reload, checks source persistence and project data, hashes the rendered PCM, and
checks master export against render (maximum absolute PCM error < 2e-6) and ten
aligned stem files. It does **not** record a real performance, physical input or
controller, exercise every live effect, verify all stem audio samples, or simulate
a complete process crash. `fullReferenceProjectQualified` stays false.

### B — beat/MIDI production

Kit → user samples → 4–8 lanes → variation/swing/probability → duplicate → timeline
→ automation → reopen → export. Still blocked by missing user-defined sampled
drum lanes, sequencer swing/probability/ratchets and full workflow qualification.
Piano-roll tests must include rapid entry, drag/resize, grouped transpose,
copy/paste, velocity, quantization, zoom/scroll and dense projects on real touch
hardware. Existing controls are not a substitute for production-task observation.

### C — live musician

Backing tracks + named interface/controller → input gain and separate monitor/arm
→ effects → MIDI → capture → edit → mix. Needs explicit physical-input permission,
measured round-trip latency, cable disconnect/reconnect, missing-device handling,
and 30/60/120-minute real-time recordings. Synthetic accelerated tests do not count.

### D — browser/mobile continuity

Portable project with assets → supported second device/browser → reopen/edit →
export. Validate actual Safari/iOS/Android and desktop browsers separately. Local
browser persistence is not cloud sync. No cloud collaboration or seamless native
plugin transfer is claimed. Record which browser/version passes and which features
are unavailable rather than advertising universal parity.

## Proposed supported-load qualification profiles

These are test targets, **not advertised supported limits** until measured. Run on
the same documented machine/interface with recorded sample rate and buffer size.
Keep deadline, memory and audio-parity assertions in existing tests unchanged.

| Profile | Project | Expected behavior |
|---|---|---|
| Normal | 2 decks / 8 stems; 16 arrangement tracks; 2 active insert effects per audible track; 24 concurrent MIDI notes; 1 stereo input | Continuous capture, editing and autosave; no dropped buffers or scheduling misses |
| Heavy | 4 decks / 16 stems; 32 arrangement tracks; up to 8 inserts per rack; 80 concurrent MIDI notes; 1 stereo input | Same audio guarantees; UI/import/export timing measured separately |
| Extreme | Exceed source-memory budget, 96-note voice budget or storage quota deliberately | Clear rejection/recovery; preserve project, print and assets; never silently discard notes |

For each run retain app/host CPU, process RSS, JS heap where available, system swap,
disk headroom, audio underruns, late controls, source-preparation latency, UI p50/
p95/max input-to-paint time, export elapsed time, captured frame count, drift and
journal/file growth. Missing telemetry is **unmeasured**, not zero. Normal/heavy
must show zero dropout/deadline counters; preserve the existing 50 ms scheduling
deadline. Record overload failures separately rather than retrying until green.

Run 30, 60 and 120 minutes as distinct physical sessions, then stop/reopen/export.
Compare recorded frame count to the reference audio clock and explain any device
clock drift. Do not sign off on wall-clock sleep or accelerated model loops.

## Native plugins and output qualification

The browser UI separates playable web DSP from desktop-host-required inventory.
Native host certification remains separate: scan/rescan, load/unload, multiple
instances, presets/state, automation, latency compensation, save/reopen, missing,
crashed and upgraded plugins. Web suite editions are not native algorithm parity.

Limiter controls are thresholds, not guaranteed output or true-peak ceilings.
Qualify sample peak/RMS/LUFS/estimated true peak with independent vectors. Include
sine, transient, intersample-peak, dense and bass-heavy masters; retain measured
overshoot. Delivery targets are measurement references, not automatic mastering.

## Gap-to-10 ledger (no scores raised)

| Area | Baseline /10 | Acceptance | Current failure / gap |
|---|---:|---|---|
| Perform → capture → edit | 6 | A | Full musical lifecycle not qualified |
| Live performance | 7 | A/C | Supported-load + hardware evidence incomplete |
| Replay/reconstruction | 6 | A + matrix | FX/source/routing history not fully editable or exact |
| Arrangement editing | 7 | A/B | End-to-end audio parity and large-project qualification |
| Piano roll/MIDI | 7 | B | Dense editing + physical MIDI/touch workflow qualification |
| Instruments/beat creation | 5.5 | B | Fixed synthesized lanes; sampled kit/expressive sequencing gaps |
| Effects/automation | 6.5 | A/B | Event controls do not universally become device envelopes |
| Master/output | 6 | A + independent vectors | No true-peak ceiling guarantee; independent qualification incomplete |
| Plugins | 4.5 | Native matrix | Shared-browser native host incomplete |
| Desktop UI | 6.5 | Observed A/B/C | Ownership/scope and novice usability not qualified |
| Mobile/browser continuity | 5 | D | Physical-device editing/transfer qualification incomplete |
| Save/recovery | 7 | A/C/D | Full-process crash + portable hardware session evidence |
| Long-session reliability | 5 | 30/60/120 min | No complete physical soak series |
| Release confidence | 4 | Entire release gate + install | Signing/install/hardware and exact-replay gates remain open |

## Change discipline

Do not wholesale-rewrite the shell. Before extracting commands/selection/save/
export state, capture behavior tests and state transitions; compare after.
Do not close other apps, delete user files, request secrets in chat, or record a
physical input without authorization. No deployment follows from a subset pass.
