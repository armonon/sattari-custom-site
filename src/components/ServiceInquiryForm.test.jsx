import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../test/deferred';
import ServiceInquiryForm from './ServiceInquiryForm';

vi.mock('../utils/monitoring', () => ({ captureException: vi.fn() }));
vi.mock('../utils/siteMeasurement', () => ({ trackSiteEvent: vi.fn() }));

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function fillInquiry() {
  fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Alex' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '555-0100' } });
  fireEvent.change(screen.getByLabelText('Describe what you need'), {
    target: { value: 'A guitar setup' },
  });
}

describe('ServiceInquiryForm', () => {
  it('announces and focuses confirmation, then starts another request with contact details intact', async () => {
    render(<ServiceInquiryForm initialService="repairs" />);
    fillInquiry();
    const submit = screen.getByRole('button', { name: 'Send service request' });
    submit.focus();
    fireEvent.click(submit);

    const confirmation = await screen.findByRole('status');
    expect(confirmation).toHaveAttribute('aria-live', 'polite');
    expect(confirmation).toHaveAttribute('aria-atomic', 'true');
    expect(confirmation).toHaveTextContent('Inquiry sent');
    expect(confirmation).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Start another request' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Service Type')).toHaveValue('repairs');
    expect(screen.getByLabelText('Service Type')).toHaveFocus();
    expect(screen.getByLabelText('Your Name')).toHaveValue('Alex');
    expect(screen.getByLabelText('Email')).toHaveValue('alex@example.com');
    expect(screen.getByLabelText('Phone')).toHaveValue('555-0100');
    expect(screen.getByLabelText('Describe what you need')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Describe what you need'), {
      target: { value: 'Another guitar setup' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));
    expect(await screen.findByRole('status')).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the controlled service for both submission paths and reports dropdown changes', async () => {
    const onServiceChange = vi.fn();
    const { rerender } = render(
      <ServiceInquiryForm service="repairs" onServiceChange={onServiceChange} />
    );
    fireEvent.change(screen.getByLabelText('Service Type'), { target: { value: 'rentals' } });
    expect(onServiceChange).toHaveBeenCalledWith('rentals');
    expect(screen.getByLabelText('Service Type')).toHaveValue('repairs');

    rerender(<ServiceInquiryForm service="rentals" onServiceChange={onServiceChange} />);
    fillInquiry();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));
    await screen.findByRole('status');
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).get('service')).toBe('rentals');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/service-inquiry');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      service: 'rentals',
      name: 'Alex',
    });
  });

  it('keeps standalone selection and initialService updates working after submission', async () => {
    const { rerender } = render(<ServiceInquiryForm initialService="repairs" />);
    fireEvent.change(screen.getByLabelText('Service Type'), { target: { value: 'accessories' } });
    fillInquiry();
    fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));
    await screen.findByRole('status');
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).get('service')).toBe('accessories');

    rerender(<ServiceInquiryForm initialService="lessons" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Service Type')).toHaveValue('lessons');
    expect(screen.getByLabelText('Your Name')).toHaveValue('Alex');
  });

  it('clears a previous service error when changing service', async () => {
    render(<ServiceInquiryForm initialService="repairs" />);
    fillInquiry();
    fetchMock.mockRejectedValueOnce(new Error('Offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline');

    fireEvent.change(screen.getByLabelText('Service Type'), { target: { value: 'lessons' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send service request' })).not.toBeDisabled();
  });

  it.each(['success', 'failure'])(
    'ignores a late %s after switching services, including switching back',
    async (outcome) => {
      const pending = deferred();
      fetchMock.mockReturnValueOnce(pending.promise);
      const { rerender } = render(<ServiceInquiryForm service="repairs" />);
      fillInquiry();
      fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));
      expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();

      rerender(<ServiceInquiryForm service="lessons" />);
      rerender(<ServiceInquiryForm service="repairs" />);
      await act(async () => {
        if (outcome === 'success') pending.resolve({ ok: true });
        else pending.reject(new Error('Old service failed'));
        await pending.promise.catch(() => {});
      });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Service Type')).toHaveValue('repairs');
      expect(screen.getByLabelText('Your Name')).toHaveValue('Alex');
      expect(screen.getByRole('button', { name: 'Send service request' })).not.toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));
      await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
    }
  );
});

it('delivers instrument and timing through the existing details contract on both transports', async () => {
  render(<ServiceInquiryForm initialService="repairs" />);
  fillInquiry();
  fireEvent.change(screen.getByLabelText('Instrument / gear and model (optional)'), {
    target: { value: 'Acoustic guitar, model A' },
  });
  fireEvent.change(screen.getByLabelText('Preferred timing (optional)'), {
    target: { value: 'Before Friday' },
  });
  fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
  fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));
  await screen.findByRole('status');
  const netlify = new URLSearchParams(fetchMock.mock.calls[0][1].body);
  const fallback = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(netlify.get('details')).toBe(
    'Instrument / gear: Acoustic guitar, model A\n\nPreferred timing: Before Friday\n\nA guitar setup'
  );
  expect(fallback.details).toBe(netlify.get('details'));
  expect(fallback).not.toHaveProperty('instrument');
  expect(fallback).not.toHaveProperty('timing');
});

it('keeps music-tool feedback focused while service intake captures instrument and timing', () => {
  const { rerender } = render(<ServiceInquiryForm initialService="tool-feedback" />);
  expect(screen.getByLabelText('Your feedback')).toBeInTheDocument();
  expect(screen.queryByLabelText('Instrument / gear and model (optional)')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Preferred timing (optional)')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send feedback' })).toBeInTheDocument();
  rerender(<ServiceInquiryForm initialService="repairs" />);
  expect(screen.getByLabelText('Instrument / gear and model (optional)')).toBeInTheDocument();
  expect(screen.getByLabelText('Preferred timing (optional)')).toBeInTheDocument();
});

it('delivers a guitar string appointment request on both transports and resets the pack preferences', async () => {
  render(<ServiceInquiryForm initialService="accessories" guitarStringInquiry />);
  fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Alex' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
  fireEvent.change(screen.getByLabelText('Guitar type'), {
    target: { value: 'Steel-string acoustic guitar' },
  });
  fireEvent.change(screen.getByLabelText('What would you like to check?'), {
    target: { value: 'Arrange a restringing appointment' },
  });
  fireEvent.change(screen.getByLabelText('Preferred brand, set or gauge (optional)'), {
    target: { value: '12–53' },
  });
  fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
  fireEvent.click(screen.getByRole('button', { name: 'Send string inquiry' }));
  await screen.findByRole('status');
  const netlify = new URLSearchParams(fetchMock.mock.calls[0][1].body);
  const fallback = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(netlify.get('details')).toContain(
    'Guitar string request: Arrange a restringing appointment'
  );
  expect(netlify.get('details')).toContain('Guitar type: Steel-string acoustic guitar');
  expect(netlify.get('details')).toContain('Preferred set or gauge: 12–53');
  expect(fallback.details).toBe(netlify.get('details'));
  expect(fallback).not.toHaveProperty('preferredPack');
  fireEvent.click(screen.getByRole('button', { name: 'Start another request' }));
  expect(screen.getByLabelText('Preferred brand, set or gauge (optional)')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Service Type'), { target: { value: 'lessons' } });
  expect(screen.queryByLabelText('Guitar type')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Describe what you need')).toBeRequired();
});
