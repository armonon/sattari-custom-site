export const nowProfileApiPath = '/.netlify/functions/now-profile';
export const nowProfileSaveApiPath = '/.netlify/functions/now-profile-save';

function getNetlifyIdentityUser() {
  if (typeof window === 'undefined') return null;
  return window.netlifyIdentity?.currentUser?.() || null;
}

export async function getNOWProfileAuthToken() {
  const user = getNetlifyIdentityUser();

  if (!user) return null;
  if (typeof user.jwt === 'function') return user.jwt();
  if (user.token?.access_token) return user.token.access_token;
  return null;
}

export function canUseNOWProfileAuth() {
  return Boolean(getNetlifyIdentityUser());
}

export async function fetchNOWProfile(handle = 'armon', fetchImpl = fetch) {
  const params = new URLSearchParams({ handle });
  const response = await fetchImpl(`${nowProfileApiPath}?${params.toString()}`);
  const body = await response.json();

  if (!response.ok) {
    const error = new Error(body.error || 'Unable to load NOW profile.');
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export async function saveNOWProfileDraft(profileDraft, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const token = options.token ?? (await getNOWProfileAuthToken());

  if (!token) {
    throw new Error('Sign in before saving your NOW profile.');
  }

  const response = await fetchImpl(nowProfileSaveApiPath, {
    method: options.method || 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileDraft),
  });
  const body = await response.json();

  if (!response.ok) {
    const error = new Error(body.error || 'Unable to save NOW profile.');
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export function openNOWProfileLogin() {
  if (typeof window === 'undefined') return false;

  if (window.netlifyIdentity?.open) {
    window.netlifyIdentity.open();
    return true;
  }

  return false;
}
