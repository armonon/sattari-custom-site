import { Link } from 'react-router-dom';
import AudioAlphaSignup from '@components/AudioAlphaSignup';
import OptimizedProductImage from '@components/OptimizedProductImage';
import { SEO, StructuredData } from '../utils/seo';

/**
 * Sattari Audio Suite — the whole thing on one tab: what it is, the product
 * screenshots, the alpha builds, and the signup.
 *
 * Installers live in `public/downloads/` and are served by Netlify. Sizes and
 * SHA-256 values below come from the checked-in `.sha256` files, so update
 * them together whenever a build is replaced.
 *
 * Screenshots are `.png` with an `.avif` sibling; OptimizedProductImage picks
 * the AVIF automatically (1.9 MB -> 158 KB across the ten shots).
 */

const SHOT = '/sattari site/audio-suite';

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
    summary: 'The full suite in one macOS installer — Audio Unit, VST3 and standalone.',
    primary: {
      label: 'macOS installer',
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
      'Realtime pitch correction — restrained to hard-tuned, with a separate polyphonic path.',
    primary: {
      label: 'macOS installer',
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
    summary: 'A small standalone tester for the AutoKey detection path.',
    primary: {
      label: 'Download (.zip)',
      file: 'sattari-auto-pitch-autokey-tester-v0.6.zip',
      size: '2.3 MB',
      sha256: '25775ff2bde22e5ebfe0e806f86eec1e96aed718e0a0148da2839fe7cf5da70a',
    },
  },
];

const PRODUCTS = [
  {
    name: 'Mix',
    role: '8-slot rack',
    shot: 'mix',
    body: 'The channel strip you assemble yourself — dynamics, tone and metering in whatever order the source needs, with external sidechain through the whole rack.',
  },
  {
    name: 'Vocal',
    role: '8-slot rack',
    shot: 'vocal',
    body: 'Cleanup, gate, de-ess, EQ, compression, saturation, doubling and space — the whole finish in one window.',
  },
  {
    name: 'Create',
    role: '8-slot rack',
    shot: 'create',
    body: 'Time, space and damage: reverb, delay, shimmer, tape, risers and vocoding, tempo-locked to the host.',
  },
  {
    name: 'Stack',
    role: '4-layer instrument rack',
    shot: 'stack',
    body: 'Four layers take the same MIDI and sum in parallel — each with its own level, pan, key range and transpose, so a stack becomes a split or an octave layer.',
  },
  {
    name: 'Auto Pitch',
    role: 'Pitch correction',
    shot: 'auto-pitch',
    body: 'Monophonic correction from restrained to hard-tuned, plus a separate polyphonic path for sustained tonal instruments.',
  },
  {
    name: 'Compass',
    role: 'Session conductor',
    shot: 'brain',
    body: 'Follows key, chord, tuning, energy and onsets, then publishes one approved session context the rest can follow — no MIDI routing or duplicate setup.',
  },
];

const ANALYSIS = [
  {
    name: 'Scope',
    shot: 'scope',
    body: 'Spectrum, stereo field, correlation and session key in one surface.',
  },
  { name: 'Tuner', shot: 'tuner', body: 'Pitch, cents and confidence, without the visual noise.' },
  {
    name: 'Meter',
    shot: 'meter',
    body: 'Loudness, true peak and correlation, built for decisions.',
  },
  { name: 'Key', shot: 'song-key', body: 'The focused key detector and fallback publisher.' },
];

const FAQS = [
  {
    q: 'What do I need to run it?',
    a: 'A Mac. The builds are Universal for Apple silicon and Intel, in Audio Unit, VST3 and standalone formats.',
  },
  {
    q: 'Why does macOS say it can’t verify the developer?',
    a: 'These alpha builds are not notarized by Apple yet. Right-click (or Control-click) the installer, choose Open, then confirm. Only do that because you trust where it came from.',
  },
  {
    q: 'Does it cost anything?',
    a: 'No. The alpha is free. We’re after real sessions and honest feedback, not customers yet.',
  },
  {
    q: 'Do I need Compass for the rest to work?',
    a: 'No. Every key-aware plugin keeps its manual controls and works on its own. Compass just saves you setting the same thing in several places.',
  },
  {
    q: 'Will my sessions survive updates?',
    a: 'That’s the intent — a module keeps the same parameter names standalone or in a rack. It is still alpha though, so keep a backup of anything important.',
  },
];

function BuildCard({ build }: { build: Build }) {
  return (
    <article className="suite-build-card">
      <div className="suite-build-head">
        <p className="card-kicker">{build.version}</p>
        <h3>{build.name}</h3>
        <p className="suite-build-summary">{build.summary}</p>
      </div>

      <div className="suite-build-actions">
        <a className="button button-solid" href={`/downloads/${build.primary.file}`} download>
          {build.primary.label}
          <span className="suite-build-size">{build.primary.size}</span>
        </a>
        {build.alternate && (
          <a className="button button-outline" href={`/downloads/${build.alternate.file}`} download>
            {build.alternate.label}
            <span className="suite-build-size">{build.alternate.size}</span>
          </a>
        )}
      </div>

      <details className="suite-checksums">
        <summary>Verify this download</summary>
        <p className="suite-verify-help">
          Run <code>shasum -a 256 &lt;file&gt;</code> and compare:
        </p>
        <p className="suite-hash">
          <span className="suite-hash-label">{build.primary.file}</span>
          <code>{build.primary.sha256}</code>
        </p>
        {build.alternate && (
          <p className="suite-hash">
            <span className="suite-hash-label">{build.alternate.file}</span>
            <code>{build.alternate.sha256}</code>
          </p>
        )}
      </details>
    </article>
  );
}

export default function DownloadsPage() {
  const url = 'https://sattarimusic.com/downloads';

  return (
    <section className="section page-header-offset suite-page">
      <SEO
        title="Sattari Audio Suite — Alpha Downloads for Mac"
        description="Download the Sattari Audio Suite alpha for macOS: Mix, Vocal, Create and Stack racks, Auto Pitch and Compass. Free alpha builds with SHA-256 checksums."
        url={url}
        image="/sattari site/audio-suite/mix.png"
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Sattari Audio Suite',
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'macOS',
          softwareVersion: '0.1.0-alpha',
          description:
            'Connected Mac music products sharing one musical session context. Audio Unit, VST3 and standalone.',
          url,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          author: { '@type': 'Organization', name: 'Sattari Music' },
        }}
      />

      {/* ---------- Hero ---------- */}
      <div className="container suite-hero">
        <div className="suite-hero-copy">
          <p className="audio-alpha-badge">
            <span className="audio-alpha-dot" aria-hidden="true" />
            Free alpha &middot; macOS
          </p>
          <h1>Sattari Audio Suite</h1>
          <p className="suite-lead">
            Connected Mac music software. Compass reads the session, Auto Pitch tunes the
            performance, and the Mix, Vocal, Create and Stack racks carry the same musical context
            through to the finished track.
          </p>
          <div className="hero-actions">
            <a className="button button-solid" href="#get-it">
              Get the alpha
            </a>
            <a className="button button-outline" href="#products">
              See what&rsquo;s inside
            </a>
          </div>
          <div className="shop-trust-bar" aria-label="Highlights">
            <span className="trust-chip">Apple silicon &amp; Intel</span>
            <span className="trust-chip">AU · VST3 · Standalone</span>
            <span className="trust-chip">Free while in alpha</span>
          </div>
        </div>
        <div className="suite-hero-shot">
          <OptimizedProductImage
            src={`${SHOT}/mix.png`}
            alt="The Sattari Mix rack, showing an eight-slot signal chain with EQ controls"
            className="suite-shot-img"
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </div>
      </div>

      {/* ---------- Downloads ---------- */}
      <div className="container suite-section" id="get-it">
        <div className="section-header narrow">
          <p className="eyebrow">Downloads</p>
          <h2>Get the alpha</h2>
          <p>Current builds for macOS. Free — expect rough edges, and tell us what breaks.</p>
        </div>

        <div className="suite-build-grid">
          {BUILDS.map((build) => (
            <BuildCard build={build} key={build.primary.file} />
          ))}
        </div>

        <div className="suite-install-notice">
          <h3>Before you install</h3>
          <ul>
            <li>
              <strong>Not notarized by Apple yet.</strong> macOS will warn you the first time.
              Right-click (or Control-click) the installer, choose <strong>Open</strong>, then
              confirm — and only because you trust the source.
            </li>
            <li>
              <strong>It&rsquo;s alpha.</strong> Don&rsquo;t use it for deadline work, and keep a
              backup of any session you open with it.
            </li>
          </ul>
        </div>
      </div>

      {/* ---------- Products ---------- */}
      <div className="container suite-section" id="products">
        <div className="section-header narrow">
          <p className="eyebrow">What&rsquo;s inside</p>
          <h2>Six products, one system</h2>
          <p>Each one finishes a musical job instead of handing you a shelf of parts.</p>
        </div>

        <div className="suite-product-grid">
          {PRODUCTS.map((product) => (
            <article className="suite-product" key={product.name}>
              <div className="suite-product-shot">
                <OptimizedProductImage
                  src={`${SHOT}/${product.shot}.png`}
                  alt={`The Sattari ${product.name} interface`}
                  className="suite-shot-img"
                  loading="lazy"
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                />
              </div>
              <div className="suite-product-body">
                <p className="card-kicker">{product.role}</p>
                <h3>{product.name}</h3>
                <p>{product.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* ---------- Analysis tools ---------- */}
      <div className="container suite-section">
        <div className="section-header narrow">
          <p className="eyebrow">Also included</p>
          <h2>Read the session at a glance</h2>
        </div>
        <div className="suite-analysis-grid">
          {ANALYSIS.map((tool) => (
            <article className="suite-analysis" key={tool.name}>
              <div className="suite-analysis-shot">
                <OptimizedProductImage
                  src={`${SHOT}/${tool.shot}.png`}
                  alt={`The Sattari ${tool.name} interface`}
                  className="suite-shot-img"
                  loading="lazy"
                  sizes="(max-width: 700px) 50vw, 25vw"
                />
              </div>
              <h3>{tool.name}</h3>
              <p>{tool.body}</p>
            </article>
          ))}
        </div>
      </div>

      {/* ---------- The idea ---------- */}
      <div className="container suite-section">
        <div className="section-header narrow">
          <p className="eyebrow">The idea</p>
          <h2>Why it&rsquo;s built this way</h2>
        </div>
        <div className="card-grid three-col">
          <article className="info-card">
            <h3>One copy of every processor</h3>
            <p>
              Most suites ship the same compressor three times over. Here each processor exists
              once, and loads either as its own plugin or as a slot in a rack — identical code, so
              they can&rsquo;t drift apart.
            </p>
          </article>
          <article className="info-card">
            <h3>Build the chain, don&rsquo;t buy it</h3>
            <p>
              Pick a module per slot, reorder it, bypass it. Nothing is welded shut — the old
              fixed-order plugins are presets now, and the order is yours.
            </p>
          </article>
          <article className="info-card">
            <h3>Your sessions survive</h3>
            <p>
              A module keeps the same parameter names standalone or inside a rack, so projects saved
              before the racks existed still open as you left them.
            </p>
          </article>
        </div>
      </div>

      {/* ---------- FAQ ---------- */}
      <div className="container suite-section">
        <div className="section-header narrow">
          <p className="eyebrow">Questions</p>
          <h2>Good to know</h2>
        </div>
        <div className="faq-list">
          {FAQS.map((faq) => (
            <details className="faq-item" key={faq.q}>
              <summary className="faq-question">{faq.q}</summary>
              <p className="faq-answer">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* ---------- Signup ---------- */}
      <div className="container suite-section">
        <div className="section-header narrow">
          <p className="eyebrow">Stay in the loop</p>
          <h2>Told when new builds land</h2>
          <p>
            Tell us what you work in and we&rsquo;ll email you as builds go out — or if you need one
            for a setup that isn&rsquo;t covered yet.
          </p>
        </div>
        <AudioAlphaSignup />
      </div>

      <div className="container shop-back-link-row">
        <Link to="/" className="btn-details">
          Back to Sattari Music
        </Link>
      </div>
    </section>
  );
}
