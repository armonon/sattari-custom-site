# Collapsible workspace panels

- Shared labeled chevron controls for Library playlists, song browser, Up Next and preview; inputs; performance sources; pads; mixer channels and mixer/FX; project files; arrangement lower editor and device racks; Master Output, stems, tone, dynamics and monitoring.
- Collapse all / Expand all operates on major panels in the current workspace. Existing submenu disclosures retain their own state rather than being forcibly opened by Expand all.
- Layout choices survive tab switches during the current app session and are independent between workspaces. Reloading resets the layout; these are not project data.
- Collapsing uses CSS visibility of direct panel children rather than conditional rendering. Audio elements, timers, pending operations and editor drafts remain mounted. No engine, transport or persistence calls are made by layout controls.
- Global transport, recording controls, timeline, input status, master meters and the master monitoring warning remain available. Direct alerts are not hidden by a panel's own collapse state.
- Keyboard-operable buttons expose aria-expanded and aria-controls. No animation, dependencies, polling or storage writes added.
- No deployment or native app installation included. Existing Vite/Netlify project retained; Sites usability guidance used for consistent disclosure controls.

Acceptance checks: component regressions exercise independent workspace state, collapse-all plus individual reopening, hidden workspace roots and forwarded refs, preserving child effects/drafts, and retaining the exact preview audio element, cue route and playhead without pausing it. Browser screenshot/responsive visual QA is still required before release.

Validation: 64 tests across eight affected suites passed after the final source edits. Vite client production build, targeted ESLint, TypeScript and tracked diff whitespace checks passed.
