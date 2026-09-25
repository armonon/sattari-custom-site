# StemDeck workspace refinement

Scope: the shared browser Studio UI. No engine, project-format, deployment, or native installation changes.

## Design decisions

- Replace the tall left rail with labeled Library / Perform / Arrange tabs in the command bar. Keep tab drag-and-drop and active-workspace semantics.
- Reduce branding and toolbar height; reclaim width for decks, library rows, and the timeline.
- Keep navigation labels visible even in compact-icon mode. Phone layouts use the same tabs rather than a separate floating bottom rail.
- Put bulk collapse/expand in a Layout disclosure, including Escape dismissal and keyboard focus restoration.
- Use quiet chevron section controls rather than nested full-width outlined buttons. Preserve mounted content, routing, drafts, and safety status when collapsed.
- Combine Input status and stem reset actions with their panel headings. Put the master collapse control in its existing metering summary.
- Flatten Library into divided columns; remove card borders around each column and around the song table. Preserve import, preview, queue, playlist, backup, and drag actions.
- Tighten Arrange padding, editor tabs, output shelf, and device-rack headings without changing note geometry or playback.

## Regression checklist

- Workspace tabs, transport, import, save, settings and recording remain reachable.
- Collapsing does not unmount audio, clear edits, reset stem gains, or hide master safety controls.
- Master remains hidden in Library; recording and processing continue independently of presentation.
- Library preview routing stays opt-in; loading a queue item does not start playback.
- Piano-roll note lengths remain free, with optional position snapping.
- Existing warning colors, metering, touch targets and reduced-motion rules remain intact.

## Validation

- 79 tests passed across the page, panel layout, input, master, library, preview, rack, arrangement editor and piano-roll components (9 files, one worker).
- Vite production build passed.
- TypeScript, targeted ESLint and `git diff --check` passed.
- Existing local `/studio` preview returned HTTP 200.

Screenshots and interactive browser visual qualification were not performed; responsive CSS is not a substitute for hands-on visual review. Local preview only until deployment is explicitly requested.
