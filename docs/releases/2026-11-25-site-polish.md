# Site polish and tuner release (2026-11-25 UTC)

Two production publishes, both manifest-preserving overlays that reuse the 24
live functions unchanged.

| Step | Deploy | Published (UTC) | Rollback to |
| --- | --- | --- | --- |
| Tuner, scales and restringing (`fd6003f`) | `6b06292cdce90781756da283` | 2026-11-25 01:20 | `6b0603f4d906fdc28eea200a` |
| Polish (`64c919d`) | `6b063b9064a2e9020fd6161f` | 2026-11-25 01:38 | `6b06292cdce90781756da283` |

## Polish changes

- 14 page titles shortened to 65 characters or fewer. A title ending in
  ` | Sattari` is used as written; every other title still gets ` | Sattari Music`.
- About page: when the Instagram feed is unavailable the section shows only the
  profile link, not an error box.
- Home hero on phones: the "Independent spirit" badge sits below the contact
  links instead of over them.
- Tuner: "Stop reference sound" and "Stop scale" appear only while sound plays.
- Tests left stale by the tuner and SEO releases updated (Hub lab name, Key & BPM
  lab heading and `StructuredData` mock, booking-form honeypot now rendered only
  while booking is open).

## Verification

- Draft and production: 96 sitemap pages return 200; no title over 65 characters
  in the build; inventory, shop, cart and tool pages respond.
- Browser (draft): no overlap between the hero badge and links at 375 px; About
  shows no placeholder; Stop buttons 0 before, 1 during, 0 after playback.
- Tuner (tuner draft): a simulated 108.6 Hz microphone note read as A2, −22 cents.
- Vitest: every file passes; Studio page timeouts in the full parallel run pass
  when rerun alone. ESLint, `tsc` and the guarded build pass.

## Open

- `INSTAGRAM_ACCESS_TOKEN` expired on 2026-08-18 (Instagram error 190). The feed
  stays empty until a new long-lived token is saved in Netlify.
- Not verified: real instruments through a real microphone, physical phones,
  Safari and Firefox.
