import { expect, it } from 'vitest';
import { guideCollections } from '../data/musicGuides';
import phrases from '../data/guideSearchPhrases.json';
import { buildGuideFinder, findGuideSections } from './guideFinder';

const index = buildGuideFinder(phrases, guideCollections);

it('resolves every mapped question to an existing guide or section', () => {
  for (const [path, questions] of Object.entries(phrases)) {
    for (const question of questions) {
      expect(findGuideSections(index, question, 1)[0]?.path, question).toBe(path);
    }
  }
});

it('routes short questions by instrument and handles a search with no matches', () => {
  expect(findGuideSections(index, 'oud bridge knot')[0].path).toBe(
    '/guides/how-to-change-oud-strings#anchor-the-string'
  );
  expect(findGuideSections(index, 'violin size')[0].path).toMatch(/choose-a-violin/);
  expect(findGuideSections(index, 'qxyzqxyz')).toEqual([]);
  expect(findGuideSections(index, 'the')).toEqual([]);
});
