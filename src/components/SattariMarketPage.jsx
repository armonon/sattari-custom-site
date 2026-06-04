import { Link } from 'react-router-dom';
import { SEO, StructuredData } from '../utils/seo';
import NowTenantProfileCard from './NowTenantProfileCard';
import { getNOWStagedUserJourney } from '../data/nowProfiles';
import {
  sattariMarketCategories,
  sattariMarketGuardrails,
  sattariMarketSampleListings,
  sattariMarketSources,
  sattariMarketTenant,
} from '../data/sattariMarket';

const statusLabels = {
  'ready-for-local-prototype': 'Prototype-ready',
  'separate-official-catalog': 'Official store stays separate',
  'approval-and-compliance-gated': 'Approval/compliance gated',
};

export default function SattariMarketPage() {
  const stagedJourney = getNOWStagedUserJourney('armon', 'sattari_market', 'market_listing');

  const pageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Sattari Market',
    url: 'https://sattarimusic.com/internal/market-concept',
    description:
      'Sattari Market concept page for NOW-powered music gear listings, source labels, and user-listing guardrails.',
  };

  return (
    <section className="section page-header-offset sattari-market-page">
      <SEO
        title="Sattari Market — Music Gear Listing Concept"
        description="Preview the safe Sattari Market concept: music gear listings, NOW seller-profile trust, source labels, and clear guardrails before live connectors or marketplace payments."
        url="https://sattarimusic.com/internal/market-concept"
        robots="noindex,nofollow"
      />
      <StructuredData data={pageSchema} />

      <div className="container section-header narrow sattari-market-hero">
        <p className="eyebrow">NOW-powered marketplace concept</p>
        <h1>{sattariMarketTenant.name}</h1>
        <p className="hero-lede">{sattariMarketTenant.tagline}</p>
        <p>{sattariMarketTenant.description}</p>
        <div className="market-hero-actions" aria-label="Sattari Market actions">
          <Link className="button button-solid" to="/profiles/armon">
            Open NOW profile
          </Link>
          <Link className="button button-outline" to="/shop">
            Shop official Sattari products
          </Link>
          <Link className="button button-outline" to="/services">
            Ask about local services
          </Link>
        </div>
        <NowTenantProfileCard
          handle="armon"
          tenantId="sattari_market"
          variant="market_listing"
          eyebrow="Market seller identity"
        />
      </div>

      <div
        className="container market-disclosure-card"
        role="note"
        aria-label="Prototype disclosure"
      >
        <p className="card-kicker">Prototype boundary</p>
        <h2>Official shop, user listings, and external sources stay clearly separated.</h2>
        <p>
          {sattariMarketTenant.profileLayer} This page reuses the verified Market guardrail copy for
          Sattari-specific positioning without adding live marketplace connectors, checkout,
          scraping, or external messaging.
        </p>
      </div>

      <section
        className="container market-section-split now-staged-journey"
        aria-labelledby="now-market-staged-journey-title"
      >
        <div>
          <p className="card-kicker">Staged user flow</p>
          <h2 id="now-market-staged-journey-title">Profile to Market, without private data.</h2>
          <p>{stagedJourney.label}</p>
          <p>
            This is the smokeable path a reviewer can try now: open Armon&apos;s public NOW profile,
            enter the noindexed Market concept card, then use contact-first or official-shop paths
            instead of native marketplace actions.
          </p>
        </div>
        <ol className="market-chip-list" aria-label="NOW Market staged user-flow steps">
          {stagedJourney.steps.map((step) => (
            <li key={step.id}>
              <strong>{step.label}</strong>
              <span>{step.route}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="container card-grid three-col market-source-grid">
        {sattariMarketSources.map((source) => (
          <article className="info-card market-source-card" key={source.id}>
            <p className="card-kicker">Source lane</p>
            <h3>{source.label}</h3>
            <span className={`market-status market-status-${source.status}`}>
              {statusLabels[source.status]}
            </span>
            <p>{source.copy}</p>
          </article>
        ))}
      </div>

      <section className="container market-section-split" aria-labelledby="market-categories-title">
        <div>
          <p className="card-kicker">Sattari categories</p>
          <h2 id="market-categories-title">Built first around musicians and studios.</h2>
          <p>
            The Sattari tenant keeps the universal Market model focused on gear and local music
            needs before broader marketplace themes are turned on.
          </p>
        </div>
        <ul className="market-chip-list" aria-label="Sattari Market categories">
          {sattariMarketCategories.map((category) => (
            <li key={category}>{category}</li>
          ))}
        </ul>
      </section>

      <section className="container market-listing-panel" aria-labelledby="market-listings-title">
        <div className="shop-collection-header">
          <div>
            <p className="card-kicker">Seed listing model</p>
            <h2 id="market-listings-title">Listing cards show source and readiness.</h2>
          </div>
          <p>
            These are prototype cards only. They demonstrate how buyer-facing copy should disclose
            whether an item is official Sattari inventory, a manual seller listing, or an external
            link-out concept.
          </p>
        </div>
        <div className="market-listing-grid">
          {sattariMarketSampleListings.map((listing) => (
            <article className="info-card market-listing-card" key={listing.id}>
              <p className="card-kicker">{listing.category}</p>
              <h3>{listing.title}</h3>
              <dl>
                <div>
                  <dt>Source</dt>
                  <dd>{listing.source}</dd>
                </div>
                <div>
                  <dt>Seller</dt>
                  <dd>{listing.seller}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{listing.location}</dd>
                </div>
              </dl>
              <p className="market-listing-price">{listing.price}</p>
              <span className="market-readiness-pill">{listing.readiness}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="container market-guardrails" aria-labelledby="market-guardrails-title">
        <p className="card-kicker">Hard guardrails</p>
        <h2 id="market-guardrails-title">What this page does not do yet</h2>
        <ul className="bullet-list">
          {sattariMarketGuardrails.map((guardrail) => (
            <li key={guardrail}>{guardrail}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
