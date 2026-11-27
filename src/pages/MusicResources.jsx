import { useRef } from 'react';
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
import { guideCollections, musicGuides } from '../data/musicGuides';
import { guideRevisionDates } from '../data/guideRevisionDates';
import { instrumentTunerPages } from '../data/instrumentTunerPages';
import { separatorQuestions } from '../data/stemSeparatorContent';
import { toolDetails, toolReferencePath } from '../data/toolDetails';
import { getProductBySlug } from '../data/catalog';
import NotFoundPage from '../components/NotFoundPage';
import { AnalyticsChoice } from '../components/SiteMeasurement';
import GuideFinder from '../components/GuideFinder';
import ChoiceHistoryAid from '../components/ChoiceHistoryAid';
import StringLessonAid from '../components/StringLessonAid';
import { PracticeGuideAid } from '../components/PracticeGuideAid';
import './MusicResources.css';

const guidePath = (guide) => `/guides/${guide.slug}`;
const sectionId = (index) => `guide-section-${index + 1}`;
function labelFor(path) {
  const resourceLabels = {
    '/studio/keybpm#live-tuner': 'Open the live instrument tuner',
    '/keys': 'Notes and chords for all 24 keys',
    '/bpm': 'Tempo reference: every BPM',
    '/guitar-strings-woodland-hills': 'Guitar strings in Woodland Hills',
    '/violin-strings-woodland-hills': 'Violin strings in Woodland Hills',
    '/services/guitar-restringing-woodland-hills': 'Guitar restringing and string replacement',
    '/services/violin-restringing-woodland-hills': 'Violin restringing and string fitting',
    '/services/string-replacement-woodland-hills': 'Broken guitar, bass or violin string help',
  };
  const guide = musicGuides.find((item) => guidePath(item) === path);
  const tool = Object.values(toolDetails).find((item) => toolReferencePath(item) === path);
  const tuner = instrumentTunerPages.find((page) => page.path === path);
  const product = path.startsWith('/product/') ? getProductBySlug(path.slice(9)) : null;
  return (
    resourceLabels[path] ||
    guide?.linkLabel ||
    guide?.title ||
    tuner?.heading ||
    product?.name ||
    (tool ? `${tool.name} details` : path.split('/').at(-1).replaceAll('-', ' '))
  );
}
export function Page({
  title,
  seoTitle = title,
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
        title={seoTitle}
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
          <Link to="/learn">Guitar song lessons</Link>
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
  const tasks = [
    [
      'Change a string',
      [
        ['Acoustic guitar', 'how-to-change-acoustic-guitar-strings'],
        ['Classical guitar', 'how-to-change-classical-guitar-strings'],
        ['Electric guitar', 'how-to-change-electric-guitar-strings'],
        ['Bass guitar', 'how-to-change-bass-guitar-strings'],
        ['Violin', 'how-to-change-a-violin-string'],
        ['Viola', 'how-to-change-a-viola-string'],
        ['Cello', 'how-to-change-a-cello-string'],
        ['Ukulele', 'how-to-change-ukulele-strings'],
        ['Persian tar', 'how-to-change-persian-tar-strings'],
        ['Setar', 'how-to-change-setar-strings'],
        ['Oud', 'how-to-change-oud-strings'],
      ],
    ],
    [
      'Choose an instrument',
      [
        ['Violin', 'choose-a-violin-for-beginners'],
        ['Viola', 'how-to-choose-a-viola'],
        ['Acoustic guitar', 'choose-a-beginner-acoustic-guitar'],
        ['Electric guitar', 'how-to-choose-an-electric-guitar'],
        ['Bass guitar', 'how-to-choose-a-bass-guitar'],
        ['Cymbals', 'choose-your-first-cymbals'],
      ],
    ],
    [
      'Identify a sound',
      [
        ['Violin and viola', 'violin-vs-viola'],
        ['Tar, setar and sitar', 'tar-setar-and-sitar'],
        ['Instruments of Iran', 'instruments-of-iran'],
        ['Snare drum tunings', 'how-to-tune-a-snare-drum#before-and-after'],
        ['Song key and tempo', 'find-song-key-and-bpm'],
      ],
    ],
  ];
  return (
    <Page
      title="Music Guides"
      seoTitle="Beginner Music Guides for Strings, Instrument Care and Practice"
      description="Learn how to choose a first instrument, change strings with close-up photos, compare sounds by ear, and practice with song stems in Sattari’s music guides."
    >
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          '@id': absoluteUrl('/guides#collection'),
          url: absoluteUrl('/guides'),
          name: 'Music Guides',
          dateModified: guideRevisionDates['/guides'],
          isPartOf: { '@id': websiteSchema['@id'] },
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: musicGuides.length,
            itemListElement: guideCollections
              .flatMap((group) => group.guides)
              .map((guide, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: guide.title,
                url: absoluteUrl(guidePath(guide)),
              })),
          },
        }}
      />
      <p className="resource-lead">
        Compare two instruments by ear, follow a string from bridge to tuning peg, or turn a song
        into a backing track for practice.
      </p>
      <GuideFinder />
      <nav className="guide-task-links" aria-label="Start with a task">
        {tasks.map(([label, links]) => (
          <details key={label}>
            <summary>{label}</summary>
            <ul>
              {links.map(([name, slug]) => (
                <li key={slug}>
                  <Link to={'/guides/' + slug}>{name}</Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </nav>
      <nav aria-label="Guide topics" id="guide-topics" className="guide-topics">
        {guideCollections.map((collection) => (
          <a key={collection.id} href={`#${collection.id}`}>
            {collection.title}
          </a>
        ))}
      </nav>
      {guideCollections.map((collection) => (
        <section className="guide-collection" key={collection.id} aria-labelledby={collection.id}>
          <h2 id={collection.id}>{collection.title}</h2>
          <div className="guide-list">
            {collection.guides.map((guide) => (
              <article key={guide.slug}>
                {guide.image && (
                  <Link
                    className="guide-image"
                    to={guidePath(guide)}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <img src={guide.image} alt="" loading="lazy" width="96" height="100" />
                  </Link>
                )}
                <div>
                  <h3>
                    <Link to={guidePath(guide)}>{guide.title}</Link>
                  </h3>
                  <p>{guide.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      <section className="resource-section">
        <h2>Know your tools</h2>
        <div className="resource-tool-links">
          {Object.values(toolDetails).map((tool) => (
            <Link to={toolReferencePath(tool)} key={tool.key}>
              {tool.name}
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </section>
    </Page>
  );
}

function AudioComparison({ examples, credit }) {
  const playing = useRef(null);
  function playExample(event) {
    const next = event.currentTarget;
    if (playing.current && playing.current !== next) playing.current.pause();
    playing.current = next;
  }
  return (
    <div className="guide-audio-comparison">
      {examples.map((example) => (
        <div key={example.src} id={example.id} className="guide-audio-example">
          <h3>{example.label}</h3>
          <p>{example.description}</p>
          <audio
            aria-label={example.label}
            controls
            preload="metadata"
            src={example.src}
            onPlay={playExample}
          >
            <a href={example.src}>Open this recording (WAV)</a>
          </audio>
        </div>
      ))}
      <p className="guide-media-credit">
        Recordings by {credit.author} on Freesound.{' '}
        <a href={credit.before}>First source recording</a> ·{' '}
        <a href={credit.after}>Second source recording</a> ·{' '}
        <a href={credit.licenseUrl}>{credit.license}</a>. {credit.note}
      </p>
    </div>
  );
}

function LessonPhoto({ photo }) {
  return (
    <figure className="guide-step-photo">
      <a href={photo.src} aria-label={`Open full-size photo: ${photo.alt}`}>
        <img
          width={photo.width}
          height={photo.height}
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
        />
      </a>
      <figcaption>
        {photo.caption}
        <span className="guide-media-credit">
          Photo by <a href={photo.sourceUrl}>{photo.author}</a>
          {photo.licenseUrl && (
            <>
              {' '}
              · <a href={photo.licenseUrl}>{photo.license}</a>
            </>
          )}
          {photo.edit && <> · {photo.edit}</>}
        </span>
      </figcaption>
    </figure>
  );
}

function GuideSection({ section, sources, slug }) {
  const source = sources?.find((item) => item.url === section.sourceUrl);
  return (
    <section className="resource-section" id={section.id}>
      <h2>{section.title}</h2>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.audioExamples && (
        <AudioComparison examples={section.audioExamples} credit={section.audioCredit} />
      )}
      {section.table && (
        <div className="guide-table-wrap">
          <table aria-label={section.title}>
            <thead>
              <tr>
                {section.table.headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map(([label, ...cells]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {cells.map((cell, i) => (
                    <td key={section.table.headers[i + 1]}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.steps && (
        <ol>
          {section.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {section.after?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.choiceAid && <ChoiceHistoryAid name={section.choiceAid} />}
      <StringLessonAid
        section={section}
        renderPhoto={(photo) => <LessonPhoto key={photo.src} photo={photo} />}
      />
      {!section.stringPhotoLabels &&
        section.photos?.map((photo) => <LessonPhoto key={photo.src} photo={photo} />)}
      {source && (
        <p>
          <a href={source.url}>{source.label}</a>
        </p>
      )}
      {section.link && <Link to={section.link.path}>{section.link.label}</Link>}
      <PracticeGuideAid slug={slug} sectionId={section.id} />
    </section>
  );
}

export function GuideArticle() {
  const { slug } = useParams();
  const guide = musicGuides.find((item) => item.slug === slug);
  if (!guide) return <NotFoundPage />;
  const sections = guide.sections.map((section, index) => ({
    ...section,
    id: section.id || sectionId(index),
  }));
  const photos = sections.flatMap((section) => section.photos || []);
  const audio = sections.flatMap((section) => section.audioExamples || []);
  const previewImage = guide.image || photos[0]?.src;
  const revised = guideRevisionDates[guidePath(guide)];
  const leadSection = sections.find((section) => section.lead);
  const bodySections = sections.filter((section) => !section.lead);
  return (
    <Page
      title={guide.title}
      seoTitle={guide.seoTitle}
      description={guide.description}
      image={previewImage}
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
          dateModified: revised,
          description: guide.description,
          inLanguage: 'en-US',
          articleSection: guide.category,
          hasPart: sections.map((section) => ({
            '@type': 'WebPageElement',
            name: section.title,
            url: absoluteUrl(guidePath(guide) + '#' + section.id),
          })),
          ...(previewImage && {
            image: photos.length
              ? photos.map((photo) => absoluteUrl(photo.src))
              : absoluteUrl(previewImage),
          }),
          ...(audio.length > 0 && {
            audio: audio.map((example) => ({
              '@type': 'AudioObject',
              name: example.label,
              contentUrl: absoluteUrl(example.src),
              encodingFormat: 'audio/wav',
              description: example.description,
            })),
          }),
          ...(guide.sources?.length && { citation: guide.sources.map((source) => source.url) }),
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
        {revised && (
          <>
            {' '}
            · Updated{' '}
            <time dateTime={revised}>
              {new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(revised + 'T00:00:00Z'))}
            </time>
          </>
        )}
      </p>
      <p className="resource-lead">{guide.answer}</p>
      {photos.length > 0 && (
        <p className="guide-photo-instruction">Select any close-up to open the full-size photo.</p>
      )}
      {leadSection && (
        <div className="resource-article resource-checklist">
          <GuideSection section={leadSection} sources={guide.sources} slug={slug} />
        </div>
      )}
      {guide.action && (
        <Link className="resource-action" to={guide.action.path}>
          {guide.action.label}
          <ArrowRight size={18} />
        </Link>
      )}
      <nav className="resource-contents" aria-label="In this guide">
        <h2>In this guide</h2>
        <ol
          className={
            sections.some((section) => /^\d+\./.test(section.title))
              ? 'guide-step-index'
              : undefined
          }
        >
          {sections.map((section) => (
            <li key={section.title}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {guide.trialSheet && (
        <a
          className="resource-link guide-handout"
          href="/handouts/instrument-trial-sheet.pdf"
          download
        >
          <Download size={18} aria-hidden="true" /> Download the instrument trial sheet (one-page
          PDF)
        </a>
      )}
      {guide.image && (
        <figure
          className={
            guide.imageCredit || !guide.action
              ? 'resource-figure guide-instrument-photo'
              : 'resource-figure'
          }
        >
          <img
            src={guide.image}
            alt={guide.imageAlt}
            width={guide.imageWidth || 1280}
            height={guide.imageHeight || 800}
            loading="lazy"
          />
          {guide.imageCredit && (
            <figcaption>
              {guide.imageAlt} <a href={guide.imageCredit.url}>{guide.imageCredit.label}</a>
            </figcaption>
          )}
        </figure>
      )}
      <div className="resource-article">
        {bodySections.map((section) => (
          <GuideSection section={section} key={section.title} sources={guide.sources} slug={slug} />
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
      {key === 'key-bpm' && (
        <section className="resource-section">
          <h2>Key and tempo reference</h2>
          <p>
            <Link to="/keys">Notes, chords and Camelot codes for all 24 keys</Link>, and{' '}
            <Link to="/bpm">a click and delay times for every tempo</Link>.
          </p>
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
          Separator saves your songs and stems in this browser until you choose Clear saved work.
          The song key and BPM finder saves results in this browser. You can export a report to keep
          a copy. Clearing browser data can remove saved results, projects, lessons and recordings.
        </p>
      </section>
      <section className="resource-section">
        <h2>Optional site measurement</h2>
        <p>
          With your permission, we count page visits and actions such as starting a tuner microphone
          or reference tone, following a product link, tapping a phone number, sending an inquiry,
          using a music tool or completing a verified purchase. Reports contain only the action, a
          page label and a broad referral source. Audio, notes you play, form contents, visitor IDs,
          IP addresses, order IDs and raw URLs stay out of these reports.
        </p>
        <p>
          Measurement is off until you allow it. We respect Global Privacy Control and Do Not Track.
          Your browser remembers your choice. During a visit, the tab remembers the broad referral
          source and the last measured local shopping page or violin buying guide where you followed
          a product link. This lets us count a later verified purchase from that tab. A checkout
          reference stays in the tab to avoid counting the same purchase twice. Aggregate reports
          cover the latest 90 days. Hosting providers receive normal network requests and may keep
          operational logs.
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
