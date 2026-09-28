import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '../utils/seo';
import { bookingSummary, money } from '../utils/studioBooking';
import { useHydratedSearchParams } from './useHydratedSearchParams';
import '../components/StudioBookingForm.css';

export default function StudioBookingStatus() {
  // Read after hydration: the prerendered page has no query string.
  const params = useHydratedSearchParams();
  const sessionId = params.get('session_id');
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  // Loading from the render the session id first appears in, not from the
  // effect after it, so "not finalized" never shows before the check starts.
  const requestKey = sessionId ? `${sessionId}#${refresh}` : null;
  const [settledKey, setSettledKey] = useState(null);
  const loading = requestKey !== null && settledKey !== requestKey;
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    const key = `${sessionId}#${refresh}`;
    setError('');
    fetch(`/api/studio-bookings?session_id=${encodeURIComponent(sessionId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to check payment.');
        setBooking(result.booking);
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettledKey(key);
      });
    return () => controller.abort();
  }, [sessionId, refresh]);
  const paid = booking?.status === 'paid';
  // Money arrived that the booking cannot account for automatically (a stale
  // payment link, an amount that differs); staff check it by hand while the
  // time stays held.
  const inReview = booking?.status === 'needs_review';
  return (
    <section className="section page-header-offset container studio-booking-status-page">
      <SEO
        title="Studio Booking Status"
        description="Check your Sattari studio booking payment."
        url="https://sattarimusic.com/studio-booking"
        noindex
      />
      <h1>
        {paid
          ? 'Your studio time is booked'
          : inReview
            ? 'We’re reviewing your payment'
            : 'Studio booking'}
      </h1>
      {loading && <p role="status">Checking your payment with Stripe...</p>}
      {error && <p role="alert">{error}</p>}
      {booking && (
        <>
          <p>{bookingSummary(booking)}</p>
          <p>
            {money(booking.amountCents)} {paid ? 'paid' : 'session total'}
          </p>
        </>
      )}
      {paid ? (
        <p>Payment received. Your reservation is finalized. We will email your booking details.</p>
      ) : inReview ? (
        <p role="status">
          We received your payment and need to check one detail by hand before we confirm. Your time
          is held while we do, and we&apos;ll be in touch by email. There&apos;s no need to pay
          again.
        </p>
      ) : (
        <p>
          {booking?.status === 'expired'
            ? 'This payment link has expired. Contact the shop to arrange another time.'
            : 'Your reservation is not finalized until payment succeeds. Use the payment link in your approval email, or contact the shop for help.'}
        </p>
      )}
      {sessionId && !paid && !inReview && (
        <button
          className="button button-outline"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          Check payment status
        </button>
      )}
      <p>
        <a href="tel:+14244653020">Call (424) 465-3020</a>
      </p>
      <Link className="button button-solid" to="/services/rehearsal-space-los-angeles">
        Studio &amp; rehearsal space
      </Link>
    </section>
  );
}
