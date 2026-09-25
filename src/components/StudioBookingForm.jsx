import { useEffect, useRef, useState } from 'react';
import { CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  availableHours,
  bookingPrice,
  bookingSummary,
  hourLabel,
  localDate,
  money,
} from '../utils/studioBooking';
import './StudioBookingForm.css';
import { trackSiteEvent } from '../utils/siteMeasurement';

export default function StudioBookingForm({
  initialPurpose = 'Rehearsal',
  initialContact = {},
  onContactChange,
}) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState({
    date: '',
    startHour: '',
    hours: 4,
    purpose: initialPurpose,
    name: initialContact.name || '',
    email: initialContact.email || '',
    phone: initialContact.phone || '',
    notes: '',
    website: '',
    accepted: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const requestId = useRef(null);

  useEffect(() => {
    setForm((current) => ({ ...current, purpose: initialPurpose }));
  }, [initialPurpose]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    setLoading(true);
    setLoadError('');
    fetch('/api/studio-bookings', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.durations))
          throw new Error('Availability could not be loaded.');
        if (active) setConfig(result);
      })
      .catch(() => {
        if (active) {
          setConfig(null);
          setLoadError('Availability could not be loaded. Please retry or call the shop.');
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [refresh]);

  const starts = availableHours(form.date, Number(form.hours), config, config?.reserved || []);
  const startKey = starts.join(',');
  useEffect(() => {
    setForm((current) =>
      current.startHour !== '' && !startKey.split(',').includes(String(current.startHour))
        ? { ...current, startHour: '' }
        : current
    );
  }, [startKey]);

  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    if (['name', 'email', 'phone'].includes(name)) onContactChange?.(name, value);
  }

  async function submit(event) {
    event.preventDefault();
    if (!config?.enabled || loading || submitting) return;
    setSubmitting(true);
    setError('');
    requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch('/api/studio-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          requestId: requestId.current,
          hours: Number(form.hours),
          startHour: Number(form.startHour),
        }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) {
        if ([400, 409, 429].includes(response.status)) requestId.current = null;
        if (response.status === 409) setRefresh((value) => value + 1);
        throw new Error(result.error || 'Unable to submit your request.');
      }
      trackSiteEvent('booking_requested');
      setReceipt({
        ...form,
        hours: Number(form.hours),
        startHour: Number(form.startHour),
        ...result.booking,
      });
    } catch (failure) {
      setError(
        failure.name === 'TimeoutError'
          ? 'The connection timed out. Retry this same request to check it without creating a duplicate.'
          : failure.message || 'Unable to submit your request. Please retry.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt)
    return (
      <div className="studio-booking studio-booking-received" role="status">
        <CheckCircle2 size={28} aria-hidden="true" />
        <h3>Request received</h3>
        <p>{bookingSummary(receipt)}</p>
        <p className="studio-booking-total">{money(receipt.amountCents)}</p>
        <p>
          This time is awaiting our approval. Once approved, we will email your secure payment link
          to <strong>{receipt.email}</strong>. Payment finalizes the booking.
        </p>
        <small>Reference: {receipt.id}</small>
      </div>
    );

  return (
    <form className="studio-booking" onSubmit={submit}>
      <div className="studio-booking-heading">
        <CalendarClock size={22} aria-hidden="true" />
        <div>
          <h3>Book studio &amp; rehearsal time</h3>
          <p>Woodland Hills · Los Angeles time</p>
        </div>
      </div>
      <div className="studio-booking-rates" aria-label="Studio rates">
        <span>
          <strong>$25</strong> / hour
        </span>
        <span>
          <strong>$60</strong> / 4 hours
        </span>
      </div>
      {config?.openHour != null && (
        <p className="studio-booking-hours">
          {hourLabel(config.openHour)} to {hourLabel(config.closeHour)} ·{' '}
          {config.days.length === 7
            ? 'Every day'
            : config.days
                .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                .join(', ')}
        </p>
      )}
      {loading ? (
        <p role="status">Checking availability...</p>
      ) : (
        (loadError || !config?.enabled) && (
          <div className="studio-booking-notice" role="status">
            <p>
              {loadError ||
                'Online booking is not open yet. Call (424) 465-3020 to arrange your time.'}
            </p>
            <a href="tel:+14244653020">Call the shop</a>
            {loadError && (
              <button
                type="button"
                className="studio-booking-refresh"
                title="Retry availability"
                aria-label="Retry availability"
                onClick={() => setRefresh((value) => value + 1)}
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>
        )
      )}
      <fieldset disabled={!config?.enabled || loading || submitting}>
        <div className="studio-booking-grid">
          <label>
            <span>Date</span>
            <input
              required
              type="date"
              name="date"
              value={form.date}
              min={localDate()}
              max={localDate(Date.now() + 90 * 86400000)}
              onChange={change}
            />
          </label>
          <label>
            <span>Duration</span>
            <select name="hours" value={form.hours} onChange={change}>
              {(config?.durations || [1, 2, 3, 4]).map((hours) => (
                <option value={hours} key={hours}>
                  {hours} hour{hours === 1 ? '' : 's'} - {money(bookingPrice(hours))}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Start time</span>
            <select required name="startHour" value={form.startHour} onChange={change}>
              <option value="">
                {!form.date
                  ? 'Choose a date first'
                  : starts.length
                    ? 'Choose a time'
                    : 'No times available'}
              </option>
              {starts.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Session type</span>
            <select name="purpose" value={form.purpose} onChange={change}>
              {['Rehearsal', 'Recording', 'Teaching', 'Other'].map((purpose) => (
                <option key={purpose}>{purpose}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Your name</span>
            <input
              required
              name="name"
              maxLength={120}
              autoComplete="name"
              value={form.name}
              onChange={change}
            />
          </label>
          <label>
            <span>Email address</span>
            <input
              required
              type="email"
              name="email"
              maxLength={180}
              autoComplete="email"
              value={form.email}
              onChange={change}
            />
          </label>
        </div>
        <label>
          <span>Phone (optional)</span>
          <input
            type="tel"
            name="phone"
            maxLength={40}
            autoComplete="tel"
            value={form.phone}
            onChange={change}
          />
        </label>
        <label>
          <span>Session notes (optional)</span>
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            placeholder="Group size, instruments, and anything you need"
            value={form.notes}
            onChange={change}
          />
        </label>
        <div className="studio-booking-honeypot" aria-hidden="true">
          <label>
            Leave blank
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={change}
            />
          </label>
        </div>
        <label className="studio-booking-consent">
          <input
            required
            type="checkbox"
            name="accepted"
            checked={form.accepted}
            onChange={change}
          />
          <span>
            I understand this is a request. My time is finalized after Sattari approves it and I pay
            through the emailed link.
          </span>
        </label>
      </fieldset>
      <div className="studio-booking-checkout">
        <span>
          Session total<strong>{money(bookingPrice(Number(form.hours)))}</strong>
        </span>
        <span>No payment now</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button-solid button-full"
        disabled={!config?.enabled || loading || submitting || !form.date || form.startHour === ''}
        type="submit"
      >
        {submitting ? 'Sending request...' : 'Request booking'}
      </button>
    </form>
  );
}
