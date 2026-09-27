# Studio modern UI — 2026-09-20

Shared the native StemDeck ink/ice palette, vector mark, control shape and visual
hierarchy with the existing browser workspace. Updated Perform, Arrange, Library
and master output without changing the browser audio engine or project schema.

Workflow changes: deck Play/Cue now precede the tall stem editor in DOM and
keyboard order; desktop headers consume less space; short-laptop empty-state
actions fit; phone actions have larger targets; a keyboard skip link targets the
workspace. Navigation and editor tests retain all assertions.

Validation: lint, type-check, production build, 249 tests / 28 files pass.
Earlier timeout runs were not counted as passes. Scoped arranger test queries
avoid repeatedly traversing unrelated piano buttons; no timeout was relaxed.
Visually checked desktop and 390×844 layouts with synthetic audio, including
master disclosure. No browser errors observed in the checked local session.

Production preview: http://127.0.0.1:4186/studio (requires the local preview server).
No deployment, commit or push. No new audio/MIDI parity or release-readiness claim.
Native change and verification details live in the native repository at
`plugins/stemdeck/MODERN_UI_2026-09-20.md`.
