# StemDeck performance overview qualification

The four-deck overview reuses the live deck state, waveform and audio commands. Each deck exposes playback, seeking, mix level, prepared stem import, stem level, mute and solo. Detailed controls retain cue, loop, pitch and effects editing. Empty stem lanes are disabled until audio is loaded; this view does not claim automatic separation.

The arranger remains a separate workspace. A simultaneous deck/timeline workspace and redesigned mixer from the concept remain future work; this is a qualified first slice, not completion of the entire concept.

Validation: 41 focused component/integration tests; TypeScript and production build; browser audio import and playback, 16 stem imports, controls, embedded `.sattari` save/reopen, widths 1440/1024/390/320. Audio harness: 14 arrangement/export checks and 4 performance recovery checks including a 60-second recording. No browser runtime errors. Generated PCM only; no microphone access or audible playback.

`browser.mjs` reproduces the isolated UI workflow using STUDIO_ORIGIN (localhost by default). Binary fixtures and screenshots stay local. JSON reports preserve results. Publication must preserve backend digests, schedules, edge code and unrelated static assets.
