import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import CoursePath, { courseEvidence, LessonBrief } from './CoursePath';
import { FOUNDATION_LESSONS } from './courseCatalog';
import { DEFAULT_PROFILE } from './guitarProfile';
import { lessonFingerprint } from './progress';
import { PracticeCheckIn } from './PracticeJournal';
import DraftAudition from './DraftAudition';
import { readFeedback } from './practiceReport';

beforeEach(() => localStorage.clear());
it('opens a real first lesson and gives it a practical teaching brief', () => {
  const onChoose = vi.fn();
  render(<CoursePath onChoose={onChoose} progress={{}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start step 1' }));
  expect(onChoose).toHaveBeenCalledWith(FOUNDATION_LESSONS[0]);
  render(<LessonBrief lesson={FOUNDATION_LESSONS[0]} />);
  expect(screen.getByRole('region', { name: 'Before you play' })).toHaveTextContent(
    'Relax your picking hand'
  );
});
it('never counts manual completion or stale fingerprints as a pitch milestone', () => {
  const lesson = FOUNDATION_LESSONS[0];
  const key = 'loop-checkpoint-v2:' + lesson.id;
  localStorage.setItem(
    key,
    JSON.stringify({
      fingerprint: lessonFingerprint(lesson),
      stage: 'complete',
      phraseIndex: 0,
      position: 0,
      matched: [],
    })
  );
  expect(courseEvidence(lesson, DEFAULT_PROFILE)).toEqual({ label: 'Explored', verified: false });
  const onChoose = vi.fn();
  render(<CoursePath onChoose={onChoose} progress={{}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start step 2' }));
  expect(onChoose).toHaveBeenCalledWith(FOUNDATION_LESSONS[1]);
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0');
  expect(
    courseEvidence(lesson, DEFAULT_PROFILE, {
      [lesson.id]: { fingerprint: 'stale', matched: lesson.notes.length },
    }).verified
  ).toBe(false);
  localStorage.setItem(
    key,
    JSON.stringify({
      fingerprint: lessonFingerprint(lesson),
      stage: 'complete',
      phraseIndex: 0,
      position: 0,
      matched: lesson.notes.map((_, i) => i),
    })
  );
  expect(courseEvidence(lesson, DEFAULT_PROFILE).verified).toBe(true);
});
it('saves a learner check-in locally', () => {
  render(<PracticeCheckIn lesson={FOUNDATION_LESSONS[0]} phrase={0} />);
  fireEvent.click(screen.getByText('How did the feedback feel?'));
  fireEvent.change(screen.getByLabelText('Your experience'), {
    target: { value: 'missed-correct' },
  });
  fireEvent.change(screen.getByLabelText('Anything you noticed? (optional)'), {
    target: { value: 'Low E was missed' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }));
  expect(readFeedback()[0]).toMatchObject({
    issue: 'missed-correct',
    note: 'Low E was missed',
    phrase: 0,
  });
  expect(screen.getByRole('status')).toHaveTextContent('saved on this device');
});
it('corrects a selected imported note in place and exposes both listening comparisons', () => {
  const lesson = { ...FOUNDATION_LESSONS[0], source: 'estimate' },
    edit = vi.fn();
  render(<DraftAudition lesson={lesson} sourceUrl="blob:recording" onEdit={edit} />);
  fireEvent.click(screen.getByText('Check the guide, one phrase at a time'));
  expect(screen.getByRole('button', { name: 'Hear recording excerpt' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Hear draft notes' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Correct melody pitch'), { target: { value: '65' } });
  expect(edit.mock.calls[0][0].notes[0].midi).toBe(65);
  fireEvent.click(screen.getByRole('button', { name: 'Omit this melody note' }));
  expect(edit.mock.calls[1][0].notes).toHaveLength(3);
});
