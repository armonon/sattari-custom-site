# Sattari Learn: private beta test kit

Status: software and synthetic reference checks are separate from the human validation below. No physical-player results or teacher approval are implied by this document. The app remains a preview.

## Local software verification — September 29, 2026

- 371 tests passed across 34 Learn and app test files. Checks include corrupt backup rejection, preserving existing restore entries, imported-note correction, and keeping manual exploration separate from microphone milestones.
- The 12 new reference WAVs were checked against their lesson durations and detected MIDI pitches. This verifies generated reference audio, not recognition of a person playing guitar.
- Changed Learn files passed lint; project type-check, production build/prerender and SEO checks for all 75 public pages passed.
- A downloaded backup restored an imported lesson and seven settings into a separate local test origin. A media fixture restored original/prepared audio and a playable saved take. The original development site's stored library was retained.
- Browser checks exercised original/draft phrase playback, correcting an E4 estimate to F4 with the tablature updating to fret 1, and saving a local learner check-in. No microphone permission was granted or real playing scored during these checks.
- Course and backup layouts were inspected at 390 px and 320 px; the review controls were inspected at 390 px. The checked pages had no horizontal document overflow or recorded browser runtime errors. These viewport checks do not substitute for physical iPhone/Android testing.

## First session, approximately 15 minutes

Use an anonymous participant code. Ask permission before recording a person or their playing; a recording is optional. Do not collect names, contact details or raw audio in the results sheet. Begin with the participant's existing guitar and device.

1. Open Learn. Ask the participant to find the beginner path and start One clear note without navigation help. Record whether help was required.
2. Read the brief, listen to the reference, enter practice, connect the microphone and complete calibration. Record setup time and any permission/device problem.
3. Ask the participant to play 20 clear high E notes, then 10 deliberately wrong notes and 10 silent target windows. A teacher independently labels what was played. Count detected correct notes, rejected correct notes, wrong-note passes and silent passes separately.
4. Try Find the first fret. Observe posture and comfort; the app cannot assess these. Ask the participant to describe what the feedback means.
5. Repeat the same phrase at the same tempo and guitar setup. Record the first and last attempt separately; improvement in a score is not proof of improvement in playing.
6. Save a personal check-in under the phrase review. Download the practice report. The participant chooses whether to share it.
7. Download a Learn backup, restore it in an empty browser profile or separate test origin, and reopen the imported lesson and progress. Repeat the restore to verify no duplicate entries.
8. Ask whether they would return tomorrow and why. Arrange follow-up outside the app only with their permission.

Use First light as the course endpoint after earlier lessons are comfortable. Never rush a first-time guitarist through all 12 lessons in one test session.

## Guitar/input matrix

Use at least one acoustic guitar with a built-in microphone, one clean electric guitar through an interface, and an electric guitar heard through a room microphone. Cover quiet and moderately noisy rooms, soft and loud picking, low E and high E, repeated notes and string changes. Exercise standard tuning, Drop D, capo 2 and left-handed diagrams. Have the musician confirm the displayed fingering is playable.

Check the devices and browsers participants actually use, including desktop Chromium, desktop Safari, iPhone Safari and Android Chrome when available. Record exact versions in the report rather than assuming behavior from a brand name. Use wired headphones for the timing baseline; report Bluetooth separately. Never adjust timing tolerance merely to make a test pass.

## Proposed beta gates — targets, not observed results

- All 10 silent windows earn zero matches. Investigate every false pass on a deliberately wrong note before expanding the beta.
- At least 18 of 20 independently confirmed clean notes are recognized in each supported setup. Report failures by device/input; do not pool good and bad configurations into a misleading average.
- At least 4 of 5 first-time participants complete the first phrase without navigation help after the introductory brief. Log musical coaching separately from navigation assistance.
- No crash, lost imported recording, microphone left running after exit, or backup that claims success while losing data.
- A teacher checks every course melody, tab, timing, chord diagram and playing instruction before calling the course teacher-reviewed.

These are small-beta entry gates, not statistical product accuracy claims. Broader held-out testing is needed before advertising general transcription or performance-scoring accuracy.

## Teacher review and filming brief

Review all 12 beginner lessons in order. Correct uncomfortable positions or misleading instructions. Confirm the distinction between melody targets and suggested chord accompaniment. Sign off in the results sheet only after playing the lesson from the displayed guide.

For each lesson, film one slow demonstration with the fretting and picking hands visible, followed by the musical phrase at the authored tempo. Show a common mistake and its correction without claiming the microphone sees physical technique. For First light, film the opening, each transition, and a complete performance. Keep the audio clean and align the clip start in the existing teacher-video control. Obtain permission to distribute the footage before adding any video to the public catalog.

## Publication readiness

Complete teacher review and the physical input matrix; verify on the intended HTTPS host that microphone permission, audio-model downloads, mobile playback and backup restoration work. Provide an actual invite-only host or access control before describing the beta as private. Do not claim a hidden link alone is private. Keep a rollback build and retain original lesson/media backups.

The current work does not create accounts, cloud storage, invitation access control, commercial-song licensing, or filmed teacher material. Those need agreed infrastructure, rights and/or people. No automated outreach is configured.
