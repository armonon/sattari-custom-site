import { useEffect, useRef, useState } from 'react';
import { useGuitarProfile } from './GuitarSetup';
import { mediaStore } from './lessonMedia';
import { lessonFingerprint } from './progress';

export function fingeringFor(note, notes) {
  const held = notes.filter((n) => n.fret > 0).map((n) => n.fret);
  const base = held.length ? Math.max(1, Math.min(...held)) : 1;
  const position = note?.fret > base + 3 ? Math.max(1, note.fret - 2) : base;
  return { position, finger: note?.fret ? Math.min(4, Math.max(1, note.fret - position + 1)) : 0 };
}

export default function HandDemonstration({
  lesson,
  phrase,
  note,
  playing,
  onFollow,
  onVideoStart,
}) {
  const { profile } = useGuitarProfile();
  const [clip, setClip] = useState(null),
    [url, setUrl] = useState(''),
    [message, setMessage] = useState('');
  const video = useRef(null);
  const key = `video:${lesson.id}:${phrase.start}`;
  const fingerprint = lessonFingerprint(lesson);
  useEffect(() => {
    let live = true;
    setClip(null);
    void mediaStore('list')
      .then((items) => {
        if (live) setClip(items.find((v) => v.id === key && v.fingerprint === fingerprint) || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, fingerprint]);
  useEffect(() => {
    if (!clip?.blob) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(clip.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [clip?.blob]);
  useEffect(() => {
    if (playing) video.current?.pause();
  }, [playing]);
  useEffect(() => {
    const player = video.current;
    const hide = () => {
      if (document.hidden) player?.pause();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      player?.pause();
      document.removeEventListener('visibilitychange', hide);
    };
  }, [url]);
  if (!note || note.unplayable) return null;
  const { position, finger } = fingeringFor(note, phrase.notes);
  const mirror = profile.handedness === 'left';
  const fingerX = 76 + (finger ? finger - 1 : 0) * 39;
  const stringY = 42 + (5 - note.string) * 17;
  return (
    <details
      className="lc-hands"
      onToggle={(e) => {
        if (!e.currentTarget.open) video.current?.pause();
      }}
    >
      <summary>Show me the hands</summary>
      <div className="lc-hand-grid">
        <div>
          <span className="lj-eyebrow">FRETTING HAND · {mirror ? 'RIGHT' : 'LEFT'}</span>
          <svg
            viewBox="0 0 300 235"
            role="img"
            aria-label={
              finger
                ? `Use finger ${finger}, fret ${note.fret}, string ${6 - note.string}. Hand starts at fret ${position}.`
                : `Leave string ${6 - note.string} open.`
            }
          >
            <g transform={mirror ? 'translate(300 0) scale(-1 1)' : undefined}>
              <rect x="48" y="27" width="200" height="120" rx="5" fill="#dedfcd" />
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1={56 + i * 39}
                  x2={56 + i * 39}
                  y1="27"
                  y2="147"
                  stroke="#a1a78e"
                  strokeWidth="3"
                />
              ))}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <line
                  key={i}
                  x1="34"
                  x2="252"
                  y1={42 + i * 17}
                  y2={42 + i * 17}
                  stroke={5 - i === note.string ? '#ba4825' : '#7d8972'}
                  strokeWidth={5 - i === note.string ? 2.5 : 1}
                />
              ))}
              <path
                d="M82 230L76 188Q72 165 85 161L209 161Q222 165 213 192L199 230"
                fill="#edc6a2"
                stroke="#ae896b"
                strokeWidth="2"
              />
              {[1, 2, 3, 4].map((f) => (
                <path
                  key={f}
                  d={`M${76 + (f - 1) * 39} 178 Q${65 + (f - 1) * 39} 145 ${76 + (f - 1) * 39} ${f === finger ? stringY : 151}`}
                  fill="none"
                  stroke={f === finger ? '#d79c71' : '#edc6a2'}
                  strokeWidth="17"
                  strokeLinecap="round"
                />
              ))}
              <circle cx={finger ? fingerX : 34} cy={stringY} r="10" fill="#c34a23" />
            </g>
            {[0, 1, 2, 3].map((i) => (
              <text
                key={i}
                x={mirror ? 300 - (76 + i * 39) : 76 + i * 39}
                y="20"
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
              >
                {position + i}
              </text>
            ))}
            <text
              x={mirror ? 300 - (finger ? fingerX : 34) : finger ? fingerX : 34}
              y={stringY + 4}
              textAnchor="middle"
              fill="white"
              fontSize="11"
            >
              {finger || '○'}
            </text>
          </svg>
          <p>
            {finger
              ? `${['', 'Index', 'Middle', 'Ring', 'Little'][finger]} finger · fret ${note.fret}. Keep your hand near fret ${position}.`
              : 'Keep this string open. Let the fretting hand relax.'}
          </p>
        </div>
        <div>
          <span className="lj-eyebrow">PICKING HAND · {mirror ? 'LEFT' : 'RIGHT'}</span>
          <svg
            viewBox="0 0 220 170"
            role="img"
            aria-label={`Pluck string ${6 - note.string} once with a downstroke for this exercise.`}
          >
            <circle cx="104" cy="83" r="61" fill="#d8ddca" stroke="#a9b399" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={i}
                x1="20"
                x2="190"
                y1={42 + i * 17}
                y2={42 + i * 17}
                stroke={5 - i === note.string ? '#bd4925' : '#8b967e'}
                strokeWidth={5 - i === note.string ? 3 : 1}
              />
            ))}
            <path d={`M${mirror ? 39 : 139} ${stringY - 25}q14-12 28 0l-14 27Z`} fill="#c34a23" />
            <text x="12" y="161" fontSize="12" fill="currentColor">
              String {6 - note.string} · one clear pluck ↓
            </text>
          </svg>
          <p>Use a small downstroke for this exercise. Briefly mute between repeated notes.</p>
        </div>
      </div>
      <small>
        Animated placement guide follows the highlighted note. It illustrates one possible fingering
        and does not measure your physical technique.
      </small>
      <label className="lc-file">
        Add a teacher video for this phrase
        <input
          type="file"
          accept="video/*"
          onChange={async (e) => {
            const blob = e.target.files?.[0];
            e.target.value = '';
            if (!blob) return;
            if (blob.size > 80 * 1024 ** 2) {
              setMessage('Choose a video smaller than 80 MB.');
              return;
            }
            const value = { id: key, kind: 'video', fingerprint, blob, offset: 0 };
            setClip(value);
            try {
              await mediaStore('save', value);
              setMessage('Teacher video saved on this device.');
            } catch {
              setMessage('Video is available for this visit; device storage is unavailable.');
            }
          }}
        />
      </label>
      {url && (
        <div className="lc-teacher-video">
          <video
            ref={video}
            src={url}
            controls
            playsInline
            onPlay={onVideoStart}
            onTimeUpdate={(e) => {
              const time = phrase.start + e.currentTarget.currentTime - (clip.offset || 0);
              const next = phrase.notes.findLastIndex((n) => n.start <= time);
              onFollow?.(Math.max(0, next));
            }}
          />
          <label>
            Phrase starts in video (seconds)
            <input
              type="number"
              min="0"
              max="600"
              step="0.1"
              value={clip.offset || 0}
              onChange={(e) => setClip({ ...clip, offset: Math.max(0, Number(e.target.value)) })}
            />
          </label>
          <button
            type="button"
            className="lj-text-link"
            onClick={() =>
              void mediaStore('save', clip)
                .then(() => setMessage('Video alignment saved.'))
                .catch(() => setMessage('Alignment is available for this visit only.'))
            }
          >
            Save video alignment
          </button>
          <p>
            Use a demonstration at the lesson’s original tempo. The guide follows video time from
            this start point.
          </p>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
