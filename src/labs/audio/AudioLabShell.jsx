import { Link } from 'react-router-dom';
import { ArrowLeft, FlaskConical, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { SEO } from '../../utils/seo';
import { LAB_TOOLS } from './audioLabTools';
import './audioLabs.css';

const ORIGIN = 'https://sattarimusic.com';

/** Shared frame for the Studio alpha labs: alpha label, honest limits, sibling links. */
export default function AudioLabShell({
  tool,
  title,
  eyebrow,
  summary,
  description,
  limits,
  children,
}) {
  const current = LAB_TOOLS.find((item) => item.id === tool);
  return (
    <>
      <SEO
        title={`${title} alpha · Sattari Studio lab`}
        description={description}
        url={`${ORIGIN}${current.path}`}
        noindex
      />
      <div className="alab-page" data-lab={tool}>
        <div className="alab-shell">
          <nav className="alab-breadcrumb" aria-label="Breadcrumb">
            <Link to="/hub">
              <ArrowLeft size={14} aria-hidden="true" /> Sattari Hub
            </Link>
            <Link to="/studio">
              <SlidersHorizontal size={14} aria-hidden="true" /> Open StemDeck
            </Link>
          </nav>
          <header className="alab-heading">
            <div>
              <p className="alab-eyebrow">{eyebrow}</p>
              <h1>
                {title} <span className="alab-alpha">Alpha</span>
              </h1>
              <p className="alab-summary">{summary}</p>
            </div>
            <span className="alab-private">
              <ShieldCheck size={16} aria-hidden="true" /> Runs on your device. No uploads.
            </span>
          </header>
          {children}
          <section className="alab-limits" aria-labelledby={`${tool}-limits`}>
            <h2 id={`${tool}-limits`}>
              <FlaskConical size={16} aria-hidden="true" /> Alpha: what it does not do yet
            </h2>
            <ul>
              {limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </section>
          <nav className="alab-siblings" aria-label="Studio labs">
            {LAB_TOOLS.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                aria-current={item.id === tool ? 'page' : undefined}
                className={item.id === tool ? 'is-current' : undefined}
              >
                <strong>{item.name}</strong>
                <span>{item.blurb}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
