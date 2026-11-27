import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { practiceGuideExercises, snareExerciseSections } from '../data/practiceGuideExercises';
import './PracticeGuideAid.css';

const cards = {
  pad: [
    'Pad comparison',
    [
      '8-inch surface, support and fit',
      '12-inch surface, support and fit',
      'Rebound on the second stroke',
      'Noise in the next room',
    ],
  ],
  bass: [
    'Two-bar bass worksheet',
    [
      'First attack in each bar',
      'Where the last bass note releases',
      'Beats with space',
      'Bass attacks that line up with the kick',
    ],
  ],
  repair: [
    'Repair inquiry',
    [
      'Instrument, brand and model',
      'Symptom and where it occurs',
      'Recent changes or earlier repairs',
      'Playing setup or usual tuning',
      'Rehearsal or performance deadline',
    ],
  ],
  cymbals: [
    'Cymbal audition card',
    [
      'Cymbal or set and playing volume',
      'Hi-hat foot chick and open sound',
      'Ride stick definition on bow and bell',
      'Crash attack and decay',
      'Stand fit, sleeve and felts',
    ],
  ],
  setup: [
    'Guitar setup observations',
    [
      'Guitar, usual tuning and string gauge',
      'Open note and string',
      'Affected fret or range',
      'Light, usual or strong picking',
      'What I heard and when it began',
    ],
  ],
  sticks: [
    'Same-tempo stick trial',
    [
      '7A quiet strokes and ride ping',
      '5A quiet strokes and ride ping',
      '5B quiet strokes and ride ping',
      'Pair that feels relaxed at my practice volume',
    ],
  ],
  care: [
    'Guitar maintenance log',
    [
      'Date, guitar and finish',
      'Room or case humidity',
      'Last string-change date, set and gauge',
      'Usual tuning',
      'Symptoms and affected frets',
    ],
  ],
};

function PracticeWorksheet({ kind }) {
  const [title, fields] = cards[kind];
  const ref = useRef(null);
  const [status, setStatus] = useState('');
  const [manualCopy, setManualCopy] = useState('');
  async function copy() {
    const inputs = ref.current.querySelectorAll('input');
    const value = [title, ...fields.map((label, i) => label + ': ' + inputs[i].value)].join('\n');
    try {
      await navigator.clipboard.writeText(value);
      setManualCopy('');
      setStatus('Copied. You can paste these notes wherever you keep them.');
    } catch {
      setManualCopy(value);
      setStatus('Select the text below and copy it.');
    }
  }
  function print() {
    const card = ref.current;
    card.dataset.printCard = 'true';
    window.addEventListener(
      'afterprint',
      () => {
        delete card.dataset.printCard;
      },
      { once: true }
    );
    window.print();
  }
  return (
    <div ref={ref} className="practice-worksheet">
      <h4>{title}</h4>
      <div className="practice-card-fields">
        {fields.map((label) => (
          <label key={label}>
            {label}
            <input type="text" autoComplete="off" />
          </label>
        ))}
      </div>
      <div className="practice-card-actions">
        <button type="button" onClick={copy}>
          {kind === 'repair' ? 'Copy repair inquiry' : 'Copy notes'}
        </button>
        <button type="button" onClick={print}>
          Print card
        </button>
      </div>
      <span className="practice-response" role="status">
        {status}
      </span>
      {manualCopy && (
        <textarea
          className="practice-copy-fallback"
          aria-label="Notes to copy"
          readOnly
          value={manualCopy}
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}

const clips = {
  parts: [
    ['Other instruments only', 'other-instruments'],
    ['Drums, bass and other instruments', 'karaoke-band'],
  ],
  bass: [
    ['Listen to the two-bar bass line', 'two-bar-bass'],
    ['Play the same two bars with bass muted', 'two-bars-without-bass'],
  ],
  guitar: [
    ['Hear the four guitar notes at 60 BPM', 'guitar-phrase-60'],
    ['Play the notes against four clicks', 'guitar-four-beats'],
  ],
  karaoke: [
    ['Karaoke export · band only', 'karaoke-band'],
    ['Solo-vocal export · guide melody', 'solo-vocal'],
  ],
  pickup: [
    ['Hear the pickup with drums', 'pickup-with-drums'],
    ['Play the pickup with drums muted', 'pickup-drumless'],
  ],
  keys: [
    ['Listen to ending A', 'c-major-ending'],
    ['Listen to ending B', 'a-minor-ending'],
  ],
  tempo: [['Count the strong beats, then every click', '80-and-160']],
};
function ListeningClips({ kind }) {
  const playing = useRef(null);
  function play(e) {
    if (playing.current && e.currentTarget !== playing.current) playing.current.pause();
    playing.current = e.currentTarget;
  }
  return (
    <div className="practice-clips">
      {clips[kind].map(([label, file]) => (
        <figure key={file}>
          <figcaption>{label}</figcaption>
          <audio
            aria-label={label}
            controls
            preload="none"
            onPlay={play}
            src={'/audio/guide-practice/' + file + '.wav'}
          />
          {kind === 'karaoke' && (
            <a download href={'/audio/guide-practice/' + file + '.wav'}>
              Download {file === 'solo-vocal' ? 'solo melody' : 'band mix'} WAV
            </a>
          )}
        </figure>
      ))}
    </div>
  );
}
function ListeningAnswer({ children }) {
  return (
    <details className="practice-answer">
      <summary>Reveal the listening answer</summary>
      <p>{children}</p>
    </details>
  );
}
const outputRows = [
  ['Vocals', 'Lead and backing voices assigned to the vocal group. Mute it for karaoke.'],
  [
    'Drums',
    'Kit and percussion estimate. Keep it for the backbeat, or mute it to play along on drums.',
  ],
  ['Bass', 'Low bass line. Keep it for the band mix, or mute it for bass practice.'],
  [
    'Other instruments',
    'Remaining accompaniment, such as keys and guitar. Add bass and drums for the full non-vocal band.',
  ],
];
function PartKey() {
  return (
    <div className="guide-table-wrap">
      <table aria-label="Four stem outputs and what to keep">
        <thead>
          <tr>
            <th scope="col">Output</th>
            <th scope="col">What you hear</th>
          </tr>
        </thead>
        <tbody>
          {outputRows.map(([group, note]) => (
            <tr key={group}>
              <th scope="row">{group}</th>
              <td>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const violinChecks = [
  'Wipe loose rosin dust from the body with the clean, dry varnish cloth.',
  'Use the string cloth on the strings. Check for a damaged winding.',
  'Look at the bridge feet and seams. Leave new gaps or visible movement for a specialist.',
  'Loosen the bow hair as taught. Secure the bow and violin, remove loose objects, then close the case.',
];
const stringRoutes = [
  ['Steel-string acoustic guitar', 'acoustic-guitar'],
  ['Nylon-string classical guitar', 'classical-guitar'],
  ['Electric guitar', 'electric-guitar'],
  ['Bass guitar', 'bass-guitar'],
];

export function PracticeGuideAid({ slug, sectionId }) {
  const list = practiceGuideExercises[slug];
  if (!list) return null;
  const index =
    slug === 'how-to-tune-a-snare-drum'
      ? snareExerciseSections.indexOf(sectionId)
      : Number(sectionId?.replace('guide-section-', '')) - 1;
  const row = list[index];
  if (!row) return null;
  const [heading, body, kind] = row;
  return (
    <aside
      className={kind ? 'practice-aid practice-aid-feature' : 'practice-aid'}
      aria-label={heading}
    >
      <h3>{heading}</h3>
      <p>{body}</p>
      {kind === 'snare' && (
        <>
          <p className="practice-clip-nav">
            <a href="#snare-take-a">Hear take A</a>
            <a href="#snare-take-b">Hear take B</a>
          </p>
          <ListeningAnswer>
            Take B has the higher body pitch. Replay A, hum what rings after the initial attack,
            then play B while that pitch is still in your ear.
          </ListeningAnswer>
        </>
      )}
      {kind === 'parts' && (
        <>
          <PartKey />
          <p>
            The examples below come from the clean, synthesized parts of one original arrangement.
            Farther down the guide you can hear actual model estimates.
          </p>
        </>
      )}
      {kind === 'guitar' && (
        <div className="guide-table-wrap">
          <table aria-label="One-bar high E string tablature">
            <thead>
              <tr>
                <th scope="col">Beat</th>
                {[1, 2, 3, 4].map((n) => (
                  <th key={n} scope="col">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">High E fret</th>
                {[0, 1, 3, 0].map((n, i) => (
                  <td key={i}>{n}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Sounding note</th>
                {['E4', 'F4', 'G4', 'E4'].map((n, i) => (
                  <td key={i}>{n}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {kind && clips[kind] && <ListeningClips kind={kind} />}
      {kind === 'guitar' && (
        <p>
          Replay the click track with your eyes off the tab. Sing the first E while the last E
          rings. They should match in pitch and octave. If the last note is cut short, repeat just
          beats three and four.
        </p>
      )}
      {kind === 'keys' && (
        <ListeningAnswer>
          A settles on C major after G major. B settles on A minor after E minor. Both use notes
          from the same seven-note collection. The closing harmony and melody give each example a
          different home.
        </ListeningAnswer>
      )}
      {kind === 'bass' && (
        <ListeningAnswer>
          Both bars begin with bass and kick together on beat one. The bass next enters on the “and”
          of two, returns with the kick on three and leaves beat four open. The second bar starts on
          F instead of A.
        </ListeningAnswer>
      )}
      {kind === 'batch' && (
        <ol>
          <li>
            Download the verse WAVs for Vocals, Drums, Bass and Other instruments, or the verse ZIP
            if you need them all.
          </li>
          <li>
            For the rehearsal, keep only the required exports. A two-minute, four-stem result is
            about 162 MiB of uncompressed 32-bit stereo audio.
          </li>
          <li>
            Open the saved files from disk. Once verified, clear completed results if you need
            output space before adding another group.
          </li>
        </ol>
      )}
      {kind === 'violin' && (
        <fieldset className="practice-case-check">
          <legend>Case-closing checklist</legend>
          {violinChecks.map((c) => (
            <label key={c}>
              <input type="checkbox" />
              {c}
            </label>
          ))}
        </fieldset>
      )}
      {kind && cards[kind] && <PracticeWorksheet kind={kind} />}
      {kind === 'care' && (
        <ul>
          {stringRoutes.map(([label, part]) => (
            <li key={part}>
              <Link to={'/guides/how-to-change-' + part + '-strings'}>
                Change strings on a {label.toLowerCase()}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
