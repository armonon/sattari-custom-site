# Windowed sources and editable performance — September 24, 2026

## Delivered in this pass

- Arrangement streaming and section export demux/decode compressed source windows rather than silently decoding a complete MP3/AAC file. Mediabunny is loaded lazily; unsupported browser codecs fail explicitly. PCM WAV keeps its existing range reader.
- Simultaneous clips using distant positions of one source retain separate PCM windows. Overlapping intervals share a window. Cancellation disposes the compressed decoder; allocation is checked against the existing PCM budget before creating the output buffer.
- LAME/Lavc/Lavf MP3 gapless delay/padding is accounted for so source offsets match native browser decoding. The header reader skips ID3 artwork and reads at most 4,106 bytes. Unknown gapless metadata variants are not qualified by these fixtures.
- Parameter captures retain their scheduled audio time, sample rate and frame indices. Supported ramps share a sample-rounded clock during capture; replay no longer substitutes a different machine's look-ahead for these events. Retiming edits update the associated scheduled/frame metadata. Failed synchronous mutations are not journaled.
- Source reconstruction now creates editable regions for loop passes, new lanes, source replacements and lane removal, and incorporates master-stem mute/solo/gain into reconstructed volume automation.
- Performance events can be filtered by action type and edited with numeric/boolean controls, with raw arguments retained as an advanced option. Original event history and printed safety audio remain intact.
- Corrected confirmed transport replay offsets at non-unit playback rates.

## Audio evidence

Final frozen-source gate: **PASS**, 2026-09-25 03:40:53 UTC (September 24 local). 103 unit files / 659 tests; nine browser audio suites; built-artifact UI workflows at 1440 px and 390 px; lint, types, generated meter/tempo qualification, build and prerender all passed. Lint retains one pre-existing hook-cleanup warning. The 60-second synthetic recording/recovery soak passed; physical hardware was not measured. Source fingerprint: `12edf140057b514657ec8cf9f92a0db9083c8c47c51713d693986e0b62454c1f`.

Machine-local gate evidence: `/tmp/stemdeck-window-timing-verified/report.json` and its `browser/` reports. `softwarePassed` is true and `releaseApproved` remains false. This pass is uncommitted and was not deployed or installed into the native application. Earlier runs either hit loaded-machine UI timeouts or were superseded by final source fixes; only the frozen-source gate is the final result.

`scripts/compressed-window-qa.html` compares a one-second window at 17 seconds against BOTH a whole decode and the browser's native `decodeAudioData`. MP3 and AAC fixtures have zero maximum sample difference in isolated Chromium at 48 kHz. Two simultaneous arrangement clips at different offsets render with maximum error approximately `1.49e-8` against their summed reference. PCM retention is 48,001 mono samples, not the whole song.

A separate two-hour AAC/M4A source (88,342,560 encoded bytes) was read at 7,190–7,191 seconds: 1,966,112 encoded bytes were read by the demuxer, and the returned PCM used 192,004 bytes. That is a late-source window test, **not** a two-hour real-time playback or hardware recording qualification. Header probes, encoded cache, decoder internals and graph overhead are additional to reported retained PCM. Timing depends on machine load.

Fixtures are original generated signals, not commercial recordings:

```sh
ffmpeg -f lavfi -i 'aevalsrc=(0.15+0.05*t/30)*sin(2*PI*(220*t+3*t*t)):s=48000:d=30' -c:a libmp3lame -b:a 96k scripts/fixtures/window-source.mp3
ffmpeg -f lavfi -i 'aevalsrc=(0.15+0.05*t/30)*sin(2*PI*(220*t+3*t*t)):s=48000:d=30' -c:a aac -b:a 96k -movflags +faststart scripts/fixtures/window-source.m4a
```

Dependency/source notice is shipped as `public/audio-codec-credits.txt`.

Implementation references: [Mediabunny media sinks](https://mediabunny.dev/guide/media-sinks) and [FFmpeg MP3 gapless handling](https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/mp3dec.c). The library's packet timeline and native gapless playback timeline are deliberately treated as different until the MP3 padding adjustment is applied.

## Explicit remaining boundaries

This is **not a 10/10 or sample-deterministic-every-mutation certification**.

1. The live granular `PerformancePlayer` still uses its bounded whole-source cache. Arrangement range decoding does not turn that player into a streaming granular engine. Large sampler sources also retain whole-source requirements.
2. Pitch, source, loop, key-lock and some graph/topology mutations still use real-time JavaScript dispatch. Recording frame metadata does not make those mutations sample-deterministic. Native DSP state, opening grain phase, effect tails and rebuilt noise voices are not universally reconstructable from historical captures.
3. Source reconstruction covers transport, source regions, loops and supported volume automation. Every FX, pad and input event is not yet mapped to an ordinary arrangement device/automation lane. Unsupported reconstruction is reported; editable event history is not equivalent to complete arrangement reconstruction.
   The existing arrangement model has a 1 ms minimum clip duration. Smaller loop/transport fragments are explicitly reported and omitted rather than generating an invalid project; the safety print retains them.
4. MP3/AAC fixtures do not qualify every codec, container, sample rate, browser, variable-bitrate seek table or MP3 gapless-tag variant. No whole-file fallback is used to conceal unsupported range decoding.
5. Real interface sessions, process crash recovery during long recordings, deployment, and native desktop packaging were not performed in this pass.

The next architectural gate is one source/DSP scheduler for live capture and offline replay, with explicit sample-frame mutation commands, deterministic voice state, and range-backed granular sources. Qualify each mutation family against printed references before promoting capability labels. Preserve the safety print throughout.
