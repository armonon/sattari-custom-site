import { useRef } from 'react';
import './ChoiceHistoryAid.css';

const guides = '/images/guides/';
const met = 'https://www.metmuseum.org/art/collection/search/';
const tarConcert =
  'https://asia-archive.si.edu/podcast/masters-of-persian-musichossein-alizadeh-and-kayhan-kalhor/';
const tarFilm =
  'https://ich.unesco.org/en/RL/craftsmanship-and-performance-art-of-the-tar-a-long-necked-string-musical-instrument-00671';
const pejvakConcert =
  'https://asia-archive.si.edu/wp-content/uploads/2021/12/FS20100307_PejvakEnsemble_PODCAST.mp3';

function Card({ title, children, printable = false }) {
  const card = useRef(null);
  function printCard() {
    const element = card.current;
    element.setAttribute('data-choice-print', '');
    const restore = () => element.removeAttribute('data-choice-print');
    window.addEventListener('afterprint', restore, { once: true });
    window.print();
  }
  return (
    <aside className="choice-aid" ref={card} aria-label={title}>
      <div className="choice-aid-heading">
        <h3>{title}</h3>
        {printable && (
          <button type="button" onClick={printCard}>
            Print this card
          </button>
        )}
      </div>
      {children}
    </aside>
  );
}

function ListeningExample({ src, label }) {
  return (
    <div className="choice-audio">
      <span>{label}</span>
      <audio controls preload="none" aria-label={label} src={src}>
        <a href={src}>Open the audio example</a>
      </audio>
    </div>
  );
}

function ViolinTrial() {
  const prompts = [
    'Size and model',
    'Reach to the fourth finger',
    'First quiet bow stroke',
    'What I heard across the room',
    'First-term cost and what it covers',
  ];
  return (
    <Card title="Your two-violin comparison card" printable>
      <p>
        Enter a short observation for each violin or print a blank card. Use the same player, room
        and bow for the listening pass.
      </p>
      <div className="choice-worksheet">
        <table>
          <thead>
            <tr>
              <th scope="col">Trial check</th>
              <th scope="col">Violin A</th>
              <th scope="col">Violin B</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((prompt) => (
              <tr key={prompt}>
                <th scope="row">{prompt}</th>
                {['A', 'B'].map((id) => (
                  <td key={id}>
                    <input aria-label={prompt + ', violin ' + id} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ViolaFit() {
  return (
    <Card title="Viola fitting card" printable>
      <svg
        viewBox="0 0 460 124"
        role="img"
        aria-label="Two measurement diagrams. For the back, measure from the upper edge beside the button to the center of the lower edge. For playing length, measure from the nut to the bridge."
      >
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M26 35 Q32 18 48 22 Q59 25 66 31 Q73 35 81 30 Q90 22 99 25 Q114 29 116 48 Q114 68 99 71 Q89 75 81 66 Q73 60 66 65 Q57 73 48 74 Q30 74 26 61 Q21 49 26 35Z" />
          <path d="M114 44h9v8h-9M25 49H113" strokeDasharray="4 3" />
          <path d="M25 83v13m0-6h89m0-7v13" />
          <path d="M238 37h179m-179 9h179m-179 9h179m-179 9h179M247 34v32m148-34 5 35m-153 15v14m0-7h153m0-8v15" />
        </g>
        <g fill="currentColor" fontFamily="sans-serif" fontSize="13">
          <text x="25" y="114">
            Back length
          </text>
          <text x="235" y="23">
            Nut
          </text>
          <text x="375" y="23">
            Bridge
          </text>
          <text x="248" y="114">
            Vibrating string length
          </text>
        </g>
      </svg>
      <p>
        Use a flexible tape on the back, excluding the projecting button. Measure the open string
        along its speaking length. Ask the player to try first position while the teacher observes
        both hands.
      </p>
      <div className="choice-fields">
        {[
          'Back length and unit',
          'Vibrating string length and unit',
          'First-position reach and comfort',
        ].map((label) => (
          <label key={label}>
            {label}
            <input />
          </label>
        ))}
      </div>
    </Card>
  );
}

function TwoClefs() {
  return (
    <Card title="Find the same open D in two clefs">
      <svg
        viewBox="0 0 500 123"
        role="img"
        aria-label="Treble clef D4 is in the space below the bottom line. Alto clef D4 is in the space just above the middle line. Both notes sound the same."
      >
        {[0, 250].map((x) => (
          <g key={x} transform={'translate(' + x + ' 0)'}>
            {[37, 47, 57, 67, 77].map((y) => (
              <path
                key={y}
                d={'M12 ' + y + 'H228'}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            ))}
            <g fill="currentColor" fontSize="16" fontFamily="sans-serif">
              <text x="12" y="22">
                {x ? 'Viola · alto clef' : 'Violin · treble clef'}
              </text>
              <text x="105" y="112">
                D4
              </text>
            </g>
          </g>
        ))}
        <g stroke="currentColor" fill="none" strokeWidth="3" strokeLinecap="round">
          <path d="M46 67C34 72 29 56 39 47C49 38 57 26 51 22C45 20 42 36 46 55L51 83C53 93 44 96 40 91C37 87 43 84 45 88M36 61C35 48 54 47 55 59C56 67 48 72 41 67" />
          <path d="M273 37v40m5-40v40m7-38q18-5 12 8q-2 5-12 10q10 4 12 10q6 14-12 10m-3-23 5 3-5 3" />
        </g>
        <g fill="currentColor">
          <ellipse cx="119" cy="82" rx="7" ry="4.5" transform="rotate(-18 119 82)" />
          <ellipse cx="369" cy="52" rx="7" ry="4.5" transform="rotate(-18 369 52)" />
        </g>
        <g stroke="currentColor" strokeWidth="2">
          <path d="M125 81V51M363 53v31" />
        </g>
      </svg>
      <ListeningExample
        src="/audio/guide-references/open-d4.wav"
        label="Play the shared pitch · synthesized D4 reference"
      />
    </Card>
  );
}

function Headphones() {
  const routes = [
    [
      'Passive instrument output',
      [
        'Pickup',
        'Instrument input on a headphone amp or interface',
        'Headphone output',
        'Wired headphones',
      ],
    ],
    [
      'Dedicated headphone system',
      ['Violin or model-specific control box', 'Powered headphone output', 'Wired headphones'],
    ],
  ];
  return (
    <Card title="Trace the signal to your headphones">
      {routes.map(([label, stages]) => (
        <div className="choice-route" key={label}>
          <h4>{label}</h4>
          <ol>
            {stages.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>
        </div>
      ))}
    </Card>
  );
}

function AcousticFit() {
  return (
    <Card title="One string, two body sizes">
      <div className="choice-bands">
        {[
          ['E', 'High E open'],
          ['F', 'First fret'],
          ['G', 'Third fret'],
        ].map(([n, f]) => (
          <div key={n}>
            <strong>{n}</strong>
            <small>{f}</small>
          </div>
        ))}
      </div>
      <p>
        Sit in the same chair for both trials. On the smaller guitar, play E–F–G with the fretting
        elbow loose. On the deeper guitar, repeat at the same tempo. Record which body lets the
        picking shoulder stay down and which neck makes the first fret easiest to reach.
      </p>
    </Card>
  );
}

function PickupTest() {
  return (
    <Card title="The one-minute clean-amp pickup test">
      <div className="choice-route">
        <h4>Find these controls first</h4>
        <ol>
          {[
            'Neck pickup beside the fretboard',
            'Pickup selector',
            'Bridge pickup beside the bridge',
            'Volume and tone controls',
          ].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>
      <dl className="choice-timeline">
        <div>
          <dt>0–15 seconds</dt>
          <dd>
            Set the amp clean with effects off. Select the neck pickup and play four even notes on
            one string.
          </dd>
        </div>
        <div>
          <dt>15–30 seconds</dt>
          <dd>
            Switch to the bridge pickup. Repeat at a similar listening level and listen for the
            leading edge of each note.
          </dd>
        </div>
        <div>
          <dt>30–45 seconds</dt>
          <dd>
            Try a combined position if available. Play two adjacent open strings together and listen
            for both pitches.
          </dd>
        </div>
        <div>
          <dt>45–60 seconds</dt>
          <dd>
            Mute the strings, listen to the noise floor and turn the tone control. Repeat the
            passage on the second guitar with the same amp.
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function BassGroove() {
  return (
    <Card title="Two bars to test bass muting">
      <p>
        Count four beats per bar at 80 BPM. Each note lasts one beat. Lift or damp it as the next
        beat starts, then leave that beat silent.
      </p>
      <div className="choice-bars">
        {[
          ['Bar 1', 'E1'],
          ['Bar 2', 'A1'],
        ].map(([bar, note]) => (
          <div key={bar}>
            <h4>{bar}</h4>
            <div className="choice-bands">
              {[1, 2, 3, 4].map((beat) => (
                <div key={beat}>
                  <small>Beat {beat}</small>
                  <strong>{beat % 2 ? note : 'Rest'}</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ListeningExample
        src="/audio/guide-references/bass-e-a-rests.wav"
        label="Play the two bars · synthesized bass reference"
      />
    </Card>
  );
}

function StringCores() {
  return (
    <Card title="Read a classical bridge and two wound strings">
      <figure className="choice-bridge">
        <a
          className="choice-marked-photo"
          href={guides + 'classical-string-change/identify-the-tie-block.webp'}
        >
          <img
            src={guides + 'classical-string-change/identify-the-tie-block.webp'}
            loading="lazy"
            width="802"
            height="740"
            alt="Classical bridge with the plain treble strings 1–3 toward the upper right and the wound bass strings 4–6 toward the lower left."
          />
          <svg aria-hidden="true" focusable="false" viewBox="0 0 802 740">
            <g fill="none" strokeLinejoin="round">
              <path
                d="M685 110L575 110L470 200 M122 445L172 445L310 335"
                stroke="#fff"
                strokeWidth="14"
              />
              <path
                d="M685 110L575 110L470 200 M122 445L172 445L310 335"
                stroke="#173d35"
                strokeWidth="6"
              />
            </g>
            <g fill="#173d35">
              <rect x="631" y="64" width="142" height="75" rx="10" />
              <rect x="26" y="406" width="142" height="75" rx="10" />
            </g>
            <g
              fill="white"
              textAnchor="middle"
              fontFamily="sans-serif"
              fontSize="55"
              fontWeight="700"
            >
              <text x="702" y="120">
                1–3
              </text>
              <text x="97" y="461">
                4–6
              </text>
            </g>
          </svg>
        </a>
        <figcaption>
          <strong>Strings 1–3</strong> are the usual plain synthetic trebles, high E, B and G.{' '}
          <strong>Strings 4–6</strong> are wound D, A and low E on a typical classical set. Photo by
          Sattari Music.
        </figcaption>
      </figure>
      <svg
        viewBox="0 0 500 119"
        role="img"
        aria-label="Two magnified cross sections. The outer winding encloses a bundle of synthetic fibres in a typical classical bass string and a solid steel core in a steel-string acoustic bass."
      >
        {[69, 305].map((x) => (
          <g key={x}>
            <circle cx={x} cy="58" r="34" fill="#cf8854" stroke="#4b382a" strokeWidth="2" />
            <circle
              cx={x}
              cy="58"
              r="24"
              fill={x === 69 ? '#ece4c8' : '#7e949c'}
              stroke="#4b382a"
              strokeWidth="2"
            />
          </g>
        ))}
        {[
          [0, 0],
          [-12, -7],
          [0, -14],
          [12, -7],
          [-12, 8],
          [0, 14],
          [12, 8],
        ].map(([dx, dy]) => (
          <circle
            key={dx + ',' + dy}
            cx={69 + dx}
            cy={58 + dy}
            r="5.5"
            fill="#a28c61"
            stroke="#554834"
            strokeWidth="1"
          />
        ))}
        <g fill="currentColor" fontFamily="sans-serif" fontSize="15">
          <text x="112" y="53">
            Fiber bundle
          </text>
          <text x="112" y="74">
            Metal wrap
          </text>
          <text x="349" y="53">
            Steel core
          </text>
          <text x="349" y="74">
            Metal wrap
          </text>
          <text x="12" y="110">
            Classical bass
          </text>
          <text x="253" y="110">
            Steel-string acoustic bass
          </text>
        </g>
      </svg>
    </Card>
  );
}

function TarEvidence() {
  return (
    <Card title="Three places to study the tar">
      <div className="choice-object">
        <a href={met + '502242'}>
          <img
            src={guides + 'persian-tar.webp'}
            width="671"
            height="840"
            loading="lazy"
            alt="The Met’s late nineteenth-century Iranian tar with its membrane-covered body."
          />
        </a>
        <dl className="choice-timeline">
          <div>
            <dt>Late nineteenth century · Iran</dt>
            <dd>
              Find the narrow waist between two skin-covered lobes on object 89.4.1679.{' '}
              <a href={met + '502242'}>The Met, public-domain photograph</a>
            </dd>
          </div>
          <div>
            <dt>March 1997 · Iranian classical performance</dt>
            <dd>
              Hear Hossein Alizadeh carry a phrase through repeated plucks.{' '}
              <a href={tarConcert}>Smithsonian concert recording</a>
            </dd>
          </div>
          <div>
            <dt>2012 inscription · Azerbaijan</dt>
            <dd>
              Watch a maker work on the body and a musician hold the tar at the chest.{' '}
              <a href={tarFilm}>UNESCO film and inscription</a>
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

function GuitarTimeline() {
  return (
    <Card title="Three guitars in museum collections">
      <dl className="choice-timeline">
        <div>
          <dt>About 1630–50 · Venice</dt>
          <dd>
            <a href={met + '503385'}>Guitar attributed to Matteo Sellas</a>. Originally five
            courses. Later alterations included five single strings.
          </dd>
        </div>
        <div>
          <dt>1924 · Madrid</dt>
          <dd>
            <a href={met + '742642'}>Santos Hernández flamenco guitar</a>. Six single strings run to
            a bridge on the spruce soundboard.
          </dd>
        </div>
        <div>
          <dt>About 1934 · Los Angeles</dt>
          <dd>
            <a href={met + '729575'}>Rickenbacker A-22 Hawaiian guitar</a>. Six metal strings pass
            through a horseshoe pickup. A steel bar moves over them as the guitar lies across the
            player’s lap.
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function LutePhotos() {
  return (
    <Card title="Identify the body, picking hand and pegs">
      <div className="choice-photo-strip">
        <figure>
          <a href={guides + 'persian-tar.webp'}>
            <img
              src={guides + 'persian-tar.webp'}
              width="671"
              height="840"
              alt="Iranian tar with a narrow waist between two skin-covered lobes."
              loading="lazy"
            />
          </a>
          <figcaption>
            <strong>Tar · soundboard</strong> Follow the pale membrane across both lobes.{' '}
            <a href={met + '502242'}>The Met, public domain</a>.
          </figcaption>
        </figure>
        <figure>
          <a href={guides + 'setar-string-change/pluck-one-open-string.webp'}>
            <img
              src={guides + 'setar-string-change/pluck-one-open-string.webp'}
              width="1280"
              height="547"
              alt="A setar player’s picking hand poised beside the lower end of the fretted neck."
              loading="lazy"
            />
          </a>
          <figcaption>
            <strong>Setar · picking hand</strong> The index fingernail plucks where the neck
            approaches the wooden body.{' '}
            <a href="https://commons.wikimedia.org/w/index.php?curid=64843709">
              Mif.dang, design by Rajabian.co
            </a>
            , cropped, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
          </figcaption>
        </figure>
        <figure>
          <a href={guides + 'instrument-comparisons/miraj-sitar.webp'}>
            <img
              src={guides + 'instrument-comparisons/miraj-sitar.webp'}
              width="428"
              height="850"
              alt="Miraj sitar with large head pegs and a line of smaller tuning pegs along the side of the neck."
              loading="lazy"
            />
          </a>
          <figcaption>
            <strong>Sitar · side pegs</strong> Look along the neck for the smaller pegs that tune
            the sympathetic strings.{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Sitar_full.jpg">
              Jan Kraus, public domain
            </a>
            .
          </figcaption>
        </figure>
      </div>
    </Card>
  );
}

function Pejvak() {
  return (
    <Card title="Play from a marked entrance">
      <dl className="choice-timeline">
        {[
          [
            451,
            '7:31',
            'Tar and tombak',
            'Listen for the plucked pitch above the hand-drum strokes.',
          ],
          [
            941,
            '15:41',
            'Santur',
            'Follow one high struck note as it rings underneath the next attack.',
          ],
          [
            1556,
            '25:56',
            'Tombak',
            'Hear the contrast between the lower and higher strokes on one hand drum.',
          ],
        ].map(([seconds, time, name, note]) => (
          <div key={seconds}>
            <dt>
              <a href={pejvakConcert + '#t=' + seconds}>
                ▶ {time} · {name}
              </a>
            </dt>
            <dd>{note}</dd>
          </div>
        ))}
      </dl>
      <p>
        The links open the Smithsonian’s Pejvak Ensemble concert audio at the indicated time.{' '}
        <a href="https://asia-archive.si.edu/podcast/singing-rumi-the-pejvak-ensemble/">
          Read the program and performer credits.
        </a>
      </p>
    </Card>
  );
}

const aids = {
  violinTrial: ViolinTrial,
  violaFit: ViolaFit,
  twoClefs: TwoClefs,
  headphonePaths: Headphones,
  acousticFit: AcousticFit,
  pickupTest: PickupTest,
  bassGroove: BassGroove,
  stringCores: StringCores,
  tarEvidence: TarEvidence,
  guitarTimeline: GuitarTimeline,
  lutePhotos: LutePhotos,
  pejvak: Pejvak,
};
export default function ChoiceHistoryAid({ name }) {
  const Aid = aids[name];
  return Aid ? <Aid /> : null;
}
