// Press builds one self-contained HTML file from plain form data. Everything
// the artist types is escaped; links must be http(s), mailto or tel; players are
// embedded only for known hosts from IDs parsed out of the URL; the page carries
// no script and a CSP that forbids scripts, so the file is safe to host anywhere.

export const PRESS_VERSION = 1;
export const DRAFT_KEY = 'sattari-press-draft-v1';

const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[\w-]+$/;
const PHOTO = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export const FRAME_HOSTS = [
  'https://www.youtube-nocookie.com',
  'https://open.spotify.com',
  'https://w.soundcloud.com',
  'https://embed.music.apple.com',
  'https://player.vimeo.com',
];

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** An http(s) URL as a normalized string, or '' for anything else. Adds https:// to bare domains. */
export function safeUrl(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (!url.hostname.includes('.')) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function mailto(value) {
  const email = String(value ?? '').trim();
  return EMAIL.test(email) ? `mailto:${email}` : '';
}

export function telLink(value) {
  const digits = String(value ?? '').replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 7 ? `tel:${digits}` : '';
}

/** Player embed for a track URL on a known host, or null (shown as a link). */
export function embedFor(value) {
  const href = safeUrl(value);
  if (!href) return null;
  const url = new URL(href);
  const host = url.hostname.replace(/^www\.|^m\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtu.be') {
    let id = '';
    if (host === 'youtu.be') id = parts[0];
    else if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1];
    if (id && ID.test(id))
      return {
        provider: 'YouTube',
        src: `https://www.youtube-nocookie.com/embed/${id}`,
        ratio: '16 / 9',
      };
    return null;
  }
  if (host === 'open.spotify.com') {
    const index = parts[0]?.startsWith('intl-') ? 1 : 0;
    const [type, id] = [parts[index], parts[index + 1]];
    if (
      ['track', 'album', 'playlist', 'artist', 'episode', 'show'].includes(type) &&
      ID.test(id || '')
    )
      return {
        provider: 'Spotify',
        src: `https://open.spotify.com/embed/${type}/${id}`,
        height: type === 'track' || type === 'episode' ? 152 : 352,
      };
    return null;
  }
  if (host === 'soundcloud.com' && parts.length >= 2) {
    const clean = `https://soundcloud.com/${parts.map(encodeURIComponent).join('/')}`;
    return {
      provider: 'SoundCloud',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(clean)}&visual=false&show_comments=false`,
      height: parts[1] === 'sets' ? 300 : 166,
    };
  }
  if (host === 'music.apple.com' && parts.length >= 3) {
    if (!parts.every((part) => /^[\w.%-]+$/.test(part))) return null;
    const song = url.searchParams.get('i');
    const query = song && ID.test(song) ? `?i=${song}` : '';
    return {
      provider: 'Apple Music',
      src: `https://embed.music.apple.com/${parts.join('/')}${query}`,
      height: query || parts[1] === 'song' ? 175 : 450,
    };
  }
  if (host === 'vimeo.com' && /^\d+$/.test(parts[0] || '')) {
    return {
      provider: 'Vimeo',
      src: `https://player.vimeo.com/video/${parts[0]}`,
      ratio: '16 / 9',
    };
  }
  return null;
}

export function exampleDraft() {
  return {
    version: PRESS_VERSION,
    name: 'Artist Name',
    tagline: 'Alt-R&B · Producer · Los Angeles',
    location: 'Los Angeles, CA',
    bio: 'Write two or three short paragraphs: who you are, what your music sounds like, and what is new.\n\nMention a recent release, a show, or a collaboration. Keep it in the third person for press.',
    photo: '',
    accent: '#d6b36d',
    theme: 'dark',
    layout: 'epk',
    links: [
      { label: 'Instagram', url: '' },
      { label: 'Spotify', url: '' },
    ],
    tracks: [{ title: '', url: '' }],
    quotes: [
      { text: 'Add a line from a review, blog or playlist curator.', source: 'Publication' },
    ],
    contact: { booking: '', management: '', press: '', phone: '' },
  };
}

const text = (value, max) => String(value ?? '').slice(0, max);
const list = (value, max, shape) => (Array.isArray(value) ? value.slice(0, max).map(shape) : []);

/** Coerces untrusted data (storage, imported JSON) into a valid draft. */
export function normalizeDraft(raw) {
  const base = exampleDraft();
  if (!raw || typeof raw !== 'object') return base;
  return {
    version: PRESS_VERSION,
    name: text(raw.name, 80),
    tagline: text(raw.tagline, 120),
    location: text(raw.location, 80),
    bio: text(raw.bio, 5000),
    photo: PHOTO.test(String(raw.photo || '')) ? raw.photo : '',
    accent: HEX.test(String(raw.accent || '')) ? raw.accent : base.accent,
    theme: raw.theme === 'light' ? 'light' : 'dark',
    layout: raw.layout === 'bio' ? 'bio' : 'epk',
    links: list(raw.links, 16, (item) => ({
      label: text(item?.label, 40),
      url: text(item?.url, 500),
    })),
    tracks: list(raw.tracks, 8, (item) => ({
      title: text(item?.title, 80),
      url: text(item?.url, 500),
    })),
    quotes: list(raw.quotes, 8, (item) => ({
      text: text(item?.text, 400),
      source: text(item?.source, 80),
    })),
    contact: {
      booking: text(raw.contact?.booking, 120),
      management: text(raw.contact?.management, 120),
      press: text(raw.contact?.press, 120),
      phone: text(raw.contact?.phone, 40),
    },
  };
}

function paragraphs(value) {
  return String(value || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function trackHtml(track) {
  const href = safeUrl(track.url);
  if (!href) return '';
  const title = escapeHtml(track.title || '');
  const embed = embedFor(href);
  const link = `<a class="track-link" href="${escapeHtml(href)}" rel="noopener" target="_blank">${title || escapeHtml(new URL(href).hostname)}</a>`;
  if (!embed) return `<div class="track">${link}</div>`;
  const size = embed.ratio
    ? `style="aspect-ratio: ${embed.ratio}; width: 100%; height: auto"`
    : `height="${embed.height}"`;
  return `<div class="track">
  ${title ? `<h3>${title}</h3>` : ''}
  <iframe src="${escapeHtml(embed.src)}" title="${escapeHtml(track.title || embed.provider)} on ${embed.provider}" ${size} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>
  <p class="print-only">${link}</p>
</div>`;
}

function styles(draft) {
  const dark = draft.theme === 'dark';
  const accent = HEX.test(draft.accent) ? draft.accent : '#d6b36d';
  const narrow = draft.layout === 'bio';
  return `:root{--bg:${dark ? '#0f0f10' : '#f6f4ef'};--panel:${dark ? '#18181a' : '#ffffff'};--text:${dark ? '#f4f3ef' : '#1a1a18'};--muted:${dark ? '#a9a8a2' : '#5d5c56'};--line:${dark ? '#2c2c30' : '#dedbd2'};--accent:${accent}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:${narrow ? '520px' : '880px'};margin:0 auto;padding:48px 20px 64px;display:grid;gap:40px}
header{display:grid;gap:18px;${narrow ? 'justify-items:center;text-align:center' : 'grid-template-columns:auto 1fr;align-items:end'}}
header img{width:${narrow ? '140px' : '220px'};height:${narrow ? '140px' : '220px'};object-fit:cover;border-radius:${narrow ? '50%' : '16px'};border:1px solid var(--line)}
h1{font-size:${narrow ? '34px' : 'clamp(36px,7vw,64px)'};line-height:1.05;margin:0;letter-spacing:-0.02em}
h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 14px}
h3{font-size:16px;margin:0 0 8px}
.tagline{color:var(--muted);margin:8px 0 0}
.links{display:grid;gap:10px;${narrow ? '' : 'grid-template-columns:repeat(auto-fill,minmax(180px,1fr))'}}
.links a{display:block;padding:14px 18px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--text);text-decoration:none;font-weight:600;text-align:center}
.links a:hover{border-color:var(--accent)}
.tracks{display:grid;gap:18px}
.track iframe{display:block;width:100%;border:0;border-radius:12px;background:var(--panel)}
.track-link{color:var(--accent);font-weight:600}
.bio p{margin:0 0 14px;max-width:68ch}
blockquote{margin:0 0 16px;padding:16px 20px;border-left:3px solid var(--accent);background:var(--panel);border-radius:0 12px 12px 0}
blockquote p{margin:0;font-size:18px}
blockquote footer{margin-top:8px;color:var(--muted);font-size:14px}
.contact dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:0}
.contact dt{color:var(--muted)}
.contact dd{margin:0}
.contact a{color:var(--text)}
.made{color:var(--muted);font-size:12px;text-align:center}
.print-only{display:none}
@media print{
 @page{margin:16mm}
 :root{--bg:#fff;--panel:#fff;--text:#111;--muted:#555;--line:#ccc}
 body{font-size:11pt}
 main{max-width:none;padding:0;gap:22px}
 header{grid-template-columns:auto 1fr;justify-items:start;text-align:left}
 header img{width:150px;height:150px;border-radius:8px}
 h1{font-size:30pt}
 .links{grid-template-columns:1fr 1fr}
 .links a{border-radius:6px;text-align:left;padding:6px 10px}
 .links a::after{content:" " attr(href);font-weight:400;color:#555;font-size:9pt;word-break:break-all}
 .track iframe{display:none}
 .print-only{display:block}
 section,blockquote{break-inside:avoid}
}`;
}

/** The complete, self-contained page. */
export function buildPressHtml(input) {
  const draft = normalizeDraft(input);
  const name = draft.name.trim() || 'Artist';
  const bio = draft.layout === 'bio' ? draft.bio.split(/\n\s*\n/)[0] || '' : draft.bio;
  const links = draft.links
    .map((link) => ({ label: link.label.trim(), href: safeUrl(link.url) }))
    .filter((link) => link.href)
    .map(
      (link) =>
        `<a href="${escapeHtml(link.href)}" rel="noopener" target="_blank">${escapeHtml(link.label || new URL(link.href).hostname)}</a>`
    );
  const tracks = draft.tracks.map(trackHtml).filter(Boolean);
  const quotes = draft.layout === 'bio' ? [] : draft.quotes.filter((quote) => quote.text.trim());
  const contactRows = [
    ['Booking', mailto(draft.contact.booking), draft.contact.booking],
    ['Management', mailto(draft.contact.management), draft.contact.management],
    ['Press', mailto(draft.contact.press), draft.contact.press],
    ['Phone', telLink(draft.contact.phone), draft.contact.phone],
  ].filter(([, href]) => href);
  const description = (draft.tagline || bio.split('\n')[0] || `${name} press kit`).slice(0, 160);
  const csp = [
    "default-src 'none'",
    'img-src data: https:',
    "style-src 'unsafe-inline'",
    `frame-src ${FRAME_HOSTS.join(' ')}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${escapeHtml(name)}${draft.layout === 'epk' ? ' · Press Kit' : ''}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(name)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta name="generator" content="Sattari Press (alpha)">
<style>${styles(draft)}</style>
</head>
<body>
<main>
<header>
${draft.photo ? `<img src="${draft.photo}" alt="${escapeHtml(name)}">` : ''}
<div>
<h1>${escapeHtml(name)}</h1>
${draft.tagline ? `<p class="tagline">${escapeHtml(draft.tagline)}</p>` : ''}
${draft.location && draft.layout === 'epk' ? `<p class="tagline">${escapeHtml(draft.location)}</p>` : ''}
</div>
</header>
${links.length ? `<section class="links" aria-label="Links">\n${links.join('\n')}\n</section>` : ''}
${tracks.length ? `<section><h2>Listen</h2><div class="tracks">\n${tracks.join('\n')}\n</div></section>` : ''}
${bio.trim() ? `<section class="bio"><h2>About</h2>\n${paragraphs(bio)}\n</section>` : ''}
${
  quotes.length
    ? `<section><h2>Press</h2>\n${quotes
        .map(
          (quote) =>
            `<blockquote><p>“${escapeHtml(quote.text.trim())}”</p>${quote.source.trim() ? `<footer>${escapeHtml(quote.source.trim())}</footer>` : ''}</blockquote>`
        )
        .join('\n')}\n</section>`
    : ''
}
${
  contactRows.length
    ? `<section class="contact"><h2>Contact</h2><dl>\n${contactRows
        .map(
          ([label, href, value]) =>
            `<dt>${label}</dt><dd><a href="${escapeHtml(href)}">${escapeHtml(value.trim())}</a></dd>`
        )
        .join('\n')}\n</dl></section>`
    : ''
}
<p class="made">Made with Sattari Press</p>
</main>
</body>
</html>
`;
}
