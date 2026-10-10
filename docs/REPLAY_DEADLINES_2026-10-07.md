# Captured replay deadline repair — 2026-10-07

## Reproduced problem

The actual four-deck UI capture could be saved and exported, but printing its
recorded controls stopped with a missed grain deadline or source-window underrun.
The original capture, sources and events were retained. This was a real workflow
failure, even though the narrower automated audio gate passed.

Chromium CPU sampling of that failing capture attributed 16.54 seconds of self CPU
to `standardized-audio-context`'s `detectCycles`. Each grain connect/disconnect
walked every possible path through a reconvergent mix graph, even with no feedback
path. The resulting main-thread stalls reached 1,013 ms. The existing 50 ms grain
and 250 ms control guards correctly refused a damaged replay.

## Bounded repair

`standardized-audio-context` 25.3.77 is the currently reviewed dependency. A small
postinstall patch performs a linear reachability check before the existing cycle
enumerator. Only when the destination cannot reach the connecting root does it
return no cycles immediately. For reachable roots, the original cycle enumerator
and downstream connection/cycle bookkeeping run unchanged. Delay nodes and
AudioParam ownership use the existing library rules. There is no cross-call graph
cache, so connect/disconnect changes cannot leave stale reachability results.

Both the ESM browser entry point and bundled entry point are patched. The installer
requires the reviewed version and exact original factory SHA-256 hashes and rejects
unknown source; it is idempotent on a previously patched install. Future dependency
updates require an explicit patch review, not silently removing the fence. Run
normal `npm ci` with lifecycle scripts enabled, or explicitly run
`node scripts/apply-audio-cycle-precheck.mjs` after an install with scripts disabled.
The installed-factory regression tests must pass before building/releasing.

No audio graph, DSP, gain, scheduling horizon, deadline threshold, source media,
export samples or cycle counter policy was changed. This is not a switch to private
native audio internals or a replacement grain engine. True feedback graphs still
use the upstream enumeration and may still be expensive; no universal performance
claim is made.

## Evidence and limits

- Eight targeted regressions cover all 1,024 directed three-node graph/delay cases,
  feedback paths and ordering, AudioParam edges, non-root cycles, graph mutation,
  bundled entry parity and installer source fencing. A 14-stage acyclic diamond
  changes from more than 60,000 graph reads to 43.
- The same owned capture that previously failed printed through the actual UI
  after the repair, with zero reported late control events. Its sampled replay had
  no observed grain failure, grain pump over 10 ms, or main-thread task over 50 ms.
- A fresh actual UI run held all four decks for 12 seconds across source windows,
  captured stem mute/crossfader controls, printed the replay, reconstructed source
  lanes, used undo/redo, downloaded master/stems, restarted the browser completely,
  and restored a portable project into a fresh profile. All four decks remained
  playing until explicitly paused. The 39 referenced assets survived; master PCM
  was identical across both reopen paths (646,336 frames, 48 kHz stereo).
- Comparing the original lossless master capture against the actual live-engine
  print over 0.75 s through duration minus 0.4 s gave zero-sample alignment,
  correlation 0.99999999999997 and maximum sample error 1.12e-8. This is a measured
  representative middle-interval PCM match; intro/outro and other musical cases
  are not qualified by it.
- These are generated-media, local Chromium measurements, not physical-input,
  all-device, native-app or full musical reference-project qualification. The
  original browser-encoded reference and live-engine print are not asserted
  sample-identical merely because both export/reopen correctly.
- The stronger optional UI harness now fails its performance subset if a deck has
  already stopped unexpectedly. It no longer labels an unexplained stop a natural
  end. Archive checks still run independently if replay fails, preserving evidence.
- Keep the prior exact-head WebKit IndexedDB setup failure explicit: no arrangement
  tests executed in that attempt. This patch does not claim to resolve it.

Reports are retained under the company work log at
`core-product-lab/reports/stemdeck-replay-deadline-20261007/`, including failing CPU
profiles, same-fixture before/after probes and fresh UI lifecycle results. Candidate
local gates, independent review and exact committed-head receipts are recorded
there separately. This document is not a merge, deployment or release approval;
required remote checks and the existing source/live stack still apply.
