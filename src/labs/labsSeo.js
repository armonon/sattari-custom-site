import { SITE_ORIGIN } from '../data/siteSeo';

// Alpha tools stay out of search (noindex, not in the sitemap) until the owner
// decides they are ready. Flip `noindex` and add them to the sitemap together.
export const LAB_SEO = {
  canvas: {
    title: 'Canvas (alpha): Audio-Reactive Vertical Video Loops',
    description:
      'Turn a track and cover art into an audio-reactive 9:16 loop for Spotify Canvas, Reels and TikTok. Runs in your browser; nothing is uploaded.',
    url: `${SITE_ORIGIN}/studio/canvas`,
    noindex: true,
  },
  pocket: {
    title: 'Pocket (alpha): Beat & Loop Sketchpad',
    description:
      'Sketch a beat on your phone: step sequencer, synthesized drums, bass line, swing. Export the loop as WAV or stems and open them in StemDeck.',
    url: `${SITE_ORIGIN}/studio/pocket`,
    noindex: true,
  },
  press: {
    title: 'Press (alpha): Artist EPK & Link-in-Bio Builder',
    description:
      'Build an electronic press kit or link-in-bio page: bio, photo, links, tracks, press quotes and contact. Export one self-contained HTML file or a PDF.',
    url: `${SITE_ORIGIN}/press`,
    noindex: true,
  },
};

export const LAB_APPS = [
  {
    id: 'canvas',
    name: 'Canvas',
    path: '/studio/canvas',
    detail: 'Audio-reactive 9:16 loops for Spotify Canvas and Reels',
  },
  {
    id: 'pocket',
    name: 'Pocket',
    path: '/studio/pocket',
    detail: 'Phone-first beat sketchpad with WAV and stem export',
  },
  {
    id: 'press',
    name: 'Press',
    path: '/press',
    detail: 'EPK and link-in-bio page you can download as one file',
  },
];
