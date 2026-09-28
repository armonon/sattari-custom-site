import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import OptimizedProductImage from './OptimizedProductImage';

it('offers the AVIF sibling of a bundled PNG, with the space in its path encoded', () => {
  const { container } = render(
    <OptimizedProductImage src="/sattari site/cymbal.png" alt="Cymbal" />
  );
  expect(container.querySelector('source')).toHaveAttribute(
    'srcset',
    '/sattari%20site/cymbal.avif'
  );
  expect(container.querySelector('img')).toHaveAttribute('src', '/sattari site/cymbal.png');
});

it('loads a PNG staff uploaded directly, since /product-images/ has no AVIF', () => {
  const { container } = render(
    <OptimizedProductImage src="/product-images/0123456789abcdef01234567.png" alt="New" />
  );
  expect(container.querySelector('source')).toBeNull();
  expect(container.querySelector('img')).toHaveAttribute(
    'src',
    '/product-images/0123456789abcdef01234567.png'
  );
});

it('loads photos without an AVIF sibling directly', () => {
  const { container } = render(
    <OptimizedProductImage src="/sattari site/violins/brescia-acoustic.jpg" alt="Violin" />
  );
  expect(container.querySelector('source')).toBeNull();
});
