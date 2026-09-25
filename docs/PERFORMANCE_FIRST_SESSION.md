# Performance-first session contract

The shared browser UI is one musical session with Library, Perform, Arrange and Mix views. Switching views must not create or replace an audio engine, discard takes, reset monitoring or change routing. Export acts on the arrangement in this same session.

## Workspace hierarchy

- The persistent command bar owns global transport, tempo, key, capture and inspector access.
- Perform shows the focused deck and a second loaded deck, with the crossfader directly available. Deck selectors change focus without stopping other decks.
- Arrange keeps its timeline visible even when empty. Clip, device, automation, piano, sequencer and performance tools share one lower editor.
- Input and Master are bounded, on-demand inspectors, not stacked above/below the musical surface. Closing them hides controls; it never disables processing, disconnects inputs or resets monitor state.
- The output meter remains in the command bar. Hidden detailed meters stop polling; hidden input status polls slowly for connection changes.
- Status and capture settings live in the expandable bottom status line. Recovery downloads and recording faults expand it automatically.
- Primary musical surfaces cannot be collapsed by the secondary-panel layout menu.

## Capture → Arrange

Capture uses the existing recorder, durable event journal and optional separate-source recording. Finish saves events and source references into the existing arrangement; it does not create another project. “Open performance in Arrange” opens the latest captured take in the Performance editor.

The Performance editor exposes event edits, live-engine audition, printing, and source reconstruction. Original events and the printed reference remain intact. Reconstructed lanes begin muted for comparison; do not enable them over an audible safety reference without an explicit user action. Older captures without stable IDs must be edited by their selected index, never by a shared empty asset ID.

## Honest boundaries

This restructure does not certify exact replay of every live effect. Existing replay warnings about legacy reverb, opening tails, pads and scheduling still apply. Separate source capture remains opt-in. Device loopback, acoustic latency and long hardware sessions require physical testing. Browser audio CPU percentages are not exposed by the current engine; never substitute a fictional reading.

## Regression gates

### Browser follow-through, 2026-09-24

- Command-bar UI callback delay is sampled by its existing 400 ms meter timer. Background-tab pauses are excluded. The tooltip distinguishes browser processing/output latency estimates from CPU usage and measured round-trip latency; unavailable values are not replaced with zeros.
- Stable deck-filter sweeps use the audio scheduler and the same curve as live playback. Any low-pass/high-pass type change keeps that deck's filter sequence on the conservative dispatcher, avoiding early graph mutations. This is an improvement, not a claim of exact replay of every effect.
- Isolated desktop/mobile browser QA covers all four views, inspector visibility, viewport containment and adding a sequencer hit. The inspector follows the measured command-bar height, including narrow-screen wrapping. Tool-information links now live in the status drawer rather than displacing the full-height app.
- Audio QA waits for completed suites rather than closing a context at its first failure. Range-export checks validate the WAV header and decode at 48 kHz: decoding at a 44.1 kHz hardware rate introduces resampling and cannot establish sample-exact export length.
- Physical loopback, actual interface disconnects, extended hardware sessions and legacy opening-state reconstruction are not certified by synthetic tests.

1. Open/close Input and Master while playing: routing and playback remain unchanged.
2. Capture, finish, open in Arrange: events and aligned sources remain in the same session.
3. Edit one take: no other take or original event history changes.
4. Switch Library / Perform / Arrange / Mix: keep project state and recovery copies.
5. Piano roll, sequencer, linked patterns, undo and export remain reachable.
6. Recovery download remains visible after a storage failure.
7. Check narrow screens, text enlargement and real output on physical hardware before release sign-off.

Automated component checks validate state and wiring, not the visual layout or actual listening quality. No native installation or production deployment is implied by this change.
