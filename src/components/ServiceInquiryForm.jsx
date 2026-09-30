// ServiceInquiryForm.jsx
import { captureException } from '../utils/monitoring';
import { useEffect, useRef, useState } from 'react';
import StudioBookingForm from './StudioBookingForm';
import { trackSiteEvent } from '../utils/siteMeasurement';

const SERVICE_OPTIONS = [
  { value: 'instrument-sales', label: 'Instruments / gear' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'rentals', label: 'Instrument rentals' },
  { value: 'rehearsal', label: 'Rehearsal space' },
  { value: 'studio', label: 'Rental studio' },
  { value: 'lessons', label: 'Teachers / classes' },
];

// Off-screen rather than display:none, which some bots skip. Named to match the
// netlify-honeypot field on the static form in index.html; the fallback
// function ignores submissions that fill it too.
const HONEYPOT_STYLE = {
  position: 'absolute',
  left: '-10000px',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
};

export default function ServiceInquiryForm({
  initialService = '',
  service: controlledService = undefined,
  onServiceChange = undefined,
  source = 'Website service form',
  compact = false,
}) {
  const [form, setForm] = useState({
    service: initialService,
    name: '',
    email: '',
    phone: '',
    details: '',
    'bot-field': '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const service = controlledService ?? form.service;
  const confirmationRef = useRef(null);
  const serviceSelectRef = useRef(null);
  const focusFormRef = useRef(false);
  const submissionVersion = useRef(0);

  useEffect(() => {
    if (controlledService !== undefined) return;
    setForm((current) =>
      current.service === initialService ? current : { ...current, service: initialService }
    );
  }, [initialService, controlledService]);

  useEffect(() => {
    setSubmitted(false);
    setSubmitting(false);
    setError('');
    // An earlier service's response must not replace this service's form.
    return () => {
      submissionVersion.current += 1;
    };
  }, [service]);

  useEffect(() => {
    if (submitted) confirmationRef.current?.focus();
    else if (focusFormRef.current) {
      serviceSelectRef.current?.focus();
      focusFormRef.current = false;
    }
  }, [submitted]);

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'service') {
      onServiceChange?.(value);
      if (controlledService !== undefined) return;
    }
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const version = ++submissionVersion.current;
    const inquiry = { ...form, service };
    setSubmitting(true);
    setError('');

    try {
      const body = new URLSearchParams({
        'form-name': 'service-inquiry',
        source,
        ...inquiry,
      });

      const response = await fetch('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const fallbackResponse = await fetch('/api/service-inquiry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...inquiry, source }),
        });
        const fallbackResult = await fallbackResponse.json().catch(() => ({}));

        if (!fallbackResponse.ok) {
          const responseError = new Error(
            fallbackResult.error || 'Unable to send your inquiry right now.'
          );

          captureException(responseError, {
            tags: {
              feature: 'service-inquiry',
              netlifyFormsStatus: String(response.status),
              fallbackStatus: String(fallbackResponse.status),
            },
            extra: { source, service },
          });
          responseError.sentryCaptured = true;

          throw responseError;
        }
      }

      if (version === submissionVersion.current) setSubmitted(true);
      trackSiteEvent('inquiry_sent');
    } catch (submitError) {
      if (!submitError.sentryCaptured) {
        captureException(submitError, {
          tags: { feature: 'service-inquiry' },
          extra: { source, service },
        });
      }
      if (version === submissionVersion.current) {
        setError(submitError.message || 'Unable to send your inquiry right now.');
      }
    } finally {
      if (version === submissionVersion.current) setSubmitting(false);
    }
  }

  if (['studio', 'rehearsal'].includes(service)) {
    return (
      <div className="service-form-glass">
        <label>
          <span>Service Type</span>
          <select ref={serviceSelectRef} name="service" value={service} onChange={handleChange}>
            {SERVICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <StudioBookingForm
          initialPurpose={service === 'studio' ? 'Recording' : 'Rehearsal'}
          initialContact={form}
          onContactChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="service-form-glass">
        <div
          ref={confirmationRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
        >
          <p className="card-kicker">Inquiry sent</p>
          <h3>Thank you!</h3>
          <p>We’ve received your request and we’ll follow up soon with the next steps.</p>
        </div>
        <button
          type="button"
          className="button button-outline"
          onClick={() => {
            focusFormRef.current = true;
            setForm((current) => ({ ...current, details: '', 'bot-field': '' }));
            setSubmitted(false);
            setError('');
          }}
        >
          Start another request
        </button>
      </div>
    );
  }

  return (
    <form
      className={`service-form-glass${compact ? ' service-form-compact' : ''}`}
      onSubmit={handleSubmit}
    >
      {!compact && (
        <>
          <p className="card-kicker">Local service request</p>
          <h3>Service Inquiry</h3>
          <p className="form-helper">
            Tell us what you need, when you need it, and any details that will help us guide you.
          </p>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="service-form-row">
        <label>
          <span>Service Type</span>
          <select
            ref={serviceSelectRef}
            name="service"
            value={service}
            onChange={handleChange}
            required
          >
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
      </div>
      <div className="service-form-row">
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
      </div>
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
      <div aria-hidden="true" style={HONEYPOT_STYLE}>
        <label>
          Leave this field empty
          <input
            name="bot-field"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form['bot-field']}
            onChange={handleChange}
          />
        </label>
      </div>
      <button className="button button-solid button-full" type="submit" disabled={submitting}>
        {submitting ? 'Sending...' : 'Send service request'}
      </button>
    </form>
  );
}
