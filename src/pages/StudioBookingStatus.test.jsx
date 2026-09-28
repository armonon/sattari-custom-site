import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import StudioBookingStatus from './StudioBookingStatus';

function renderStatus(url) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[url]}>
        <StudioBookingStatus />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function stubBooking(booking) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ booking }) }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const BOOKING = {
  id: 'studio_1',
  date: '2026-10-02',
  startHour: 18,
  hours: 2,
  purpose: 'Rehearsal',
  amountCents: 6000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it('says a payment under review is being checked, not that the booking is unpaid', async () => {
  stubBooking({ ...BOOKING, status: 'needs_review' });

  renderStatus('/studio-booking?session_id=cs_test_1');

  expect(
    await screen.findByRole('heading', { level: 1, name: 'We’re reviewing your payment' })
  ).toBeInTheDocument();
  expect(screen.getByText(/no need to pay again/)).toBeInTheDocument();
  expect(screen.queryByText(/not finalized until payment succeeds/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Check payment status' })).toBeNull();
});

it('shows the check as under way from the first render with a session id', async () => {
  const fetchMock = stubBooking({ ...BOOKING, status: 'paid' });

  renderStatus('/studio-booking?session_id=cs_test_1');

  expect(screen.getByRole('status')).toHaveTextContent('Checking your payment with Stripe...');
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Your studio time is booked' })
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/studio-bookings?session_id=cs_test_1',
    expect.any(Object)
  );
});
