# StemDeck console redesign — 2026-09-17

## Design

Graphite surfaces, warm white typography, restrained lime selection, and existing
deck/stem colours. Navigation is a permanent left rail on desktop and a bottom
bar on smaller displays. Perform, Arrange and Library share the same transport,
project tempo/key, workspace actions and master console.

`src/styles-studio-console.css` is the scoped presentation layer. It does not
restyle the public storefront. Native counterparts live in StemDeck's
`DesignTokens.h` and `docs/reference/tokens.css`.

## Preserved and verified

- Import audio, save project, deck focus, sync, cues/loops/FX, and stem controls.
- Arrangement editing/automation and the library remain reachable by navigation.
- The compact master stays visible on desktop; its detailed tone, dynamics and
  independent monitor controls expand without covering the workspace navigation.
- Tempo/key remain available on phones; arrangement actions wrap instead of clipping.
- Waveform detail buttons now change density. Removed the inert frequency-view
  button; AUDIO is a status label rather than a fake DSP action.
- Stem ranges have accessible names, selected navigation has aria-current, and
  reduced-motion preference suppresses transitions.

## Workflow repair found during visual testing

`loadLane` and `loadPad` no longer await browser playback permission. Saved audio
can decode and restore while the audio context is suspended. Actual playback,
recording and microphone actions still require their existing unlock path.
Verified a locally generated eight-second WAV imports and restores after reload.

## Validation / boundaries

- Production Vite build passed; 224 tests passed across 28 files.
- Browser inspection covered empty/loaded Perform, Library, Arrange, phone tempo
  controls, and expanded master. No real user music was used.
- Stem wave columns in the browser reuse the mix envelope when isolated stems
  are absent; this redesign does not implement browser AI separation.
- Desktop and browser share visual direction, not identical engine capabilities.
- No production deployment, native installation, git commit or push performed.
- Audition, real mobile-device gestures, native plugin windows, and release
  packaging remain separate validation work; automated checks do not certify them.
