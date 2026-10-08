import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, Download, MapPin, Phone } from 'lucide-react';
import { SEO, StructuredData } from '../utils/seo';
import {
  BUSINESS,
  absoluteUrl,
  breadcrumbSchema,
  organizationSchema,
  websiteSchema,
} from '../data/siteSeo';
import { musicGuides } from '../data/musicGuides';
import { separatorQuestions } from '../data/stemSeparatorContent';
import { toolDetails } from '../data/toolDetails';
import { getProductBySlug } from '../data/catalog';
import NotFoundPage from '../components/NotFoundPage';
import { AnalyticsChoice } from '../components/SiteMeasurement';
import './MusicResources.css';

const guidePath = (guide) => `/guides/${guide.slug}`;
const sectionId = (index) => `guide-section-${index + 1}`;
function labelFor(path) {
  const guide = musicGuides.find((item) => guidePath(item) === path);
  const tool = Object.values(toolDetails).find((item) => `/tools${item.path}` === path);
  const product = path.startsWith('/product/') ? getProductBySlug(path.slice(9)) : null;
  return (
    guide?.title ||
    product?.name ||
    (tool ? `${tool.name} details` : path.split('/').at(-1).replaceAll('-', ' '))
  );
}
function Page({
  title,
  description,
  children,
  image,
  category = 'Sattari Music',
  type = 'website',
}) {
  const { pathname } = useLocation();
  return (
    <section className="resource-page">
      <SEO
        title={title}
        description={description}
        url={absoluteUrl(pathname)}
        image={image}
        type={type}
      />
      <StructuredData
        data={breadcrumbSchema([
          { name: 'Sattari Music', path: '/' },
          ...(type === 'article' ? [{ name: 'Music Guides', path: '/guides' }] : []),
          { name: title, path: pathname },
        ])}
      />
      <div className="resource-shell">
        <nav className="resource-nav" aria-label="Music resources">
          <Link to="/guides">Guides</Link>
          <Link to="/hub">Music tools</Link>
          <Link to="/visit">Visit Sattari</Link>
        </nav>
        <header className="resource-heading">
          <p>{category}</p>
          <h1>{title}</h1>
        </header>
        {children}
      </div>
    </section>
  );
}
function Related({ paths }) {
  return (
    <nav className="resource-related" aria-label="Related pages">
      <h2>Keep exploring</h2>
      {paths.map((path) => (
        <Link key={path} to={path}>
          {labelFor(path)}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

function StemAudioExample({ includeOriginal = true }) {
  const examples = [
    ...(includeOriginal
      ? [{ label: 'Original mix', path: '/audio/sattari-practice-demo.wav' }]
      : []),
    { label: 'Bass estimate', path: '/audio/sattari-demo-bass.wav' },
    { label: 'Drum estimate', path: '/audio/sattari-demo-drums.wav' },
  ];
  return (
    <section className="resource-section resource-demo" aria-labelledby="stem-example-title">
      <h2 id="stem-example-title">Hear the actual separated results</h2>
      <p>
        An original eight-second synthesized groove in A minor at 120 BPM, with no vocals. The bass
        and drums below are unedited HTDemucs estimates, not the clean synthesis sources. Listen for
        leakage, the start of each note and how long it rings out. This short example demonstrates
        the workflow, not the quality you can expect from every song.
      </p>
      {examples.map(({ label, path }) => (
        <div key={path}>
          <h3>{label}</h3>
          <audio controls preload="none" src={path} aria-label={label} />
          <a className="resource-link" download href={path}>
            <Download size={16} aria-hidden="true" /> Download {label.toLowerCase()} WAV
          </a>
        </div>
      ))}
      <p>
        Count four steady beats, then try matching the bass note lengths. Import these WAVs into{' '}
        <Link to="/studio">Sattari Studio</Link> to hear them together, or{' '}
        <Link to="/stem-separator">separate your own recording</Link>.
      </p>
    </section>
  );
}

export function GuideIndex() {
  return (
    <Page
      title="Music Guides"
      description="Practical music guides from Sattari Music: choose a violin or drumsticks, tune a snare drum, care for your instrument, separate stems, make karaoke tracks, and more."
    >
      <p className="resource-lead">Good questions. More music.</p>
      <div className="guide-list">
        {musicGuides.map((guide) => (
          <article key={guide.slug}>
            <Link className="guide-image" to={guidePath(guide)} tabIndex={-1} aria-hidden="true">
              <img src={guide.image} alt="" loading="lazy" width="1280" height="800" />
            </Link>
            <div>
              <p className="resource-label">{guide.category}</p>
              <h2>
                <Link to={guidePath(guide)}>{guide.title}</Link>
              </h2>
              <p>{guide.answer}</p>
              <Link className="resource-link" to={guidePath(guide)}>
                Read guide <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <section className="resource-section">
        <h2>Know your tools</h2>
        <div className="resource-tool-links">
          {Object.values(toolDetails).map((tool) => (
            <Link to={`/tools${tool.path}`} key={tool.key}>
              {tool.name}
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </section>
    </Page>
  );
}

export function GuideArticle() {
  const { slug } = useParams();
  const guide = musicGuides.find((item) => item.slug === slug);
  if (!guide) return <NotFoundPage />;
  return (
    <Page
      title={guide.title}
      description={guide.description}
      image={guide.image}
      category={guide.category}
      type="article"
    >
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          '@id': `${absoluteUrl(guidePath(guide))}#article`,
          url: absoluteUrl(guidePath(guide)),
          headline: guide.title,
          description: guide.description,
          inLanguage: 'en-US',
          articleSection: guide.category,
          image: absoluteUrl(guide.image),
          mainEntityOfPage: absoluteUrl(guidePath(guide)),
          isPartOf: { '@id': websiteSchema['@id'] },
          author: {
            '@id': organizationSchema['@id'],
            name: BUSINESS.name,
            url: absoluteUrl('/about'),
          },
          publisher: { '@id': organizationSchema['@id'] },
        }}
      />
      <p className="resource-byline">
        Published by <Link to="/about">{BUSINESS.name}</Link>
      </p>
      <p className="resource-lead">{guide.answer}</p>
      <Link className="resource-action" to={guide.action.path}>
        {guide.action.label}
        <ArrowRight size={18} />
      </Link>
      <nav className="resource-contents" aria-label="In this guide">
        <h2>In this guide</h2>
        <ol>
          {guide.sections.map((section, index) => (
            <li key={section.title}>
              <a href={`#${sectionId(index)}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      <figure className="resource-figure">
        <img src={guide.image} alt={guide.imageAlt} width="1280" height="800" loading="lazy" />
      </figure>
      <div className="resource-article">
        {guide.sections.map((section, index) => (
          <section key={section.title} className="resource-section" id={sectionId(index)}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.steps && (
              <ol>
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </section>
        ))}
        {['how-to-separate-vocals-drums-bass', 'practice-bass-with-isolated-stems'].includes(
          slug
        ) && <StemAudioExample />}
        {guide.sources && (
          <section className="resource-section">
            <h2>Further reading</h2>
            {guide.sources.map((source) => (
              <p key={source.url}>
                <a href={source.url}>{source.label}</a>
              </p>
            ))}
          </section>
        )}
        <Related paths={guide.related} />
      </div>
    </Page>
  );
}

export function ToolDetailsPage() {
  const { tool: key } = useParams();
  const tool = toolDetails[key];
  if (!tool) return <NotFoundPage />;
  return (
    <Page
      title={`${tool.name}: Formats, Privacy & Limits`}
      description={tool.description}
      image={tool.screenshot}
      category={`${tool.status} / Tool reference`}
    >
      <p className="resource-lead">{tool.summary}</p>
      <Link className="resource-action" to={tool.path}>
        Open {tool.name}
        <ArrowRight size={18} />
      </Link>
      <figure className="resource-figure">
        <img
          src={tool.screenshot}
          alt={`${tool.name} running in a web browser`}
          width={tool.screenshotWidth || 1280}
          height={tool.screenshotHeight || 800}
        />
        <figcaption>{tool.screenshotCaption}</figcaption>
      </figure>
      <dl className="resource-facts">
        {tool.facts.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="resource-section resource-demo">
        <h2>{tool.demoTitle || 'Try the same audio'}</h2>
        <p>
          {tool.demoDescription ||
            'An original eight-second synthesized A minor groove at 120 BPM: bass, chords and percussion, with no vocals. Free to download and use for practice. This is a workflow demonstration, not a commercial-song benchmark.'}
        </p>
        <audio
          controls
          preload="none"
          src={tool.demoAudio || '/audio/sattari-practice-demo.wav'}
          aria-label={tool.demoLabel || 'Original Sattari practice demo'}
        />
        <a
          className="resource-link"
          href={tool.demoAudio || '/audio/sattari-practice-demo.wav'}
          download
        >
          <Download size={18} />
          Download demo WAV
        </a>
        <ol>
          {tool.demo.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section className="resource-section">
        <h2>Your browser and your files</h2>
        <p>
          Start with a short file and verify a small export before a long session. Browser storage
          is not a backup. No all-device performance guarantee is implied by these screenshots.
        </p>
        <Link to="/privacy">Audio privacy and measurement choices</Link>
      </section>
      {key === 'stem-separator' && <StemAudioExample includeOriginal={false} />}
      {key === 'stem-separator' && (
        <section
          className="resource-section resource-questions"
          id="questions"
          aria-labelledby="separator-questions"
        >
          <h2 id="separator-questions">Stem Separator questions</h2>
          {separatorQuestions.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </section>
      )}
      <Related paths={tool.guides.map((slug) => `/guides/${slug}`)} />
    </Page>
  );
}

export function VisitPage() {
  return (
    <Page
      title="Visit Sattari Music in Woodland Hills"
      description="Visit Sattari Music in Woodland Hills by appointment only. Call to arrange a visit for instruments, repairs, rentals and lessons at 4881 Topanga Canyon Blvd #202."
    >
      <p className="resource-lead">Instruments, music tools, and local support.</p>
      <dl className="resource-facts">
        <div>
          <dt>Business</dt>
          <dd>
            {BUSINESS.name} / {BUSINESS.alternateName}
          </dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>
            <address>{BUSINESS.addressLine}</address>
          </dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>
            <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>
          </dd>
        </div>
        <div>
          <dt>Shop visits</dt>
          <dd>{BUSINESS.shopHoursNote}</dd>
        </div>
        <div>
          <dt>Studio & rehearsal</dt>
          <dd>
            {BUSINESS.studioHoursNote} $25 per hour or $60 for four hours. Availability and approval
            required; contact the shop while online booking is being set up.
          </dd>
        </div>
        <div>
          <dt>Service area</dt>
          <dd>
            {BUSINESS.areas.join(', ')}. One Woodland Hills location, not separate storefronts in
            each city.
          </dd>
        </div>
      </dl>
      <div className="resource-actions">
        <a className="resource-action" href={BUSINESS.directions}>
          <MapPin size={18} />
          Get directions
        </a>
        <a className="resource-link" href={BUSINESS.phoneHref}>
          <Phone size={18} />
          Arrange a visit
        </a>
      </div>
      <section className="resource-section">
        <h2>How can we help?</h2>
        <p>
          Shop cymbals, drumsticks, violins, guitars, bass and accessories. Ask about instrument
          repairs and setups, rentals, teachers and classes, or studio and rehearsal time. Confirm
          the specific service, price and timing with our team.
        </p>
        <Link className="resource-link" to="/services">
          Request local support
          <ArrowRight size={18} />
        </Link>
      </section>
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <Page
      title="Audio Privacy & Measurement Choices"
      description="How Sattari browser tools handle audio, local saves, optional site measurements and service inquiries. Control anonymous usage measurement on this device."
    >
      <section className="resource-section">
        <h2>Music tools</h2>
        <p>
          Stem Separator, Studio and Learn process source audio on your device. Source audio,
          microphone audio, filenames and musical analysis are not sent to our usage measurement
          endpoint. Stem Separator downloads a model from Hugging Face, which receives the network
          information associated with that download.
        </p>
        <p>
          Studio stores projects and audio assets in your browser. Learn stores imported lessons,
          guitar settings, practice history, recorded takes and attached lesson videos locally. Stem
          Separator results last only for the current page session. Download backups; clearing
          browser data can remove local projects, lessons and recordings.
        </p>
      </section>
      <section className="resource-section">
        <h2>Optional site measurement</h2>
        <p>
          With your permission, we count page groups, recognized referral sources and actions such
          as a completed inquiry, analysis, separation, practice session or software download click.
          A practice completion is not a verified musical skill; a download click is not a verified
          download or installation. We do not add visitor IDs or store raw referring URLs, query
          strings, IP addresses, contact fields or audio in these aggregate reports. Counts are not
          unique visitors or verified sales.
        </p>
        <p>
          Measurement is off until you allow it. We respect Global Privacy Control and Do Not Track.
          A local preference remembers your choice; session storage remembers only a broad source
          such as ChatGPT or Google. Reports cover the latest 90 days. Hosting providers still
          receive normal network requests and may maintain operational logs.
        </p>
        <AnalyticsChoice />
      </section>
      <section className="resource-section">
        <h2>Forms, checkout and external services</h2>
        <p>
          Information you submit in an inquiry or booking request is sent to Sattari and the
          services used to store and deliver it. Stripe handles checkout. Those operational requests
          are separate from optional usage measurement. Map embeds and links to third-party services
          follow those providers&apos; practices.
        </p>
        <p>
          The website also contains Sentry error reporting, enabled only when a Sentry connection is
          configured. Do not include confidential information in filenames or error reports. Contact
          the shop about information you have submitted.
        </p>
        <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>
      </section>
    </Page>
  );
}
