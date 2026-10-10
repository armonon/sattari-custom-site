import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, StaticRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CanvasPage from './canvas/CanvasPage';
import PocketPage from './pocket/PocketPage';
import PressPage from './press/PressPage';
import { STORAGE_KEY } from './pocket/pocketPattern';
import { DRAFT_KEY } from './press/pressHtml';
import { LAB_SEO } from './labsSeo';

vi.mock('../utils/seo', () => ({ SEO: () => null }));
vi.mock('../pwa/SattariAppMetadata', () => ({ default: () => null }));

const page = (Component) => (
  <MemoryRouter>
    <Component />
  </MemoryRouter>
);

beforeEach(() => {
  localStorage.clear();
  // jsdom has no 2D canvas; Canvas idles without one.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe.each([
  ['Canvas', CanvasPage],
  ['Pocket', PocketPage],
  ['Press', PressPage],
])('%s', (name, Component) => {
  it('is labelled alpha with its limitations and renders on the server', () => {
    expect(
      renderToString(
        <StaticRouter location="/">
          <Component />
        </StaticRouter>
      )
    ).toContain(name);
    render(page(Component));
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(name);
    expect(heading).toHaveTextContent('Alpha');
    expect(screen.getByText('Alpha: what this does not do yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sattari Hub/ })).toHaveAttribute('href', '/hub');
  });
});

it('makes the alpha tools indexable with search-length descriptions', () => {
  for (const seo of Object.values(LAB_SEO)) {
    expect(seo.noindex).toBeUndefined();
    expect(seo.description.length).toBeLessThanOrEqual(180);
  }
});

describe('Pocket', () => {
  it('toggles steps and saves the pattern in this browser', () => {
    render(page(PocketPage));
    const step = screen.getByRole('button', { name: 'Kick step 2' });
    expect(step).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(step);
    expect(step).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bus idea' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved[0].name).toBe('Bus idea');
    expect(saved[0].drums.kick[1]).toBe(true);
    expect(screen.getByRole('button', { name: /^Bus idea ·/ })).toBeInTheDocument();
  });

  it('keeps the bass monophonic: one note per step', () => {
    render(page(PocketPage));
    const low = screen.getByRole('button', { name: 'Bass B step 3' });
    const high = screen.getByRole('button', { name: 'Bass G step 3' });
    fireEvent.click(low);
    fireEvent.click(high);
    expect(high).toHaveAttribute('aria-pressed', 'true');
    expect(low).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Press', () => {
  it('updates the preview and auto-saves the draft', async () => {
    vi.useFakeTimers();
    render(page(PressPage));
    fireEvent.change(screen.getByLabelText('Artist or band name'), {
      target: { value: 'Nova Lane' },
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    const preview = screen.getByTitle('Press kit preview');
    expect(preview.getAttribute('srcdoc')).toContain('<h1>Nova Lane</h1>');
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)).name).toBe('Nova Lane');
  });
});
