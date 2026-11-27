Key & BPM upgrade, key and tempo reference pages, tuning and song-key guides

Published https://sattarimusic.com

Deployment: 6b090588fbcfd9bcd01d0d2f
Rollback deployment: 6b08faed8ec83c698cc15f0b
Source: branch claude/affectionate-keller-m67jwo at b8487aa (feat/shop-natural-light 6668f19 merged with main fd9ba62, which carries PR54).

What changed: Key & BPM results gain a live tempo dial, a metronome click, the notes and chords of the key, Camelot neighbours and a copy button. 24 key pages under /keys and 181 tempo pages under /bpm (40 to 220), each computed from the tool's theory code. Two guides: how to tune an instrument, and how to find the key of a song. The hub lists Studio, Key & BPM and Stem Separator, with a text link to Sattari Learn.

Merge decisions, production first: navigation keeps "Guides & Learn"; Key & BPM keeps the live tuner at the top; keyDisplay keeps the musician's spelling while reference pages and chord lists use the fewest-accidentals spelling; the tuning guide opens the live instrument tuner.

Verification: full unit suite passed (294 files), lint and types pass, guarded production build with the live catalog (332 canonical routes), SEO check passed. Before drafting, 512 built files matched the live deploy byte for byte and the shop page script matched live after normalising chunk names.

Manifest-preserving overlay with backend reuse: 3319 files in the deploy, 441 uploaded, no function uploads. All 25 function digests and settings, 4 schedules and the edge bundle match the previous deploy. Draft checked in a browser (hub, Key & BPM, a key page, a tempo page, home, a guide, the guitar tuner) with no page errors, then published. Live checks after publishing: 14 routes return 200, the sitemap lists 205 key and tempo URLs, inventory responds.

Not verified: the metronome click and scale playback by ear on a device; the shop showroom in a real browser after this publish (its script and assets are unchanged from the previous deploy).

Follow-up for other work in progress: branches that publish from the production line need this branch merged first, or their next overlay will replace these pages' HTML with builds that lack the new routes.

Follow-up published: 6b09092a92a72dbc1dbe90aa, rollback 6b090588fbcfd9bcd01d0d2f. Source: this branch at the commit "Show the hub tile's meter in Key & BPM". Key & BPM now shows the same meter as its hub tile artwork, idle before a song and live for the selected track. 435 files uploaded, no function uploads; 25 function digests and settings, 4 schedules and the edge bundle match the previous deploy. Live checks: 8 routes return 200, inventory responds, the meter renders on /studio/keybpm with no page errors.

overlay_deploy.py now refuses a draft whose sitemap lacks any page that is live, so a build from a branch without another line's pages cannot replace them.

Follow-up published: 6b091bc6d934d2996375271f, rollback 6b09092a92a72dbc1dbe90aa. Key & BPM uses the ink palette of its hub tile in day and night mode, with the meter under the title as the page hero showing the selected track. 436 files uploaded, no function uploads; 25 function digests and settings and 4 schedules match the previous deploy. Live checks: 7 routes return 200, inventory responds, /studio/keybpm renders the meter on the ink background with no page errors.

Follow-up published: 6b091cbce8c37d9ee13b3d26, rollback 6b091bc6d934d2996375271f. The instrument tuner pages (/tuner/*) use the same ink palette in day and night mode. 435 files uploaded, no function uploads; 25 function digests and settings and 4 schedules match the previous deploy. Live checks: 7 routes return 200, inventory responds, /tuner/guitar and /tuner/violin render on the ink background with no page errors.

Follow-up published: 6b09240d579088e5f41d0e1e, rollback 6b091cbce8c37d9ee13b3d26. The live tuner reads on the circular meter (needle = cents). A fine tempo pass gives exact BPM where the tracker's 20 ms frames could not (128 read as 130, 174 as 176) and records where the beats fall; the metronome click follows those beats while the song plays. Split, Vox, Lyric and Clean share the ink palette. Key pages link to the scale player and the guitar tuner. Full unit suite passed (294 files, 2852 tests), SEO check passed on 332 pages. 440 files uploaded, no function uploads; 25 function digests and settings and 4 schedules match the previous deploy. Live checks: 8 routes return 200, inventory responds, the tuner meter renders on /tuner/guitar, the example track on /studio/keybpm measures 120 BPM, 8B, C major and reports a beat-following click, /studio/vox renders on the ink background; no page errors.

Benchmark re-run (docs/qualification/key-bpm-benchmark-2026-11-27.md): key accuracy unchanged (synthetic 95.8% exact, lessons 35.3%); lesson and synthetic tempos that were one BPM off are now exact. The key engine was not changed: the lesson set is 17 short exercises, too small and unusual to tune against without overfitting. Not verified by ear: the click against a song, and the tuner needle with a real microphone.

Follow-up published: 6b092c9d10dec539e37e6b86, rollback 6b09240d579088e5f41d0e1e. The live tuner dial is the hero of the tuner section (dial and microphone first, string notes below, then reference tone and settings); the song meter sits in the song key section again. 436 files uploaded, no function uploads; 25 function digests and settings and 4 schedules match the previous deploy. Live checks: 6 routes return 200, inventory responds, the dial renders above the notes on /studio/keybpm with no page errors.

Follow-up published: 6b092fc2284a2f0af8a26810, rollback 6b092c9d10dec539e37e6b86. Key & BPM: the section chips sit below the live tuner. 435 files uploaded, no function uploads; backend matched the previous deploy. Live checks: 4 routes return 200, inventory responds.
