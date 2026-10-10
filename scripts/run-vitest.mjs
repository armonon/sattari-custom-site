import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Node 26 exposes an experimental process-level localStorage. It shadows the
// jsdom storage Vitest gives browser tests unless it is disabled before workers
// start. Run Vitest through Node so the safeguard works on macOS, Linux and
// Windows without shell-specific environment-variable syntax.
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const vitest = path.resolve(scriptDirectory, '../node_modules/vitest/vitest.mjs');
const existing = process.env.NODE_OPTIONS?.trim();
const option = '--no-experimental-webstorage';
const nodeOptions = existing?.includes(option) ? existing : [existing, option].filter(Boolean).join(' ');

const result = spawnSync(process.execPath, [vitest, '--run', '--passWithNoTests', ...process.argv.slice(2)], {
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
