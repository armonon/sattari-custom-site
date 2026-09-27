import crypto from 'node:crypto';
import process from 'node:process';

// A plain SHA-256 of an address is not anonymous: all of IPv4 can be hashed in
// minutes and matched back. Keying the hash with a server-side secret keeps it
// usable for rate limiting while making it useless to anyone who reads the
// stored records.
export function ipHashSecret() {
  return process.env.IP_HASH_SECRET || process.env.STAFF_SESSION_SECRET || '';
}

export function hashIp(ip) {
  const secret = ipHashSecret();
  // Refuse rather than fall back to an unkeyed hash, which is the very thing
  // this module exists to avoid.
  if (!secret) throw new Error('IP_HASH_SECRET (or STAFF_SESSION_SECRET) is not configured.');
  return crypto
    .createHmac('sha256', secret)
    .update(String(ip || 'unknown'))
    .digest('hex');
}
