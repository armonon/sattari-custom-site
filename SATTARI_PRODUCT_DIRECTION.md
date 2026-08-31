# Sattari Product Direction

This site is moving toward a broader Sattari music ecosystem: shop, studio, learning,
radio, social profiles, and a community marketplace. The goal is not just to sell gear,
but to help people make, learn, share, and trade music around the Sattari brand.

## North Star

Sattari should feel like a practical music home base:

- Buy instruments and accessories.
- Learn from songs and guided practice.
- Use Sattari Studio tools, including the DJ stem deck.
- Discover music through radio, charts, and curated features.
- Build musician profiles and social presence.
- Sell and browse instruments in a local community market.

## Existing Technical Source

The Sattari plugin suite provides much of the advanced Studio and Learn capability:

- GitHub repo: https://github.com/armonon/sattari-plugins-suite
- Local source inspected at:
  `/Users/lillypad/Downloads/sattari-plugins-suite-0.1.4`
- Private repo access was confirmed from local Git with `git ls-remote`; the GitHub
  connector may still need permission to browse it directly.

Important truth label: the suite is native JUCE/C++ alpha plugin/app code, not a
drop-in React library. The website should use it through a deliberate bridge: extracted
analysis modules, a local/server job runner, WebAudio/WebMIDI implementations inspired by
the suite, or a future WASM/service wrapper.

Relevant capabilities already present in the suite:

- StemDeck: four-deck remix app/plugin, full mix plus Drums/Bass/Music/Vocals lanes,
  optional Demucs stem separation command, waveform loading, faders, EQ/filter,
  pads, BPM/source-BPM controls, host/beat sync, live key analysis, key matching,
  Rubber Band time/pitch, mic monitoring, WAV recording, and arrangement/event-log
  export.
- VoxKey: real-time vocal pitch detection, confidence/RMS gating, voice-to-MIDI,
  scale/key lock, note stabilization, velocity mapping, pitch bend, glide, and modes
  including Melody, Bass Follow, Harmony, Drum Mouth, and Pad/Soul Layer.
- Auto Pitch: real-time monophonic pitch detection and correction, key/scale snapping,
  Rubber Band pitch shifting, AutoKey follow, key-map scanning, and cross-plugin key
  publishing.
- Sattari Arp: MIDI-effect arpeggiator with rate, pattern, octaves, gate, swing,
  velocity, humanize, transpose, latch, and input-through controls.
- Sattari Audio Core: shared contracts for keys, harmonic wheel codes, track analysis,
  energy segments, cue points, MIDI patterns, render/export manifests, pitch detection,
  MIDI learn, cross-plugin key/session bus, realtime utilities, and validation reports.

## Sattari Studio

The studio section will incorporate the existing DJ stem deck and Sattari plugin suite
code. It should become the creative tool layer of the site.

Initial concepts:

- Stem deck demos with drums, bass, melody, vocals, and effects.
- Solo, mute, loop, and section controls.
- BPM, key, chord, and arrangement information.
- Song breakdowns that connect directly into lessons.
- Studio service calls to action for production, mixing, lessons, and custom work.

First practical Studio build:

- Create a web-native `/studio` shell using the StemDeck product language.
- Embed a demo deck UI with pre-cleared audio/stems before accepting uploads.
- Show BPM/key/section metadata and stem controls from static demo manifests first.
- Later connect real StemDeck processing through a local/server analysis bridge.

## Sattari Learn

The Learn section should not start as a static full curriculum. It should start as an
interactive teaching engine, then use curriculum paths to organize the user's progress.

Core idea:

1. The user drops in a song or chooses a demo track.
2. They click "Teach".
3. The system analyzes the song and turns it into exercises.
4. The user practices with guided feedback using browser audio, mic, and MIDI where
   possible.

Capabilities to build toward:

- Detect likely key, chords, tempo, BPM, sections, and loops.
- Generate practice steps from a real song.
- Show guitar tabs and chord shapes.
- Show piano keys, scale degrees, chords, and hand-position prompts.
- Create rhythm tests from drums, claps, or metronome patterns.
- Separate or loop song sections for repeated practice.
- Suggest a bassline, generate one, and ask the user to play it.
- Use mic input to tell whether the user is playing in key or on rhythm.
- Use MIDI input for more precise note, timing, and velocity feedback.
- Turn progress into challenges, badges, and next-step recommendations.

Plugin-suite mapping:

- Song/stem context comes from StemDeck concepts: stem lanes, TrackAnalysis, BPM/key
  metadata, section/cue points, loop regions, and arrangement export.
- Mic pitch feedback comes from VoxKey and shared pitch detection concepts.
- In-key correction/scoring concepts come from Auto Pitch and Sattari Audio Core's
  key/scale contracts.
- MIDI practice input can use WebMIDI on the site, with SattariMidiLearn concepts
  informing the controller-mapping model.
- Bassline, arpeggio, and rhythm challenge generation can start from Sattari Arp and
  Core MIDI pattern descriptors.

Recommended first Learn prototype:

1. Let the user choose a demo song or upload a file.
2. Show a "Teach" button.
3. Return an analysis card with key, BPM, sections, and suggested chords. This can be
   mocked from fixtures at first.
4. Generate three exercises from that analysis: play the root notes, play the chords,
   and clap/tap the rhythm.
5. Add browser mic pitch detection for a simple "in key / not in key" meter.
6. Add WebMIDI note detection for piano/guitar-MIDI controllers.
7. Add StemDeck-powered stem separation and loop practice once the processing bridge is
   clear.

The curriculum should be modular, not huge upfront. We can create small skill paths:

- Piano Basics: keys, notes, intervals, scales, simple chords, first progressions.
- Guitar Basics: open chords, power chords, chord changes, strumming, simple tabs.
- Drum Basics: tempo, counting, subdivisions, grooves, fills, rhythm accuracy.
- Song Practice: key, chords, looped sections, simplified parts, performance goals.
- Producer Basics: basslines, arrangement, stems, groove, harmony, and remix ideas.

## Radio And Charts

Radio will become the listening and discovery layer.

Initial concepts:

- Now playing.
- Weekly Sattari chart.
- Staff and DJ picks.
- Song voting.
- Music submission flow.
- Featured local artists.
- Links from songs to Learn breakdowns and musician profiles.

## Music Social Profiles

Profiles are the identity layer for musicians, teachers, sellers, and local artists.

Profile concepts:

- Artist name, handle, instruments, location, and links.
- Tracks, videos, or embedded demos.
- Gear list.
- Lessons offered.
- Marketplace listings.
- Radio submissions and chart placements.
- Practice progress or badges if the user wants them public.

## Community Market

The market should begin as a moderated instrument-listing system.

Initial concepts:

- Submit an instrument form.
- Photos, price, condition, category, location, and contact preference.
- Admin approval before public display.
- Local pickup and shipping badges.
- Seller profiles.
- Search and filters for category, price, condition, and location.

## Build Order

Recommended first implementation passes:

1. Restore the hidden nav entries intentionally when each section is useful enough.
2. Add `/studio` and connect the existing stem deck code.
3. Add `/learn` with a simple "drop a song / choose demo / teach me" interface.
4. Add one working lesson flow for song analysis results, even if the analysis is
   initially mocked or powered by the existing plugin suite.
5. Add mic/MIDI capability checks and a basic rhythm or pitch feedback prototype.
6. Add `/market` as a moderated submission form before building full accounts.
7. Add radio/charts and profiles once the content model is clearer.

## Open Questions

- Should the first Learn prototype use static demo analyses, server-side native suite
  calls, or browser-only WebAudio/WebMIDI?
- Should Learn require accounts at launch, or start with anonymous local progress?
- Which instrument should be the first polished teaching path: piano, guitar, or drums?
- Should uploaded songs be processed locally in the browser, server-side, or through
  the plugin suite?
- Which audio can be legally used as built-in demo/teaching material?
