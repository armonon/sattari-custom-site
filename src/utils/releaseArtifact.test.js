import { afterEach, expect, it } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { artifactIdentity, verifyArtifact } from '../../scripts/release-artifact.mjs';

const directories = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'stemdeck-artifact-test-'));
  directories.push(root);
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<html>qualified build</html>');
  await writeFile(join(root, 'assets', 'studio.js'), 'export const version = 1;');
  const manifest = {
    softwarePassed: true,
    unchanged: true,
    releaseApproved: false,
    commit: 'tested-commit',
    artifact: await artifactIdentity(root),
  };
  await writeFile(join(root, 'release-manifest.json'), JSON.stringify(manifest));
  return { root, manifest };
}
it('verifies the tested bytes and commit without mistaking software checks for release approval', async () => {
  const { root, manifest } = await fixture();
  expect(await verifyArtifact(root, { commit: 'tested-commit' })).toEqual(manifest.artifact);
  await expect(verifyArtifact(root, { commit: 'other' })).rejects.toThrow('commit');
  await expect(verifyArtifact(root, { requireApproval: true })).rejects.toThrow('not approved');
});
it.each(['modified', 'added', 'removed'])(
  'rejects %s content after qualification',
  async (kind) => {
    const { root } = await fixture();
    if (kind === 'modified') await writeFile(join(root, 'index.html'), 'changed');
    if (kind === 'added') await writeFile(join(root, 'unexpected.js'), 'unqualified');
    if (kind === 'removed') await rm(join(root, 'assets', 'studio.js'));
    await expect(verifyArtifact(root)).rejects.toThrow('bytes differ');
  }
);
it('rejects symlinks and failed evidence', async () => {
  const { root, manifest } = await fixture();
  await symlink(join(root, 'index.html'), join(root, 'linked.html'));
  await expect(artifactIdentity(root)).rejects.toThrow('symlink');
  await writeFile(
    join(root, 'release-manifest.json'),
    JSON.stringify({ ...manifest, softwarePassed: false })
  );
  await expect(verifyArtifact(root)).rejects.toThrow('no passing');
});
