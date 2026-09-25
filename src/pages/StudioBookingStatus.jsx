import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SEO } from '../utils/seo';
import { bookingSummary, money } from '../utils/studioBooking';
import '../components/StudioBookingForm.css';

export default function StudioBookingStatus() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    setLoading(true);
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
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [sessionId, refresh]);
  const paid = booking?.status === 'paid';
  return (
    <section className="section page-header-offset container studio-booking-status-page">
      <SEO
        title="Studio Booking Status"
        description="Check your Sattari studio booking payment."
        url="https://sattarimusic.com/studio-booking"
        noindex
      />
      <h1>{paid ? 'Your studio time is booked' : 'Studio booking'}</h1>
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
      ) : (
        <p>
          {booking?.status === 'expired'
            ? 'This payment link has expired. Contact the shop to arrange another time.'
            : 'Your reservation is not finalized until payment succeeds. Use the payment link in your approval email, or contact the shop for help.'}
        </p>
      )}
      {sessionId && !paid && (
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
