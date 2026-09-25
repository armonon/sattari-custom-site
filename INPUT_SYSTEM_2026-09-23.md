# Input system — implementation and qualification

## Shipped in local source/builds

Browser Perform and Arrange now share an Input strip: device selector, exposed mono channel or auto/stereo, gain, peak/held clip indication, separate record arm and monitor, low-latency input-FX bypass, high-pass and compressor, explicit disconnect/reconnect, and error/interruption status. Connecting never enables monitoring. Exact device constraints and actual track settings prevent silent device substitution. Pending permission/unlock completions are cancelled safely.

The browser still supports **one live input device/strip at a time**, with selection among that device's exposed channels. This is not a simultaneous multi-device input mixer. Browser input settings are session-runtime controls; no device opens automatically when a project is restored.

Recording reserves stable input buses before a device is connected. A dry, post-gain armed lane remains editable; a separate performed-monitor lane preserves what actually reached the master (including monitor-off silence and input FX). Reconnecting does not replace these recording buses. Completely silent input chunks are omitted from storage without collapsing timeline gaps; deliberately empty replay input metadata survives recovery. Input FX are printed in the performed lane, not reconstructed from editable input-FX automation.

Desktop input strips now expose record arm, low-latency mode, held clip status and unavailable-input status. The source menu lists all enabled input channels and opens expanded audio-device settings (up to 32 inputs). The engine accepts multichannel input instead of only mono/stereo, and unavailable channel selections produce silence rather than substituting another channel. Arm and monitor actions explicitly release JUCE's separate standalone input-mute gate. New inputs and reopened projects do not auto-monitor. Input gain, channel, arm, low-latency and tone settings survive project reopen.

Desktop low-latency mode skips input EQ/filter, input inserts and channel delay compensation. Browser low-latency mode bypasses input high-pass/compressor. **Neither bypasses master processing or physical interface latency.** These are not hardware direct-monitor switches. Desktop disarm writes silence to the individual channel recording while preserving timeline length; the existing raw global mic safety reference remains separately captured during a take.

## Validation

- 72 browser tests passed together across 11 files; the subsequently added unlock-cancellation regression passed in the now-10-test input suite (73 distinct tests covered).
- Fresh native `StemDeckChannelIdentity` and `StemDeckRtSafety` passed. New checks cover real eight-input processor routing to stereo, input 8 selection, missing-channel silence, safe reconnect, input-state persistence and bypass of a 512-sample channel compensation delay.
- Offline real Web Audio rendering passed 11 checks: late connection, independent recording/monitoring, disconnect silence, stable recording bus, reconnect capture, monitor-off after reconnect, low-latency audio, disarm silence, continuing monitoring while disarmed, and synthetic latency detection.
- Real-time browser source recording through the production engine/AudioWorklet/IndexedDB survived connect → disconnect → reconnect → stop → recovery. Dry peak: 0.20000000298; monitor-off peak: **exactly 0**. This caught and fixed an initial gain-ramp leak missed by mocked tests.
- Browser type-check and production build passed. Targeted lint passed with existing-file formatting checks disabled; new strip/controller files were formatted.
- Desktop standalone rebuilt; self-contained bundle/model/helper/ad-hoc signature validation passed.
- Production UI inspected at 1440px and 390px widths; input strip has no horizontal overflow. Native focused input rendered and inspected at 1280×800.

## Hardware qualification still required

No physical round-trip result is claimed. The 10 ms result in the synthetic test is an intentionally injected delay, not the Mac's latency. System Profiler lists the built-in microphone/speakers and virtual/unknown-transport devices; no USB audio interface was listed. No physical microphone was opened and no test signal was played through speakers during these automated checks.

`scripts/input-loopback-qa.html` provides an opt-in three-trial PCM-correlation probe. Serve the site with Vite and open `/scripts/input-loopback-qa.html`. Connect interface output 1 to a selected line input, disconnect speakers, disable hardware direct monitoring/phantom power, select the devices/channel, and confirm the test. Weak or unstable correlation fails rather than inventing a latency figure. This measures the browser/device loopback baseline; repeat in the actual performance setup to qualify additional app/plugin latency.

Long USB-interface sessions, unplug/replug of real hardware, changing sample rates/buffer sizes during capture, Bluetooth latency, and third-party plugin monitoring load remain unqualified. The existing opt-in `scripts/hardware-session-qa.html` now arms the input explicitly and leaves monitoring off.

## Delivery

Local source and builds only. No commit, push, deployment, or installation into `/Applications` was performed. Unrelated existing changes were preserved; temporary QA servers were stopped.
