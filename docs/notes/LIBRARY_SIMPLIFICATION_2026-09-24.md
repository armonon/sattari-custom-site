# Library simplification

The library now prioritizes finding, auditioning and preparing songs rather than presenting every management action at once.

- Preview, Queue and Load are the primary per-song actions, in that order. Their labels remain visible in compact-icon mode, as do the import actions.
- Per-song More contains playlist assignment/reordering, analysis, arrangement import and song details. Original downloads and recoverable Trash remain inside song details.
- Collection actions contains bulk queueing, playlist additions and missing BPM/key analysis.
- New playlist is a disclosure rather than a permanently visible form.
- The desktop sidebar is labeled Playlists instead of the ambiguous Collections. The all-music selection no longer looks active while browsing albums, artists or favorites.
- Up Next explicitly explains that Load next prepares a deck without starting playback.
- Below 1500px the queue moves below the song list so the main table has sufficient room. Existing phone collection controls and card-style rows are retained.
- Device-local storage, safe cue routing, playlist semantics and audio processing are unchanged. No deployment or native installation is included.

This follows the Sites design guidance for reducing competing controls on a working surface. Browser visual testing is still needed; DOM regression tests do not certify responsive geometry.

Validation: Vite production client build and targeted ESLint passed. The library and preview regression run passed all 19 tests with one worker (4.79 seconds overall). A prior run under heavy machine load timed out; the passing diagnostic rerun used a 30-second per-test allowance without changing committed test configuration. Actual individual test times on that rerun were below the normal 5-second limit.

Final confirmation with the normal, unmodified test timeout: all 19 tests passed (6.93 seconds overall).
