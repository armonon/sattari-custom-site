# Session Integrity checkpoint — 2026-09-24

Scope: shared browser StemDeck. This is not native installation, physical-interface certification, or a declaration of exact replay parity. Existing site and music tools are retained; no major new production tool was added.

## Implemented

- Replay preparation uses the enabled replay plan. Disabled lane/pad source edits no longer require missing assets. The browser regression calls the real `PerformancePlayer.prepare`, then re-enables each edit and requires the missing-source error.
- Sequential song replacements use a serialized source cache with ten-second prefetch and eviction of unreferenced sources. Known-duration PCM estimates reject oversized active sets before decode. A simulated 120-song replacement test verifies retained cache bounds; this is not a two-hour playback measurement.
- Input gain, monitor, arm, device/channel, low-latency and built-in FX state, including automatic interruption/disconnection, enter the durable performance journal. Events carry session-relative seconds, sample rate, frame and sequence metadata. Editing event time updates its frame metadata.
- New takes capture an authorized selected-channel pre-gain input lane, separately from the printed monitor and armed dry lanes. New replay can edit gain, monitor, high-pass and compression on the audio clock. Legacy takes retain their printed input audio. Unarmed and unmonitored input is not recorded.
- Multitrack capture is the default. Long-session takes open with their safety reference playable when this does not double existing audible tracks. Original source lanes and event history remain available.
- Take UI distinguishes Audio Take and Performance Take, lists editable areas and replay limitations. **Full Editable Take is deliberately not advertised before qualification.**
- Arrange has a bounded, collapsible and keyboard/pointer-resizable context editor; mobile uses a focused editor with Back and transport. Piano roll opens around the actual note register rather than hiding the notes below setup controls.
- Supported track/keyboard effect topology edits preserve playback and track automation via 25 ms crossfades. Old tails fade over that interval; unlimited tail preservation is not claimed. Excessive suspended-context changes are rejected safely.
- Formatting cleanup is mechanical; the two semantic lint defects were an unused import and missing Node Buffer import. Required pre-existing untracked source/tests/media were retained, not deleted as supposed garbage.
- Release gate fingerprints the source before/after lint, unit, type, meter, tempo, build, prerender and browser checks. CI tests built `dist` and Netlify receives it with `--no-build`. Pinned Playwright enables reproducible browser installation.

## Important architectural limits

1. Replay cache is **whole-source lookahead**, not arbitrary seekable decoding of compressed files. The 256 MiB cap measures retained replay PCM, not total process memory, encoded bytes, temporary browser decodes or other live-engine buffers. Unknown/incorrect source duration and multichannel media can allocate before the post-decode guard. Large simultaneously loaded decks may still exceed the cap.
2. Pitch/rate, loop, source and some topology mutations still use the monitored JavaScript dispatcher. Common stable transport, mix, FX and new input parameters use scheduled audio time. Frame metadata alone does not make all replay sample-deterministic.
3. Input device/channel choices are embedded in captured selected-channel audio. Missing, unarmed/unmonitored or disconnected audio cannot be reconstructed. Input compressor history, pre-recording effect tails and grain phase may differ. Printed recordings remain the safety reference.
4. Canonical capture events are retained alongside arrangement edits; not every event is yet a native graphical automation lane or region. Pad sound defaults to printed audio; rebuilding noise may differ.
5. Native plugin inventory is not browser hosting. Imported stem tracks are not a guarantee of instant separation.

## Verification and evidence

Final software gate report: `/tmp/stemdeck-session-integrity-final/report.json`.
Browser evidence: `/tmp/stemdeck-session-integrity-final/browser/`.
These paths are machine-local. CI uploads its reports/screenshots as artifacts. See the final report for pass/fail and exact source fingerprint; do not infer a pass from this checklist alone.

Final unchanged-source gate **passed** on 2026-09-25 at 02:37:55 UTC (September 24 local):

- 99 test files / **640 tests passed**.
- Lint: **0 errors**, one existing sequencer effect-cleanup warning. Type check passed.
- Synthetic meter qualification: **300 passed**; tempo fixtures: **7 passed**.
- Production build and prerender passed.
- **All eight generated-audio suites passed**, including 23 rack/input PCM checks and actual disabled-dependency replay preparation.
- 60-second audio-clock recording recovered 1,200 journaled actions; replay had zero events more than 25 ms late, worst 10.1 ms. This is not sample-exact or physical hardware qualification.
- Built-artifact desktop and mobile UI passed navigation, six-track import/reload, playback, visible notes and valid mix/stem downloads, without console errors. Desktop timeline 503 px; mobile timeline starts at 386 px and is 479 px tall. Mobile focused piano has 596 visible pixels of note canvas.
- Exact tested source fingerprint: `4359b2038202269bbc3cc5a41025164e53b91e3eb8116f6d86f279ec021bcf05`.
- Gate runtime: about 195 seconds. The report explicitly retains `releaseApproved: false`.

The first full run exposed two stale test expectations (new capture wording and newly required sample-rate metadata in a fake engine). They were updated with positive assertions for playable safety lanes and frame metadata; the complete unchanged-source rerun above then passed.

## Release-signoff matrix

| Gate | Required evidence |
| --- | --- |
| Software regression | Entire release gate green on an unchanged source snapshot |
| Browser workflow | Six-track project, all workspaces, playback, actual MIDI notes visible, mix/stem downloads, reload; 1440×900 and 390×900 |
| Recovery | Generated audio-clock capture under UI load, durable chunks/events, reload/replay; not a physical test |
| Long-session memory | Real multi-hour source mixes with memory traces, including oversized compressed sources — still open |
| Hardware | One-hour then multi-hour interface + controller sessions, vocals/instruments, disconnect/reconnect, sample-rate change — still open |
| Platforms | Chrome/Safari, real iPhone Safari and background/foreground — hardware/platform signoff still open |
| Replay fidelity | Exact pitch/loop/source/topology/input-history parity against printed PCM — still open |

Do not assign a production release-approved tag until the open gates have evidence. A software-validated checkpoint tag must explicitly retain these limitations.

## Physical session protocol

Back up the session; use headphones and safe monitor levels. Record machine/OS/browser, interface/driver, sample rate/buffer and controller. Load six songs, perform for an hour with vocals/instrument, pads/MIDI, stem changes, loops, crossfades and FX. Save while playing. Stop, open Arrange, audition the safety take, edit/replay, export mix/stems, close and reopen the archive. Compare duration/alignment and audible transitions. Repeat unplug/reconnect and foreground/background on a copied take; preserve the safety audio and exported diagnostics after every fault. Repeat with a multi-hour take and another browser/device. Report observed dropout counts and measured loopback latency, not advertised buffer estimates.
