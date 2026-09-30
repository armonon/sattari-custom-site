import { useMemo, useState } from 'react';
import { adaptiveSuggestion } from './practicePlan';
import RhythmPractice from './RhythmPractice';
import MicrophoneSetup from './MicrophoneSetup';
import useMicrophone from './useMicrophone';

export default function AdaptiveDrill({ phrase, bpm, result, onExit }) {
  const mic = useMicrophone();
  const initial = useMemo(() => adaptiveSuggestion(phrase, result, result.speed), [phrase, result]);
  const [step, setStep] = useState(initial);
  const [ready, setReady] = useState(false),
    [round, setRound] = useState(0);
  const [last, setLast] = useState(null);
  const target = {
    start: step.notes[0].start,
    end: step.notes.at(-1).end + 0.15,
    notes: step.notes,
  };
  const leave = () => {
    mic.stop();
    onExit();
  };
  return (
    <section className="lc-adaptive" aria-label="Adaptive passage practice">
      <div className="lc-panel">
        <span className="lj-eyebrow">YOUR PERSONAL PRACTICE PLAN</span>
        <h2>
          {step.kind === 'isolate' ? 'Just this little transition.' : 'Put it back together.'}
        </h2>
        <p>{step.message}</p>
        <p>
          {step.notes.length} notes · {Math.round(step.speed * 100)}% speed. Drill results stay
          separate from the full phrase.
        </p>
        {!ready ? (
          <MicrophoneSetup mic={mic} onReady={() => setReady(true)} />
        ) : last ? (
          <div role="status">
            <p>
              {last.reliable === false
                ? 'We did not hear enough clear input to judge this attempt. Reconnect and try again; the plan has not changed.'
                : `${last.onTime} of ${last.total} notes landed on time.`}
            </p>
            <button
              className="loop-button loop-button-purple"
              type="button"
              onClick={() => {
                if (last.reliable !== false && last.onTime === last.total && !last.extras)
                  setStep({
                    kind: 'build',
                    notes: phrase.notes,
                    speed: Math.min(1, step.speed + 0.25),
                    message: 'Now reconnect the complete phrase at the next pace.',
                  });
                else if (last.reliable !== false)
                  setStep({
                    ...step,
                    speed: Math.max(0.5, step.speed - 0.25),
                    message: 'Stay with this passage a little longer. Keep each pluck clear.',
                  });
                setLast(null);
                setRound((r) => r + 1);
              }}
            >
              {last.reliable !== false && last.onTime === last.total && !last.extras
                ? 'Build up the phrase'
                : 'Try this step again'}
            </button>
          </div>
        ) : null}
        <button className="lj-text-link" type="button" onClick={leave}>
          Return to the full lesson
        </button>
      </div>
      {ready && !last && (
        <RhythmPractice
          key={round}
          phrase={target}
          bpm={bpm}
          mic={mic}
          initialSpeed={step.speed}
          onRequestMicrophone={() => setReady(false)}
          onDone={setLast}
          onBack={leave}
        />
      )}
    </section>
  );
}
