import * as Sentry from '@sentry/react';
import { useState, type FormEvent, type ChangeEvent } from 'react';

/**
 * Alpha-access signup for the Sattari Audio Suite.
 *
 * Deliberately posts through the existing service-inquiry pipeline
 * (Netlify Forms first, `/api/service-inquiry` function as fallback) using the
 * `audio-alpha` service type, so signups land in the same inbox and Netlify
 * Blobs store the shop already relies on — no second email integration to keep
 * configured or pay for.
 */

const DAW_OPTIONS = [
  'Logic Pro',
  'Ableton Live',
  'Pro Tools',
  'FL Studio',
  'Studio One',
  'Reaper',
  'Cubase',
  'GarageBand',
  'Other / not sure',
];

interface FormState {
  name: string;
  email: string;
  daw: string;
  notes: string;
}

const EMPTY: FormState = { name: '', email: '', daw: '', notes: '' };

export default function AudioAlphaSignup() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    // The shared inquiry pipeline requires a non-empty `details`, so the DAW and
    // any notes are folded into one readable block rather than sent as extra
    // fields the Netlify form and function would both have to learn about.
    const details = [
      `DAW / host: ${form.daw || 'Not specified'}`,
      '',
      form.notes || 'No extra notes.',
    ]
      .join('\n')
      .trim();

    const payload = {
      service: 'audio-alpha',
      name: form.name,
      email: form.email,
      phone: '',
      details,
      source: 'Audio Suite alpha signup',
    };

    try {
      const body = new URLSearchParams({ 'form-name': 'service-inquiry', ...payload });

      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const fallbackResponse = await fetch('/api/service-inquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const fallbackResult = await fallbackResponse.json().catch(() => ({}));

        if (!fallbackResponse.ok) {
          const responseError = new Error(
            fallbackResult.error || 'Unable to submit your request right now.'
          ) as Error & { sentryCaptured?: boolean };

          Sentry.captureException(responseError, {
            tags: {
              feature: 'audio-alpha-signup',
              netlifyFormsStatus: String(response.status),
              fallbackStatus: String(fallbackResponse.status),
            },
          });
          responseError.sentryCaptured = true;
          throw responseError;
        }
      }

      setSubmitted(true);
    } catch (submitError) {
      const err = submitError as Error & { sentryCaptured?: boolean };
      if (!err.sentryCaptured) {
        Sentry.captureException(err, { tags: { feature: 'audio-alpha-signup' } });
      }
      setError(err.message || 'Unable to submit your request right now.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="service-form-glass audio-alpha-form" id="alpha-signup">
        <p className="card-kicker">Request received</p>
        <h3>You&rsquo;re on the alpha list.</h3>
        <p>
          Thanks for signing up. We&rsquo;ll email you at <strong>{form.email}</strong> when a build
          is ready for your setup. Alpha invites go out in small batches, so it may be a little
          while.
        </p>
      </div>
    );
  }

  return (
    <form className="service-form-glass audio-alpha-form" id="alpha-signup" onSubmit={handleSubmit}>
      <p className="card-kicker">Alpha access</p>
      <h3>Request an alpha invite</h3>
      <p className="form-helper">
        The suite is in private alpha — there is no public download yet. Leave your details and
        we&rsquo;ll reach out as testing opens up.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <label>
        <span>Your name</span>
        <input
          name="name"
          type="text"
          value={form.name}
          onChange={handleChange}
          autoComplete="name"
          placeholder="Your name"
          required
        />
      </label>

      <label>
        <span>Email</span>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </label>

      <label>
        <span>Main DAW</span>
        <select name="daw" value={form.daw} onChange={handleChange} required>
          <option value="" disabled>
            Select your DAW
          </option>
          {DAW_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>What would you test? (optional)</span>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Vocals, mixing, sound design — and your Mac (Apple silicon or Intel)"
        />
      </label>

      <button className="button button-solid button-full" type="submit" disabled={submitting}>
        {submitting ? 'Sending…' : 'Request alpha access'}
      </button>

      <p className="audio-alpha-privacy">
        We only use this to contact you about the alpha. No newsletter, no sharing.
      </p>
    </form>
  );
}
