# Home hero video composition

The hero preserves the instrument arrangement over the site's existing day/night
video loops. The original artwork remains unchanged.

## Assets

- Transparent artwork: `public/images/home/sattari-instruments-cutout.png`
- Day still: `public/images/home/video-day-poster.jpg`
- Night still: `public/images/home/video-night-poster.jpg`
- Original artwork: `public/images/home/sattari-instruments-hero.jpg`
- Existing video sources: `public/sattari site/bg.mp4` and
  `public/sattari site/INSTRA PATTERN.mp4`

The stills are frames extracted at one second from the existing videos. They
remain visible when reduced motion, data-saving preferences, or playback errors
prevent video. The PNG was created with the built-in image generation/editing
tool, not the CLI fallback. Its alpha channel was checked in a real browser.

## Final Edit Prompt

Use case: background-extraction. Edit the provided Sattari website hero artwork
into a genuinely transparent PNG with an alpha channel, same 1536x1024 canvas and
identical instrument placement. Remove the entire studio backdrop: the
white/off-white area, blue fabric/paper, pink paper, and all backdrop shadows.
Make all background areas completely transparent, including the large empty left
half and gaps between objects. Preserve the cymbals, flame electric guitar
including its WHITE pickguard and neck/strings, violin, bow, drumsticks, red
instrument cable, partial keyboard, their shapes, colors, printed SATTARI logos
and fine details. Do not remove white instrument surfaces, metallic highlights,
piano keys, or strings. Do not add any objects, text, shadow backdrop, substitute
background color, border, or checkerboard. Keep the collage composition and
framing unchanged. Purpose: overlay these existing instruments on a real moving
video background, with headline text over the empty transparent left half.

## Verification

`node scripts/qualify-home-hero.mjs` checks real playback, pixel detail,
transparent artwork, day/night switching, motion controls, reduced-motion
requests, offscreen suspension, and layouts at 320, 390, 768, 1440, and 1920px.
Set `HOME_QA_URL` to test another server and `HOME_QA_DIR` for screenshot output.
