import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
describe('Apple distribution contracts (not device qualification)', () => {
  it('uses a studio-scoped standalone manifest with valid icon assets', () => {
    const manifest = JSON.parse(read('public/studio.webmanifest'));
    expect(manifest.id).toBe('/studio');
    expect(manifest.scope).toBe('/studio');
    expect(manifest.start_url).toBe('/studio?installed=1');
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) {
      expect(existsSync(resolve(root, 'public', icon.src.slice(1)))).toBe(true);
      const png = readFileSync(resolve(root, 'public', icon.src.slice(1)));
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    }
  });
  it('does not promise native iOS downloads or offline/background audio', () => {
    const guide = read('public/studio-install.html').replace(/\s+/g, ' ');
    expect(guide).toContain('no public TestFlight build');
    expect(guide).toContain('Internet is required');
    expect(guide).toContain('No background-recording guarantee');
    expect(guide).toContain('not automatically synced');
    expect(guide).not.toContain('.ipa');
  });
  it('targets both mobile device families and keeps microphone purpose text', () => {
    expect(read('packaging/apple/StemDeck.xcodeproj/project.pbxproj')).toContain(
      'TARGETED_DEVICE_FAMILY = "1,2"'
    );
    for (const platform of ['Mobile', 'Mac']) {
      const plist = read(`packaging/apple/${platform}-Info.plist`);
      expect(plist).toContain('NSMicrophoneUsageDescription');
      expect(plist).not.toContain('NSAllowsArbitraryLoads');
    }
    expect(read('packaging/apple/Mobile-Info.plist')).not.toContain('UIBackgroundModes');
  });
  it('keeps native navigation HTTPS-bound and does not grant microphone silently', () => {
    const source = read('packaging/apple/StemDeckApp.swift');
    expect(source).toContain('url?.scheme == "https"');
    expect(source).toContain('url?.host == "sattarimusic.com"');
    expect(source).toContain('type == .microphone ? .prompt : .deny');
    expect(source).not.toContain('.grant');
    expect(source).not.toContain('WKScriptMessageHandler');
  });
});
