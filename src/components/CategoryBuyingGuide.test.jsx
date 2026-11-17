import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import CategoryBuyingGuide from './CategoryBuyingGuide';
import { products } from '../data/catalog';

it('takes comparison prices and included items from the current visible catalog', () => {
  const current = products
    .filter((product) => product.slug !== 'miami-electric-violin')
    .map((product) =>
      product.slug === 'chiara-wooden-electric-violin'
        ? {
            ...product,
            price: 275,
            specs: ['Size: 4/4 (full size)', 'Included: updated kit from live catalog'],
          }
        : product
    );
  render(
    <MemoryRouter>
      <CategoryBuyingGuide categoryKey="violins" products={current} />
    </MemoryRouter>
  );
  const row = screen.getByRole('link', { name: /CHIARA/ }).closest('tr');
  expect(within(row).getByText('$275.00')).toBeInTheDocument();
  expect(within(row).getByText('Included: updated kit from live catalog')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /MIAMI/ })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Instrument comparison' })).toHaveAttribute(
    'tabindex',
    '0'
  );
  expect(screen.getByRole('link', { name: 'Ask about violin setup' })).toHaveAttribute(
    'href',
    '/services/violin-repair-los-angeles'
  );
});

it('asks for package details instead of inventing included guitar accessories', () => {
  render(
    <MemoryRouter>
      <CategoryBuyingGuide categoryKey="guitar-bass" products={products} />
    </MemoryRouter>
  );
  const row = screen.getByRole('link', { name: 'Classic Nylon String Guitar' }).closest('tr');
  expect(within(row).getByText('Ask the shop to confirm.')).toBeInTheDocument();
  expect(within(row).getByText('$280.00')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ask about guitar and bass setup' })).toHaveAttribute(
    'href',
    '/services/guitar-setup-los-angeles'
  );
});
