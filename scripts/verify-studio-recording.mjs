// Strict artifact gate: validate the downloaded file, not the recorder's toast.
// Usage: node scripts/verify-studio-recording.mjs /absolute/path/to/take.m4a
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed: ${result.error?.message || result.stderr}`);
  return result;
}

try {
  if (process.argv.length !== 3)
    throw new Error('Usage: node scripts/verify-studio-recording.mjs <take>');
  const file = resolve(process.argv[2]);
  const info = JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size:stream=codec_name,sample_rate,channels',
      '-of',
      'json',
      file,
    ]).stdout
  );
  if (
    !info.streams?.some((stream) => stream.channels > 0 && Number(stream.sample_rate) > 0) ||
    !(Number(info.format?.duration) > 0)
  )
    throw new Error('No timed audio stream found');
  const decoded = run('ffmpeg', [
    '-hide_banner',
    '-nostdin',
    '-xerror',
    '-i',
    file,
    '-map',
    '0:a:0',
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]);
  const peak = Number(decoded.stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1]);
  if (!Number.isFinite(peak) || peak <= -90)
    throw new Error('Recording is silent or below the -90 dBFS QA floor');
  console.log(JSON.stringify({ status: 'PASS', file, ...info, peakDbFS: peak }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
