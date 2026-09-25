// Revalidate one exact source snapshot; never certify a tree that changed mid-run.
// Browser checks start isolated source/preview servers and test the built artifact.
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
const output = resolve(process.env.STUDIO_GATE_OUTPUT || `/tmp/stemdeck-gate-${Date.now()}`);
await mkdir(output, { recursive: true });
async function fingerprint() {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean)
    .filter((file) =>
      /^(src\/|public\/|scripts\/|package.*json$|vite.*|tsconfig.*|index.html$|\.github\/)/.test(
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
const steps = [
  ['lint', ['node_modules/eslint/bin/eslint.js', 'src', '--ext', '.js,.jsx,.ts,.tsx']],
  ['unit', ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', '--minWorkers=1']],
  ['types', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['meter', ['scripts/qualify-loudness.mjs']],
  ['tempo', ['scripts/qualify-tempo.mjs']],
  ['build', ['node_modules/vite/bin/vite.js', 'build']],
  ['prerender', ['scripts/prerender.mjs']],
  ['browser', ['scripts/run-studio-browser-qa.mjs']],
];
const results = [];
for (const [name, args] of steps) {
  console.log(`Gate: ${name}`);
  const start = Date.now();
  let log = '';
  const status = await new Promise((resolveStatus) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, STUDIO_BROWSER_OUTPUT: resolve(output, 'browser') },
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
  results.push({ name, status, seconds: (Date.now() - start) / 1000 });
  if (status !== 0) break;
}
const unchanged = sourceHash === (await fingerprint());
const softwarePassed =
  results.length === steps.length && results.every((step) => step.status === 0) && unchanged;
const report = {
  commit,
  sourceHash,
  unchanged,
  at: new Date().toISOString(),
  softwarePassed,
  audioChecked: results.some((step) => step.name === 'browser' && step.status === 0),
  builtArtifactUiChecked: results.some((step) => step.name === 'browser' && step.status === 0),
  releaseApproved: false, // physical sessions, exact DSP replay, signing/install are separate gates
  results,
  output,
};
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
if (softwarePassed)
  await writeFile(resolve(root, 'dist/release-manifest.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!softwarePassed) process.exitCode = 1;
