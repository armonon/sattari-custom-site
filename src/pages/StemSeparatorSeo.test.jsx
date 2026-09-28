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

function renderPage(path) {
  const context = {};
  const canUseDOM = HelmetProvider.canUseDOM;
  HelmetProvider.canUseDOM = false;
  try {
    const body = renderToString(
      <HelmetProvider context={context}>
        <StaticRouter location={path}>
          <Routes>
            <Route path="/guides" element={<GuideIndex />} />
            <Route path="/guides/:slug" element={<GuideArticle />} />
            <Route path="/tools/:tool" element={<ToolDetailsPage />} />
          </Routes>
        </StaticRouter>
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
    expect(doc.querySelector('.resource-action').getAttribute('href')).toBe('/stem-separator');
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
