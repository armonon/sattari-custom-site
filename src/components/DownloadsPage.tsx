import { SEO, StructuredData } from '../utils/seo';

const suiteArchive = {
  name: 'Sattari Audio Plugin Suite alpha v0.1.0',
  filename: 'sattari-audio-plugin-suite-alpha-v0.1.0.tar.gz',
  href: '/downloads/sattari-audio-plugin-suite-alpha-v0.1.0.tar.gz',
  checksumHref: '/downloads/sattari-audio-plugin-suite-alpha-v0.1.0.sha256',
  size: '26 MB',
  sha256: '914063e32b8a1233ad320fb6f5bc1fed928de865a7ac1a7729cfd672b7bc5f08',
  updated: 'May 28, 2026',
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
          name: suiteArchive.name,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'macOS',
          downloadUrl: `https://sattarimusic.com${suiteArchive.href}`,
          softwareVersion: '0.1.0-alpha',
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
          <h1>Get the latest plugin suite build.</h1>
          <p>
            This downloader hosts the current Sattari Audio Plugin Suite alpha validation package:
            one archive with AU/VST3 plugin builds, standalone apps where available, source snapshots,
            install helpers, and validation helpers.
          </p>
          <div className="hero-actions downloads-actions">
            <a className="button button-solid" href={suiteArchive.href} download>
              Download suite alpha
            </a>
            <a className="button button-outline" href={suiteArchive.checksumHref} download>
              Download SHA-256
            </a>
          </div>
        </div>

        <aside className="download-card" aria-label="Download details">
          <span className="download-pill">Internal alpha</span>
          <h2>{suiteArchive.name}</h2>
          <dl className="download-meta">
            <div>
              <dt>File</dt>
              <dd>{suiteArchive.filename}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{suiteArchive.size}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{suiteArchive.updated}</dd>
            </div>
          </dl>
          <div className="checksum-box">
            <span>SHA-256</span>
            <code>{suiteArchive.sha256}</code>
          </div>
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
          <h2>Local validation flow.</h2>
          <ol className="download-list ordered">
            <li>Download and unzip the archive.</li>
            <li>
              Run <code>./scripts/install_suite_user_plugins.sh</code> from the extracted folder.
            </li>
            <li>
              Run <code>./scripts/validate_suite_local.sh</code> to check installed plugin bundles.
            </li>
          </ol>
        </article>
      </div>

      <div className="container downloads-warning">
        <strong>Release gate:</strong> This is an internal alpha validation package, not a sale-ready
        public release. Before any beta/public claim, each plugin still needs DAW open tests,
        real-session listening, crash/CPU checks, install/uninstall checks, preset UX review, and
        honest limitation notes.
      </div>
    </section>
  );
}
