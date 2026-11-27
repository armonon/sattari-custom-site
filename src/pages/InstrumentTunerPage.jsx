import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import NotFoundPage from '../components/NotFoundPage';
import { getInstrumentTunerPage } from '../data/instrumentTunerPages';
import { absoluteUrl, breadcrumbSchema } from '../data/siteSeo';
import InstrumentTuner from '../labs/keybpm/InstrumentTuner';
import { SEO, StructuredData } from '../utils/seo';
import { useHydratedSearchParams } from './useHydratedSearchParams';
import '../labs/audio/audioLabs.css';
import './InstrumentTunerPage.css';

export default function InstrumentTunerPage({ instrument }) {
  const params = useParams();
  const preset = useHydratedSearchParams().get('preset');
  const page = getInstrumentTunerPage(instrument ?? params.instrument);
  if (!page) return <NotFoundPage />;
  const initialPreset = page.presets.includes(preset) ? preset : page.slug;
  const url = absoluteUrl(page.path);
  const hub = '/studio/keybpm';
  const label = `${page.name} tuner`;
  return (
    <div className="alab-page instrument-tuner-page">
      <SEO title={page.title} description={page.description} url={url} />
      <StructuredData
        data={breadcrumbSchema([
          { name: 'Sattari Music', path: '/' },
          { name: 'Music tuner and song key detector', path: hub },
          { name: label, path: page.path },
        ])}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: page.heading,
          description: page.description,
          isAccessibleForFree: true,
          isPartOf: { '@id': absoluteUrl('/#website') },
          about: { '@id': absoluteUrl(hub + '#application') },
        }}
      />
      <div className="alab-shell">
        <nav className="instrument-page-nav" aria-label="Music tools">
          <Link to={hub}>
            <ArrowLeft size={16} aria-hidden="true" /> All instrument tuners
          </Link>
          <Link to={hub + '#song-key'}>
            Song key and BPM finder <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>
        <InstrumentTuner
          key={page.slug + initialPreset}
          instrumentPage={page}
          initialPreset={initialPreset}
        />
        <section className="instrument-guide" aria-label={`${page.name} tuning guide`}>
          {page.tips.map(([heading, text]) => (
            <div key={heading}>
              <h2>{heading}</h2>
              <p>{text}</p>
            </div>
          ))}
        </section>
        <nav
          className="instrument-page-related"
          aria-label={`Related ${page.name.toLowerCase()} resources`}
        >
          {page.links.map(([text, path]) => (
            <Link to={path} key={path}>
              {text}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
