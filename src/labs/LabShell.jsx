import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { SEO } from '../utils/seo';
import { LAB_SEO } from './labsSeo';
import SattariAppMetadata from '../pwa/SattariAppMetadata';
import { InstallAppButton } from '../pwa/StudioPwaUi';
import { SuiteMenu } from '../suite/SuiteUi';
import './labs.css';

/**
 * Shared frame for the wave-2 alpha tools: breadcrumb, heading with an Alpha
 * badge, a one-line pitch and an always-visible list of honest limitations.
 */
export default function LabShell({ lab, name, tagline, limitations, className = '', children }) {
  return (
    <>
      <SEO {...LAB_SEO[lab]} />
      {/* Press lives at /press, outside the installable app's /studio/ scope. */}
      {lab !== 'press' && <SattariAppMetadata />}
      <section className={`lab-page lab-${lab} ${className}`.trim()}>
        <div className="lab-shell">
          <nav className="lab-breadcrumb" aria-label="Music tools">
            <Link to="/hub">
              <ArrowLeft size={15} aria-hidden="true" /> Sattari Hub
            </Link>
            <span className="lab-breadcrumb-end">
              <Link to="/studio">
                Open StemDeck <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
              {lab !== 'press' && (
                <InstallAppButton className="lab-install">Install Sattari app</InstallAppButton>
              )}
              <SuiteMenu />
            </span>
          </nav>
          <header className="lab-heading">
            <div>
              <p className="lab-eyebrow">Sattari music tools</p>
              <h1>
                {name} <span className="lab-badge">Alpha</span>
              </h1>
              <p className="lab-tagline">{tagline}</p>
            </div>
            <span className="lab-private">
              <ShieldCheck size={16} aria-hidden="true" /> Runs in your browser. Nothing is
              uploaded.
            </span>
          </header>
          {children}
          <details className="lab-limits">
            <summary>Alpha: what this does not do yet</summary>
            <ul>
              {limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </div>
      </section>
    </>
  );
}
