import { Link } from 'react-router-dom';
import { SEO } from '../utils/seo';

/**
 * Sattari Audio Suite — alpha downloads.
 *
 * The installers already live in `public/downloads/` and are served by
 * Netlify; until now nothing on the site linked to them. Sizes and SHA-256
 * values below are read from the checked-in `.sha256` files, so they should be
 * updated together whenever a build is replaced.
 */

interface Build {
  name: string;
  version: string;
  summary: string;
  primary: { label: string; file: string; size: string; sha256: string };
  alternate?: { label: string; file: string; size: string; sha256: string };
}

const BUILDS: Build[] = [
  {
    name: 'Sattari Audio Plugin Suite',
    version: 'alpha v0.1.0',
    summary:
      'The full plugin suite as a single macOS installer — Audio Unit, VST3 and standalone builds.',
    primary: {
      label: 'macOS installer (.pkg)',
      file: 'sattari-audio-plugin-suite-alpha-v0.1.0-mac-installer.pkg',
      size: '25.9 MB',
      sha256: 'a5fb20742934d68cc45d542e0587c860be3a8c47bcb454c4fb0975b9ee9ab195',
    },
    alternate: {
      label: 'Archive (.tar.gz)',
      file: 'sattari-audio-plugin-suite-alpha-v0.1.0.tar.gz',
      size: '26.1 MB',
      sha256: '914063e32b8a1233ad320fb6f5bc1fed928de865a7ac1a7729cfd672b7bc5f08',
    },
  },
  {
    name: 'Sattari Auto Pitch (Realtime)',
    version: 'alpha v0.2.0',
    summary:
      'Realtime pitch correction — monophonic correction from restrained to hard-tuned, with a separate polyphonic path.',
    primary: {
      label: 'macOS installer (.pkg)',
      file: 'sattari-auto-pitch-realtime-alpha-v0.2.0-mac-installer.pkg',
      size: '8.8 MB',
      sha256: '74b6cab68dfaea0a1dcf6f3b27051fde54bfb1ca249cc43a4de34a1d29eb32c6',
    },
    alternate: {
      label: 'Archive (.tar.gz)',
      file: 'auto-pitch-realtime-alpha-v0.2.0.tar.gz',
      size: '8.8 MB',
      sha256: '5a91f53c5ac31cdb30cb8b4dc3fa38053cca9221888b746c7a7171e9ddf0eaa1',
    },
  },
  {
    name: 'Auto Pitch AutoKey Tester',
    version: 'v0.6',
    summary:
      'A small standalone tester for the AutoKey detection path — useful for checking key tracking against your own material.',
    primary: {
      label: 'Download (.zip)',
      file: 'sattari-auto-pitch-autokey-tester-v0.6.zip',
      size: '2.3 MB',
      sha256: '25775ff2bde22e5ebfe0e806f86eec1e96aed718e0a0148da2839fe7cf5da70a',
    },
  },
];

function BuildCard({ build }: { build: Build }) {
  return (
    <article className="info-card download-card">
      <p className="card-kicker">{build.version}</p>
      <h3>{build.name}</h3>
      <p>{build.summary}</p>

      <div className="download-actions">
        <a className="button button-solid" href={`/downloads/${build.primary.file}`} download>
          {build.primary.label}
          <span className="download-size"> · {build.primary.size}</span>
        </a>
        {build.alternate && (
          <a className="button button-outline" href={`/downloads/${build.alternate.file}`} download>
            {build.alternate.label}
            <span className="download-size"> · {build.alternate.size}</span>
          </a>
        )}
      </div>

      <details className="download-checksums">
        <summary>Verify this download (SHA-256)</summary>
        <p className="download-verify-help">
          In Terminal, run <code>shasum -a 256 &lt;file&gt;</code> and compare:
        </p>
        <p className="download-hash">
          <span className="download-hash-label">{build.primary.file}</span>
          <code>{build.primary.sha256}</code>
        </p>
        {build.alternate && (
          <p className="download-hash">
            <span className="download-hash-label">{build.alternate.file}</span>
            <code>{build.alternate.sha256}</code>
          </p>
        )}
      </details>
    </article>
  );
}

export default function DownloadsPage() {
  return (
    <section className="section page-header-offset">
      <SEO
        title="Sattari Audio Suite — Alpha Downloads"
        description="Download the current Sattari Audio Suite alpha builds for macOS: the plugin suite installer, Auto Pitch realtime, and the AutoKey tester, with SHA-256 checksums."
        url="https://sattarimusic.com/downloads"
      />

      <div className="container section-header narrow downloads-header">
        <p className="eyebrow">Sattari Audio Suite</p>
        <p className="audio-alpha-badge">
          <span className="audio-alpha-dot" aria-hidden="true" />
          Alpha builds &middot; macOS
        </p>
        <h1>Downloads</h1>
        <p>
          Current alpha builds of the Sattari Audio Suite. These are early releases — expect rough
          edges, and please tell us what breaks.
        </p>
      </div>

      <div className="container audio-alpha-callout downloads-notice">
        <h2>Before you install</h2>
        <ul>
          <li>
            <strong>macOS only</strong> — these are Mac builds (Audio Unit, VST3 and standalone).
          </li>
          <li>
            <strong>Not yet notarized by Apple.</strong> macOS will likely warn you the first time.
            To open anyway: right-click (or Control-click) the installer, choose{' '}
            <strong>Open</strong>, then confirm. Only do this because you trust the source.
          </li>
          <li>
            <strong>Alpha software.</strong> Don&rsquo;t rely on it for paid or deadline work, and
            keep a backup of any session you open with it.
          </li>
        </ul>
      </div>

      <div className="container downloads-grid">
        {BUILDS.map((build) => (
          <BuildCard build={build} key={build.primary.file} />
        ))}
      </div>

      <div className="container downloads-footer">
        <p>
          Something not working, or want a build for a setup that isn&rsquo;t covered?{' '}
          <Link to="/audio-suite#alpha-signup">Get in touch through the alpha signup</Link> and
          we&rsquo;ll follow up.
        </p>
        <Link to="/audio-suite" className="btn-details">
          Back to the Audio Suite
        </Link>
      </div>
    </section>
  );
}
