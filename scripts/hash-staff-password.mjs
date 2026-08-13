#!/usr/bin/env node
//
// Generates the three Netlify environment variables that guard the staff
// inventory page. The password itself is never stored anywhere — only a scrypt
// hash of it — so this output is safe to paste into the Netlify UI.
//
//   node scripts/hash-staff-password.mjs "the password you want"
//
// Set the printed values under: Netlify → Site configuration →
// Environment variables. Then redeploy so the functions pick them up.

import crypto from 'node:crypto';
import process from 'node:process';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-staff-password.mjs "your-password"');
  process.exit(1);
}

if (password.length < 10) {
  console.error(
    `That password is ${password.length} characters. Use at least 10 — this is the only lock on the staff page, since the page URL will leak eventually.`
  );
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
const secret = crypto.randomBytes(32).toString('hex');

console.log(`
Set these three environment variables in Netlify:

STAFF_PASSWORD_SALT
${salt}

STAFF_PASSWORD_HASH
${hash}

STAFF_SESSION_SECRET
${secret}

Notes:
  - Changing STAFF_SESSION_SECRET signs everyone out immediately. That is the
    fastest revocation you have if the password ever gets out.
  - To change the password later, run this again and update all three.
  - Do not commit these. They belong in Netlify's environment, not the repo.
`);
