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
