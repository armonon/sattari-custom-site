# Studio graphite refinement — 2026-09-20

Companion to the desktop refinement:

- Shared neutral graphite palette and blue transport accent; retained stem colours.
- Quieter active navigation and buttons, reduced borders, more deliberate deck padding.
- Larger regular action labels and master readouts; readable Tempo/Key labels on mobile.
- View title followed by session name; removed promotional workspace taglines.
- Sentence-case status and master labels; neutral idle Record and red recording state.
- Preserved master expansion, audible-monitor warnings, muted-state distinction,
  recording, import/save, all workspaces, FX controls, and Play/Cue above waveforms.
- Retained keyboard focus, skip target, reduced-motion preference and mobile targets.

No dependencies, audio engine, persistence model or hosting configuration changed.

Validation: page integration 9/9, TypeScript check and production build passed.
Copy-only test expectations now use the intentional sentence case. No workflow
assertions were removed. No new browser visual/interaction QA was performed in
this follow-up. The preview serves the rebuilt production output on port 4186;
the public site was not deployed.

## Add-source follow-up

Both empty-stage and loaded-deck Add source buttons now open Mic / Input / Track.
Mic confirms default-device monitoring; Input requests permission only on Find inputs,
stops the temporary permission stream, and routes the selected device on Connect.
Track keeps the existing file importer. A persistent live-input status/disconnect
control appears in Perform. This browser version supports one live input at a time;
interface channel routing remains in the interface/browser configuration.

Exact-device validation rejects disconnected/substituted devices; cancellation and
engine disposal invalidate pending connections. Native modal focus/Escape semantics
are used. The 26 targeted page, chooser and audio-routing tests passed, along with
the type check and production build. Browser hardware permission/monitoring and
native top-layer focus behaviour still need hands-on verification; jsdom tests use
an open/close dialog shim. No live site deployment or installed-app update was done.
