import { MemoryRouter } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { act, fireEvent, render as renderComponent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import LoopJourney from './LoopJourney';
import { DEMO } from './music';

function render(ui) {
  return renderComponent(ui, { wrapper: MemoryRouter });
}

const { child } = vi.hoisted(() => ({ child: { props: null, mounts: 0 } }));
vi.mock('./FocusedPractice', () => ({
  default: function MockFocusedPractice(props) {
    child.props = props;
    useEffect(() => {
      child.mounts++;
    }, []);
    return (
      <div>
        <span>{props.sessionStep}</span>
        <button onClick={() => props.onComplete({ matched: 0 })}>Complete exercise</button>
        {props.onNextSessionStep && (
          <button onClick={props.onNextSessionStep}>Next daily exercise</button>
        )}
      </div>
    );
  },
}));
vi.setConfig({ testTimeout: 120000 });
beforeEach(() => {
  localStorage.clear();
  child.mounts = 0;
  URL.createObjectURL = vi.fn(() => 'blob:exercise');
  URL.revokeObjectURL = vi.fn();
});

it('runs all three daily steps, remounts repeated passages, and never credits a full-song completion', async () => {
  const complete = vi.fn();
  function Harness() {
    const [stage, setStage] = useState('choose'),
      [lesson, setLesson] = useState(DEMO);
    return (
      <LoopJourney
        stage={stage}
        lesson={lesson}
        records={[]}
        progress={{}}
        onChoose={setLesson}
        onPractice={() => setStage('focus')}
        onComplete={complete}
      />
    );
  }
  await act(async () => render(<Harness />));
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Start today’s session' }))
  );
  expect(child.props.sessionStep).toBe('1 / 3');
  expect(child.props.lesson.plan.level).toBe('essentials');
  expect(child.props.initialSpeed).toBe(0.5);
  fireEvent.click(screen.getByRole('button', { name: 'Complete exercise' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next daily exercise' }));
  expect(child.props.sessionStep).toBe('2 / 3');
  expect(child.props.lesson.plan.level).toBe('full');
  expect(child.props.initialSpeed).toBe(0.75);
  fireEvent.click(screen.getByRole('button', { name: 'Next daily exercise' }));
  expect(child.props.sessionStep).toBe('3 / 3');
  expect(child.props.initialSpeed).toBe(1);
  expect(child.mounts).toBe(3);
  expect(screen.queryByRole('button', { name: 'Next daily exercise' })).not.toBeInTheDocument();
  expect(complete).not.toHaveBeenCalled();
});
