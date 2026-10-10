import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Library,
  Radio,
  SlidersHorizontal,
  Split,
  Store,
  Users,
} from 'lucide-react';
import { SEO } from '../utils/seo';
import { PAGE_SEO } from '../data/siteSeo';
import '../styles-hub.css';
import HubLabs from '../labs/HubLabs';

const workspaces = [
  {
    id: 'studio',
    name: 'Sattari Studio',
    category: 'Create',
    detail: 'Browser DAW, mixing & arrangement',
    path: '/studio',
    image: '/images/tools/studio.jpg',
    alt: 'Four-deck Sattari Studio workspace with audio loaded',
    icon: SlidersHorizontal,
    status: 'Alpha',
    tools: ['Four decks', 'Instruments', 'Arrangement'],
  },
  {
    id: 'learn',
    name: 'Sattari Learn',
    category: 'Practice',
    detail: 'Guided guitar lessons & live feedback',
    path: '/learn',
    image: '/images/tools/learn-guitar.jpg',
    alt: 'Sattari Learn song library and interactive guitar practice player',
    icon: BookOpen,
    status: 'Practice lab',
    tools: ['Tabs & chords', 'Guided practice', 'Live feedback'],
  },
  {
    id: 'stem-separator',
    name: 'Stem Separator',
    category: 'Explore',
    detail: 'Find the individual parts of a track',
    path: '/stem-separator',
    image: '/images/tools/separator.jpg',
    alt: 'Stem Separator with completed bass and drum files',
    icon: Split,
    status: 'Local processing',
    tools: ['Vocals', 'Drums', 'Bass', 'Instruments'],
  },
];

const reading = [
  {
    path: '/guides/how-to-separate-vocals-drums-bass',
    category: '01 / Separation',
    title: 'A song, taken apart.',
    detail: 'Vocals, drums, bass and everything between.',
  },
  {
    path: '/guides/practice-bass-with-isolated-stems',
    category: '02 / Practice',
    title: 'Get closer to the bassline.',
    detail: 'Listen, loop and find your place in the groove.',
  },
];

const upcoming = [
  { name: 'Radio', detail: 'Shows, selections & artist discovery', icon: Radio },
  { name: 'Community', detail: 'Musicians, music & connections', icon: Users },
  { name: 'Market', detail: 'Instruments with a next chapter', icon: Store },
];

export default function SattariHubPage() {
  return (
    <>
      <SEO {...PAGE_SEO.hub} />
      <div className="hub-page">
        <div className="hub-shell">
          <header className="hub-heading">
            <div>
              <p className="hub-eyebrow">
                <AudioLines size={17} aria-hidden="true" /> Music in motion
              </p>
              <h1>
                Sattari Hub<span aria-hidden="true">.</span>
              </h1>
            </div>
            <div className="hub-heading-aside">
              <p>Learn guitar. Create music. Explore sound.</p>
            </div>
          </header>

          <section className="hub-workspaces" aria-labelledby="hub-workspaces-title">
            <div className="hub-section-heading">
              <h2 id="hub-workspaces-title">Your workspaces</h2>
              <span>01 / 03</span>
            </div>
            <div className="hub-workspace-grid">
              {workspaces.map(
                (
                  { id, name, category, detail, path, image, alt, icon: Icon, status, tools },
                  index
                ) => (
                  <article key={id} className={`hub-tool hub-tool-${id}`}>
                    <div className="hub-tool-topline">
                      <span>
                        <Icon size={17} aria-hidden="true" /> {category}
                      </span>
                      <span className="hub-tool-number">0{index + 1}</span>
                    </div>
                    <Link to={path} className="hub-tool-launch" aria-label={`Open ${name}`}>
                      <div className="hub-tool-name">
                        <h3>{name}</h3>
                        <ArrowUpRight size={24} aria-hidden="true" />
                      </div>
                      <p>{detail}</p>
                      <div className="hub-tool-image">
                        <img src={image} alt={alt} width="1440" height="1000" loading="eager" />
                      </div>
                      <ul className="hub-tool-capabilities">
                        {tools.map((tool) => (
                          <li key={tool}>{tool}</li>
                        ))}
                      </ul>
                    </Link>
                    <div className="hub-tool-footer">
                      <span>{status}</span>
                      <Link to={`/tools${path}`} aria-label={`${name} formats, privacy and limits`}>
                        Details <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>

          <section className="hub-reading" aria-labelledby="hub-reading-title">
            <div className="hub-section-heading">
              <h2 id="hub-reading-title">
                <Library size={18} aria-hidden="true" /> Field notes
              </h2>
              <Link to="/guides" className="hub-text-link">
                All guides <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="hub-reading-grid">
              {reading.map(({ path, category, title, detail }) => (
                <Link key={path} to={path} className="hub-reading-link">
                  <span className="hub-eyebrow">{category}</span>
                  <h3>
                    {title}
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </h3>
                  <p>{detail}</p>
                </Link>
              ))}
            </div>
          </section>

          <HubLabs />

          <section className="hub-horizon" aria-labelledby="hub-horizon-title">
            <div className="hub-section-heading">
              <h2 id="hub-horizon-title">On the horizon</h2>
              <span>Planned projects</span>
            </div>
            <ul>
              {upcoming.map(({ name, detail, icon: Icon }) => (
                <li key={name}>
                  <Icon size={20} aria-hidden="true" />
                  <div>
                    <h3>{name}</h3>
                    <p>{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <div className="hub-bottom-links">
            <Link to="/privacy">Privacy choices</Link>
            <Link to="/services">
              Visit the real-world Sattari <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
