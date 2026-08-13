import { Link } from 'react-router-dom';
import AudioAlphaSignup from '@components/AudioAlphaSignup';
import { SEO, StructuredData } from '../utils/seo';

/**
 * Sattari Audio Suite — Mac music software, currently in private alpha.
 *
 * Rebuilt from the standalone sattari-audio-suite site into this site's
 * design system (tokens + existing section/card classes) so it themes with
 * day/night and reads as part of sattarimusic.com rather than a bolt-on.
 */

const PRODUCTS = [
  {
    name: 'Compass',
    role: 'Session conductor',
    body: 'Follows key, chord, tuning, energy and musical onsets, then publishes one approved session context the other products can follow — no MIDI routing or duplicate setup.',
  },
  {
    name: 'Auto Pitch',
    role: 'Pitch correction',
    body: 'Realtime monophonic correction from restrained to hard-tuned, plus a separate polyphonic path for sustained tonal instruments and well-separated chords.',
  },
  {
    name: 'Vocal',
    role: '8-slot rack',
    body: 'Build the finish in one window: cleanup, gate, de-ess, EQ, compression, saturation, doubling and space — every slot reorderable and bypassable.',
  },
  {
    name: 'Mix',
    role: '8-slot rack',
    body: 'The channel strip you assemble yourself — dynamics, tone and metering in whatever order the source actually needs, with external sidechain through the whole rack.',
  },
  {
    name: 'Create',
    role: '8-slot rack',
    body: 'Time, space and damage: reverb, delay, shimmer, tape, risers and vocoding in one rack, tempo-locked to the host.',
  },
  {
    name: 'Stack',
    role: '4-layer instrument rack',
    body: 'Four layers receive the same MIDI and sum in parallel — each with its own level, pan, key range and transpose, so a stack can become a split or an octave layer.',
  },
];

const IDEAS = [
  {
    title: 'One copy of every processor',
    body: 'Most suites ship the same compressor three times over. Here each processor exists once as a module, and loads either as its own plugin or as a slot in a rack — identical code, so they cannot drift apart.',
  },
  {
    title: 'Build the chain, don’t buy it',
    body: 'Pick a module per slot, reorder it, bypass it. Nothing is welded shut. Fixed-order plugins became presets instead, so the starting point stays and the order is yours.',
  },
  {
    title: 'Your sessions survive',
    body: 'A module keeps the same parameter names whether it runs standalone or inside a rack, so projects saved before the racks existed still open exactly as you left them.',
  },
];

const FAQS = [
  {
    q: 'Can I download it today?',
    a: 'Yes — early alpha builds for macOS are on the Downloads page, including the plugin suite installer and Auto Pitch. They are not yet notarized by Apple, so macOS will warn you on first open. Sign up below if you would like to be told when newer builds land.',
  },
  {
    q: 'What do I need to run it?',
    a: 'A Mac — the builds are Universal for Apple silicon and Intel, in Audio Unit, VST3 and standalone formats.',
  },
  {
    q: 'Does it cost anything to join the alpha?',
    a: 'No. Alpha access is free. We’re looking for real sessions and honest feedback, not customers yet.',
  },
  {
    q: 'Do I need Compass for the rest to work?',
    a: 'No. Every key-aware plugin keeps its manual controls and works independently. Compass is the session publisher that saves you setting the same thing in several places.',
  },
];

export default function AudioSuitePage() {
  const url = 'https://sattarimusic.com/audio-suite';

  return (
    <section className="section page-header-offset audio-suite-shell">
      <SEO
        title="Sattari Audio Suite — Mac Music Software (Alpha)"
        description="Six connected Mac music products — Compass, Auto Pitch, Vocal, Mix, Create and Stack — sharing one musical session context. Currently in private alpha; request an invite."
        url={url}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Sattari Audio Suite',
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'macOS',
          description:
            'Six connected Mac music products sharing one musical session context. Audio Unit, VST3 and standalone formats.',
          url,
          softwareVersion: '0.2.0-alpha',
          author: { '@type': 'Organization', name: 'Sattari Music' },
        }}
      />

      <div className="container audio-suite-hero">
        <p className="eyebrow">Sattari Audio Suite</p>
        <p className="audio-alpha-badge">
          <span className="audio-alpha-dot" aria-hidden="true" />
          Alpha &middot; early builds, expect rough edges
        </p>
        <h1>Six products. One musical system.</h1>
        <p className="hero-copy audio-suite-lead">
          Compass understands the session. Auto Pitch tunes the performance. Vocal, Mix, Create and
          Stack carry the same musical context through to the finished track.
        </p>
        <div className="hero-actions">
          <Link className="button button-solid" to="/downloads">
            Download the alpha
          </Link>
          <a className="button button-outline" href="#alpha-signup">
            Get build announcements
          </a>
        </div>
        <div className="shop-trust-bar" aria-label="Audio Suite highlights">
          <span className="trust-chip">macOS · Apple silicon &amp; Intel</span>
          <span className="trust-chip">AU · VST3 · Standalone</span>
          <span className="trust-chip">v0.2.0 alpha</span>
        </div>
      </div>

      <div className="container audio-alpha-callout">
        <h2>What &ldquo;alpha&rdquo; means here</h2>
        <p>
          This is unreleased software under active development. It is not on sale, it is not yet
          notarized by Apple, and things will change between builds — that is the point of this
          stage. Don&rsquo;t rely on it for deadline work.
        </p>
        <p>
          Early macOS builds are on the <Link to="/downloads">Downloads</Link> page. The signup
          below reaches us directly if you&rsquo;d like to be told when newer builds land, or want
          one for a setup that isn&rsquo;t covered yet.
        </p>
      </div>

      <div className="container audio-suite-section" id="products">
        <div className="section-header narrow">
          <p className="eyebrow">The suite</p>
          <h2>Six products</h2>
          <p>Each one completes a musical job, rather than presenting a shelf of parts.</p>
        </div>
        <div className="card-grid three-col">
          {PRODUCTS.map((product) => (
            <article className="info-card audio-product-card" key={product.name}>
              <p className="card-kicker">{product.role}</p>
              <h3>{product.name}</h3>
              <p>{product.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="container audio-suite-section">
        <div className="section-header narrow">
          <p className="eyebrow">The idea</p>
          <h2>Why it is built this way</h2>
        </div>
        <div className="card-grid three-col">
          {IDEAS.map((idea) => (
            <article className="info-card" key={idea.title}>
              <h3>{idea.title}</h3>
              <p>{idea.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="container audio-suite-section">
        <div className="section-header narrow">
          <p className="eyebrow">Common questions</p>
          <h2>Before you sign up</h2>
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

      <div className="container audio-suite-signup-shell">
        <div className="section-header narrow">
          <p className="eyebrow">Join the alpha</p>
          <h2>Want to test it?</h2>
          <p>
            Tell us what you work in and we&rsquo;ll get in touch when there&rsquo;s a build that
            suits your setup.
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
