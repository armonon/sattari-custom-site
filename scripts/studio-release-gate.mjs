// Revalidate one exact source snapshot; never certify a tree that changed mid-run.
// Browser checks start isolated source/preview servers and test the built artifact.
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifactIdentity } from './release-artifact.mjs';
import { availableParallelism, freemem, loadavg, totalmem, release } from 'node:os';
import { chromium } from 'playwright';
import { recordingPreflight } from './recording-preflight.mjs';

// Diagnostic context, never a reason to waive a failed musical deadline.
const hostSnapshot = () => ({ loadAverage: loadavg(), freeMemoryBytes: freemem() });

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
const output = resolve(process.env.STUDIO_GATE_OUTPUT || `/tmp/stemdeck-gate-${Date.now()}`);
await mkdir(output, { recursive: true });
// A failed early gate must not leave yesterday's success attached to dist.
await unlink(resolve(root, 'dist/release-manifest.json')).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
async function fingerprint() {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean)
    .filter((file) =>
      /^(src\/|public\/|scripts\/|tests\/|server\/|netlify\/|package.*json$|vite.*|tsconfig.*|index.html$|netlify.toml$|eslint\.config\.js$|\.prettierrc.*|\.github\/)/.test(
        file
      )
    );
  const hash = createHash('sha256');
  for (const file of [...new Set(files)].sort()) {
    hash.update(file);
    hash.update('\0');
    try {
      hash.update(await readFile(file));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('<deleted>');
    }
  }
  return hash.digest('hex');
}
const sourceHash = await fingerprint();
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const gitStatus = () =>
  execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    encoding: 'utf8',
  });
const hashFile = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
const initialStatus = gitStatus();
const lockfileSha256 = await hashFile('package-lock.json');
const configFiles = [
  'package.json',
  'vite.config.js',
  'vite.qa.config.mjs',
  'vitest.config.ts',
  'netlify.toml',
  '.github/workflows/build-deploy.yml',
];
const configuration = Object.fromEntries(
  await Promise.all(configFiles.map(async (file) => [file, await hashFile(file)]))
);
const browserMetadata = JSON.parse(
  await readFile('node_modules/playwright-core/browsers.json', 'utf8')
);
const browserExecutable = process.env.CHROMIUM_EXECUTABLE || chromium.executablePath();
const browserConfiguration = {
  playwrightVersion: JSON.parse(await readFile('node_modules/playwright/package.json', 'utf8'))
    .version,
  executable: browserExecutable,
  version: execFileSync(browserExecutable, ['--version'], { encoding: 'utf8' }).trim(),
  executableSha256: await hashFile(browserExecutable),
  revisions: browserMetadata.browsers.filter((browser) => browser.name.startsWith('chromium')),
  headless: true,
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  audioOrigin: 'http://127.0.0.1:4192',
  builtUiOrigin: 'http://127.0.0.1:4193',
};
const disk = await recordingPreflight(output, {
  seconds: 120,
  channels: 10,
  reserveBytes: 2 * 1024 ** 3,
});
const preflight = { cleanTree: initialStatus === '', initialStatus, disk };
await writeFile(resolve(output, 'preflight.json'), JSON.stringify(preflight, null, 2));
const steps = [
  ['matrix', ['scripts/report-performance-support.mjs', '--json']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
  ['unit', ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1']],
  ['types', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['meter', ['scripts/qualify-loudness.mjs']],
  ['tempo', ['scripts/qualify-tempo.mjs']],
  ['build', ['node_modules/vite/bin/vite.js', 'build']],
  ['prerender', ['scripts/prerender.mjs']],
  ['service-worker', ['scripts/build-studio-sw.mjs']],
  ['seo', ['scripts/check-seo.mjs']],
  ['browser', ['scripts/run-studio-browser-qa.mjs']],
  ['soak', ['scripts/run-windowed-soak.mjs']],
];
const results = [];
for (const [name, args] of steps) {
  if (!preflight.cleanTree || !disk.pass) break;
  console.log(`Gate: ${name}`);
  const start = Date.now();
  const hostBefore = hostSnapshot();
  let log = '';
  const status = await new Promise((resolveStatus) => {
    const child = spawn(process.execPath, args, {
      env: {
        ...process.env,
        STUDIO_BROWSER_OUTPUT: resolve(output, 'browser'),
        CHROMIUM_EXECUTABLE: browserExecutable,
        PLAYWRIGHT_MODULE: resolve(root, 'node_modules/playwright/index.mjs'),
      },
    });
    child.stdout.on('data', (value) => {
      process.stdout.write(value);
      log += value;
    });
    child.stderr.on('data', (value) => {
      process.stderr.write(value);
      log += value;
    });
    child.on('error', (error) => {
      log += error.message;
      resolveStatus(-1);
    });
    child.on('close', resolveStatus);
  });
  await writeFile(resolve(output, `${name}.log`), log);
  if (name === 'matrix' && status === 0)
    await writeFile(resolve(output, 'performance-support.json'), log);
  if (name === 'prerender' && status === 0)
    await writeFile(
      resolve(root, 'dist/performance-support.json'),
      await readFile(resolve(output, 'performance-support.json'))
    );
  results.push({
    name,
    status,
    seconds: (Date.now() - start) / 1000,
    hostBefore,
    hostAfter: hostSnapshot(),
  });
  if (status !== 0) break;
}
const unchanged =
  sourceHash === (await fingerprint()) &&
  gitStatus() === '' &&
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === commit;
const softwarePassed =
  results.length === steps.length && results.every((step) => step.status === 0) && unchanged;
const report = {
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    osRelease: release(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    logicalCpus: availableParallelism(),
    totalMemoryBytes: totalmem(),
  },
  commit,
  lockfileSha256,
  configuration,
  browserConfiguration,
  preflight,
  sourceHash,
  unchanged,
  at: new Date().toISOString(),
  softwarePassed,
  audioChecked: results.some((step) => step.name === 'browser' && step.status === 0),
  builtArtifactUiChecked: results.some((step) => step.name === 'browser' && step.status === 0),
  releaseApproved: false, // physical sessions, exact DSP replay, signing/install are separate gates
  results,
  output,
  artifact: results.some((step) => step.name === 'prerender' && step.status === 0)
    ? await artifactIdentity(resolve(root, 'dist'))
    : null,
};
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
if (softwarePassed) {
  await writeFile(resolve(root, 'dist/release-manifest.json'), JSON.stringify(report, null, 2));
  const { verifyArtifact } = await import('./release-artifact.mjs');
  await verifyArtifact(resolve(root, 'dist'), { commit });
  await writeFile(
    resolve(output, 'artifact-verification.json'),
    JSON.stringify(
      {
        pass: true,
        commit,
        artifact: report.artifact,
        releaseApproved: false,
      },
      null,
      2
    )
  );
}
console.log(JSON.stringify(report, null, 2));
if (!softwarePassed) process.exitCode = 1;
