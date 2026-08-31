import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  AudioWaveform,
  BookOpen,
  CircleDot,
  Radio,
  RadioTower,
  Store,
  Users,
} from 'lucide-react';
import { SEO } from '../utils/seo';

const upcomingProjects = [
  {
    title: 'Sattari Radio',
    description: 'Live shows, charts, DJ picks, and local artist discovery.',
    icon: Radio,
  },
  {
    title: 'Musician Profiles',
    description: 'A home for tracks, gear, lessons, credits, and creative identity.',
    icon: Users,
  },
  {
    title: 'Community Market',
    description: 'A trusted place to list, discover, and trade instruments.',
    icon: Store,
  },
];

export default function SattariHubPage() {
  return (
    <>
      <SEO
        title="Sattari Hub - Music Tools and Creative Projects"
        description="Enter Sattari Hub for Learn, Studio, and the growing family of Sattari music tools, radio, profiles, and community projects."
        image="/sattari site/audio-suite/create.png"
        url="https://sattarimusic.com/hub"
      />
      <section className="hub-page">
        <header className="hub-masthead">
          <div className="hub-masthead-brand">
            <span className="hub-mark">
              <CircleDot size={18} />
            </span>
            <div>
              <p>Sattari Music</p>
              <strong>Hub</strong>
            </div>
          </div>
          <div className="hub-masthead-status">
            <i />
            Two projects live
          </div>
          <Link to="/" className="hub-store-return">
            <ArrowLeft size={15} />
            Back to store
          </Link>
        </header>

        <div className="hub-shell">
          <div className="hub-intro">
            <div>
              <p className="hub-eyebrow">Your Sattari creative home</p>
              <h1>
                Learn the music.
                <br />
                Then make it yours.
              </h1>
            </div>
            <p>
              One place for Sattari&apos;s music technology, learning tools, creative workspaces,
              and the community experiences ahead.
            </p>
          </div>

          <div className="hub-primary-grid">
            <Link to="/learn" className="hub-product hub-product-learn">
              <div className="hub-product-media">
                <img
                  src="/sattari site/audio-suite/brain.png"
                  alt="Sattari music analysis interface"
                  loading="eager"
                />
                <span className="hub-live-label">
                  <i /> Live preview
                </span>
              </div>
              <div className="hub-product-copy">
                <span className="hub-product-icon">
                  <BookOpen size={20} />
                </span>
                <div>
                  <p>Analyze and practice</p>
                  <h2>Sattari Learn</h2>
                  <span>
                    Turn songs into concepts, exercises, and challenges for your instrument.
                  </span>
                </div>
                <span className="hub-open-product" aria-hidden="true">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              <div className="hub-product-meta">
                <span>Song maps</span>
                <span>Piano + guitar</span>
                <span>Rhythm + MIDI</span>
              </div>
            </Link>

            <Link to="/studio" className="hub-product hub-product-studio">
              <div className="hub-product-media">
                <img
                  src="/sattari site/audio-suite/create.png"
                  alt="Sattari creative effects interface"
                  loading="eager"
                />
                <span className="hub-live-label">
                  <i /> Alpha workspace
                </span>
              </div>
              <div className="hub-product-copy">
                <span className="hub-product-icon">
                  <AudioWaveform size={20} />
                </span>
                <div>
                  <p>Create, remix, perform</p>
                  <h2>Sattari Studio</h2>
                  <span>
                    Shape audio across four decks with stems, sync, pads, and arrangement tools.
                  </span>
                </div>
                <span className="hub-open-product" aria-hidden="true">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              <div className="hub-product-meta">
                <span>Four decks</span>
                <span>Stem workflow</span>
                <span>Performance pads</span>
              </div>
            </Link>
          </div>

          <section className="hub-coming-section">
            <div className="hub-section-heading">
              <div>
                <p className="hub-eyebrow">Growing inside the Hub</p>
                <h2>What comes next</h2>
              </div>
              <RadioTower size={22} />
            </div>
            <div className="hub-coming-grid">
              {upcomingProjects.map(({ title, description, icon: Icon }, index) => (
                <article key={title}>
                  <span className="hub-coming-number">0{index + 3}</span>
                  <Icon size={20} />
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                  <span className="hub-coming-state">In development</span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
