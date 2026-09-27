# Instrument workspace upgrade

Scope: browser Studio Arrange. Existing audio tracks, project storage, master processing and independent MIDI clips are retained.

## Delivered

- Always-available Piano roll toolbar entry and a dock that opens when an instrument clip is selected. Pattern selector, new instrument, adjustable desktop height, mobile-focused layout, pattern length in bars.
- Modeled piano, electric keys, bass, pad, analog synth, synthesized drums, legacy sine/triangle, and a user-audio sampler. Attack, release and tone controls. The sampler has a selectable original pitch; its audio uses the existing portable-project asset pipeline. Samples are limited to 32 MB / 60 seconds to prevent accidental full-song decoding as an instrument.
- One voice builder for playback, export, live keyboard monitoring and audition. Audition uses the note's velocity/duration and the selected clip's automation, fades, track gain/pan, mute/solo, and master stem routing. Audition prepares only its own assets, preserves playback caches, reuses the master graph, and stops on transport pause.
- Linked repetitions with a shared pattern definition and backward-compatible materialized clips. Notes, instrument, sample and sound settings propagate; placements and mix controls remain independent. Make independent, ordinary duplication/paste, trim, split and timebase changes provide explicit independence. Tempo changes retime linked definitions with their clips. Repeat selects the new instance so successive repeats progress along the timeline.
- Box selection, ghost notes, triplet subdivisions, major/minor scale snapping, directional scale nudging, and time-aligned vertical velocity controls. Selected chord notes bring their velocity control forward.
- Live MIDI scheduling uses a 300 ms look-ahead and 25 ms pump, rather than creating oscillators for all future notes. A shared 96-note overlap limit and 384 queued-voice cap reject overload explicitly; finished voices and stopped queues are released. Existing loop and live-edit graphs use the same bounded MIDI path.

## Verification

- Focused arrangement, MIDI, automation, export and project-store regression suite: 87 tests passing.
- Native browser audio QA: 11 checks passing, including real rendered instrument PCM, velocity scaling, silence after note ends, sampler transposition/seek, track routing, and no eager voices for 20,000 future notes.
- Unit scheduler fixture: 100,000 notes with only the immediate scheduling horizon instantiated.
- Desktop (1280×720) and mobile (390×844) visual checks in an isolated test origin. No user Studio session was edited.
- Production build and focused lint checked.

Reproducible browser audio checks: `scripts/instrument-browser-qa.html` through the local Vite development server. Generated audio is disconnected from speakers; the checks do not modify the Studio project.

## Boundaries

These are lightweight synthesized/modeled instruments, not a sampled concert-grand library or a third-party plugin host. The sampler is a pitched one-shot instrument, not a multisample mapping editor. Live keyboard monitoring shares voices and track routing but does not replay timeline-positioned clip envelopes while keys are held.

The live scheduler reports excessive polyphony or a substantially delayed browser timer rather than silently dropping notes. Long-session hardware/load testing is still needed. Offline rendering retains the existing whole-buffer allocation/export limits; this change does not solve the separate long-set export work identified in the arranger review. No deployment or native desktop installation was performed.
