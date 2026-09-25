import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudioBookingForm from './StudioBookingForm';
import { localDate } from '../utils/studioBooking';

const config = {
  enabled: true,
  openHour: 18,
  closeHour: 24,
  days: [0, 1, 2, 3, 4, 5, 6],
  durations: [1, 2, 3, 4],
  reserved: [],
};
let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => config });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fill() {
  await waitFor(() => expect(screen.getByLabelText('Date')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: localDate(Date.now() + 7 * 86400000) },
  });
  fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '18' } });
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Music Student' } });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'student@example.com' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('StudioBookingForm', () => {
  it('shows rates, midnight and only valid starts for the selected duration', async () => {
    render(<StudioBookingForm />);
    await fill();
    expect(screen.getByText(/6 PM to 12 AM \(midnight\)/)).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '9 PM' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '1' } });
    expect(screen.getByRole('option', { name: '11 PM' })).toBeInTheDocument();
  });
  it('submits a request without suggesting it is confirmed or paid', async () => {
    render(<StudioBookingForm />);
    await fill();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        booking: { id: 'studio_test', status: 'requested', amountCents: 6000 },
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request booking' }));
    expect(await screen.findByRole('heading', { name: 'Request received' })).toBeInTheDocument();
    expect(screen.getByText(/This time is awaiting our approval/)).toBeInTheDocument();
    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload).toMatchObject({
      hours: 4,
      startHour: 18,
      accepted: true,
      email: 'student@example.com',
    });
    expect(payload).not.toHaveProperty('amountCents');
  });
  it('keeps the same request ID after a network failure', async () => {
    render(<StudioBookingForm />);
    await fill();
    fetchMock.mockRejectedValueOnce(new Error('Network unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Request booking' }));
    await screen.findByRole('alert');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ booking: { id: 'studio_test', amountCents: 6000 } }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request booking' }));
    await screen.findByRole('heading', { name: 'Request received' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).requestId).toBe(
      JSON.parse(fetchMock.mock.calls[2][1].body).requestId
    );
  });
  it('fails closed when booking is disabled or availability cannot load', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...config, enabled: false }),
    });
    render(<StudioBookingForm />);
    await screen.findByText(/Online booking is not open/);
    expect(screen.getByRole('button', { name: 'Request booking' })).toBeDisabled();
    expect(screen.getByLabelText('Date')).toBeDisabled();
  });
  it('offers a retry after availability fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Offline'));
    render(<StudioBookingForm />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry availability' }));
    await waitFor(() => expect(screen.getByLabelText('Date')).not.toBeDisabled());
  });
});
