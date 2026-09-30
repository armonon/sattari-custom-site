import { useEffect, useRef, useState } from 'react';
import { phrasesFor, noteName, formatTime } from './music';
import { wavBlob } from './lessonMedia';
import { editDraftNote, phraseConcerns } from './draftReview';
import { lessonFingerprint } from './progress';

export default function DraftAudition({ lesson, sourceUrl, onEdit, onBeforePlay, otherPlaying }) {
  const [part, setPart] = useState(0),
    [selected, setSelected] = useState(0),
    [mode, setMode] = useState(''),
    [error, setError] = useState('');
  const original = useRef(null),
    draft = useRef(null),
    draftUrl = useRef('');
  const phrases = phrasesFor(lesson),
    index = Math.min(part, phrases.length - 1),
    phrase = phrases[index];
  const note = phrase.notes[Math.min(selected, phrase.notes.length - 1)];
  const concerns = phraseConcerns(phrase);
  const fingerprint = lessonFingerprint(lesson);
  useEffect(() => {
    const sourcePlayer = original.current,
      draftPlayer = draft.current;
    const stop = () => {
      sourcePlayer?.pause();
      draftPlayer?.pause();
      setMode('');
    };
    stop();
    document.addEventListener('visibilitychange', stop);
    return () => {
      document.removeEventListener('visibilitychange', stop);
      sourcePlayer?.pause();
      draftPlayer?.pause();
      URL.revokeObjectURL(draftUrl.current);
    };
  }, [index, fingerprint]);
  useEffect(() => {
    if (otherPlaying) {
      original.current?.pause();
      draft.current?.pause();
      setMode('');
    }
  }, [otherPlaying]);
  const hear = async (which) => {
    original.current?.pause();
    draft.current?.pause();
    setError('');
    if (mode === which) {
      setMode('');
      return;
    }
    onBeforePlay?.();
    try {
      let player = original.current;
      if (which === 'draft') {
        URL.revokeObjectURL(draftUrl.current);
        const start = phrase.start;
        draftUrl.current = URL.createObjectURL(
          wavBlob(
            phrase.notes.map((n) => ({ ...n, start: n.start - start, end: n.end - start })),
            phrase.end - start
          )
        );
        player = draft.current;
        player.src = draftUrl.current;
        player.currentTime = 0;
      } else player.currentTime = phrase.start;
      await player.play();
      setMode(which);
    } catch {
      setMode('');
      setError('Playback could not start. Try the excerpt again.');
    }
  };
  return (
    <details
      className="lc-audit"
      onToggle={(e) => {
        if (!e.currentTarget.open) {
          original.current?.pause();
          draft.current?.pause();
          setMode('');
        }
      }}
    >
      <summary>Check the guide, one phrase at a time</summary>
      <p>
        Compare the recording with the estimated melody. Signals below identify places to inspect;
        they are not accuracy scores.
      </p>
      <label>
        Review phrase
        <select
          aria-label="Review phrase"
          value={index}
          onChange={(e) => {
            setPart(Number(e.target.value));
            setSelected(0);
          }}
        >
          {phrases.map((p, i) => (
            <option key={i} value={i}>
              {i + 1} · {formatTime(p.start)}–{formatTime(p.end)}
              {phraseConcerns(p).length ? ' · check this part' : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="lc-backup-actions">
        <button
          type="button"
          className="loop-button loop-button-secondary"
          disabled={!sourceUrl}
          onClick={() => void hear('recording')}
        >
          {mode === 'recording' ? 'Pause recording excerpt' : 'Hear recording excerpt'}
        </button>
        <button
          type="button"
          className="loop-button loop-button-secondary"
          disabled={!phrase.notes.length}
          onClick={() => void hear('draft')}
        >
          {mode === 'draft' ? 'Pause draft notes' : 'Hear draft notes'}
        </button>
      </div>
      {concerns.length ? (
        <ul>
          {concerns.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p>No automatic flags in this phrase. Still compare it by ear.</p>
      )}
      {note && onEdit && (
        <div className="lc-note-correction">
          <label>
            Note to check
            <select
              value={Math.min(selected, phrase.notes.length - 1)}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {phrase.notes.map((n, i) => (
                <option key={n.index} value={i}>
                  {i + 1} · {noteName(n.midi)} at {formatTime(n.start)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Correct melody pitch
            <select
              value={note.midi}
              onChange={(e) => {
                setMode('');
                onEdit(editDraftNote(lesson, note.index, Number(e.target.value)));
              }}
            >
              {[...new Set([note.midi, ...Array.from({ length: 45 }, (_, i) => 40 + i)])]
                .sort((a, b) => a - b)
                .map((midi) => (
                  <option key={midi} value={midi}>
                    {noteName(midi)}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="lj-text-link"
            onClick={() => {
              onEdit(editDraftNote(lesson, note.index, null));
              setSelected(0);
            }}
          >
            Omit this melody note
          </button>
          <small>
            Changes apply to the melody guide. The recording and separate chord-tone estimates stay
            as they were. Recheck the guide before practice.
          </small>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <audio
        ref={original}
        src={sourceUrl || undefined}
        preload="none"
        onEnded={() => setMode('')}
        onTimeUpdate={(e) => {
          if (e.currentTarget.currentTime >= phrase.end) {
            e.currentTarget.pause();
            setMode('');
          }
        }}
      />
      <audio ref={draft} preload="none" onEnded={() => setMode('')} />
    </details>
  );
}
