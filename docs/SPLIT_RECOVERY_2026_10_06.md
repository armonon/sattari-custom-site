# Split audio lifecycle recovery

Fresh production runs completed the demo in approximately 30 seconds and
produced four finite, nonblank, 8-second stereo float WAVs at 44.1 kHz. The
previous indefinite "Reading audio" observation was not consistently
reproduced, but that path had no deadline and Stop could not settle a pending
decode.

Audio reading now has a 60-second deadline and immediate cancellation. Late
results are ignored. Worker startup has its own progress message and a
45-second deadline before any response; ongoing model work retains the
existing five-minute idle deadline.

Verification: 29 focused tests, production build and scoped ESLint; real
demo separation and imported-WAV CPU separation; validation of all four WAV
downloads and playback controls; an injected decoder that never resolves,
followed by Stop and a successful real retry on a hosted draft.

The live Sattari deployment has download pages and navigation changes not
present on the feature branch. The release updates only the two changed
audio modules and generated asset references, preserving those live changes
and all server functions. Do not publish this branch wholesale.
