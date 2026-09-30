/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServicesPage from './ServicesPage';

vi.mock('../utils/siteMeasurement', () => ({ trackSiteEvent: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: true,
        durations: [1, 2, 3, 4],
        days: [0, 1, 2, 3, 4, 5, 6],
        openHour: 18,
        closeHour: 24,
        reserved: [],
      }),
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

function renderServices() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('ServicesPage', () => {
  it('makes shop visits appointment-only and provides a direct call action', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <ServicesPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    expect(screen.getByText('Visit by appointment')).toBeInTheDocument();
    expect(
      screen.getByText(/By appointment only\. Call to arrange your visit\./)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Arrange a visit' })).toHaveAttribute(
      'href',
      'tel:+14244653020'
    );
  });

  it('updates the inquiry type without clearing entered contact details', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <ServicesPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    const nameInput = screen.getByLabelText('Your Name');
    fireEvent.change(nameInput, { target: { value: 'Armon' } });
    fireEvent.click(screen.getByRole('button', { name: /instrument rentals/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Service Type')).toHaveValue('rentals');
    });
    expect(nameInput).toHaveValue('Armon');
    expect(screen.getByRole('heading', { name: 'Instrument rentals' })).toBeInTheDocument();
    expect(
      screen.getByTitle('Map to SATTARI Musical Instruments in Woodland Hills')
    ).toBeInTheDocument();
  });

  it.each(['rehearsal', 'studio'])(
    'synchronizes the picker and request heading when the dropdown selects %s',
    async (service) => {
      renderServices();
      fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Armon' } });
      fireEvent.change(screen.getByLabelText('Service Type'), { target: { value: service } });

      expect(screen.getByRole('button', { name: /studio & rehearsal/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: /instrument repair/i })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.getByRole('heading', { name: 'Book a time' })).toBeInTheDocument();
      expect(screen.getByLabelText('Service Type')).toHaveValue(service);
      await waitFor(() => expect(screen.getByLabelText('Your name')).not.toBeDisabled());
      expect(screen.getByLabelText('Your name')).toHaveValue('Armon');
      expect(screen.getByLabelText('Session type')).toHaveValue(
        service === 'studio' ? 'Recording' : 'Rehearsal'
      );

      fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Armon S' } });
      fireEvent.click(screen.getByRole('button', { name: /instrument repair/i }));
      expect(screen.getByLabelText('Service Type')).toHaveValue('repairs');
      expect(screen.getByLabelText('Your Name')).toHaveValue('Armon S');
      expect(screen.getByRole('heading', { name: 'Send your request' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Session type')).not.toBeInTheDocument();
    }
  );

  it.each(['instrument-sales', 'accessories'])(
    'keeps %s available without highlighting an unrelated picker row',
    (service) => {
      renderServices();
      fireEvent.change(screen.getByLabelText('Service Type'), { target: { value: service } });
      expect(screen.getByLabelText('Service Type')).toHaveValue(service);
      expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Instrument repair' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /instrument rentals/i }));
      expect(screen.getByLabelText('Service Type')).toHaveValue('rentals');
      expect(screen.getByRole('button', { name: /instrument rentals/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    }
  );

  it('opens a fresh request when the picker changes service after confirmation', async () => {
    renderServices();
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Armon' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'armon@example.com' } });
    fireEvent.change(screen.getByLabelText('Describe what you need'), {
      target: { value: 'Repair my guitar' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));
    expect(await screen.findByRole('status')).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: /teachers & classes/i }));
    expect(screen.queryByRole('heading', { name: 'Thank you!' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Service Type')).toHaveValue('lessons');
    expect(screen.getByLabelText('Your Name')).toHaveValue('Armon');
    fireEvent.click(screen.getByRole('button', { name: 'Send service request' }));
    await screen.findByRole('heading', { name: 'Thank you!' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URLSearchParams(fetch.mock.calls[1][1].body).get('service')).toBe('lessons');
  });
});
