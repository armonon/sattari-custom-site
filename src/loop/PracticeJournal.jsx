import { useState } from 'react';
import { readHistory } from './practicePlan';
import { useGuitarProfile } from './GuitarSetup';
import { readFeedback, saveFeedback, practiceReport } from './practiceReport';

export function PracticeCheckIn({ lesson, phrase }) {
  const [issue, setIssue] = useState('helpful'),
    [note, setNote] = useState(''),
    [message, setMessage] = useState('');
  return (
    <details className="lc-check-in">
      <summary>How did the feedback feel?</summary>
      <p>
        Help keep a record of what worked. This note stays on your device and can be included in a
        practice report.
      </p>
      <label>
        Your experience
        <select value={issue} onChange={(e) => setIssue(e.target.value)}>
          <option value="helpful">The feedback helped</option>
          <option value="missed-correct">It missed notes I played correctly</option>
          <option value="false-match">It accepted a note I played incorrectly</option>
          <option value="timing">The timing felt off</option>
          <option value="setup">I had trouble with the microphone</option>
        </select>
      </label>
      <label>
        Anything you noticed? (optional)
        <textarea
          maxLength={600}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="For example: the open low E was hard to detect."
        />
      </label>
      <button
        type="button"
        className="loop-button loop-button-secondary"
        onClick={() => {
          const saved = saveFeedback({ lessonId: lesson.rootId || lesson.id, phrase, issue, note });
          setMessage(
            saved
              ? 'Check-in saved on this device.'
              : 'The check-in could not be saved. Device storage is unavailable.'
          );
        }}
      >
        Save check-in
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
export default function PracticeJournal({ songs }) {
  const history = readHistory(),
    feedback = readFeedback(),
    { profile } = useGuitarProfile();
  const [message, setMessage] = useState('');
  const attempts = history.filter((r) => r.kind === 'rhythm');
  const names = new Map(songs.map((song) => [song.id, song.title]));
  return (
    <details className="lc-journal">
      <summary>Your practice journal</summary>
      <p>
        {attempts.length} timing attempts ·{' '}
        {new Set(history.map((r) => new Date(r.at).toLocaleDateString())).size} practice days ·{' '}
        {feedback.length} personal check-ins
      </p>
      {attempts.length ? (
        <ol>
          {attempts
            .slice(-5)
            .reverse()
            .map((row, i) => (
              <li key={`${row.at}:${i}`}>
                <strong>{names.get(row.lessonId) || 'Your imported lesson'}</strong>
                <span>
                  Phrase {(row.phrase || 0) + 1} · {new Date(row.at).toLocaleDateString()} ·{' '}
                  {Math.round((row.result?.speed || 1) * 100)}% speed
                </span>
                <small>
                  {row.result?.reliable === false
                    ? 'Unconfirmed input · not used for adaptive practice'
                    : `${row.result?.onTime || 0}/${row.result?.total || 0} notes detected on time`}
                </small>
              </li>
            ))}
        </ol>
      ) : (
        <p>Try a phrase in time and save the attempt to begin your journal.</p>
      )}
      <p>
        Download a report when you want to discuss a session with a teacher or report a problem. It
        includes practice scores, written check-ins, guitar settings and browser information. It
        contains no recordings.
      </p>
      <button
        type="button"
        className="loop-button loop-button-secondary"
        onClick={() => {
          const report = practiceReport({ profile, device: navigator.userAgent });
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
          );
          const link = document.createElement('a');
          link.href = url;
          link.download = 'sattari-learn-practice-report.json';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          setMessage('Report prepared. You choose whether and where to share it.');
        }}
      >
        Download practice report
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
