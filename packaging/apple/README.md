# STEMDECK Apple editions

> **Native direction supersedes these online wrappers (September 29).** These
> wrappers are retained as prototypes, not the requested offline/native product.
> The real iPhone/iPad engine port is in
> `/Users/lillypad/Projects/StemDeck/plugins/stemdeck/mobile`. Its configuration
> and initial contracts pass, but the full native build/device validation is
> blocked on build-volume space. Do not publish these wrappers as native parity.

This target shares the **deployed** `https://sattarimusic.com/studio` web engine.
It does not bundle the working tree, port JUCE/ONNX, host AU/VST, sync projects,
guarantee background audio, or grant hardware permissions silently. Loading needs
internet. The native app's local website data is separate from Safari's data.
Export projects before moving between installations. Hosted code updates with the
site, so a signed shell does not freeze or qualify the web engine version.

## Existing native Mac application (separate product build)

The release workbench is `/Users/lillypad/Projects/mac-release-suite`.
Its StemDeck source is **`/Users/lillypad/Projects/StemDeck`**, not the older
`StemDeck copy` folder recorded in the September 26 handoff. On September 28 the
workbench generated a distribution-passing universal 0.5.0 native app and DMG:

`artifacts/stemdeck/0.5.0-6KZC2L/Sattari StemDeck-0.5.0-macOS.dmg`

Both Apple submissions were accepted; see its adjacent `distribution-report.json`.
Product, clean-install, hardware and minimum-OS validation are separate. Do not
claim the native artifact contains the latest shared browser code. Do not replace
that application with this lighter **STEMDECK Web** edition: bundle IDs differ.

## Build the shared-web Mac edition

From this web repository, with Xcode installed:

```sh
STEMDECK_APP_OUTPUT=/absolute/fresh/output \
STEMDECK_SIGN_IDENTITY='Developer ID Application: YOUR NAME (TEAM)' \
node scripts/package-stemdeck-apple.mjs mac
```

Outputs a universal macOS 13+ `.app`, ZIP and SHA-256 report. Without the identity
it is ad-hoc signed for local development only. Existing packages are not
overwritten. Signatures are verified, but **notarization and runtime checks are
not implied**. Keep `package-report.json` with the ZIP. Do not add generated
builds, signing material or provisioning profiles to Git.

## iPhone and iPad

The Xcode project targets iOS/iPadOS 16+ and both device families. An unsigned
compile check does not produce a distributable IPA:

```sh
node scripts/package-stemdeck-apple.mjs ios-check
open packaging/apple/StemDeck.xcodeproj
```

Select the owner's team under Signing & Capabilities, verify bundle identifier
availability (`com.sattarimusic.stemdeck.mobile`), connect a registered device,
then build/run. The microphone purpose string and Files export support are
included. Complete device qualification before Archive → Distribute → TestFlight.
No Apple account changes, store listing, privacy declaration, review submission
or public release are performed by the build script. A web wrapper is not a
promise of App Store approval; minimum-functionality/review requirements apply.

Completed downloads go to Documents with a unique export folder and offer the
native share sheet. If sharing is cancelled, use Files → On My iPhone/iPad →
STEMDECK. macOS offers a save panel and keeps temporary exports on cancellation.
No audio recordings are automatically deleted.

## Installable web edition

`public/studio.webmanifest`, the route-scoped `StudioInstallMetadata` component,
and `/studio-install.html` provide the Home Screen/Dock installation path. The
guide is linked in Studio settings. No service worker intercepts session/network
traffic or caches authenticated data. This is deliberately an online install,
not an offline-ready PWA. Deploy web changes through the existing qualified
release workflow before announcing the new guide as live.

## Required checks before distribution

- On physical iPhone AND iPad: open, import Files audio/project, mic allow/deny,
  record, stop, share/save WAV/project, reopen exported data, orientation changes.
- Test foreground/background, screen lock and interruptions. Do not add a
  background-audio entitlement until the actual engine/session behavior passes.
- Verify MIDI and output routing support explicitly; WebKit is not Chromium.
- On Mac: file/folder imports, drag/drop, blob exports, save cancellation/failure,
  microphone permission, window/quit behavior, offline error and process recovery.
- Network loss and WebKit crashes must not silently reload an active session.
- Validate app icons, touch layouts, VoiceOver and real audio-session duration.
- Notarize the new Mac shell using the owner's existing secure credential flow;
  never place an Apple password/API key in source, commands or chat.

Apple references:
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
- https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases
- https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
