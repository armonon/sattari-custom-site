/* @vitest-environment jsdom */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { Route, Routes, StaticRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { musicGuides } from '../data/musicGuides';
import { separatorGuides, separatorQuestions } from '../data/stemSeparatorContent';
import { toolDetails } from '../data/toolDetails';
import { LIMITS } from '../utils/stemSeparator';
import { GuideArticle, GuideIndex, ToolDetailsPage } from './MusicResources';
import { InventoryProvider } from '../context/InventoryContext';

function renderPage(path, inventory = null) {
  const context = {};
  const canUseDOM = HelmetProvider.canUseDOM;
  HelmetProvider.canUseDOM = false;
  try {
    const body = renderToString(
      <HelmetProvider context={context}>
        <InventoryProvider initialInventory={inventory}>
          <StaticRouter location={path}>
            <Routes>
              <Route path="/guides" element={<GuideIndex />} />
              <Route path="/guides/:slug" element={<GuideArticle />} />
              <Route path="/tools/:tool" element={<ToolDetailsPage />} />
            </Routes>
          </StaticRouter>
        </InventoryProvider>
      </HelmetProvider>
    );
    const { helmet } = context;
    const doc = new DOMParser().parseFromString(
      `<!doctype html><html><head>${helmet.title}${helmet.meta}${helmet.link}${helmet.script}</head><body>${body}</body></html>`,
      'text/html'
    );
    const schema = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((node) =>
      JSON.parse(node.textContent)
    );
    return { doc, schema };
  } finally {
    HelmetProvider.canUseDOM = canUseDOM;
  }
}

describe('Stem Separator search content', () => {
  it.each(musicGuides)(
    'gives $slug visible attribution and working section permalinks',
    (guide) => {
      const { doc, schema } = renderPage(`/guides/${guide.slug}`);
      const article = schema.find((item) => item['@type'] === 'Article');
      expect(doc.querySelector('.resource-byline').textContent).toContain(article.author.name);
      expect(doc.querySelector('.resource-byline a').getAttribute('href')).toBe('/about');
      expect(article.isPartOf['@id']).toBe('https://sattarimusic.com/#website');
      expect(article.inLanguage).toBe('en-US');
      const links = [...doc.querySelectorAll('.resource-contents a')];
      expect(links).toHaveLength(guide.sections.length);
      expect(new Set(links.map((link) => link.hash)).size).toBe(links.length);
      for (const link of links) {
        expect(doc.getElementById(link.hash.slice(1)).querySelector('h2').textContent).toBe(
          link.textContent
        );
      }
      expect(
        schema
          .find((item) => item['@type'] === 'BreadcrumbList')
          .itemListElement.map((item) => item.item)
      ).toEqual([
        'https://sattarimusic.com/',
        'https://sattarimusic.com/guides',
        `https://sattarimusic.com/guides/${guide.slug}`,
      ]);
    }
  );

  it('has unique guides with real screenshots and existing related guides/tools', () => {
    expect(new Set(musicGuides.map((guide) => guide.slug)).size).toBe(musicGuides.length);
    expect(new Set(musicGuides.map((guide) => guide.description)).size).toBe(musicGuides.length);
    for (const guide of separatorGuides) {
      expect(musicGuides).toContain(guide);
      expect(guide.title.length).toBeLessThanOrEqual(65);
      expect(guide.description.length).toBeGreaterThanOrEqual(80);
      expect(guide.description.length).toBeLessThanOrEqual(170);
      expect(existsSync(resolve(process.cwd(), 'public', guide.image.slice(1)))).toBe(true);
      for (const path of guide.related) {
        if (path.startsWith('/guides/')) {
          expect(musicGuides.some((item) => `/guides/${item.slug}` === path)).toBe(true);
        } else if (path.startsWith('/tools/')) {
          expect(toolDetails[path.split('/').at(-1)]).toBeDefined();
        }
      }
    }
  });

  it.each(separatorGuides)('renders $slug as a complete crawlable article', (guide) => {
    const path = `/guides/${guide.slug}`;
    const { doc, schema } = renderPage(path);
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    expect(doc.querySelector('h1').textContent).toBe(guide.title);
    expect(doc.title).toBe(`${guide.title} | Sattari Music`);
    expect(doc.querySelector('meta[name="description"]').content).toBe(guide.description);
    expect(doc.querySelector('meta[property="og:type"]').content).toBe('article');
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(doc.querySelector('link[rel="canonical"]').href).toBe(`https://sattarimusic.com${path}`);
    expect(doc.body.textContent).toContain(guide.answer);
    for (const section of guide.sections) {
      expect(doc.body.textContent).toContain(section.title);
      for (const text of [...(section.paragraphs || []), ...(section.steps || [])]) {
        expect(doc.body.textContent).toContain(text);
      }
    }
    // Each guide's call to action opens the flagship tool that completes its task.
    expect(doc.querySelector('.resource-action').getAttribute('href')).toBe(guide.action.path);
    expect(['/stem-separator', '/studio/keybpm']).toContain(
      new URL(guide.action.path, 'https://sattarimusic.com').pathname
    );
    expect(schema.find((item) => item['@type'] === 'Article')).toMatchObject({
      headline: guide.title,
      description: guide.description,
      mainEntityOfPage: `https://sattarimusic.com${path}`,
    });
    expect(schema.find((item) => item['@type'] === 'BreadcrumbList')).toBeDefined();
  });

  it('makes every new guide discoverable from both the index and tool reference', () => {
    for (const path of ['/guides', '/tools/stem-separator']) {
      const { doc } = renderPage(path);
      for (const guide of separatorGuides) {
        expect(doc.querySelector(`a[href="/guides/${guide.slug}"]`)).not.toBeNull();
      }
    }
  });

  it('renders useful questions and answers without inventing ratings or rich-result markup', () => {
    const { doc, schema } = renderPage('/tools/stem-separator');
    const questions = [...doc.querySelectorAll('#questions details')];
    expect(questions).toHaveLength(separatorQuestions.length);
    separatorQuestions.forEach(({ question, answer }, index) => {
      expect(questions[index].querySelector('summary').textContent).toBe(question);
      expect(questions[index].querySelector('p').textContent).toBe(answer);
    });
    expect(schema.some((item) => item['@type'] === 'FAQPage')).toBe(false);
    expect(JSON.stringify(schema)).not.toMatch(/aggregateRating|reviewRating/);
    expect(renderPage('/tools/studio').doc.querySelector('#questions')).toBeNull();
  });

  it('keeps published batch limits aligned with the actual separator limits', () => {
    const guide = separatorGuides.find((item) => item.slug === 'batch-separate-audio-stems');
    const text = JSON.stringify(guide);
    const mib = 1024 * 1024;
    expect(text).toContain(`${LIMITS.tracks} queued tracks`);
    expect(text).toContain(`${LIMITS.fileBytes / mib} MiB per source file`);
    expect(text).toContain(`${LIMITS.inputBytes / mib} MiB of source files`);
    expect(text).toContain(`${LIMITS.outputBytes / mib} MiB`);
    expect(LIMITS.seconds).toBe(600);
    expect(text).toContain('ten minutes per track');
    expect(text).toContain('still calculates all four source groups');
  });
});

it('keeps the violin trial, comparison anchor and handout available without an inventory dependency', () => {
  const { doc } = renderPage('/guides/choose-a-violin-for-beginners');
  const list = doc.querySelector('.resource-checklist ol');
  expect(list.children).toHaveLength(5);
  expect(list.compareDocumentPosition(doc.querySelector('.resource-contents'))).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING
  );
  expect(doc.querySelector('#compare-violins h2')).not.toBeNull();
  expect(doc.querySelector('a[download]').getAttribute('href')).toBe(
    '/handouts/instrument-trial-sheet.pdf'
  );
  expect(doc.querySelector('a[href^="/product/"], a[href^="/shop"]')).toBeNull();
});

it('gives every educational guide an index link, cited sources and educational next steps', () => {
  const { doc: index } = renderPage('/guides');
  const educational = musicGuides.filter((guide) => !guide.action);
  for (const guide of educational) {
    const path = `/guides/${guide.slug}`;
    const { doc, schema } = renderPage(path);
    const article = schema.find((item) => item['@type'] === 'Article');
    expect(index.querySelector(`a[href="${path}"]`)).not.toBeNull();
    expect(guide.sources.length).toBeGreaterThanOrEqual(2);
    expect(article.citation).toEqual(guide.sources.map((source) => source.url));
    expect(
      doc.querySelector('.resource-action, a[href^="/shop"], a[href^="/product/"]')
    ).toBeNull();
    for (const section of guide.sections) {
      if (section.sourceUrl) {
        expect(guide.sources.some((source) => source.url === section.sourceUrl)).toBe(true);
      }
      if (section.table) {
        const table = [...doc.querySelectorAll('table')].find(
          (el) => el.getAttribute('aria-label') === section.title
        );
        expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(
          section.table.headers.length
        );
        expect(table.querySelectorAll('th[scope="row"]')).toHaveLength(section.table.rows.length);
      }
    }
  }
});

it('ships the two snare listening examples as accessible players backed by separate recordings', () => {
  const { doc, schema } = renderPage('/guides/how-to-tune-a-snare-drum');
  const players = [...doc.querySelectorAll('#before-and-after audio[controls]')];
  expect(players.map((p) => p.getAttribute('src'))).toEqual([
    '/audio/snare-tuning/before.wav',
    '/audio/snare-tuning/after.wav',
  ]);
  const recordings = schema.find((item) => item['@type'] === 'Article').audio;
  expect(recordings.map((item) => item.name)).toEqual(
    players.map((p) => p.getAttribute('aria-label'))
  );
  expect(
    doc.querySelector('#before-and-after a[href="https://creativecommons.org/licenses/by/4.0/"]')
  ).not.toBeNull();
});

it('places full-size violin detail photographs next to the steps they illustrate', () => {
  const { doc } = renderPage('/guides/how-to-change-a-violin-string');
  for (const id of ['seat-the-tailpiece-end', 'wind-the-peg', 'check-the-bridge']) {
    const figure = doc.querySelector(`#${id} figure`);
    expect(figure).not.toBeNull();
    const img = figure.querySelector('img');
    expect(img.getAttribute('alt').length).toBeGreaterThan(12);
    expect(figure.querySelector('a').getAttribute('href')).toBe(img.getAttribute('src'));
    expect(figure.querySelector('figcaption a')).not.toBeNull();
  }
});

it.each([
  'how-to-change-acoustic-guitar-strings',
  'how-to-change-electric-guitar-strings',
  'how-to-change-bass-guitar-strings',
  'how-to-change-a-viola-string',
  'how-to-change-classical-guitar-strings',
  'how-to-change-a-cello-string',
  'how-to-change-ukulele-strings',
])('pairs each numbered step of %s with a credited, openable photograph', (slug) => {
  const { doc, schema } = renderPage('/guides/' + slug);
  const article = schema.find((item) => item['@type'] === 'Article');
  const steps = [...doc.querySelectorAll('section.resource-section[id]')].filter((section) =>
    /^\d+\./.test(section.querySelector('h2')?.textContent || '')
  );
  expect(steps.length).toBeGreaterThanOrEqual(4);
  const images = [];
  for (const [index, step] of steps.entries()) {
    expect(step.querySelector('h2').textContent).toMatch(new RegExp('^' + (index + 1) + '\\.'));
    const figures = [...step.querySelectorAll('.guide-step-photo')];
    expect(figures.length).toBeGreaterThan(0);
    for (const figure of figures) {
      const img = figure.querySelector('img');
      const src = img.getAttribute('src');
      expect(img.getAttribute('alt').length).toBeGreaterThan(12);
      expect(figure.querySelector('a').getAttribute('href')).toBe(src);
      expect(existsSync(resolve('public', src.slice(1)))).toBe(true);
      expect(figure.querySelector('figcaption .guide-media-credit a')).not.toBeNull();
      images.push('https://sattarimusic.com' + src);
    }
  }
  expect(article.image).toEqual(images);
});
