# Instagram feed on the About page

`/.netlify/functions/instagram-feed` returns the nine most recent posts of
@sattari.music. When it cannot, the About page shows only the profile link.

A saved setting takes effect on the next deploy: after changing either value in
Netlify, redeploy with `scripts/overlay_deploy.py` (a function-reusing draft
picks up the production values), then publish.

## Option A: Instagram Login token, renewed automatically (default)

Settings: `INSTAGRAM_ACCESS_TOKEN` only.

- The token is a long-lived Instagram token (60 days).
- `instagram-token-refresh` runs Mondays and Thursdays at 10:00 UTC on the
  published deploy, asks Instagram for a fresh 60-day token
  (`graph.instagram.com/refresh_access_token`) and stores it in the
  `instagram-token` blob store. The feed uses the stored token.
- Saving a different token in Netlify always wins: the stored token is ignored
  unless it descends from the configured one.
- Instagram refuses to renew a token younger than 24 hours or one that has
  expired. The first is harmless (the next run succeeds); the second needs a new
  token. Each run logs one `instagram-token-refresh` line with the outcome and
  the new expiry, never the token.

Getting a token: developers.facebook.com → the app → Instagram → API setup with
Instagram login → Generate token for @sattari.music.

## Option B: business account with a token that does not expire

Settings: `INSTAGRAM_ACCESS_TOKEN` (a Meta system-user token) and
`INSTAGRAM_BUSINESS_ACCOUNT_ID` (the Instagram account's numeric id).

With the id set, the feed reads `graph.facebook.com/<id>/media` and the renewal
job does nothing.

Setup in Meta Business settings (business.facebook.com/settings):

1. @sattari.music must be a professional account linked to a Facebook Page, and
   the Page, the Instagram account and the app must be in the same business
   portfolio.
2. Users → System users → Add an admin system user.
3. Assign assets to it: the Page, the Instagram account and the app.
4. Generate token → choose the app → expiry **Never** → permissions
   `instagram_basic`, `pages_show_list`, `pages_read_engagement`,
   `business_management`.
5. Copy the Instagram account id from Accounts → Instagram accounts.

Not confirmed: Meta's reference lists a *user* token for reading media and does
not say whether a system-user token qualifies. If it is refused, the feed logs
`instagram-feed-failed` with `mode: business` and the page shows the profile
link; remove `INSTAGRAM_BUSINESS_ACCOUNT_ID` to return to option A.
