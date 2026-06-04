import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SEO, StructuredData } from '../utils/seo';
import {
  getAllNOWProfiles,
  getNOWAppConnections,
  getNOWProfile,
  getNOWProfileReadiness,
} from '../data/nowProfiles';
import { fetchNOWProfile } from '../utils/nowProfileApi';

const statusCopy = {
  active: 'Live connection',
  ready: 'Ready to connect',
  planned: 'Planned',
};

export default function NowProfilePage() {
  const { handle } = useParams();
  const fallbackProfile = useMemo(() => getNOWProfile(handle), [handle]);
  const [selectedProfile, setSelectedProfile] = useState(fallbackProfile);
  const [profileSource, setProfileSource] = useState('seed');
  const [profileStatus, setProfileStatus] = useState('Loading NOW profile…');
  const profiles = getAllNOWProfiles();
  const connections = getNOWAppConnections(selectedProfile);
  const readiness = getNOWProfileReadiness();

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const result = await fetchNOWProfile(handle || 'armon');
        if (!active) return;
        setSelectedProfile(result.profile);
        setProfileSource(result.storage?.source || 'api');
        setProfileStatus(
          result.storage?.source === 'stored'
            ? 'Loaded from durable NOW profile storage.'
            : 'Loaded from seeded NOW profile data.'
        );
      } catch (error) {
        if (!active) return;
        setSelectedProfile(fallbackProfile);
        setProfileSource('fallback');
        setProfileStatus(
          error.status === 404
            ? 'No saved profile exists for this handle yet.'
            : 'Using local profile fallback while the API is unavailable.'
        );
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [fallbackProfile, handle]);

  const profileSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `${selectedProfile.displayName} — NOW Profile`,
    url: `https://sattarimusic.com/profiles/${selectedProfile.handle}`,
    about: {
      '@type': 'Person',
      name: selectedProfile.displayName,
      description: selectedProfile.bio,
    },
  };

  return (
    <section className="section page-header-offset now-profile-page">
      <SEO
        title={`${selectedProfile.displayName} — NOW Profile`}
        description={`${selectedProfile.displayName}'s universal Sattari/NOW profile for Store, Market, Radio, Teach, Community, and Downloads.`}
        url={`https://sattarimusic.com/profiles/${selectedProfile.handle}`}
      />
      <StructuredData data={profileSchema} />

      <div className={`container now-profile-hero now-profile-hero-${selectedProfile.bannerTone}`}>
        <div className="now-profile-avatar" aria-hidden="true">
          {selectedProfile.avatarInitials}
        </div>
        <div className="now-profile-main-copy">
          <p className="eyebrow">NOW universal profile</p>
          <h1>{selectedProfile.displayName}</h1>
          <p className="hero-lede">{selectedProfile.headline}</p>
          <p>{selectedProfile.bio}</p>
          <div className="now-profile-meta" aria-label="Profile facts">
            <span>@{selectedProfile.handle}</span>
            <span>{selectedProfile.location}</span>
            <span>{selectedProfile.roles.length} roles</span>
            <span>{profileSource} profile</span>
          </div>
          <div className="now-profile-actions">
            <Link to={`/profiles/${selectedProfile.handle}/edit`} className="primary-button">
              Edit / claim profile
            </Link>
            <span className="now-profile-api-status">{profileStatus}</span>
          </div>
        </div>
      </div>

      <div className="container now-profile-switcher" aria-label="Available NOW profiles">
        {profiles.map((profile) => (
          <Link
            className={`now-profile-tab${profile.handle === selectedProfile.handle ? ' now-profile-tab-active' : ''}`}
            to={`/profiles/${profile.handle}`}
            key={profile.id}
          >
            @{profile.handle}
          </Link>
        ))}
      </div>

      <section className="container now-profile-section" aria-labelledby="now-profile-roles-title">
        <div>
          <p className="card-kicker">Identity roles</p>
          <h2 id="now-profile-roles-title">One profile, many app permissions.</h2>
          <p>
            NOW gives each person or brand one reusable identity layer so Store, Market, Radio,
            Teach, Community, and Downloads do not need separate profile systems.
          </p>
        </div>
        <ul className="now-role-list" aria-label="Profile roles">
          {selectedProfile.roles.map((role) => (
            <li key={role}>{role.replace('-', ' ')}</li>
          ))}
        </ul>
      </section>

      <section className="container now-profile-section" aria-labelledby="now-apps-title">
        <div>
          <p className="card-kicker">App connections</p>
          <h2 id="now-apps-title">The profile rail is already mapped across the apps.</h2>
          <p>
            Active connections can show profile identity now. Ready/planned connections define the
            next safe handoff before auth, payments, messaging, or private data are added.
          </p>
        </div>
        <div className="now-app-grid">
          {connections.map((connection) => (
            <article className="info-card now-app-card" key={connection.id}>
              <div className="now-app-card-topline">
                <p className="card-kicker">{connection.name}</p>
                <span className={`now-status-pill now-status-${connection.profileStatus}`}>
                  {statusCopy[connection.profileStatus] ?? 'Planned'}
                </span>
              </div>
              <h3>{connection.profileLabel}</h3>
              <p>{connection.profileSummary}</p>
              <p className="now-app-description">{connection.description}</p>
              <Link to={connection.route} className="text-link">
                Open {connection.name}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section
        className="container now-profile-section now-featured-panel"
        aria-labelledby="now-featured-title"
      >
        <div>
          <p className="card-kicker">Connected work</p>
          <h2 id="now-featured-title">Featured surfaces using this profile.</h2>
        </div>
        <div className="now-featured-list">
          {selectedProfile.featured.map((item) => (
            <Link to={item.route} key={`${item.appId}-${item.title}`}>
              <span>{item.appId}</span>
              <strong>{item.title}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="container now-profile-readiness"
        aria-label="NOW profile readiness summary"
      >
        <div>
          <strong>{readiness.profileCount}</strong>
          <span>seed profiles</span>
        </div>
        <div>
          <strong>{readiness.appCount}</strong>
          <span>app rails mapped</span>
        </div>
        <div>
          <strong>{readiness.activeConnectionCount}</strong>
          <span>active connections</span>
        </div>
      </section>
    </section>
  );
}
