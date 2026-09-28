# Homepage Local Gallery

Expanded on 2026-09-28 from the user-requested Google listing, filtered to **By owner**. The visible contributor was [SATTARI Musical Instruments California, U.S.A.](https://maps.google.com/maps/contrib/103987062368900608516). No customer-uploaded photos were selected.

These are locally hosted snapshots, not a live Google feed. Listing changes do not automatically change the homepage. They show the owner's collection and history; the captions do not claim that every scene depicts today's Woodland Hills location. Keep the original attribution visible in any clips.

## Complete Owner Collection

The owner collection exposed 59 items: 46 photos and 13 videos. All were downloaded and checked. `owner-57.webp` is a completely blank, dark source image, so it is retained in the source manifest but excluded from the carousel. The homepage presents all **58 usable items: 45 photos and 13 videos**.

- `docs/local-gallery-sources.json` preserves the exact observed Google asset paths in listing order. Prefix each with `https://lh3.googleusercontent.com/gps-cs-s/` for its full provenance URL.
- `src/data/localGalleryMedia.json` records local paths, intrinsic dimensions and actual video durations.
- `src/data/localGalleryCaptions.js` contains descriptive captions in the same order. Historical promotions are labeled as archive material, not current offers. Archived images can contain historical addresses, phone numbers or event dates.
- `scripts/import-local-gallery.mjs` imports the verified source URLs, extracts full-size video posters at one second, creates 160x120 JPEG thumbnails and generates the metadata. Requires Node 22 and ffmpeg/ffprobe. It reuses existing downloaded source files.

Files use `owner-01` through `owner-59` names. Images and videos remain unmodified. Thumbnail padding preserves the entire image; the main display uses `object-fit: contain` in a fixed 4:3 frame. No cropping or stretching is applied.

Only the current media and temporarily outgoing media are mounted. Full video files are not preloaded, thumbnails are lazy-loaded, sound is opt-in, and playback stops offscreen or in a hidden tab. The incoming photo or video poster must load before the 650ms crossfade starts. Reduced-motion and data-saving visitors get manual playback; reduced motion disables transitions. Video end events advance the gallery, with a duration-aware timeout for stalled downloads.

## Original Five-Slide Files

These earlier files remain in `public/images/local-gallery/` for compatibility. Google supplied the photos as WebP and the videos as MP4. The expanded carousel uses the numbered collection above.

- `shop.webp`: [owner shop-display photo](https://lh3.googleusercontent.com/gps-cs-s/AHRPTWnpDFbLgE5Qna2ITzUgqPVCu7qarYt4g_I1vi2kM32nsPZd-HeErzDrILqhkzVFdD1I7W3VA_yWMCi5qjQVLKvrirLDSATUj_eb7EOyG8mFgrO99UjFq6J_dAx65wVGXI4k0JtssQ=s1360-w1360-h1020-rw)
- `instrument-care.webp`: [owner sitar-care photo](https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlfT-85xvQ9RGcwj39IT3X0UPiJgAXLK4dc84gpL93xmHrH9LZVtP1FgDNOX8soTxF4Q_rK6iAhgl0B8pxekZdTq-Zbr750MIe-zhN2DAqEqTlzhgADE6YVC4XmTxeOkHTdvpPMirirobYU=s1360-w1360-h1020-rw)
- `guitars.webp`: [owner guitar-display photo](https://lh3.googleusercontent.com/gps-cs-s/AHRPTWnm81HIc5VWUA9xzJn1C2eD_ETFkDWCyXTVtW782fZpF4vOGKm3NuOtVCkKmxschPFTqzTh3Oy_7CNRI0bUUW8d_RcC0W9aYp_ol9rHPX_o8GIQA_2OjHCb9InRtM4JmiKtp1O2YQ=s1360-w1360-h1020-rw)
- `drum-kit.mp4`, `drum-kit-poster.jpg`: [owner drum-kit clip](https://lh3.googleusercontent.com/gps-cs-s/AHRPTWk3DnSLM3CMKwY-GNESM62JaQ9lyY71mt7on5OJoHtnU8yQToP-rKtefbzfw_i4Q0SDwuaUI7NkHF-Upx0uAH2z0C8djJChVhGxf5rJeOnhpHLdHK2K6Fm7GaqCDITBozPqubsF=m18), about 16 seconds.
- `violin.mp4`, `violin-poster.jpg`: [owner violin clip](https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlS1918uZU4ZEcPdajEauq1LNyEoacPnrnUeuZKzY1kw_--A9cB4hSUTWAAD-IkrGzIwNO7N93Ke26bNSoGJ4CkVNRQidpQVyaPWqVvjMo-qFWWkLjaIRxhAt9uN1CJHBZHk3Q=m18), about 8 seconds.

The Google asset URLs above are provenance only and may expire. Runtime media references use local files, so visitors do not contact Google to play this gallery.
