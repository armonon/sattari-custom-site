# Studio premium UI consistency pass — 2026-09-24

## Scope

The browser/shared Studio UI, not the native audio engine or an installed desktop release. Preserve ongoing changes in this checkout. No deployment, commit, dependency changes, project migrations, or audio routing changes were performed.

## Changes

- One graphite surface, border, text, and control palette across Library, Arrange, Input, the device rack, and Master Output. Component CSS uses shared tokens with fallback values rather than unrelated fixed colors.
- Consistent panel finish, readable metadata, larger master readouts, clearer queue hierarchy, and focus-visible treatment for disclosure and keyboard-focusable controls.
- Recording control has a circular idle record glyph and a square stop glyph during capture; accessible action names remain unchanged.
- Settings is a scrollable, labeled panel with larger controls and a compact-screen bottom placement above navigation. Removed its inherited backdrop blur.
- Mixer headers, pad labels, and the project browser no longer rely on tiny 7–9px text. Mixer mute/solo expose their pressed state and deck identity to assistive technology.
- Project-browser actions use sentence case, readable descriptions, and responsive columns.
- No added animation loops, remote fonts, image downloads, dependencies, or background processing.

## Preservation checklist

- Library imports, collections, preview routing and Up Next retained.
- Deck playback, stem colors, safety/warning colors, transport and pads retained.
- Master stems, metering, processing and compact/expanded states retained.
- Arrangement tracks, devices, automation and piano workspace retained.
- Piano-roll position snapping stays optional/off by default; note resizing remains free-length.
- Compact-icons preference and accessible action names retained.
- Recording recovery, source capture and project persistence untouched.

## Verification

- 96 tests across 19 files passed after the final edits, including Studio navigation, recording transitions, library, master, input, arrangement and free note timing regressions.
- Vite production client build, targeted ESLint, TypeScript check and tracked diff whitespace check passed.
- Computed shared palette contrast: primary text/panel 14.63:1; secondary text/raised surface 7.10:1; metadata/raised surface 5.47:1; accent text/panel 9.56:1. These checks do not constitute whole-app accessibility certification.
- Local preview at http://127.0.0.1:4194/studio returned HTTP 200.
- Screenshot review, real mobile-device inspection, 200% text zoom and hardware/audio qualification were not performed in this pass. Those remain acceptance checks before release.

Design direction used the Sites design guidance available at the start of this pass, without migrating the existing Vite/Netlify project to Sites hosting.
