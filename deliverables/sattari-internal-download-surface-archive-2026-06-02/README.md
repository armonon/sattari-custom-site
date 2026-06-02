# Sattari internal download-surface archive — 2026-06-02

This folder preserves metadata from the public `/downloads` surface before the local-only public-surface recovery branch removed that customer-facing route and static files.

Preserved here:

- `DownloadsPage.tsx` — former public download-page source copy for historical/internal reference.
- `*.sha256` files — checksum text files copied from the public downloads folder when present.
- `public-download-archive.ls.txt` — file-size inventory of the removed public downloads folder.
- `public-download-archive.sha256` — SHA-256 manifest for removed public download files.

The actual plugin/tester packages should stay in the internal Sattari packaging flow, not on the public customer-facing site until Armon explicitly approves a sale/beta/download surface.
