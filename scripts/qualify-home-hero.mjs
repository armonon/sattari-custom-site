import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.HOME_QA_URL || 'http://127.0.0.1:5190';
const output = process.env.HOME_QA_DIR || '/tmp/sattari-home-video-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  for (const theme of ['day', 'night']) {
    for (const width of [320, 390, 768, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(
        (mode) => localStorage.setItem('sattari-theme-pref-v1', mode),
        theme
      );
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('.home-hero-art').evaluate((image) => image.decode());
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => {
        const video = document.querySelector('.home-hero-video');
        return video?.readyState >= 2 && video.currentTime > 0.1 && !video.paused;
      });
      const state = await page.evaluate(() => {
        const video = document.querySelector('.home-hero-video');
        const art = document.querySelector('.home-hero-art');
        const canvas = document.createElement('canvas');
        canvas.width = art.naturalWidth;
        canvas.height = art.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(art, 0, 0);
        const backgroundAlpha = ctx.getImageData(64, 64, 1, 1).data[3];
        ctx.drawImage(video, 0, 0, 128, 128);
        const pixels = ctx.getImageData(0, 0, 128, 128).data;
        const levels = Array.from(pixels).filter((_, index) => index % 4 !== 3);
        const rect = document.querySelector('.home-hero').getBoundingClientRect();
        const copy = document.querySelector('.home-hero-copy').getBoundingClientRect();
        const actions = document.querySelector('.home-hero-actions').getBoundingClientRect();
        const motion = document.querySelector('.home-hero-motion').getBoundingClientRect();
        return {
          backgroundAlpha,
          pixelRange: Math.max(...levels) - Math.min(...levels),
          muted: video.muted,
          loop: video.loop,
          source: decodeURI(video.currentSrc),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          nextSectionVisible: rect.bottom < innerHeight,
          copyFits: copy.right <= innerWidth && copy.bottom <= rect.bottom,
          copyOffset: (copy.top + copy.bottom - rect.top - rect.bottom) / 2,
          motionOverlapsActions:
            motion.left < actions.right &&
            motion.right > actions.left &&
            motion.top < actions.bottom &&
            motion.bottom > actions.top,
          frame: video.currentTime,
        };
      });
      assert.equal(state.backgroundAlpha, 0, 'The artwork must have a truly transparent backdrop');
      assert.ok(state.pixelRange > 3, 'The video frame must contain visible detail');
      assert.equal(state.muted, true);
      assert.equal(state.loop, true);
      const expectedSource =
        theme === 'day' ? '/bg.mp4' : width <= 760 ? '/night-loop-720.mp4' : '/INSTRA PATTERN.mp4';
      assert.ok(state.source.endsWith(expectedSource));
      assert.equal(state.overflow, false);
      assert.equal(state.nextSectionVisible, true);
      assert.equal(state.copyFits, true);
      if (width > 760)
        assert.ok(state.copyOffset >= 55, 'Desktop hero copy should sit below center');
      assert.equal(state.motionOverlapsActions, false, 'Video control must not cover hero actions');
      await page.waitForFunction(
        (frame) => document.querySelector('.home-hero-video').currentTime !== frame,
        state.frame
      );
      await page.getByRole('button', { name: 'Pause background video' }).click();
      await page.waitForFunction(() => document.querySelector('.home-hero-video').paused);
      await page.screenshot({ path: `${output}/${theme}-${width}.png` });
      await page.getByRole('button', { name: 'Play background video' }).click();
      await page.waitForFunction(() => !document.querySelector('.home-hero-video').paused);
      console.log(`PASS ${theme} ${width}px: transparent art, video frames, playback, layout`);
      await page.close();
    }
  }

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await page.addInitScript(() => localStorage.setItem('sattari-theme-pref-v1', 'day'));
  page.on('pageerror', (error) => errors.push(error.message));
  const videosRequested = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.mp4')) videosRequested.push(request.url());
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  // The still is the hero's CSS background, chosen by [data-theme]: wait until it has loaded.
  await page.locator('.home-hero-background').evaluate(async (hero) => {
    const url = getComputedStyle(hero).backgroundImage.match(/url\("?(.*?)"?\)/)?.[1];
    if (!url) throw new Error('The hero has no still background.');
    const image = new Image();
    image.src = url;
    await image.decode();
  });
  assert.equal(await page.locator('.home-hero-video').count(), 0);
  assert.deepEqual(videosRequested, []);
  await page.screenshot({ path: `${output}/reduced-motion-390.png` });
  console.log('PASS reduced motion: still poster, no video request');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.querySelector('.home-hero-video')?.currentTime > 0);
  await page.evaluate(() => {
    document.querySelector('#home-hub').scrollIntoView();
  });
  await page.waitForFunction(() => document.querySelector('.home-hero-video').paused);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => !document.querySelector('.home-hero-video').paused);
  const previousTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole('button', { name: /Switch to (day|night) mode/i }).click();
  await page.waitForFunction(
    (previous) => document.documentElement.dataset.theme !== previous,
    previousTheme
  );
  await page.waitForFunction((previous) => {
    const video = document.querySelector('.home-hero-video');
    const expected = previous === 'day' ? '/night-loop-720.mp4' : '/bg.mp4';
    return video?.currentTime > 0 && decodeURI(video.currentSrc).endsWith(expected);
  }, previousTheme);
  const themeMatches = await page.evaluate(() => {
    const isDay = document.documentElement.dataset.theme === 'day';
    return decodeURI(document.querySelector('.home-hero-video').currentSrc).endsWith(
      isDay ? '/bg.mp4' : '/night-loop-720.mp4'
    );
  });
  assert.equal(themeMatches, true);
  console.log('PASS live motion/theme changes and offscreen suspension');
  await page.close();
  assert.deepEqual(errors, []);
  console.log(`PASS browser errors: none. Screenshots: ${output}`);
} finally {
  await browser.close();
}
