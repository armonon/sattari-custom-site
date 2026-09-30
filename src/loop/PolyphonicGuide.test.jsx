import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PolyphonicGuide from './PolyphonicGuide';
import ImportSetup from './ImportSetup';
import { DEMO } from './music';
import { lessonFingerprint } from './progress';

it('explicitly opts into polyphonic analysis', () => {
  const importer = { selectedFile: new File(['audio'], 'Chords.wav'), importSong: vi.fn() };
  render(<ImportSetup importer={importer} />);
  fireEvent.click(screen.getByRole('checkbox', { name: /Include chords/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Build my practice guide' }));
  expect(importer.importSong).toHaveBeenCalledWith(importer.selectedFile, {
    preparation: 'solo',
    detail: 'harmony',
  });
});

it('corrects polyphonic notes, updates chord names and invalidates review without changing melody notes', () => {
  const lesson = {
    ...DEMO,
    polyphonicNotes: [48, 52, 55, 59].map((midi) => ({ midi, start: 0, end: 1, confidence: 0.8 })),
  };
  const onEditLesson = vi.fn();
  render(
    <PolyphonicGuide lesson={lesson} phrase={{ start: 0, end: 2 }} onEditLesson={onEditLesson} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit chord tones' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove B3 at 0.00 seconds' }));
  const next = onEditLesson.mock.calls[0][0];
  expect(next.polyphonicNotes).toHaveLength(3);
  expect(next.chords[0].name).toBe('C');
  expect(next.notes).toBe(lesson.notes);
  expect(lessonFingerprint(next)).not.toBe(lessonFingerprint(lesson));
});

it('shows a review warning instead of an impossible two-frets-on-one-string fingering', () => {
  render(
    <PolyphonicGuide
      lesson={{ ...DEMO, polyphonicNotes: [40, 41].map((midi) => ({ midi, start: 0, end: 1 })) }}
      phrase={{ start: 0, end: 2 }}
    />
  );
  expect(screen.getByText(/don’t form a playable six-string shape/)).toBeInTheDocument();
});
