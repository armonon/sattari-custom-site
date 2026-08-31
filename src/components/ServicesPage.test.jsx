/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ServicesPage from './ServicesPage';

describe('ServicesPage', () => {
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
  });
});
