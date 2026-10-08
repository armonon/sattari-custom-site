import { chromium } from 'playwright';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir, loadavg, freemem } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { performLifecycleFixture } from './perform-lifecycle-fixture.mjs';
const origin = process.argv[2] || 'http://127.0.0.1:4291';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const out = resolve(process.argv[3] || '/tmp/stemdeck-real-lifecycle');
await mkdir(out, { recursive: true });
const fixture = performLifecycleFixture();
await writeFile(join(out, 'fixture-hashes.json'), JSON.stringify(fixture.hashes, null, 2));
let profile = await mkdtemp(join(tmpdir(), 'stemdeck-fourdeck-'));
let context, page;
const report = {
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  profile,
  pass: false,
  physicalInputs: false,
  mockedEndpoints: ['/api/inventory'],
  steps: [],
  errors: [],
};
async function launch() {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  report.browser = context.browser()?.version();
  await context.route('**/api/inventory', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"stock":{}}' })
  );
  page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(origin + '/studio', { waitUntil: 'domcontentloaded' });
  await page.getByText('Local session', { exact: true }).waitFor({ state: 'attached' });
}
const saved = () =>
  page.evaluate(async () =>
    (await import('/src/utils/sessionPersistence.js'))
      .persistentSession({ loadLegacy: () => null })
      .load()
  );
// Portable imports deliberately allocate fresh local asset IDs. Compare every
// audio reference by the actual restored bytes, not by an incidental database ID.
const semanticArrangement = () =>
  page.evaluate(async () => {
    const session = await (await import('/src/utils/sessionPersistence.js'))
      .persistentSession({ loadLegacy: () => null })
      .load();
    const { getAudioAsset } = await import('/src/utils/audioProjectStore.js');
    const ids = new Set();
    const collect = (value) => {
      if (typeof value === 'string' && /^audio-/.test(value)) ids.add(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(session.arranger);
    const hashes = new Map();
    for (const id of ids) {
      const asset = await getAudioAsset(id);
      if (!asset?.blob) throw Error('Missing portable audio ' + id);
      const digest = await crypto.subtle.digest('SHA-256', await asset.blob.arrayBuffer());
      hashes.set(
        id,
        Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('')
      );
    }
    const normalize = (value) =>
      typeof value === 'string'
        ? hashes.get(value) || value
        : Array.isArray(value)
          ? value.map(normalize)
          : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]))
            : value;
    return { arrangement: normalize(session.arranger), assets: ids.size };
  });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// Installed Playwright treats async waitForFunction's Promise as truthy. Await
// real IndexedDB reads in Node and assert the postcondition, never a Promise.
async function waitSaved(predicate, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await saved();
    if (predicate(value)) return value;
    await pause(100);
  }
  throw new Error('Saved-session postcondition timed out');
}
const recordStep = (step) => {
  report.steps.push(step);
  console.log(step);
};
try {
  await launch();
  const fixturePath = join(out, 'four-deck.sattari');
  await writeFile(fixturePath, JSON.stringify(fixture.project));
  await page.locator('input[accept="application/json,.json,.sattari"]').setInputFiles(fixturePath);
  await page.getByText('Four Deck Actual Capture QA', { exact: true }).first().waitFor();
  await waitSaved(
    (s) =>
      s?.decks?.length === 4 &&
      s.decks.every(
        (d) =>
          d.duration === fixture.duration &&
          Object.values(d.lanes).every((l) => l.status === 'ready')
      )
  );
  recordStep('Four decks,20 real generated audio assets imported through project picker');
  for (const [index, id] of ['A', 'B', 'C', 'D'].entries()) {
    await page
      .locator('[aria-label="Performance scenes"]')
      .getByRole('button', { name: id, exact: true })
      .click();
    const deck = page.getByRole('article', { name: 'Deck ' + id, exact: true });
    await deck.locator('input[type=file]').first().setInputFiles(fixture.files[index]);
    await waitSaved((s) => s?.decks?.find((d) => d.id === id)?.analysis?.waveform?.length > 0);
  }
  report.analysis = (await saved()).decks.map((d) => ({
    id: d.id,
    bpm: d.bpm,
    key: d.keyName,
    analysis: !!d.analysis,
  }));
  assert(
    report.analysis.every((d) => d.analysis),
    'all four measured analyses must be saved'
  );
  recordStep('Actual fullMix lane import and analyzer executed for all four decks');
  await page.getByRole('button', { name: 'Record live set', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording live set', exact: true }).waitFor();
  for (const id of ['A', 'B', 'C', 'D']) {
    await page
      .locator('[aria-label="Performance scenes"]')
      .getByRole('button', { name: id, exact: true })
      .click();
    await page.getByRole('button', { name: 'Play Deck ' + id, exact: true }).click();
  }
  // Exercise multiple decoded source windows, not just the initial lookahead.
  await pause(12000);
  await page
    .getByRole('article', { name: 'Deck D', exact: true })
    .getByRole('button', { name: 'Mute BAS', exact: true })
    .click();
  await page.getByLabel('Performance crossfader', { exact: true }).fill('35');
  await pause(600);
  await page
    .getByRole('article', { name: 'Deck D', exact: true })
    .getByRole('button', { name: 'Mute BAS', exact: true })
    .click();
  report.perform = { pass: true, unexpectedlyStoppedDecks: [] };
  for (const id of ['A', 'B', 'C', 'D']) {
    await page
      .locator('[aria-label="Performance scenes"]')
      .getByRole('button', { name: id, exact: true })
      .click();
    const stop = page.getByRole('button', { name: 'Pause Deck ' + id, exact: true });
    if (await stop.isVisible()) await stop.click();
    else {
      assert(await page.getByRole('button', { name: 'Play Deck ' + id, exact: true }).isVisible());
      report.perform.pass = false;
      report.perform.unexpectedlyStoppedDecks.push(id);
      report.steps.push('Deck ' + id + ' was already stopped before final pause; cause unverified');
    }
  }
  await page.getByRole('button', { name: 'Stop recording live set', exact: true }).click();
  await page
    .getByRole('button', { name: /Open performance in Arrange/ })
    .waitFor({ timeout: 60000 });
  await pause(800);
  report.captured = await saved();
  await writeFile(join(out, 'captured-session.json'), JSON.stringify(report.captured, null, 2));
  assert.equal(report.captured.arranger.captures.length, 1);
  assert(report.captured.arranger.captures[0].events.length > 8);
  recordStep(
    'Actual UI started capture,played four decks,changed stem mute/crossfader,stopped all and finished capture'
  );
  await page.getByRole('button', { name: /Open performance in Arrange/ }).click();
  await page.getByRole('button', { name: 'Build editable source replay', exact: true }).click();
  await waitSaved(
    (s) => s?.arranger?.tracks?.length > report.captured.arranger.tracks.length,
    15000
  );
  report.built = await saved();
  await writeFile(join(out, 'built-session.json'), JSON.stringify(report.built, null, 2));
  await page.screenshot({ path: join(out, 'capture-arrange.png') });
  recordStep('Actual captured events built into editable arrangement via UI');
  const tools = page.locator('details.ae-edit-tools');
  if ((await tools.getAttribute('open')) === null) await tools.locator('summary').click();
  const countBefore = report.captured.arranger.tracks.length,
    countBuilt = report.built.arranger.tracks.length;
  assert(countBuilt > countBefore, 'actual captured events must add reconstructed source lanes');
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await waitSaved((s) => s?.arranger?.tracks?.length === countBefore);
  assert.equal((await saved()).arranger.tracks.length, countBefore);
  await page.getByRole('button', { name: 'Redo edit', exact: true }).click();
  await waitSaved((s) => s?.arranger?.tracks?.length === countBuilt);
  assert.equal((await saved()).arranger.tracks.length, countBuilt);
  const track = page.locator('input[aria-label^="Track name "]').first();
  const previousName = await track.inputValue();
  await track.fill('QA edited source');
  await track.blur();
  await waitSaved((s) => s?.arranger?.tracks?.[0]?.name === 'QA edited source');
  assert.equal((await saved()).arranger.tracks[0].name, 'QA edited source');
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await waitSaved((s) => s?.arranger?.tracks?.[0]?.name === previousName);
  assert.equal((await saved()).arranger.tracks[0].name, previousName);
  await page.getByRole('button', { name: 'Redo edit', exact: true }).click();
  await waitSaved((s) => s?.arranger?.tracks?.[0]?.name === 'QA edited source');
  assert.equal((await saved()).arranger.tracks[0].name, 'QA edited source');
  recordStep(
    'Reconstruction and real track edit undo/redo preserve original capture and lane state'
  );
  const download = async (label, name) => {
    const pending = page.waitForEvent('download', { timeout: 120000 });
    await page.getByRole('button', { name: label, exact: true }).click();
    const got = await pending;
    const target = join(out, name);
    await got.saveAs(target);
    return target;
  };
  report.replayHostBefore = { loadAverage: loadavg(), freeMemoryBytes: freemem() };
  await page.getByRole('button', { name: 'Print edited performance', exact: true }).click();
  const replayStop = page.getByRole('button', { name: 'Stop performance replay', exact: true });
  await replayStop.waitFor({ state: 'visible', timeout: 15000 });
  await replayStop.waitFor({ state: 'hidden', timeout: 90000 });
  await pause(600);
  const printed = await saved();
  report.printedTrackCount = printed.arranger.tracks.length - countBuilt;
  const replayStatus = await page.locator('body').innerText();
  await writeFile(join(out, 'replay-status.txt'), replayStatus);
  report.replay = {
    pass: report.printedTrackCount > 0,
    status:
      replayStatus.match(
        /Edited performance printed[^\n]*|Audio scheduling[^\n]*|Source audio[^\n]*|Replay finished[^\n]*/
      )?.[0] || 'See replay-status.txt',
  };
  assert.deepEqual(
    printed.arranger.captures,
    report.built.arranger.captures,
    'printing must not rewrite original event history'
  );
  recordStep(
    report.replay.pass
      ? 'Actual live-engine replay printed new durable audio lanes without changing original capture history'
      : 'Actual live-engine replay failed; original take retained and independent archive/export checks continue'
  );
  const beforeWav = await download('Export mixdown', 'before-close.wav');
  const portable = await download('Save project file', 'portable.sattari');
  const archive = await readFile(portable);
  assert.equal(archive.subarray(0, 8).toString(), 'SATPROJ6');
  report.portableBytes = archive.length;
  const before = await saved();
  const semanticBefore = await semanticArrangement();
  await writeFile(join(out, 'before-close-session.json'), JSON.stringify(before, null, 2));
  await context.close();
  context = null;
  await launch();
  await page.getByText('Four Deck Actual Capture QA', { exact: true }).first().waitFor();
  await pause(1200);
  const reopened = await saved();
  assert.deepEqual(
    reopened.arranger,
    before.arranger,
    'actual complete browser close/reopen preserves all arrangement/capture state'
  );
  report.steps.push(
    'Full browser process closed/relaunched; saved arrangement and original captured event history identical'
  );
  await page
    .getByRole('navigation', { name: 'STEMDECK workspaces' })
    .getByRole('button', { name: 'Arrange', exact: true })
    .click();
  const reopenedTools = page.locator('details.ae-edit-tools');
  if ((await reopenedTools.getAttribute('open')) === null)
    await reopenedTools.locator('summary').click();
  const afterWav = await download('Export mixdown', 'after-reopen.wav');
  report.masterExport = comparePcm(await readFile(beforeWav), await readFile(afterWav));
  assert(report.masterExport.maximumError < 2e-6, 'master PCM changed after full browser reopen');
  const stems = await download('Export track stems', 'track-stems.zip');
  const zipBytes = await readFile(stems);
  report.stemArchiveBytes = zipBytes.length;
  const entries = unzipSync(zipBytes),
    wavEntries = Object.entries(entries).filter(([name]) => name.endsWith('.wav'));
  const audible = before.arranger.tracks.filter(
    (t) =>
      t.clips.length &&
      !t.offline &&
      !t.muted &&
      (!before.arranger.tracks.some((t) => t.solo) || t.solo)
  );
  assert.equal(wavEntries.length, audible.length, 'ZIP must contain every audible track');
  report.stems = wavEntries.map(([name, bytes]) => ({
    name,
    ...comparePcm(Buffer.from(bytes), Buffer.from(bytes)),
  }));
  assert(
    report.stems.every(
      (stem) =>
        stem.frames === report.masterExport.frames &&
        stem.sampleRate === 48000 &&
        stem.channels === 2
    ),
    'stem WAVs must share master timeline'
  );
  assert(entries['README.txt']);
  recordStep(
    'Actual master and aligned stem downloads independently decoded; before/after PCM comparison passed'
  );
  await context.close();
  context = null;
  profile = await mkdtemp(join(tmpdir(), 'stemdeck-portable-'));
  report.portableProfile = profile;
  await launch();
  assert(
    !(await saved())?.arranger?.captures?.length,
    'portable restore starts without the captured session'
  );
  await page.locator('input[accept="application/json,.json,.sattari"]').setInputFiles(portable);
  await waitSaved(
    (s) =>
      s?.arranger?.captures?.length === 1 &&
      s.arranger.tracks.length === before.arranger.tracks.length
  );
  assert.deepEqual(
    await semanticArrangement(),
    semanticBefore,
    'portable import must retain semantic state and every referenced asset byte hash'
  );
  await page
    .getByRole('navigation', { name: 'STEMDECK workspaces' })
    .getByRole('button', { name: 'Arrange', exact: true })
    .click();
  const portableTools = page.locator('details.ae-edit-tools');
  if ((await portableTools.getAttribute('open')) === null)
    await portableTools.locator('summary').click();
  const portableWav = await download('Export mixdown', 'portable-restored.wav');
  report.portableExport = comparePcm(await readFile(beforeWav), await readFile(portableWav));
  assert(report.portableExport.maximumError < 2e-6, 'portable source audio changed');
  recordStep(
    'Portable project reopened into a fresh browser profile; original events and exported PCM preserved'
  );
  report.archiveRoundtripPass = true;
  report.verifiedPortableAssets = semanticBefore.assets;
  report.trackCount = countBuilt;
  report.capturedActionTypes = [...new Set(before.arranger.captures[0].events.map((e) => e.type))];
  report.scope =
    'Actual synthetic four-deck capture/arrange/edit/undo/save/full browser restart/export subset; physical/full musical qualification excluded';
  report.pass = report.perform.pass && report.replay.pass;
  if (!report.pass) process.exitCode = 1;
} catch (error) {
  report.error = String(error.stack);
  await page?.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
  if (page) {
    await writeFile(join(out, 'failure-body.txt'), await page.locator('body').innerText()).catch(
      () => {}
    );
    await writeFile(
      join(out, 'failure-session.json'),
      JSON.stringify(await saved(), null, 2)
    ).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  delete report.captured;
  delete report.built;
  await context?.close();
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

function comparePcm(a, b) {
  const decode = (bytes) => {
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    let fmt, rate, channels, data;
    for (let at = 12; at + 8 <= bytes.length; ) {
      const tag = bytes.toString('ascii', at, at + 4),
        len = bytes.readUInt32LE(at + 4);
      if (tag === 'fmt ') {
        fmt = bytes.readUInt16LE(at + 8);
        channels = bytes.readUInt16LE(at + 10);
        rate = bytes.readUInt32LE(at + 12);
      }
      if (tag === 'data') {
        data = bytes.subarray(at + 8, at + 8 + len);
        break;
      }
      at += 8 + len + (len % 2);
    }
    assert.equal(fmt, 1);
    assert(data);
    assert.equal(bytes.readUInt16LE(34), 24);
    const samples = new Float32Array(data.length / 3);
    for (let i = 0; i < samples.length; i++) samples[i] = data.readIntLE(i * 3, 3) / 8388608;
    return { rate, channels, samples };
  };
  const x = decode(a),
    y = decode(b);
  assert.equal(x.rate, y.rate);
  assert.equal(x.channels, y.channels);
  assert.equal(x.samples.length, y.samples.length);
  let maximumError = 0,
    peak = 0;
  for (let i = 0; i < x.samples.length; i++) {
    maximumError = Math.max(maximumError, Math.abs(x.samples[i] - y.samples[i]));
    peak = Math.max(peak, Math.abs(x.samples[i]));
  }
  assert(peak > 0.0001, 'export must contain actual generated performance audio');
  return {
    sampleRate: x.rate,
    channels: x.channels,
    frames: x.samples.length / x.channels,
    maximumError,
    peak,
  };
}
