import { dailySession, readHistory } from './practicePlan';

export default function DailySession({ records, onStart }) {
  const history = readHistory();
  const plan = dailySession(records, history);
  if (!plan) return null;
  const days = new Set(history.map((r) => new Date(r.at).toLocaleDateString())).size;
  return (
    <section className="lc-daily" aria-label="Daily practice session">
      <div>
        <span className="lj-eyebrow">A LITTLE EVERY DAY</span>
        <h2>Your five-minute session.</h2>
        <p>
          {plan.basedOnHistory
            ? `Return to a passage that needs work in ${plan.record.lesson.title}.`
            : `Start with a short, guided session in ${plan.record.lesson.title}.`}{' '}
          Three steps, at your pace.
        </p>
      </div>
      <ol>
        {plan.steps.map((step) => (
          <li key={step.label}>{step.label}</li>
        ))}
      </ol>
      <div>
        <button
          type="button"
          className="loop-button loop-button-purple"
          onClick={() => onStart(plan)}
        >
          Start today’s session
        </button>
        <small>
          {days
            ? `${days} practice day${days === 1 ? '' : 's'} recorded on this device`
            : 'Your first practice day starts here'}
        </small>
      </div>
    </section>
  );
}
