import { SEO, StructuredData } from '../utils/seo';

const autoPitchRealtime = {
  name: 'Sattari Auto Pitch realtime alpha v0.2.0',
  filename: 'sattari-auto-pitch-realtime-alpha-v0.2.0-mac-installer.pkg',
  href: '/downloads/sattari-auto-pitch-realtime-alpha-v0.2.0-mac-installer.pkg',
  archiveHref: '/downloads/auto-pitch-realtime-alpha-v0.2.0.tar.gz',
  checksumHref: '/downloads/sattari-auto-pitch-realtime-alpha-v0.2.0.sha256',
  size: '8.8 MB',
  sha256: '74b6cab68dfaea0a1dcf6f3b27051fde54bfb1ca249cc43a4de34a1d29eb32c6',
  updated: 'June 2, 2026',
};

const macInstaller = {
  name: 'Sattari Audio Plugin Suite Mac installer alpha v0.1.0',
  filename: 'sattari-audio-plugin-suite-alpha-v0.1.0-mac-installer.pkg',
  href: '/downloads/sattari-audio-plugin-suite-alpha-v0.1.0-mac-installer.pkg',
  checksumHref: '/downloads/sattari-audio-plugin-suite-alpha-v0.1.0-mac-installer.pkg.sha256',
  size: '26 MB',
  sha256: 'a5fb20742934d68cc45d542e0587c860be3a8c47bcb454c4fb0975b9ee9ab195',
  updated: 'June 2, 2026',
};

const suiteArchive = {
  name: 'Sattari Audio Plugin Suite archive alpha v0.1.0',
  filename: 'sattari-audio-plugin-suite-alpha-v0.1.0.tar.gz',
  href: '/downloads/sattari-audio-plugin-suite-alpha-v0.1.0.tar.gz',
  checksumHref: '/downloads/sattari-audio-plugin-suite-alpha-v0.1.0.sha256',
  size: '26 MB',
  sha256: '914063e32b8a1233ad320fb6f5bc1fed928de865a7ac1a7729cfd672b7bc5f08',
  updated: 'May 28, 2026',
};

const autoPitchTester = {
  name: 'Sattari Auto Pitch / AutoKey offline tester v0.6',
  filename: 'sattari-auto-pitch-autokey-tester-v0.6.zip',
  href: '/downloads/sattari-auto-pitch-autokey-tester-v0.6.zip',
  checksumHref: '/downloads/sattari-auto-pitch-autokey-tester-v0.6.zip.sha256',
  size: '2.3 MB',
  sha256: '25775ff2bde22e5ebfe0e806f86eec1e96aed718e0a0148da2839fe7cf5da70a',
  updated: 'June 2, 2026',
};

const includedPlugins = [
  'Sattari Auto Pitch — AU, VST3, Standalone',
  'Sattari StemDeck — VST3, Standalone',
  'Sattari Arp — AU, VST3',
  'Sub Conjurer — AU, VST3, Standalone',
  'Side Chain Master — AU, VST3, Standalone',
  'Sattari Royal Chain — AU, VST3, Standalone',
];

export default function DownloadsPage() {
  return (
    <section className="section page-header-offset downloads-shell">
      <SEO
        title="Sattari Downloads"
        description="Download the current Sattari Audio Plugin Suite alpha validation package."
        url="https://sattarimusic.com/downloads"
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: autoPitchRealtime.name,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'macOS',
          downloadUrl: `https://sattarimusic.com${autoPitchRealtime.href}`,
          softwareVersion: '0.2.0-alpha',
          publisher: {
            '@type': 'Organization',
            name: 'Sattari Music',
            url: 'https://sattarimusic.com',
          },
        }}
      />

      <div className="container downloads-hero">
        <div className="downloads-copy">
          <p className="eyebrow">Sattari Downloads</p>
          <h1>Get the latest Auto Pitch build.</h1>
          <p>
            This downloader hosts the current internal alpha downloads: the new realtime Auto Pitch
            Mac installer, the broader Sattari suite archive, and the offline Auto Pitch / AutoKey
            tester kit for WAV experiments.
          </p>
          <div className="hero-actions downloads-actions">
            <a className="button button-solid" href={autoPitchRealtime.href} download>
              Download realtime Auto Pitch
            </a>
            <a className="button button-outline" href={macInstaller.href} download>
              Download full suite
            </a>
          </div>
        </div>

        <aside className="download-card" aria-label="Download details">
          <span className="download-pill">Internal alpha</span>
          <h2>{autoPitchRealtime.name}</h2>
          <dl className="download-meta">
            <div>
              <dt>File</dt>
              <dd>{autoPitchRealtime.filename}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{autoPitchRealtime.size}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{autoPitchRealtime.updated}</dd>
            </div>
          </dl>
          <div className="checksum-box">
            <span>SHA-256</span>
            <code>{autoPitchRealtime.sha256}</code>
          </div>
          <a className="download-link" href={autoPitchRealtime.checksumHref} download>
            Download Auto Pitch checksum
          </a>
        </aside>
      </div>

      <div className="container downloads-grid">
        <article className="info-card downloads-info-card">
          <p className="card-kicker">Included</p>
          <h2>Six plugin lanes in one archive.</h2>
          <ul className="download-list">
            {includedPlugins.map((plugin) => (
              <li key={plugin}>{plugin}</li>
            ))}
          </ul>
        </article>

        <article className="info-card downloads-info-card">
          <p className="card-kicker">Install</p>
          <h2>Mac installer flow.</h2>
          <ol className="download-list ordered">
            <li>Download the Mac installer package.</li>
            <li>Open the package and approve the macOS install prompts.</li>
            <li>Rescan plugins in Logic, Ableton, FL, or your target DAW.</li>
          </ol>
          <a className="download-link" href={suiteArchive.href} download>
            Download manual archive instead
          </a>
        </article>
      </div>

      <div className="container downloads-grid">
        <article className="info-card downloads-info-card">
          <p className="card-kicker">Auto Pitch realtime</p>
          <h2>Realtime tuner alpha.</h2>
          <p>
            Use this first if you want to test Auto Pitch in a DAW. It includes AU, VST3, and a
            standalone app with live pitch detection, scale snapping, and bundled Rubber Band
            realtime pitch shifting.
          </p>
          <a className="download-link" href={autoPitchRealtime.archiveHref} download>
            Download manual Auto Pitch archive
          </a>
        </article>

        <article className="info-card downloads-info-card">
          <p className="card-kicker">Checksums</p>
          <h2>Verify downloads.</h2>
          <ul className="download-list">
            <li>
              <a href={suiteArchive.checksumHref} download>
                Suite archive SHA-256
              </a>
            </li>
            <li>
              <a href={autoPitchRealtime.checksumHref} download>
                Realtime Auto Pitch SHA-256
              </a>
            </li>
            <li>
              <a href={autoPitchTester.checksumHref} download>
                Auto Pitch tester SHA-256
              </a>
            </li>
          </ul>
        </article>
      </div>

      <div className="container downloads-warning">
        <strong>Release gate:</strong> This is an internal alpha validation package, not a
        sale-ready public release. Before any beta/public claim, each plugin still needs DAW open
        tests, real-session listening, crash/CPU checks, install/uninstall checks, preset UX review,
        and honest limitation notes.
      </div>
    </section>
  );
}
