/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServiceInquiryForm from '../../src/components/ServiceInquiryForm';
import AudioAlphaSignup from '../../src/components/AudioAlphaSignup';
import StudioBookingForm from '../../src/components/StudioBookingForm';

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function expectHiddenFromPeople(input) {
  expect(input).toHaveAttribute('tabindex', '-1');
  expect(input).toHaveAttribute('autocomplete', 'off');
  expect(input.closest('[aria-hidden="true"]')).not.toBeNull();
}

function honeypot(container, name) {
  return container.querySelector(`input[name="${name}"]`);
}

describe('form honeypots', () => {
  it('ServiceInquiryForm posts an empty bot-field that people cannot reach', async () => {
    const { container } = render(<ServiceInquiryForm initialService="repairs" />);
    const trap = honeypot(container, 'bot-field');
    expectHiddenFromPeople(trap);

    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Describe what you need'), {
      target: { value: 'Snare repair' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const sent = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(sent.get('form-name')).toBe('service-inquiry');
    expect(sent.get('bot-field')).toBe('');
  });

  it('ServiceInquiryForm passes a filled trap on to the fallback, which drops it', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    const { container } = render(<ServiceInquiryForm initialService="repairs" />);

    fireEvent.change(honeypot(container, 'bot-field'), { target: { value: 'spam' } });
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Bot' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bot@example.com' } });
    fireEvent.change(screen.getByLabelText('Describe what you need'), {
      target: { value: 'Buy links' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/service-inquiry');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)['bot-field']).toBe('spam');
  });

  it('AudioAlphaSignup includes the same trap in both submission paths', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    const { container } = render(<AudioAlphaSignup />);
    const trap = honeypot(container, 'bot-field');
    expectHiddenFromPeople(trap);

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } });
    fireEvent.change(screen.getByLabelText('Main DAW'), { target: { value: 'Logic Pro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request alpha access' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).get('bot-field')).toBe('');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ 'bot-field': '' });
  });

  it('StudioBookingForm keeps its website trap out of reach', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, durations: [1, 2, 3, 4], days: [], reserved: [] }),
    });
    const { container } = render(<StudioBookingForm />);
    await screen.findByText(/Online booking is not open/);

    expectHiddenFromPeople(honeypot(container, 'website'));
  });
});
