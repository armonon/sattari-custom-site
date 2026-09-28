// @vitest-environment node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/staffAuth.js';

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/hash-staff-password.mjs'
);

function run(args, input) {
  return spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8' });
}

describe('scripts/hash-staff-password.mjs', () => {
  it('reads a piped password and prints a hash of it, not the password', () => {
    const result = run(['sattaristudio'], 'correct-horse-battery\n');

    expect(result.status).toBe(0);
    const salt = /STAFF_PASSWORD_SALT\n([a-f0-9]{32})/.exec(result.stdout)[1];
    const hash = /STAFF_PASSWORD_HASH\n([a-f0-9]{128})/.exec(result.stdout)[1];
    expect(hash).toBe(hashPassword('correct-horse-battery', salt));
    expect(result.stdout).not.toContain('correct-horse-battery');
  });

  // An argument lands in the shell history and the process list.
  it('refuses a password given on the command line', () => {
    const result = run(['sattaristudio', 'correct-horse-battery'], '');

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/shell history/);
    expect(result.stdout).toBe('');
  });

  it('refuses an empty password', () => {
    const result = run(['sattaristudio'], '');

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });
});
