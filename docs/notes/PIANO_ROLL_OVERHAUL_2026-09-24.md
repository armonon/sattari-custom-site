# Piano roll workspace overhaul

Scope: the actual arranger instrument editor (`ArrangementNotes`), not the unused one-bar `PianoRoll` sketch. The project format, instrument engine, recorded MIDI and linked-pattern model are unchanged.

## Changes

- Real overlapping white/black piano keys across C0–B8, with octave landmarks and aligned 28-pixel semitone rows.
- Grouped Draw / Select / Erase tools, consistent icons, visible selection actions and a direct quantize button.
- Fit-to-pattern zoom that also centers existing notes vertically; synchronized note/velocity scrolling and viewport resize measurement.
- Bars/beats ruler with progressively fewer labels when zoomed out; shading beyond the writable clip boundary.
- Clear note bodies, resize edges, selection state, ghost notes and velocity stems aligned to note starts. Velocity controls remain keyboard-accessible sliders.
- Optional audition while editing. Turning audition off does not mute the arrangement or alter written MIDI.
- Clip-relative transport cursor reads the existing transport clock; animation updates the DOM directly rather than rendering the entire note grid every frame. It stops when playback stops or the editor unmounts.
- Expand/restore workspace controls. At 390-pixel viewport width, Close and Restore remain visible instead of disappearing into a horizontal toolbar.
- Touch panning over empty grid in Draw mode; note drags and Select-mode marquee retain direct pointer handling.
- Scoped shortcuts: B Draw, V Select, E Erase, F Fit, Escape deselect. Existing select-all, duplicate, delete and arrow-key editing remain available.

## Validation

- Studio/arrangement regression suite: 144 tests in 29 files passed, including linked-pattern editing, note properties, triplets/scale snapping, new erase/audition/fit controls, velocity, cursor cleanup and expand/restore state.
- Real browser instrument-audio fixture: 11/11 passed using generated PCM/offline rendering and disconnected test sinks. No mic or speaker tests performed.
- Desktop and 390 × 844 layouts inspected in the in-app browser. Pointer drag moved a C4 note by two grid steps and one semitone; right-edge resize increased its displayed length from 24 to 72 pixels at unchanged onset. These are browser-pointer checks, not physical phone touch qualification.
- Targeted ESLint, TypeScript and production Vite build passed. After the final ruler-label adjustment, the complete scoped suite passed again (144 tests, 19.45 seconds), targeted ESLint passed, and the Vite production build passed (5.85 seconds).

No deployment, commit, push, native rebuild or installed-app replacement was performed. Existing unrelated working-tree changes were preserved. Local preview: http://127.0.0.1:4194/studio.

## Free timing follow-up

Grid lines no longer force note positions. Snap positions defaults off; the magnet toggle optionally snaps note starts during placement/movement, with Alt/Option bypass. Resizing always uses the raw pointer delta, even with position snap enabled. Start and duration fields accept arbitrary decimal seconds. Free arrow nudges use one horizontal pixel of time at the current zoom. Clip boundaries and the existing 1 ms minimum are retained; toggling snap never rewrites existing notes. Quantize remains an explicit action.

All 32 targeted note/editor/pattern regression tests passed, including off-grid drawing/movement, absolute-onset snapping, bypass, non-grid resize, numeric duration, clip-boundary clamping and cancelled gestures. Targeted ESLint and whitespace checks passed.
