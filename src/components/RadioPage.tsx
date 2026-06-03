import { Link } from 'react-router-dom';
import { SEO, StructuredData } from '../utils/seo';
import NowTenantProfileCard from './NowTenantProfileCard';

const shows = [
  {
    time: 'Mondays · 8 PM PT',
    title: 'Armon Selects',
    tag: 'Flagship show',
    description:
      'Taste-making sets, references, loops, and underground sounds that define the Sattari frequency.',
  },
  {
    time: 'Wednesdays · 7 PM PT',
    title: 'Plugin Lab Live',
    tag: 'Tools in context',
    description:
      'Before/after musical demos built around Sattari tools, vocal chains, low-end design, and producer workflow.',
  },
  {
    time: 'Fridays · 9 PM PT',
    title: 'Drum Market Radio',
    tag: 'Rhythm block',
    description:
      'Drum grooves, beat flips, percussion experiments, and producer submissions from the community queue.',
  },
  {
    time: 'Late nights',
    title: 'Late Night Textures',
    tag: 'After-hours signal',
    description:
      'Ambient, spiritual, cinematic, and weird sound beds for writing, designing, and staying locked in.',
  },
];

const signalStats = [
  { value: '808.8', label: 'FM concept frequency' },
  { value: '24/7', label: 'producer-lab signal' },
  { value: '4', label: 'weekly show lanes' },
];

const playlistBlocks = [
  'Sattari Sessions',
  'Producer Hour',
  'Plugin Lab',
  'Drum Market',
  'Community Frequency',
  'Late Night Textures',
];

export default function RadioPage() {
  return (
    <section className="section page-header-offset radio-shell">
      <SEO
        title="Sattari Radio"
        description="Sattari Radio is a 24/7 producer-lab station for beats, textures, plugin experiments, weekly shows, and community sounds."
        url="https://sattarimusic.com/radio"
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'RadioStation',
          name: 'Sattari Radio',
          url: 'https://sattarimusic.com/radio',
          description:
            'A producer-lab radio station from Sattari Music featuring weekly shows, beat blocks, plugin demos, and community submissions.',
          parentOrganization: {
            '@type': 'Organization',
            name: 'Sattari Music',
            url: 'https://sattarimusic.com',
          },
        }}
      />

      <div className="container radio-hero">
        <div className="radio-copy">
          <p className="eyebrow">Sattari Radio · 808.8 FM</p>
          <h1>A 24/7 creative signal for producers, drummers, and late-night builders.</h1>
          <p>
            Sattari Radio is becoming a living channel for beats, textures, plugin experiments,
            weekly shows, and community sounds — part radio station, part lab, part stage.
          </p>
          <div className="hero-actions radio-actions">
            <a className="button button-solid" href="#weekly-shows">
              View weekly shows
            </a>
            <Link className="button button-outline" to="/profiles/armon">
              Open host profile
            </Link>
            <a className="button button-outline" href="#radio-submissions">
              Submit to the signal
            </a>
          </div>
          <NowTenantProfileCard
            handle="armon"
            tenantId="sattari_radio"
            variant="host"
            eyebrow="Radio host identity"
          />
        </div>

        <div className="radio-player-card" aria-label="Sattari Radio player preview">
          <div className="radio-player-topline">
            <span className="live-dot" aria-hidden="true" />
            <span>Beta signal warming up</span>
            <strong>ON AIR SOON</strong>
          </div>
          <div className="radio-dial" aria-hidden="true">
            <span>808.8</span>
          </div>
          <div className="radio-wave" aria-hidden="true">
            {Array.from({ length: 28 }, (_, index) => (
              <span key={index} style={{ animationDelay: `${index * 48}ms` }} />
            ))}
          </div>
          <div className="now-playing-card">
            <p className="card-kicker">Now building</p>
            <h2>Sattari Frequency</h2>
            <p>Legal/owned audio, station IDs, weekly shows, and community submission flow.</p>
          </div>
        </div>
      </div>

      <div className="container radio-stat-grid" aria-label="Sattari Radio highlights">
        {signalStats.map((stat) => (
          <div className="radio-stat" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="container radio-blocks-panel">
        <div>
          <p className="eyebrow">Station format</p>
          <h2>Not just playlists — scheduled worlds.</h2>
          <p>
            The station rotates through show blocks that can spotlight Sattari taste, artist
            submissions, drum culture, sound design, and the tools we are building.
          </p>
        </div>
        <div className="radio-block-list" aria-label="Radio programming blocks">
          {playlistBlocks.map((block) => (
            <span key={block}>{block}</span>
          ))}
        </div>
      </div>

      <div className="container section-header narrow" id="weekly-shows">
        <p className="eyebrow">Weekly shows</p>
        <h2>Recurring shows give the station a reason to come back every week.</h2>
        <p>
          We’ll start with a tight slate, then expand once the audience and submission pipeline are
          healthy.
        </p>
      </div>

      <div className="container card-grid two-col radio-show-grid">
        {shows.map((show) => (
          <article className="info-card radio-show-card" key={show.title}>
            <div className="radio-show-meta">
              <span>{show.time}</span>
              <strong>{show.tag}</strong>
            </div>
            <h3>{show.title}</h3>
            <p>{show.description}</p>
          </article>
        ))}
      </div>

      <div className="container radio-submissions" id="radio-submissions">
        <div>
          <p className="eyebrow">Community Frequency</p>
          <h2>Submit sounds for the station.</h2>
          <p>
            The beta queue is for original or properly cleared audio only: beats, loops, drum ideas,
            vocals, textures, show ideas, and artist spotlights. No copyrighted commercial uploads
            unless licensing is handled.
          </p>
        </div>
        <div className="radio-submission-card">
          <h3>Beta submission rules</h3>
          <ul>
            <li>Only send audio you own or have permission to share.</li>
            <li>Include artist name, track title, BPM/key if known, and preferred show lane.</li>
            <li>
              Short ideas are welcome: 30-second flips, loops, station tags, and show concepts.
            </li>
          </ul>
          <Link className="button button-solid" to="/services">
            Contact Sattari
          </Link>
        </div>
      </div>
    </section>
  );
}
