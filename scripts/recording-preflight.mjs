import { statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function recordingBudget({
  seconds,
  sampleRate = 48000,
  channels = 12,
  copies = 3, // capture + recovery working copy + export, float PCM worst case
  reserveBytes = 5 * 1024 ** 3,
}) {
  for (const [key, value] of Object.entries({ seconds, sampleRate, channels, copies }))
    if (!Number.isFinite(value) || value <= 0) throw Error(`Invalid recording budget: ${key}`);
  if (!Number.isFinite(reserveBytes) || reserveBytes < 0)
    throw Error('Invalid recording budget: reserveBytes');
  const recordingBytes = Math.ceil(seconds * sampleRate * channels * 4 * copies);
  const requiredBytes = recordingBytes + reserveBytes;
  if (!Number.isSafeInteger(requiredBytes)) throw Error('Recording budget exceeds safe capacity.');
  return { seconds, sampleRate, channels, copies, recordingBytes, reserveBytes, requiredBytes };
}

export async function recordingPreflight(path, options, inspect = statfs) {
  const budget = recordingBudget(options);
  const fs = await inspect(resolve(path));
  const availableBytes = Number(fs.bavail) * Number(fs.bsize);
  if (!Number.isFinite(availableBytes) || availableBytes < 0)
    throw Error('Cannot establish available recording storage.');
  return {
    ...budget,
    path: resolve(path),
    availableBytes,
    pass: availableBytes >= budget.requiredBytes,
    note: 'OS capacity check, not a browser quota reservation. Recheck browser quota and target volume before physical recording.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const minutesIndex = process.argv.indexOf('--minutes');
  const channelsIndex = process.argv.indexOf('--channels');
  const report = await recordingPreflight(process.argv[2] || '.', {
    seconds: Number(minutesIndex >= 0 ? process.argv[minutesIndex + 1] : 30) * 60,
    channels: Number(channelsIndex >= 0 ? process.argv[channelsIndex + 1] : 12),
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
}
