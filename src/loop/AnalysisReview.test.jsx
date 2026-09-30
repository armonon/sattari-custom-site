import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render as renderComponent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import LoopJourney from './LoopJourney';
import { DEMO } from './music';

function render(ui) {
  return renderComponent(ui, { wrapper: MemoryRouter });
}

vi.setConfig({ testTimeout: 120000 });
beforeEach(() => localStorage.clear());

it('keeps an imported guide out of practice until reviewed, and invalidates review after an edit', () => {
  const lesson = {
    ...DEMO,
    id: 'import-review-test',
    source: 'estimate',
    quality: { coverage: 0.18 },
    notes: DEMO.notes.slice(0, 2),
  };
  const props = {
    stage: 'overview',
    lesson,
    records: [],
    progress: {},
    onPractice: vi.fn(),
    onStudio: vi.fn(),
    onBack: vi.fn(),
    onTool: vi.fn(),
    onExport: vi.fn(),
    onPreview: vi.fn(),
  };
  const view = render(<LoopJourney {...props} />);
  expect(screen.getByRole('button', { name: 'Practice this song' })).toBeDisabled();
  expect(screen.getByText(/Only a small part of this recording/)).toBeInTheDocument();
  expect(screen.getByText(/cannot isolate guitar alone/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Practice this song' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Practice this song' }));
  expect(props.onPractice).toHaveBeenCalledOnce();
  view.rerender(<LoopJourney {...props} lesson={{ ...lesson, bpm: 100 }} />);
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Practice this song' })).toBeDisabled();
});

it('lets authored lessons go straight into practice without a draft approval step', () => {
  render(
    <LoopJourney stage="overview" lesson={DEMO} progress={{}} records={[]} onPractice={vi.fn()} />
  );
  expect(screen.getByRole('button', { name: 'Practice this song' })).toBeEnabled();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

it('routes a reviewed chord-only import into guided chord practice', () => {
  const lesson = { ...DEMO, id: 'chords-only', source: 'estimate', notes: [], polyphonicNotes: [] };
  render(<LoopJourney stage="overview" lesson={lesson} progress={{}} records={[]} />);
  expect(screen.getByRole('button', { name: 'Practice these chords' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Practice these chords' }));
  expect(screen.getByRole('heading', { name: 'Build your Em.' })).toBeInTheDocument();
});
