#!/usr/bin/env node
//
// Generates the Netlify environment variables that guard the staff page. The
// password itself is never stored anywhere — only a scrypt hash of it — so
// this output is safe to paste into the Netlify UI.
//
//   node scripts/hash-staff-password.mjs "username"
//
// The password is typed at a hidden prompt, never given as an argument: an
// argument lands in the shell history and is visible to every process on the
// machine while this runs. To script it, pipe it in on stdin instead:
//
//   printf '%s' "$PASSWORD" | node scripts/hash-staff-password.mjs "username"
//
// Set the printed values under: Netlify → Site configuration →
// Environment variables. Then redeploy so the functions pick them up.

import crypto from 'node:crypto';
import process from 'node:process';

const username = process.argv[2];

if (!username || process.argv.length > 3) {
  console.error(
    process.argv.length > 3
      ? 'Do not put the password on the command line: it stays in your shell history.\n' +
          'Run the command with only the username and type the password when asked.'
      : 'Usage: node scripts/hash-staff-password.mjs "username"'
  );
  process.exit(1);
}

// Reads one line from the terminal without echoing it.
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    let value = '';
    stderr.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stderr.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u0003') {
          finish(new Error('Cancelled.'));
          return;
        }
        if (char === '\u0004') return finish();
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    }

    stdin.on('data', onData);
  });
}

// Piped input: the first line, without its line ending.
async function readPiped() {
  let data = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) data += chunk;
  return data.split(/\r?\n/)[0];
}

async function readPassword() {
  if (!process.stdin.isTTY) return readPiped();
  const first = await promptHidden('Staff password (not shown): ');
  const again = await promptHidden('Type it again: ');
  if (first !== again) {
    console.error('The two entries did not match. Nothing was generated.');
    process.exit(1);
  }
  return first;
}

let password;
try {
  password = await readPassword();
} catch (error) {
  console.error(error.message);
  process.exit(130);
}

if (!password) {
  console.error('No password was entered. Nothing was generated.');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
const secret = crypto.randomBytes(32).toString('hex');

// A warning rather than a hard stop: it is the shop's decision, but a short
// password should not slip by unremarked. This is the only lock on a page that
// can change live prices, and the staff URL will leak eventually.
if (password.length < 10) {
  console.error(`
  WARNING: that password is ${password.length} characters.
  ${/^\d+$/.test(password) ? `It is also all digits — only ${10 ** password.length} possibilities.` : ''}
  The sign-in throttle limits guesses per address and site-wide, but a short
  password is still the weakest part of the lock.
  Consider something longer before the page is used on the live site.
`);
}

console.log(`
Set these four environment variables in Netlify:

STAFF_USERNAME
${username}

STAFF_PASSWORD_SALT
${salt}

STAFF_PASSWORD_HASH
${hash}

STAFF_SESSION_SECRET
${secret}

Notes:
  - "Sign out everywhere" on the staff page revokes every sign-in without a
    redeploy. Changing STAFF_SESSION_SECRET does the same after a deploy, and
    also ends every browser's device token, so each one starts over on the
    shared sign-in limit until it signs in again.
  - To change the password later, run this again and update all four.
  - Do not commit these. They belong in Netlify's environment, not the repo.
`);
