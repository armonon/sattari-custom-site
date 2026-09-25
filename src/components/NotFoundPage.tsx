import { Link, useLocation } from 'react-router-dom';
import { SEO } from '../utils/seo';

export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <section className="section page-header-offset">
      <SEO
        title="Page Not Found"
        description="This Sattari Music page could not be found. Browse instruments, local services or music tools."
        url={`https://sattarimusic.com${pathname}`}
        noindex
      />
      <div className="container section-header narrow">
        <h1>Page not found</h1>
        <p>This page may have moved. The shop and music tools are still here.</p>
        <div className="hero-actions">
          <Link to="/shop" className="button button-solid">
            Shop instruments
          </Link>
          <Link to="/hub" className="button button-outline">
            Sattari Hub
          </Link>
        </div>
      </div>
    </section>
  );
}
