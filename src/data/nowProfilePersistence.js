import { getNOWProfile, nowApps, nowPublicProfileForbiddenFields } from './nowProfiles.js';

const MAX_TEXT_FIELD_LENGTH = 600;
const MAX_BIO_LENGTH = 2000;
const MAX_ARRAY_ITEMS = 24;

export const nowProfileStoreName = 'now-profiles-v1';

export const nowProfilePublicWritableFields = [
  'kind',
  'handle',
  'displayName',
  'headline',
  'location',
  'bio',
  'avatarInitials',
  'roles',
  'socials',
  'tenantIds',
  'apps',
  'featured',
  'tenantCards',
];

export function normalizeNOWHandle(value = '') {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || null;
}

export function getNOWProfileBlobKey(handle) {
  const normalizedHandle = normalizeNOWHandle(handle);
  if (!normalizedHandle) {
    throw new Error('A valid NOW profile handle is required.');
  }

  return `profiles/${normalizedHandle}.json`;
}

function sanitizeText(value, maxLength = MAX_TEXT_FIELD_LENGTH) {
  if (value === undefined || value === null) return undefined;

  return Array.from(String(value))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : character;
    })
    .join('')
    .trim()
    .slice(0, maxLength);
}

function sanitizeStringArray(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => sanitizeText(value, 64)).filter(Boolean))].slice(
    0,
    MAX_ARRAY_ITEMS
  );
}

function sanitizeURL(value) {
  const raw = sanitizeText(value, 300);
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function sanitizeSocials(values = []) {
  if (!Array.isArray(values)) return [];

  return values
    .map((item) => {
      const label = sanitizeText(item?.label, 80);
      const url = sanitizeURL(item?.url);
      return label && url ? { label, url } : null;
    })
    .filter(Boolean)
    .slice(0, MAX_ARRAY_ITEMS);
}

function sanitizeFeatured(values = []) {
  if (!Array.isArray(values)) return [];

  return values
    .map((item) => {
      const appId = sanitizeText(item?.appId, 80);
      const title = sanitizeText(item?.title, 140);
      const route = sanitizeText(item?.route, 180);
      return appId && title && route?.startsWith('/') ? { appId, title, route } : null;
    })
    .filter(Boolean)
    .slice(0, MAX_ARRAY_ITEMS);
}

function sanitizeApps(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return nowApps.reduce((apps, app) => {
    const input = value[app.id];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return apps;

    apps[app.id] = {
      status: sanitizeText(input.status, 40) || 'ready',
      label: sanitizeText(input.label, 160) || 'Profile connection ready',
      summary: sanitizeText(input.summary, 300) || 'This app can read the shared NOW profile.',
    };
    return apps;
  }, {});
}

function sanitizeTenantCards(values = []) {
  if (!Array.isArray(values)) return [];

  return values
    .map((item) => {
      const tenantId = sanitizeText(item?.tenantId, 80);
      const variant = sanitizeText(item?.variant, 80);
      const title = sanitizeText(item?.title, 140);
      const subtitle = sanitizeText(item?.subtitle, 180);
      const trustSignals = sanitizeStringArray(item?.trustSignals || []).slice(0, 8);

      return tenantId && variant && title
        ? { tenantId, variant, title, subtitle: subtitle || '', trustSignals }
        : null;
    })
    .filter(Boolean)
    .slice(0, MAX_ARRAY_ITEMS);
}

function rejectPrivateProfileFields(payload = {}) {
  const serializedKeys = Object.keys(payload).map((key) => key.toLowerCase());
  return nowPublicProfileForbiddenFields.filter((field) =>
    serializedKeys.includes(field.toLowerCase())
  );
}

export function sanitizeNOWProfileDraft(payload = {}, existingProfile = {}) {
  const privateFields = rejectPrivateProfileFields(payload);
  if (privateFields.length > 0) {
    throw new Error(`Private NOW profile fields are not accepted: ${privateFields.join(', ')}`);
  }

  const handle = normalizeNOWHandle(payload.handle ?? existingProfile.handle);
  if (!handle) {
    throw new Error('A valid NOW profile handle is required.');
  }

  const defaultApps = nowApps.reduce((apps, app) => {
    apps[app.id] = existingProfile.apps?.[app.id] || {
      status: 'ready',
      label: 'Profile connection ready',
      summary: 'This app can read the shared NOW profile.',
    };
    return apps;
  }, {});

  const incomingApps = sanitizeApps(payload.apps);
  const displayName = sanitizeText(payload.displayName ?? existingProfile.displayName, 120);

  return {
    id: sanitizeText(existingProfile.id, 80) || `prf_${handle}`,
    kind: sanitizeText(payload.kind ?? existingProfile.kind, 40) || 'person',
    handle,
    displayName: displayName || handle,
    headline: sanitizeText(payload.headline ?? existingProfile.headline, 220) || '',
    location: sanitizeText(payload.location ?? existingProfile.location, 120) || '',
    bio: sanitizeText(payload.bio ?? existingProfile.bio, MAX_BIO_LENGTH) || '',
    avatarInitials:
      sanitizeText(payload.avatarInitials ?? existingProfile.avatarInitials, 4) ||
      displayName
        ?.split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() ||
      handle.slice(0, 2).toUpperCase(),
    bannerTone: sanitizeText(existingProfile.bannerTone, 40) || 'dark',
    roles: sanitizeStringArray(payload.roles ?? existingProfile.roles),
    tenantIds: sanitizeStringArray(payload.tenantIds ?? existingProfile.tenantIds),
    socials: sanitizeSocials(payload.socials ?? existingProfile.socials),
    apps: { ...defaultApps, ...incomingApps },
    featured: sanitizeFeatured(payload.featured ?? existingProfile.featured),
    tenantCards: sanitizeTenantCards(payload.tenantCards ?? existingProfile.tenantCards),
    updatedAt: new Date().toISOString(),
    schema: 'now-global-profile-v1',
  };
}

export async function readStoredNOWProfile(store, handle) {
  if (!store) return null;

  const key = getNOWProfileBlobKey(handle);
  const value = await store.get(key, { type: 'json', consistency: 'strong' });
  return value || null;
}

export async function readNOWProfileWithFallback(store, handle = 'armon') {
  const normalizedHandle = normalizeNOWHandle(handle) || 'armon';
  const storedProfile = await readStoredNOWProfile(store, normalizedHandle);

  if (storedProfile) {
    const profile = sanitizeNOWProfileDraft(storedProfile, storedProfile);
    if (storedProfile.ownerId) profile.ownerId = storedProfile.ownerId;
    return { profile, source: 'stored' };
  }

  return { profile: getNOWProfile(normalizedHandle), source: 'seed' };
}

export async function saveNOWProfile(store, payload, existingProfile, options = {}) {
  if (!store) {
    throw new Error('NOW profile store is not configured.');
  }

  const sanitizedProfile = sanitizeNOWProfileDraft(payload, existingProfile);
  const ownerId = options.ownerId || existingProfile?.ownerId;
  if (ownerId) sanitizedProfile.ownerId = ownerId;
  const key = getNOWProfileBlobKey(sanitizedProfile.handle);

  await store.setJSON(key, sanitizedProfile, {
    metadata: {
      schema: sanitizedProfile.schema,
      handle: sanitizedProfile.handle,
      updatedAt: sanitizedProfile.updatedAt,
    },
  });

  return sanitizedProfile;
}

export function createMemoryNOWProfileStore(initialProfiles = {}) {
  const data = new Map(
    Object.entries(initialProfiles).map(([key, value]) => [key, JSON.parse(JSON.stringify(value))])
  );

  return {
    async get(key) {
      const value = data.get(key);
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    async setJSON(key, value) {
      data.set(key, JSON.parse(JSON.stringify(value)));
    },
    dump() {
      return Object.fromEntries(data.entries());
    },
  };
}
