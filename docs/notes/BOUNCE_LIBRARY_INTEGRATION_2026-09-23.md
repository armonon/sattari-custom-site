# Bounce inside the StemDeck library

Source reviewed: `/Users/lillypad/Projects/Bounce` (JUCE desktop and Expo/mobile implementations). Bounce remains unchanged. This is a browser adaptation of its core library experience, not an embedded native app or a Git-history merge.

## Available

- Songs, Albums, Artists and Favorites browsing, with artist-aware album grouping and album/artist drill-downs.
- Responsive album cards; embedded JPEG/PNG ID3 artwork loads only for visible cards, with a neutral disc fallback. Artist cards use an icon fallback.
- MP3 ID3 v2.2/v2.3/v2.4 text metadata at import, with filename/folder fallback. Reads are capped at 2 MiB and do not decode a song. Unsupported compressed/unsynchronized frames fall back rather than rejecting audio.
- Favorites stored with track metadata; backup/restore preserves favorites, album artist, genre and track/disc/year values.
- Whole filtered collections/albums can be queued or added to an existing playlist in one organization transaction. Playlist additions deduplicate song references.
- Drag a playlist row onto another row to place it before that song when sorted by Playlist order; existing Move earlier/later actions remain keyboard-accessible.
- Preview previous/next, shuffle, repeat off/all/one and opt-in continuous preview. Native audio controls retain play/pause, volume and seeking. Preview order follows the current filtered song list.
- Existing BPM/key analysis/sorting, safe empty-deck loading, arrangement import, file/folder drops, recoverable Trash and library backup remain in place.

## Safety and boundaries

- Preview remains muted until the user explicitly chooses an output. Selecting a song does not start it. Continuous preview is off by default. Cue-route failure never silently falls back to system speakers.
- Up Next remains the manual performance/deck queue; preview sequencing does not dequeue or load decks. Preview is not part of the recorded master bus.
- No new dependencies, native modules, external artwork lookup or audio upload.
- No automatic migration of Bounce's native library/playlist JSON or disk paths. Import folders through StemDeck; browser storage is independent of the desktop app.
- Native filesystem background scanning, AirPlay/OS media keys, desktop gain boost, native waveform APIs and gapless/crossfade playback are not ported. Non-ID3 formats can play where supported by the browser, but this pass does not parse their embedded metadata/artwork.
- A/B master controls, arrange and live DSP are unchanged by this library integration.

## Verification

- Full suite: 475 tests passed across 76 files with two workers. After adding playlist drag-reordering coverage and UTF-16/favorite-backup assertions, all 22 targeted tests passed. Final lint/build and TypeScript checks passed.
- Browser verification on an isolated QA origin: generated three-song collection imported into persistent storage; two albums/artists and a favorite; album drill-down; queue collection; preview next/previous remains muted/paused without an output selection.
- Desktop, 390 px and 320 px layouts checked; cards and page have no horizontal overflow. Reload confirmed that songs, favorite status, playlist and queue persisted; preview returned to its safe muted initial state. The user's active origin was untouched.
- Repeatable fixture page: `scripts/bounce-library-qa.html`. Generated audio only; no microphone required.
- Local source/build only. No deployment, commit or native installation.
