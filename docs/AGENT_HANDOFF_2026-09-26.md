# StemDeck agent handoff — September 26, 2026

## Continue development here

- Working repository: `/Users/lillypad/Downloads/sattari-custom-site/site`
- Remote: `https://github.com/armonon/sattari-custom-site.git`
- Working branch: `release/stemdeck-session-integrity-candidate-20260925`
- This checkpoint includes StemDeck reliability work AND unfinished shared
  homepage/About/Hub/separator work. It is not a qualified release or deployment.
- The native project at `/Users/lillypad/Projects/StemDeck copy` is separate;
  this checkpoint does not update or install that native application.

The user requested committing all current shared work for continuation by another
agent. No push or deployment was performed for this checkpoint. Finder metadata
(`.DS_Store`) is excluded from this checkpoint and may remain modified locally.

## Preserve the qualification candidate

- Candidate SHA: `c4d1ae69fd09adebaf9de8b26bebdc9a14b5adad`
- Candidate branch: `release/session-integrity-stable-20260925-r2`
- Detached worktree: `/Users/lillypad/Projects/StemDeck-qualification/candidate-20260925`
- Local evidence and resume guide: `/Users/lillypad/Projects/StemDeck-qualification/README.md`
- Latest report: `/Users/lillypad/Projects/StemDeck-qualification/evidence-c4d1ae6/report.json`
- Prior candidate and failure evidence remain preserved alongside it.

These evidence directories are outside this repository and are not uploaded by
committing this checkpoint. Transfer them separately when moving machines. The
candidate branches are local unless explicitly pushed later. Do not amend a
tested candidate or overwrite evidence. A source fix requires a new candidate.

## Verified result and unresolved work

The candidate passed 762 tests and failed one unchanged 5-second sequencer UI
test: `opens a connected beat sequencer without converting melodic clips` in
`src/components/studio/ArrangementEditor.test.jsx`. The gate stopped; later
build/browser/audio/export checks were NOT qualified for that commit. The host
was heavily loaded, but that does not establish that the product is fault-free.
The prior candidate passed 763 tests but failed prerender; the latest candidate
contains the React Router import fix for that failure.

The newest shared homepage draft is not build/browser-qualified. Review its
About/navigation tests before claiming the combined checkpoint passes. The
known website task has reopened a local preview only; source work was paused.
Confirm other agents are idle before editing or running a frozen gate.

## Next steps

1. Inspect this checkpoint and the candidate protocol in
   `docs/STABLE_CANDIDATE_PROTOCOL.md`; preserve unrelated work.
2. Diagnose the failing sequencer test on a quiet host without weakening its
   threshold. Resolve any changed Finder metadata deliberately before requiring
   a clean candidate tree; do not discard source changes.
3. Run the complete gate against an unchanged clean candidate with a new
   external evidence directory. Keep all original failures.
4. Obtain two rights-cleared full-length songs and named physical interface,
   input/main/cue routing, and recording readiness from the owner.
5. Check actual recording-volume space and browser quota before the 30/60/120
   minute hardware ladder. The conservative 12-channel, 48 kHz, three-copy
   two-hour budget is about 55 GB; prior available space was insufficient.
6. Qualify capture, reconstruction, save/reopen/relink, export, recovery and
   hardware behavior. Exact editable FX gaps remain Printed Only; native plugin
   hosting remains a separate acceptance scope. Do not declare full release,
   raise scores, or resume broad feature expansion without evidence.

Gate command (candidate checkout, choose a fresh evidence path):

```sh
STUDIO_GATE_OUTPUT=/absolute/new/evidence-directory node scripts/studio-release-gate.mjs
```

Local preview URLs can serve the shared working tree; they are not proof that
the frozen candidate or public deployment contains the same code.
