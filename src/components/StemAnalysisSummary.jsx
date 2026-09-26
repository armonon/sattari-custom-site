import { Activity, Music2 } from 'lucide-react';
import { formatDuration } from '../utils/stemSeparator';

const level = (value) => (value === null ? 'Silence' : `${value.toFixed(1)} dBFS`);
const keyNotes = {
  percussion: 'No key assigned to percussion.',
  quiet: 'Too little signal for a reliable estimate.',
  short: 'At least 3 seconds of audio is needed for a musical estimate.',
  'limited-harmony': 'Not enough distinct tonal evidence to estimate a key.',
};
const tempoNotes = {
  'no-pulse': 'No reliable repeating pulse detected.',
  variable: 'Pulse estimates disagree across the sampled sections.',
};

export default function StemAnalysisSummary({
  analysis,
  compact = false,
  label = 'Song analysis',
}) {
  if (!analysis) return null;
  if (analysis.status !== 'ready')
    return <p className="separator-analysis-unavailable">{label}: musical analysis unavailable.</p>;
  return (
    <section className={`separator-analysis${compact ? ' is-compact' : ''}`} aria-label={label}>
      {!compact && (
        <h4>
          Song analysis <span>Estimated</span>
        </h4>
      )}
      <dl className="separator-musical-stats">
        <div>
          <dt>
            <Music2 size={13} /> Estimated key
          </dt>
          <dd>
            {analysis.key ||
              (analysis.keyReason === 'percussion' ? 'Not assigned' : 'Undetermined')}
          </dd>
          {analysis.key && (
            <small>{analysis.keyEvidence === 'tentative' ? 'Tentative' : 'Tonal match'}</small>
          )}
        </div>
        <div>
          <dt>
            <Activity size={13} /> {compact ? 'Detected pulse' : 'Estimated tempo'}
          </dt>
          <dd>
            {analysis.bpm === null ? (
              'Undetermined'
            ) : (
              <>
                {analysis.bpm}
                <span> BPM</span>
              </>
            )}
          </dd>
          {analysis.bpm !== null && (
            <small>
              {analysis.tempoEvidence === 'tentative' ? 'Tentative' : 'Consistent pulse'}
            </small>
          )}
        </div>
        <div className="separator-note-stat">
          <dt>Prominent notes</dt>
          <dd>
            {analysis.prominentNotes.length ? analysis.prominentNotes.join(' · ') : 'Undetermined'}
          </dd>
        </div>
      </dl>
      <details className="separator-analysis-details">
        <summary>Analysis details</summary>
        <dl className="separator-signal-stats">
          <div>
            <dt>Duration</dt>
            <dd>{formatDuration(analysis.duration)}</dd>
          </div>
          <div>
            <dt>Working sample rate</dt>
            <dd>{analysis.sampleRate / 1000} kHz</dd>
          </div>
          <div>
            <dt>Channels</dt>
            <dd>{analysis.channels === 1 ? 'Mono' : 'Stereo'}</dd>
          </div>
          <div>
            <dt>Sample peak</dt>
            <dd>{level(analysis.peakDb)}</dd>
          </div>
          <div>
            <dt>Average level (RMS)</dt>
            <dd>{level(analysis.rmsDb)}</dd>
          </div>
          <div>
            <dt>Musical sample</dt>
            <dd>
              {analysis.analyzedSeconds}s / {analysis.windows.length}{' '}
              {analysis.windows.length === 1 ? 'section' : 'sections'}
            </dd>
          </div>
        </dl>
        {analysis.keyReason && <p>{keyNotes[analysis.keyReason]}</p>}
        {tempoNotes[analysis.tempoReason] && <p>{tempoNotes[analysis.tempoReason]}</p>}
        <p>
          Key and pulse are estimates, not a transcription. Notes are pitch classes, not a melody or
          chord progression.
          {compact
            ? ' Sparse stems may suggest a different key or a half/double-time pulse; this does not mean the song changed tempo.'
            : ' Relative major/minor keys and half/double-time tempos can be ambiguous. Short excerpts may miss key or tempo changes.'}
        </p>
      </details>
    </section>
  );
}
