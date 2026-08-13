#!/usr/bin/env node
//
// Generates the three Netlify environment variables that guard the staff
// inventory page. The password itself is never stored anywhere — only a scrypt
// hash of it — so this output is safe to paste into the Netlify UI.
//
//   node scripts/hash-staff-password.mjs "username" "the password you want"
//
// Set the printed values under: Netlify → Site configuration →
// Environment variables. Then redeploy so the functions pick them up.

import crypto from 'node:crypto';
import process from 'node:process';

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node scripts/hash-staff-password.mjs "username" "your-password"');
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
  The per-IP throttle slows guessing from one address, not from many.
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
  - Changing STAFF_SESSION_SECRET signs everyone out immediately. That is the
    fastest revocation you have if the password ever gets out.
  - To change the password later, run this again and update all four.
  - Do not commit these. They belong in Netlify's environment, not the repo.
`);
