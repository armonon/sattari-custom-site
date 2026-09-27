# Master stem controls

Local browser Studio only. No deployment or desktop installation.

## Working paths

- Always-visible Master stems panel: Vocals, Drums, Bass, Other, Unseparated. Each has 0–300% linear group gain, mute, solo, and unity reset. Reset stem mix leaves master tone/limiter settings alone.
- Live decks: multiply each lane's existing gain by the global group gain. Individual deck/lane settings remain unchanged. `music` maps to Other; `fullMix` maps to Unseparated. Newly loaded lanes inherit current settings.
- Mic/input, loaded pads and pad synths use a shared Unseparated gain before master processing and program recording.
- Arrangement tracks have an explicit Master stem group selector in Track options. Old tracks default to Unseparated. Copy deck audio assigns the known stem role automatically.
- Arrangement playback, live mixer updates and mixdown honor group gains. Pre-master individual track exports deliberately exclude global group processing.
- Settings live in optional `masterProcessing.stems` and pass through existing session/portable-project serialization and normalization. Existing projects retain neutral gain and need no migration. Stem-group assignments are validated.
- Master-processing changes already enter performance event capture; this does not add editable automatic event replay.

## Limitations

This is a global grouped-control implementation, not four new post-deck FX buses and not real-time AI separation. Deck groups act before shared deck EQ/filter/echo/reverb; effect tails can remain after muting and cannot be cleanly split into stem contributions. Displayed source counts are loaded deck lanes, not audio meters. Unassigned tracks/full mixes are not inferred to be vocals/drums/bass. Instrument audition voices are not a complete routed instrument-hosting system.

## Verification

53 targeted tests across six files passed: UI controls, bounds/defaults/roundtrip, global solo/mute interactions, preservation of deck settings, input routing regression coverage, and arrangement scheduling/live updates. Production build passed. Audible hardware and end-to-end recorded/exported PCM comparison remain pending; no production-readiness claim.
