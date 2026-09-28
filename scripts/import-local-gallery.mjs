import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(
  await readFile(path.join(root, 'docs/local-gallery-sources.json'), 'utf8')
);
const directory = path.join(root, 'public/images/local-gallery');
await mkdir(directory, { recursive: true });
const media = [];

for (const [index, source] of sources.entries()) {
  const id = `owner-${String(index + 1).padStart(2, '0')}`;
  const video = source.endsWith('=m18');
  const name = `${id}.${video ? 'mp4' : 'webp'}`;
  const file = path.join(directory, name);
  try {
    await access(file);
  } catch {
    const response = await fetch(`https://lh3.googleusercontent.com/gps-cs-s/${source}`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.startsWith(video ? 'video/' : 'image/')) throw new Error(`${id}: unexpected ${type}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height:format=duration',
        '-of',
        'json',
        file,
      ],
      { encoding: 'utf8' }
    )
  );
  const { width, height } = probe.streams[0];
  const poster = video ? `${id}-poster.jpg` : name;
  if (video)
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-ss',
      '1',
      '-i',
      file,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      path.join(directory, poster),
    ]);
  const thumbnail = `${id}-thumb.jpg`;
  execFileSync('ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    path.join(directory, poster),
    '-frames:v',
    '1',
    '-vf',
    'scale=160:120:force_original_aspect_ratio=decrease,pad=160:120:(ow-iw)/2:(oh-ih)/2:color=0x141616',
    '-q:v',
    '5',
    path.join(directory, thumbnail),
  ]);
  media.push({
    id,
    src: `/images/local-gallery/${name}`,
    video,
    width,
    height,
    ...(video
      ? { poster: `/images/local-gallery/${poster}`, duration: Number(probe.format.duration) }
      : {}),
    thumbnail: `/images/local-gallery/${thumbnail}`,
  });
  console.log(`${index + 1}/${sources.length}: ${name} (${width}x${height})`);
}
await writeFile(
  path.join(root, 'src/data/localGalleryMedia.json'),
  `${JSON.stringify(media, null, 2)}\n`
);
