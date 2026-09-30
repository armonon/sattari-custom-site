# Apple edition validation — September 29, 2026

## Passed

- New shared-web Mac shell: optimized arm64 and x86_64 compilation with Xcode
  26.2, universal binary creation, Developer ID hardened-runtime signing, strict
  signature verification and ZIP packaging.
- New iPhone/iPad target: Release build with the iPhoneOS 26.2 SDK, unsigned.
  Deployment target iOS 16, device families 1 and 2. This is NOT an installable IPA.
- Five install/packaging contract tests, including route metadata cleanup,
  manifest/icon dimensions, mobile device family, microphone purpose declarations,
  HTTPS/microphone-prompt contracts and honest availability text. A first test
  run exposed whitespace-sensitive matching after HTML formatting; normalization
  corrected the assertion without changing the required user-facing disclosure.
- Mac UI smoke check: launch from built app, deployed `/studio` loads, native
  file picker opens/cancels, empty-project blob download reaches NSSavePanel,
  save completes and returns to the workspace. No private song or microphone
  was accessed. `apple-shell-smoke.sattari` is local test evidence; its SATPROJ6
  header, declared payload length and v6 JSON metadata parse correctly (10,186
  bytes). It is the custom project archive format, not a ZIP file.
- Targeted ESLint, plist/Xcode-project syntax checks and `git diff --check` pass.
- Existing **native** StemDeck 0.5.0 Mac DMG: SHA-256 matches its accepted
  distribution report; `xcrun stapler validate` passes. Its checksum is
  `508e773635df8db4b4a6495c22713e86f308014c393c4b915353fe83597fc221`.

## Locations

New local package, report, mobile build and smoke export:
`/Users/lillypad/Downloads/sattari-custom-site/site/.local-data/apple-build/`

Existing native standalone installer:
`/Users/lillypad/Projects/mac-release-suite/artifacts/stemdeck/0.5.0-6KZC2L/Sattari StemDeck-0.5.0-macOS.dmg`

## Not signed off

The new Mac web shell is signed but **not notarized**. The iOS build is unsigned,
not uploaded, and not tested on physical iPhone/iPad. Audio quality, sustained
recording, microphone permission/reconnect, Safari/WebKit MIDI/output support,
all Files workflows, memory pressure and minimum-OS behavior remain unqualified.
An empty-project export and an open file picker do not establish audio import,
hardware recording or full arrangement fidelity. No full web release gate ran.

The online install guide and metadata changes have not been deployed. No public
download link, App Store listing, TestFlight invite or automatic cross-device
sync was created. No existing installed native app was replaced. Other agents'
working-tree edits were preserved. The native 0.5.0 installer is an existing
artifact, not a rebuild incorporating these web changes.

Host was heavily loaded (observed load average >150), with about 4 GiB free near
the end. No projects/recordings were removed and no unrelated processes stopped.
Native artifact distribution status does not substitute for product qualification.
