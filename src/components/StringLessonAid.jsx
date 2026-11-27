import { useRef } from 'react';
import { violinStringChangePhotos } from '../data/violinStringChangePhotos';
import './StringLessonAid.css';

const tuners = [
  ['through-hole', 'Through-hole post', 'The string enters a hole through the side.'],
  ['split-post', 'Split post', 'A slot and central hole open at the top.'],
  ['locking', 'Rear-wheel locking tuner', 'Look behind the headstock for a locking wheel.'],
];

function TarCourseCard() {
  const positions = [
    'First white wire',
    'Second white wire',
    'First yellow wire',
    'Second yellow wire',
    'Drone wire',
    'Bass wire',
  ];
  return (
    <fieldset className="string-course-card">
      <legend>Your six-string tar tuning</legend>
      <p>
        Record the note and octave your teacher uses for each wire. You can print the filled card
        from your browser.
      </p>
      <div className="string-course-fields">
        {positions.map((position, i) => (
          <label key={position}>
            <span>
              Course {Math.floor(i / 2) + 1} · {position}
            </span>
            <input type="text" maxLength={48} aria-label={position + ' note and octave'} />
          </label>
        ))}
      </div>
      <p>
        Trace each wire between its <a href="#anchor-the-string">tailpiece tooth</a> and its{' '}
        <a href="#wind-the-peg">own tuning peg</a>.
      </p>
    </fieldset>
  );
}

function TunerDrawing({ type }) {
  return (
    <svg className="string-tuner-drawing" viewBox="0 0 160 85" aria-hidden="true" focusable="false">
      {type === 'locking' ? (
        <>
          <rect x="27" y="27" width="104" height="22" rx="4" fill="#b98a59" />
          <path d="M73 28V9Q82 2 91 9V28" fill="#c7d2ce" stroke="#28403b" strokeWidth="3" />
          <rect x="59" y="47" width="44" height="14" rx="2" fill="#657a74" />
          <rect x="62" y="61" width="38" height="13" rx="4" fill="#293f39" />
          {[67, 73, 79, 85, 91, 97].map((x) => (
            <path key={x} d={'M' + x + ' 64v7'} stroke="#d5e5dc" strokeWidth="2" />
          ))}
          <path d="M88 15l28-5" stroke="#a74c24" strokeWidth="3" />
        </>
      ) : (
        <>
          <ellipse cx="81" cy="69" rx="40" ry="8" fill="#b98a59" />
          <path
            d="M59 68V25Q81 36 103 25V68Q81 78 59 68Z"
            fill="#bacbc4"
            stroke="#28403b"
            strokeWidth="3"
          />
          <ellipse cx="81" cy="25" rx="22" ry="8" fill="#e7efea" stroke="#28403b" strokeWidth="3" />
          {type === 'split-post' ? (
            <>
              <path d="M64 20L98 30" stroke="#28403b" strokeWidth="5" />
              <ellipse cx="81" cy="25" rx="6" ry="4" fill="#162921" />
              <path d="M81 4v14" stroke="#a74c24" strokeWidth="3" />
            </>
          ) : (
            <>
              <ellipse cx="74" cy="45" rx="7" ry="5" fill="#28403b" />
              <path d="M31 50l42-5m27-3 29-5" stroke="#a74c24" strokeWidth="3" />
            </>
          )}
        </>
      )}
    </svg>
  );
}

function TunerSelector() {
  return (
    <nav
      className="string-tuner-selector"
      aria-label="Choose the winding instructions for your tuner"
    >
      {tuners.map(([type, name, description]) => (
        <a key={type} href={'#electric-' + type}>
          <TunerDrawing type={type} />
          <strong>{name}</strong>
          <span>{description}</span>
        </a>
      ))}
    </nav>
  );
}

function TieProfile() {
  return (
    <figure className="string-line-diagram">
      <svg
        viewBox="0 0 650 172"
        role="img"
        aria-label="Two side views of a six-hole tie block. Both the wound bass and smooth treble finish with the last tuck below the rear top edge."
      >
        {[
          ['Wound bass', '2 twists', 0],
          ['Smooth treble', '3 twists', 320],
        ].map(([name, twists, offset], i) => (
          <g key={name} transform={'translate(' + offset + ' 0)'}>
            <text x="18" y="28" className="string-diagram-heading">
              {name}
            </text>
            <text x="18" y="50">
              {twists} across the top
            </text>
            <path d="M72 92h134v46H72z" fill="#aa815b" stroke="#594638" strokeWidth="2" />
            <path
              d="M22 113h193q12 0 10-12q-1-10-19-10H87q-10 0-13 15"
              fill="none"
              stroke="#424e4c"
              strokeWidth={i ? 3 : 5}
            />
            <path
              d={i ? 'M105 83l12 16m15-16 12 16m15-16 12 16' : 'M111 83l13 16m24-16 14 16'}
              stroke="#b45225"
              strokeWidth="4"
            />
            <path
              d="M181 85q17 3 25 10v15q5 9 22 14"
              stroke="#b45225"
              strokeWidth="4"
              fill="none"
            />
            <circle cx="209" cy="113" r="7" fill="none" stroke="#263b36" strokeWidth="2" />
            <path d="M217 116l31 20" stroke="#263b36" strokeWidth="2" />
            <text x="153" y="159">
              Final tuck on back
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        Side view of the six-hole tie used here. Follow the short tail over the rear edge. The last
        tuck stays below that edge as the long string takes tension.
      </figcaption>
    </figure>
  );
}

function BassLength() {
  return (
    <figure className="string-line-diagram">
      <svg
        viewBox="0 0 650 145"
        role="img"
        aria-label="A bass string from ball to tuning post. Full winding continues past the nut, then the string tapers before wrapping on the post in this example."
      >
        <path d="M46 64h426" stroke="#636762" strokeWidth="10" />
        <path d="M468 64l25 1h91" stroke="#86502b" strokeWidth="4" fill="none" />
        <circle cx="43" cy="64" r="13" fill="#b78c53" stroke="#403a30" strokeWidth="3" />
        <circle cx="43" cy="64" r="4" fill="#f5f2e9" />
        <path d="M378 72h16v20h-16z" fill="#a28a73" />
        <rect
          x="578"
          y="44"
          width="24"
          height="50"
          rx="5"
          fill="#b7c7bf"
          stroke="#43574a"
          strokeWidth="2"
        />
        <path
          d="M580 65q22 5 21 8t-22 3m0 1q21 5 22 7"
          stroke="#86502b"
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M43 28v16m342-16v27m86-27v27m118-27v12"
          stroke="#5f6961"
          strokeWidth="2"
          fill="none"
        />
        <text x="20" y="23">
          Ball
        </text>
        <text x="367" y="23">
          Nut
        </text>
        <text x="440" y="23">
          Taper
        </text>
        <text x="546" y="23">
          First wrap
        </text>
        <path d="M43 100v10h343v-10" stroke="#4d665e" strokeWidth="2" fill="none" />
        <text x="73" y="135">
          Measure ball to nut on the old string
        </text>
      </svg>
      <figcaption>
        Example of a headstock-end taper. The full winding spans the nut. Check where your string
        maker places the taper for your particular set and post.
      </figcaption>
    </figure>
  );
}

function ViolaMeasurement({ photo, renderPhoto }) {
  return (
    <div className="string-ruler-photo">
      {renderPhoto(photo)}
      <svg viewBox="0 0 750 454" aria-hidden="true" focusable="false">
        <path d="M71 207v-72l620-21v72" stroke="#162620" strokeWidth="6" fill="none" />
        <path d="M71 207v-72l620-21v72" stroke="#ffe7a3" strokeWidth="3" fill="none" />
        <circle cx="71" cy="217" r="7" fill="#ffe7a3" stroke="#162620" strokeWidth="2" />
        <circle cx="691" cy="194" r="7" fill="#ffe7a3" stroke="#162620" strokeWidth="2" />
        <rect x="18" y="92" width="191" height="32" rx="5" fill="#162620" />
        <text x="28" y="115">
          Zero at the nut
        </text>
        <rect x="474" y="69" width="245" height="32" rx="5" fill="#162620" />
        <text x="485" y="92">
          Read at the bridge
        </text>
      </svg>
    </div>
  );
}

function CelloReference() {
  const sounding = useRef(null);
  function handlePlay({ currentTarget: next }) {
    if (sounding.current && sounding.current !== next) sounding.current.pause();
    sounding.current = next;
  }
  return (
    <div className="string-pitch-pair">
      {[
        [220, 'Cello open A · A3'],
        [440, 'Violin open A · A4'],
      ].map(([hz, name]) => (
        <div key={hz}>
          <strong>{name}</strong>
          <p>{hz} Hz reference tone</p>
          <audio
            controls
            preload="none"
            onPlay={handlePlay}
            aria-label={name}
            src={'/audio/string-reference/a-' + hz + '.wav'}
          />
        </div>
      ))}
    </div>
  );
}

function Pair({ photos, labels, renderPhoto }) {
  return (
    <div className="string-photo-pair">
      {photos.map((photo, i) => (
        <div key={photo.src}>
          <strong>{labels[i]}</strong>
          {renderPhoto(photo)}
        </div>
      ))}
    </div>
  );
}

export default function StringLessonAid({ section, renderPhoto }) {
  if (!section.stringCheck) return null;
  const aid = section.stringAid;
  return (
    <>
      <details className="string-step-check">
        <summary>{section.stringCheck.question}</summary>
        <p>{section.stringCheck.answer}</p>
      </details>
      {aid === 'tar-courses' && <TarCourseCard />}
      {aid === 'select-tuner' && <TunerSelector />}
      {aid === 'tuner-methods' &&
        section.stringMethods.map(({ id, title, body }) => (
          <div className="string-wind-method" key={id} id={'electric-' + id}>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      {aid === 'tie-profile' && <TieProfile />}
      {aid === 'bass-winding-length' && <BassLength />}
      {aid === 'cello-octave' && <CelloReference />}
      {aid === 'violin-fittings' && (
        <Pair
          photos={violinStringChangePhotos['seat-the-tailpiece-end']}
          labels={['Ball-end E · forked fine tuner', 'Loop-end E · single hook']}
          renderPhoto={renderPhoto}
        />
      )}
      {aid === 'viola-ruler' && (
        <ViolaMeasurement photo={section.photos[0]} renderPhoto={renderPhoto} />
      )}
      {section.stringPhotoLabels && aid !== 'viola-ruler' && (
        <Pair
          photos={section.photos}
          labels={section.stringPhotoLabels}
          renderPhoto={renderPhoto}
        />
      )}
    </>
  );
}
