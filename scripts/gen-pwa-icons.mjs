// Rasterizes the install icons for the two studio apps with headless Chromium
// (no native image tooling needed):
//   StemDeck: maskable versions of the existing icon (public/images/stemdeck).
//   Sattari:  the Sattari mark, white on the site's near-black, any + maskable
//             (public/images/sattari-app).
// Run: node scripts/gen-pwa-icons.mjs   (CHROME_PATH=… for a local Chrome)
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../public/', import.meta.url);
const dataUrl = async (path) =>
  `data:image/png;base64,${(await readFile(new URL(path, root))).toString('base64')}`;

const jobs = [
  // [source, output, size, background, scale (of the canvas), invert]
  [
    'images/stemdeck/icon-512.png',
    'images/stemdeck/icon-maskable-192.png',
    192,
    '#101114',
    0.78,
    false,
  ],
  [
    'images/stemdeck/icon-512.png',
    'images/stemdeck/icon-maskable-512.png',
    512,
    '#101114',
    0.78,
    false,
  ],
  ['sattari site/favicon.png', 'images/sattari-app/icon-192.png', 192, '#0a0a0b', 0.72, true, 0.22],
  ['sattari site/favicon.png', 'images/sattari-app/icon-512.png', 512, '#0a0a0b', 0.72, true, 0.22],
  [
    'sattari site/favicon.png',
    'images/sattari-app/icon-maskable-192.png',
    192,
    '#0a0a0b',
    0.56,
    true,
  ],
  [
    'sattari site/favicon.png',
    'images/sattari-app/icon-maskable-512.png',
    512,
    '#0a0a0b',
    0.56,
    true,
  ],
  [
    'sattari site/favicon.png',
    'images/sattari-app/apple-touch-icon.png',
    180,
    '#0a0a0b',
    0.62,
    true,
  ],
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage();
for (const [source, output, size, background, scale, invert, radius = 0] of jobs) {
  const png = await page.evaluate(
    async ({ src, size, background, scale, invert, radius }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background;
      if (radius) {
        // "any" icons: rounded tile so they read as an app icon on every OS.
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, size * radius);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, size, size);
      }
      const box = size * scale;
      const ratio = Math.min(box / image.width, box / image.height);
      const w = image.width * ratio;
      const h = image.height * ratio;
      if (invert) ctx.filter = 'invert(1)';
      ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
      return canvas.toDataURL('image/png');
    },
    { src: await dataUrl(source), size, background, scale, invert, radius }
  );
  await writeFile(new URL(output, root), Buffer.from(png.split(',')[1], 'base64'));
  console.log(`${output} ${size}×${size}`);
}
await browser.close();
