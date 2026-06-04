import { connectLambda, getStore } from '@netlify/blobs';
import { getAllNOWProfiles } from '../../src/data/nowProfiles.js';
import {
  normalizeNOWHandle,
  nowProfilePublicWritableFields,
  nowProfileStoreName,
  readStoredNOWProfile,
  saveNOWProfile,
} from '../../src/data/nowProfilePersistence.js';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function getBearerToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function getAuthenticatedOwnerId(context) {
  const user = context?.clientContext?.user;
  return user?.sub || user?.id || user?.email || null;
}

function getWriteActor(event, context) {
  const configuredToken = process.env.NOW_PROFILE_WRITE_TOKEN;
  const isAdminToken = Boolean(configuredToken && getBearerToken(event) === configuredToken);

  if (isAdminToken) {
    return { actorType: 'admin-token', ownerId: 'admin' };
  }

  const ownerId = getAuthenticatedOwnerId(context);
  if (ownerId) {
    return { actorType: 'authenticated-user', ownerId };
  }

  return null;
}

function getSeedProfileByHandle(handle) {
  return getAllNOWProfiles().find((profile) => profile.handle === handle) || null;
}

function getProfileStore(event) {
  connectLambda(event);
  return getStore(nowProfileStoreName);
}

function parseBody(event) {
  if (!event.body) return {};
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  return JSON.parse(body);
}

export async function handler(event, context = {}) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!['POST', 'PATCH'].includes(event.httpMethod)) {
    return json(405, {
      schema: 'now-profile-save-error-v1',
      error: 'Method not allowed. Use POST or PATCH.',
    });
  }

  const actor = getWriteActor(event, context);

  if (!actor) {
    return json(401, {
      schema: 'now-profile-save-error-v1',
      error:
        'Profile writes require authenticated owner access. Configure NOW_PROFILE_WRITE_TOKEN or connect a real auth provider before enabling public saves.',
    });
  }

  let payload;
  try {
    payload = parseBody(event);
  } catch {
    return json(400, {
      schema: 'now-profile-save-error-v1',
      error: 'Request body must be valid JSON.',
    });
  }

  const handle = normalizeNOWHandle(payload.handle || event.queryStringParameters?.handle);
  if (!handle) {
    return json(400, {
      schema: 'now-profile-save-error-v1',
      error: 'A valid handle is required.',
    });
  }

  try {
    const store = getProfileStore(event);
    const storedProfile = await readStoredNOWProfile(store, handle);
    const seededProfile = getSeedProfileByHandle(handle);
    const existingProfile = storedProfile || seededProfile || { handle };

    if (actor.actorType !== 'admin-token') {
      if (storedProfile?.ownerId && storedProfile.ownerId !== actor.ownerId) {
        return json(403, {
          schema: 'now-profile-save-error-v1',
          error: 'This NOW profile handle is owned by another authenticated user.',
        });
      }

      if (!storedProfile && seededProfile) {
        return json(403, {
          schema: 'now-profile-save-error-v1',
          error: 'Seeded NOW profiles require admin-token access to edit.',
        });
      }
    }

    const savedProfile = await saveNOWProfile(store, { ...payload, handle }, existingProfile, {
      ownerId: storedProfile?.ownerId || actor.ownerId,
    });

    return json(event.httpMethod === 'POST' ? 201 : 200, {
      schema: 'now-profile-save-v1',
      profile: savedProfile,
      storage: {
        schema: 'now-profile-storage-v1',
        source: 'stored',
        store: nowProfileStoreName,
        globallyReadable: true,
      },
      writableFields: nowProfilePublicWritableFields,
      guardrails: [
        'Saved fields are public profile fields only.',
        'Private Vault, wallet, pass, email, saved items, inquiry, payment, license, secret, and token data are rejected.',
        'This endpoint is not open-anonymous; public user saves need owner auth before production launch.',
      ],
    });
  } catch (error) {
    return json(400, {
      schema: 'now-profile-save-error-v1',
      error: error.message || 'Unable to save NOW profile.',
    });
  }
}
