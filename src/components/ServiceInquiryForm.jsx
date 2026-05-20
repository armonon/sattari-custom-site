// ServiceInquiryForm.jsx
import * as Sentry from '@sentry/react';
import { useState } from 'react';

const SERVICE_OPTIONS = [
  { value: 'instrument-sales', label: 'Instruments / gear' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'rentals', label: 'Instrument rentals' },
  { value: 'rehearsal', label: 'Rehearsal space' },
  { value: 'studio', label: 'Rental studio' },
  { value: 'lessons', label: 'Teachers / classes' },
];

export default function ServiceInquiryForm({
  initialService = '',
  source = 'Website service form',
}) {
  const [form, setForm] = useState({
    service: initialService,
    name: '',
    email: '',
    phone: '',
    details: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const body = new URLSearchParams({
        'form-name': 'service-inquiry',
        source,
        ...form,
      });

      const response = await fetch('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const responseError = new Error('Unable to send your inquiry right now.');

        Sentry.captureException(responseError, {
          tags: {
            feature: 'service-inquiry',
            status: String(response.status),
            provider: 'netlify-forms',
          },
          extra: { source, service: form.service },
        });
        responseError.sentryCaptured = true;

        throw responseError;
      }

      setSubmitted(true);
    } catch (submitError) {
      if (!submitError.sentryCaptured) {
        Sentry.captureException(submitError, {
          tags: { feature: 'service-inquiry' },
          extra: { source, service: form.service },
        });
      }
      setError(submitError.message || 'Unable to send your inquiry right now.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="service-form-glass">
        <p className="card-kicker">Inquiry sent</p>
        <h3>Thank you!</h3>
        <p>We’ve received your request and we’ll follow up soon with the next steps.</p>
      </div>
    );
  }

  return (
    <form className="service-form-glass" onSubmit={handleSubmit}>
      <p className="card-kicker">Local service request</p>
      <h3>Service Inquiry</h3>
      <p className="form-helper">
        Tell us what you need, when you need it, and any details that will help us guide you.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <label>
        <span>Service Type</span>
        <select name="service" value={form.service} onChange={handleChange} required>
          <option value="" disabled>
            Select a service
          </option>
          {SERVICE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Your Name</span>
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
        <span>Phone</span>
        <input
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          autoComplete="tel"
          placeholder="Optional"
        />
      </label>
      <label>
        <span>Describe what you need</span>
        <textarea
          name="details"
          value={form.details}
          onChange={handleChange}
          rows={4}
          placeholder="Timing, location, gear, and what you are trying to solve"
          required
        />
      </label>
      <button className="button button-solid button-full" type="submit" disabled={submitting}>
        {submitting ? 'Sending...' : 'Send service request'}
      </button>
    </form>
  );
}
