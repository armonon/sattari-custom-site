import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { localDate } from '../src/utils/studioBooking.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BOOKING_QA_URL || 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Booking browser QA must run locally; API responses are mocked.');
const output = '/tmp/sattari-booking-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const date = localDate(Date.now() + 7 * 86400000);
try {
  for (const theme of ['day', 'night']) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(
        (theme) => localStorage.setItem('sattari-theme-pref-v1', theme),
        theme
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let posted;
      await page.route('**/api/studio-bookings', async (route) => {
        if (route.request().method() === 'POST') {
          posted = route.request().postDataJSON();
          return route.fulfill({
            json: {
              booking: { id: 'studio_browser_test', status: 'requested', amountCents: 6000 },
            },
          });
        }
        return route.fulfill({
          json: {
            enabled: true,
            openHour: 18,
            closeHour: 24,
            days: [0, 1, 2, 3, 4, 5, 6],
            durations: [1, 2, 3, 4],
            reserved: [],
          },
        });
      });
      await page.goto(`${base}/services`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Studio & rehearsal/ }).click();
      await page.getByLabel('Date', { exact: true }).fill(date);
      await page.getByRole('combobox', { name: 'Start time', exact: true }).selectOption('18');
      await page.getByLabel('Your name', { exact: true }).fill('QA Musician');
      await page.getByLabel('Email address', { exact: true }).fill('qa@example.com');
      await page.getByRole('checkbox').check();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false
      );
      await page
        .locator('.studio-booking')
        .screenshot({ path: `${output}/${theme}-${width}-form.png` });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${output}/${theme}-${width}-page.png`, fullPage: true });
      await page.getByRole('button', { name: 'Request booking', exact: true }).click();
      await page.getByRole('heading', { name: 'Request received' }).waitFor();
      assert.equal(posted.hours, 4);
      assert.equal(posted.startHour, 18);
      assert.equal(posted.accepted, true);
      assert.ok(await page.getByText(/This time is awaiting our approval/).isVisible());
      await page.screenshot({ path: `${output}/${theme}-${width}-received.png`, fullPage: true });
      for (const path of [
        '/services/rehearsal-space-los-angeles',
        '/services/recording-studio-rental-los-angeles',
      ]) {
        await page.goto(base + path, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Book studio & rehearsal time' }).waitFor();
        assert.equal(await page.locator('#local-inquiry').count(), 1);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false
        );
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS mocked booking request, service entry points and ${theme} layout at ${width}px`
      );
    }
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
  await page.addInitScript(() => sessionStorage.setItem('sattari_staff_token', 'qa-test-only'));
  await page.route('**/api/staff/stock', (route) =>
    route.fulfill({ json: { items: [], staff: 'QA staff' } })
  );
  let approved = false;
  await page.route('**/api/staff/bookings', (route) => {
    if (route.request().method() === 'POST') {
      assert.equal(route.request().postDataJSON().action, 'approve');
      approved = true;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({
      json: {
        setupMissing: [],
        bookings: [
          {
            id: 'studio_00000000-0000-4000-8000-000000000000',
            date,
            startHour: 18,
            hours: 4,
            amountCents: 6000,
            status: approved ? 'awaiting_payment' : 'requested',
            name: 'QA Musician',
            email: 'qa@example.com',
            purpose: 'Rehearsal',
            notifications: { ownerEmail: { state: 'sent' } },
          },
        ],
      },
    });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`${base}/staff-cc6436694e.html#bookings`);
  await page.getByRole('button', { name: 'Approve & email payment link', exact: true }).click();
  await page.getByText('Approved - awaiting payment', { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false
  );
  await page.screenshot({ path: `${output}/staff-mobile.png`, fullPage: true });
  console.log(
    `PASS staff approval UI with mocked API. Screenshots: ${output}. No emails, texts or charges sent.`
  );
} finally {
  await browser.close();
}
