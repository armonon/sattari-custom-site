import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Hash exactly the shipped tree, not a second build. Exclude only the root
// manifest which contains this digest. Symlinks must not pull in host files.
export async function artifactIdentity(directory) {
  const root = resolve(directory),
    files = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = resolve(path, entry.name);
      if (entry.isSymbolicLink()) throw Error(`Release artifact contains a symlink: ${target}`);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile() && target !== resolve(root, 'release-manifest.json'))
        files.push(target);
      else if (!entry.isFile()) throw Error(`Unsupported artifact entry: ${target}`);
    }
  }
  await walk(root);
  if (!files.length) throw Error('Release artifact is empty.');
  const hash = createHash('sha256');
  let bytes = 0;
  for (const file of files.sort()) {
    const size = (await stat(file)).size;
    hash.update(relative(root, file).split(sep).join('/') + '\0' + size + '\0');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    bytes += size;
  }
  return {
    algorithm: 'sha256-path-size-content-v1',
    sha256: hash.digest('hex'),
    files: files.length,
    bytes,
  };
}

export async function verifyArtifact(directory, { commit, requireApproval = false } = {}) {
  const manifest = JSON.parse(await readFile(resolve(directory, 'release-manifest.json'), 'utf8'));
  if (manifest.softwarePassed !== true || manifest.unchanged !== true)
    throw Error('Artifact has no passing unchanged-source gate.');
  if (commit && manifest.commit !== commit)
    throw Error('Artifact commit does not match the checked-out release.');
  if (requireApproval && manifest.releaseApproved !== true)
    throw Error('Full release is not approved; external qualification gates remain.');
  const actual = await artifactIdentity(directory);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.artifact))
    throw Error('Artifact bytes differ from the qualified build.');
  return actual;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyArtifact(process.argv[2] || 'dist', {
    commit: process.env.GITHUB_SHA,
    requireApproval: process.argv.includes('--require-release-approval'),
  });
  console.log(JSON.stringify(result));
}
