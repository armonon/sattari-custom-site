import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(process.env.STEMDECK_APP_OUTPUT || join(root, '.local-data/apple-build'));
const mode = process.argv[2] || 'mac';
if (!['mac', 'ios-check'].includes(mode)) throw new Error('Use mac or ios-check');
const env = {
  ...process.env,
  DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer',
};
const run = (exe, args) => execFileSync(exe, args, { cwd: root, env, stdio: 'inherit' });
const native = join(root, 'packaging/apple');
mkdirSync(output, { recursive: true });
if (mode === 'ios-check') {
  run('/usr/bin/xcodebuild', [
    '-jobs',
    '2',
    '-project',
    join(native, 'StemDeck.xcodeproj'),
    '-scheme',
    'StemDeckMobile',
    '-configuration',
    'Release',
    '-sdk',
    'iphoneos',
    '-destination',
    'generic/platform=iOS',
    '-derivedDataPath',
    join(output, 'ios-derived'),
    'CODE_SIGNING_ALLOWED=NO',
    'build',
  ]);
  console.log(
    'Unsigned iPhone/iPad compile check only. Not an installable IPA or TestFlight release.'
  );
} else {
  // Refuse to overwrite a previous package/evidence directory.
  const app = join(output, 'STEMDECK Web.app');
  if (existsSync(app))
    throw new Error('Output already contains an app. Select a fresh STEMDECK_APP_OUTPUT.');
  const bin = join(app, 'Contents/MacOS');
  const resources = join(app, 'Contents/Resources');
  mkdirSync(bin, { recursive: true });
  mkdirSync(resources, { recursive: true });
  const sdk = execFileSync('/usr/bin/xcrun', ['--sdk', 'macosx', '--show-sdk-path'], {
    env,
    encoding: 'utf8',
  }).trim();
  for (const arch of ['arm64', 'x86_64']) {
    run('/usr/bin/xcrun', [
      'swiftc',
      '-parse-as-library',
      '-O',
      '-sdk',
      sdk,
      '-target',
      `${arch}-apple-macos13.0`,
      '-module-cache-path',
      join(output, 'module-cache'),
      join(native, 'StemDeckApp.swift'),
      '-o',
      join(output, `StemDeckWeb-${arch}`),
    ]);
  }
  run('/usr/bin/lipo', [
    '-create',
    join(output, 'StemDeckWeb-arm64'),
    join(output, 'StemDeckWeb-x86_64'),
    '-output',
    join(bin, 'StemDeckWeb'),
  ]);
  copyFileSync(join(native, 'Mac-Info.plist'), join(app, 'Contents/Info.plist'));
  const icons = join(output, 'StemDeck.iconset');
  mkdirSync(icons);
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      run('/usr/bin/sips', [
        '-z',
        String(size * scale),
        String(size * scale),
        join(native, 'Icon.png'),
        '--out',
        join(icons, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`),
      ]);
    }
  }
  run('/usr/bin/iconutil', ['-c', 'icns', icons, '-o', join(resources, 'StemDeck.icns')]);
  const identity = process.env.STEMDECK_SIGN_IDENTITY;
  const signing = identity
    ? ['--options', 'runtime', '--timestamp', '--entitlements', join(native, 'Mac.entitlements')]
    : [];
  run('/usr/bin/codesign', ['--force', '--sign', identity || '-', ...signing, app]);
  run('/usr/bin/codesign', ['--verify', '--strict', '--verbose=2', app]);
  const zip = join(output, 'STEMDECK-Web-0.1.0-mac-universal.zip');
  run('/usr/bin/ditto', ['-c', '-k', '--keepParent', app, zip]);
  const report = {
    version: '0.1.0',
    edition: 'hosted-web-engine',
    url: 'https://sattarimusic.com/studio',
    architectures: ['arm64', 'x86_64'],
    signed: Boolean(identity),
    notarized: false,
    runtimeValidated: false,
    sha256: createHash('sha256').update(readFileSync(zip)).digest('hex'),
  };
  writeFileSync(join(output, 'package-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Created ${zip}. Not notarized; do not publish as release-ready.`);
}
