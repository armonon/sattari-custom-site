import { Link } from 'react-router-dom';
import { ArrowUpRight, FlaskConical } from 'lucide-react';
import { LAB_APPS } from './labsSeo';
import { LAB_TOOLS } from './audio/audioLabTools';
import './hubLabs.css';

// One list for every wave-2 alpha tool: the audio labs (Split, Key & BPM, Vox)
// first, then Canvas, Pocket and Press.
const HUB_LABS = [
  ...LAB_TOOLS.map(({ id, name, path, blurb }) => ({ id, name, path, detail: blurb })),
  ...LAB_APPS,
];

/** Hub listing for the wave-2 alpha tools. */
export default function HubLabs() {
  return (
    <section className="hub-reading hub-labs" aria-labelledby="hub-labs-title">
      <div className="hub-section-heading">
        <h2 id="hub-labs-title">
          <FlaskConical size={18} aria-hidden="true" /> Labs
        </h2>
        <span>Alpha tools</span>
      </div>
      <div className="hub-labs-grid">
        {HUB_LABS.map(({ id, name, path, detail }) => (
          <Link key={id} to={path} className="hub-reading-link">
            <span className="hub-eyebrow">Alpha</span>
            <h3>
              {name}
              <ArrowUpRight size={20} aria-hidden="true" />
            </h3>
            <p>{detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
