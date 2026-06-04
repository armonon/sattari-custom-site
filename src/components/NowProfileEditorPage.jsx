import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SEO } from '../utils/seo';
import { fetchNOWProfile, openNOWProfileLogin, saveNOWProfileDraft } from '../utils/nowProfileApi';
import { getNOWProfile, nowApps } from '../data/nowProfiles';
import { normalizeNOWHandle } from '../data/nowProfilePersistence';

function profileToForm(profile, fallbackHandle) {
  const handle = normalizeNOWHandle(profile?.handle || fallbackHandle || '') || '';

  return {
    handle,
    displayName: profile?.displayName || '',
    headline: profile?.headline || '',
    location: profile?.location || '',
    bio: profile?.bio || '',
    avatarInitials: profile?.avatarInitials || '',
    rolesText: (profile?.roles || []).join(', '),
    socialsText: (profile?.socials || [])
      .map((social) => `${social.label || ''} | ${social.url || ''}`)
      .join('\n'),
  };
}

function parseRoles(value) {
  return value
    .split(',')
    .map((role) => role.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean);
}

function parseSocials(value) {
  return value
    .split('\n')
    .map((line) => {
      const [label, ...urlParts] = line.split('|');
      const url = urlParts.join('|').trim();
      return { label: label.trim(), url };
    })
    .filter((social) => social.label && social.url);
}

function createDefaultApps() {
  return nowApps.reduce((apps, app) => {
    apps[app.id] = {
      status: app.id === 'community' ? 'active' : 'ready',
      label: `${app.name} profile connection`,
      summary: `This saved NOW profile can be reused by ${app.name}.`,
    };
    return apps;
  }, {});
}

export default function NowProfileEditorPage() {
  const { handle } = useParams();
  const initialHandle = normalizeNOWHandle(handle || 'armon') || 'armon';
  const [form, setForm] = useState(() =>
    profileToForm(getNOWProfile(initialHandle), initialHandle)
  );
  const [profileSource, setProfileSource] = useState('seed');
  const [status, setStatus] = useState('Loading profile editor…');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const publicProfileRoute = useMemo(
    () => `/profiles/${normalizeNOWHandle(form.handle) || initialHandle}`,
    [form.handle, initialHandle]
  );

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setError('');
      setStatus('Loading saved NOW profile…');

      try {
        const result = await fetchNOWProfile(initialHandle);
        if (!active) return;
        setForm(profileToForm(result.profile, initialHandle));
        setProfileSource(result.storage?.source || 'api');
        setStatus(
          result.storage?.source === 'stored'
            ? 'Loaded saved profile from NOW storage.'
            : 'Loaded seeded profile. Saving will create the durable profile record.'
        );
      } catch (loadError) {
        if (!active) return;
        if (loadError.status === 404) {
          setForm(profileToForm({ handle: initialHandle }, initialHandle));
          setProfileSource('new');
          setStatus('This handle is available. Saving will create a new NOW profile.');
          return;
        }
        setError(loadError.message || 'Unable to load NOW profile.');
        setStatus('Using local fallback data until the API is reachable.');
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [initialHandle]);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setStatus('Saving NOW profile…');

    try {
      const handleValue = normalizeNOWHandle(form.handle);
      const result = await saveNOWProfileDraft({
        handle: handleValue,
        displayName: form.displayName,
        headline: form.headline,
        location: form.location,
        bio: form.bio,
        avatarInitials: form.avatarInitials,
        roles: parseRoles(form.rolesText),
        socials: parseSocials(form.socialsText),
        apps: createDefaultApps(),
        featured: [
          {
            appId: 'community',
            title: `${form.displayName || handleValue}'s NOW profile`,
            route: `/profiles/${handleValue}`,
          },
        ],
      });

      setForm(profileToForm(result.profile, handleValue));
      setProfileSource('stored');
      setStatus('Saved. This profile is now available to every NOW-connected app.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save NOW profile.');
      setStatus('Save blocked until profile owner authentication is available.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignIn = () => {
    if (!openNOWProfileLogin()) {
      setError(
        'Profile login is not enabled on this deploy yet. Configure the auth provider, then this editor can save real user profiles.'
      );
    }
  };

  return (
    <section className="section page-header-offset now-profile-page now-profile-editor-page">
      <SEO
        title="Edit NOW Profile — Sattari"
        description="Create or update a reusable NOW profile for Sattari Store, Market, Radio, Teach, Community, and future apps."
        url={`https://sattarimusic.com/profiles/${initialHandle}/edit`}
      />

      <div className="container now-profile-editor-hero">
        <p className="eyebrow">NOW profile editor</p>
        <h1>Save one real profile for every app.</h1>
        <p className="hero-lede">
          This editor writes public profile fields to the shared NOW profile backend so a person or
          brand can carry the same identity across Store, Market, Radio, Teach, Community, and
          future apps.
        </p>
        <div className="now-profile-meta" aria-label="Editor status">
          <span>handle: @{form.handle || initialHandle}</span>
          <span>source: {profileSource}</span>
          <span>private fields blocked</span>
        </div>
      </div>

      <div className="container now-editor-layout">
        <form className="now-profile-editor-form" onSubmit={handleSubmit}>
          <div className="now-form-status" role="status">
            {status}
          </div>
          {error && <div className="now-form-error">{error}</div>}

          <label>
            Handle
            <input value={form.handle} onChange={updateField('handle')} placeholder="artist-name" />
          </label>

          <label>
            Display name
            <input
              value={form.displayName}
              onChange={updateField('displayName')}
              placeholder="Your name or brand"
            />
          </label>

          <label>
            Headline
            <input
              value={form.headline}
              onChange={updateField('headline')}
              placeholder="Producer, seller, teacher, community member…"
            />
          </label>

          <label>
            Location
            <input
              value={form.location}
              onChange={updateField('location')}
              placeholder="City, region"
            />
          </label>

          <label>
            Avatar initials
            <input
              value={form.avatarInitials}
              onChange={updateField('avatarInitials')}
              placeholder="AN"
            />
          </label>

          <label>
            Roles
            <input
              value={form.rolesText}
              onChange={updateField('rolesText')}
              placeholder="artist, seller, teacher"
            />
            <span className="now-field-hint">
              Comma-separated. These become app permission labels.
            </span>
          </label>

          <label>
            Bio
            <textarea value={form.bio} onChange={updateField('bio')} rows={5} />
          </label>

          <label>
            Public links
            <textarea
              value={form.socialsText}
              onChange={updateField('socialsText')}
              rows={4}
              placeholder="Website | https://example.com"
            />
            <span className="now-field-hint">
              One per line: Label | URL. No private email/payment fields.
            </span>
          </label>

          <div className="now-editor-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving…' : 'Save NOW profile'}
            </button>
            <button type="button" className="secondary-button" onClick={handleSignIn}>
              Sign in / claim handle
            </button>
            <Link to={publicProfileRoute} className="text-link">
              View public profile
            </Link>
          </div>
        </form>

        <aside className="now-editor-proof-card" aria-label="Profile system proof">
          <p className="card-kicker">What saves</p>
          <h2>Public identity only.</h2>
          <ul>
            <li>Saved server-side under one canonical handle.</li>
            <li>Readable by all NOW-connected apps through the same profile API.</li>
            <li>Owner/admin write guarded; anonymous edits are blocked.</li>
            <li>
              Vault, wallet, pass, email, payment, license, token, and secret fields are rejected.
            </li>
          </ul>
          <p>
            Once auth is configured on the deploy, this form becomes the real user-facing profile
            creation and update path.
          </p>
        </aside>
      </div>
    </section>
  );
}
